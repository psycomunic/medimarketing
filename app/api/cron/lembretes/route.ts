import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient, adminDisponivel } from "@/lib/supabase/admin";
import {
  estruturaPronta,
  getDevidas,
  gerarPendentes,
} from "@/lib/supabase/confirmacoes";
import { agendarWhatsApp, envioAutomatico, whatsappConfigurado } from "@/lib/envio";
import { mergeConfigurado } from "@/lib/merge";
import {
  diaDaSemana,
  formatarData,
  formatarHora,
  montarMensagem,
  urlConfirmacao,
} from "@/lib/lembretes";
import { emailConfigurado, enviarEmail } from "@/lib/email";
import { emailPacienteLembrete } from "@/lib/email-modelos";
import { marcaDaClinica } from "@/lib/supabase/destinatarios";

/**
 * ROTINA DE LEMBRETES — chamada pelo Vercel Cron (ver vercel.json).
 *
 * Faz duas coisas a cada passada:
 *   1. cria a confirmação das consultas novas, com o disparo já datado;
 *   2. envia o que venceu.
 *
 * Roda uma vez por dia (ver vercel.json). O plano Hobby da Vercel não
 * aceita cron mais frequente, e um agendamento fora do permitido faz a
 * plataforma recusar o deploy inteiro — não é só o cron que para.
 *
 * Por isso o corte é o fim do dia, e não "agora": a passada da manhã
 * envia tudo que vence hoje. A mensagem sai algumas horas antes do
 * horário escolhido pela clínica, nunca depois. Com o plano Pro, mudar
 * o schedule para "0 * * * *" faz o horário ser respeitado na hora.
 *
 * Sem as credenciais do WhatsApp nada falha: a confirmação continua
 * pendente e a recepção dispara pelo painel.
 */

// A rotina lê o relógio e escreve no banco: nunca pode ser cacheada
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Janela de geração: consultas até 30 dias à frente. */
const HORIZONTE_DIAS = 30;
/** Depois de 3 falhas, para de insistir e deixa para a recepção. */
const MAX_TENTATIVAS = 3;

function autorizado(req: NextRequest): boolean {
  const segredo = process.env.CRON_SECRET;

  // Sem segredo configurado, só aceitamos a chamada do próprio Vercel Cron
  if (!segredo) return !!req.headers.get("x-vercel-cron");

  return req.headers.get("authorization") === `Bearer ${segredo}`;
}

export async function GET(req: NextRequest) {
  if (!autorizado(req)) {
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  }
  if (!adminDisponivel()) {
    return NextResponse.json(
      { erro: "SUPABASE_SERVICE_ROLE_KEY ausente" },
      { status: 503 }
    );
  }

  // Falha ruidosa: sem a estrutura no banco, a rotina não pode responder
  // "0 enviados" como se estivesse tudo bem.
  const estrutura = await estruturaPronta();
  if (!estrutura.pronta) {
    console.error("[cron/lembretes] Estrutura ausente:", estrutura.motivo);
    return NextResponse.json({ ok: false, erro: estrutura.motivo }, { status: 503 });
  }

  const admin = createAdminClient();
  const relatorio = {
    geradas: 0,
    enviadas: 0,
    porEmail: 0,
    semCanal: 0,
    semTelefone: 0,
    falhas: 0,
  };

  // 1) Confirmações para consultas que ainda não têm
  const ate = new Date();
  ate.setDate(ate.getDate() + HORIZONTE_DIAS);

  const { data: orgs } = await admin
    .from("organizations")
    .select("*")
    .eq("ativo", true)
    .eq("lembrete_ativo", true);

  for (const org of orgs ?? []) {
    relatorio.geradas += await gerarPendentes(org, ate);
  }

  // 2) Disparo do que venceu
  const devidas = await getDevidas();

  for (const c of devidas) {
    const { data: consulta } = await admin
      .from("consultas")
      .select("paciente_nome,paciente_telefone,paciente_email,data_hora,medico_id,status")
      .eq("id", c.consulta_id)
      .maybeSingle();

    // Cancelada entre a geração e o disparo: encerra sem enviar
    if (!consulta || consulta.status === "cancelada") {
      await admin
        .from("confirmacoes")
        .update({ status: "cancelado" })
        .eq("id", c.id);
      continue;
    }

    const { data: medico } = await admin
      .from("profiles")
      .select("nome")
      .eq("id", consulta.medico_id)
      .maybeSingle();

    const texto = montarMensagem({
      paciente: consulta.paciente_nome,
      dataHora: consulta.data_hora,
      medico: medico?.nome ?? null,
      clinica: c.organizacao.nome,
      endereco: [c.organizacao.endereco, c.organizacao.cidade].filter(Boolean).join(" — ") || null,
      link: urlConfirmacao(c.token),
      modelo: c.organizacao.mensagem_lembrete,
    });

    // O lembrete também vai por e-mail quando há endereço. Não
    // substitui o WhatsApp — é o mesmo pedido por outro caminho, para
    // o paciente que lê e-mail e não vê mensagem.
    if (emailConfigurado() && consulta.paciente_email) {
      const marca = await marcaDaClinica(c.organization_id);
      if (marca) {
        const modelo = emailPacienteLembrete(marca, {
          paciente: consulta.paciente_nome,
          data: formatarData(consulta.data_hora),
          hora: formatarHora(consulta.data_hora),
          diaSemana: diaDaSemana(consulta.data_hora),
          medico: medico?.nome ?? null,
          endereco:
            [c.organizacao.endereco, c.organizacao.cidade].filter(Boolean).join(" — ") ||
            null,
          link: urlConfirmacao(c.token),
        });
        const r = await enviarEmail({
          para: consulta.paciente_email,
          assunto: modelo.assunto,
          html: modelo.html,
          texto: modelo.texto,
          remetenteNome: marca.clinica,
        });
        if (r.enviado) relatorio.porEmail++;
      }
    }

    if (!consulta.paciente_telefone) {
      relatorio.semTelefone++;
      continue;
    }

    const conexaoId = c.organizacao.merge_connection_id ?? null;

    if (!envioAutomatico(conexaoId)) {
      relatorio.semCanal++;
      continue;
    }

    // Pelo Merge a mensagem é programada para a hora que a clínica
    // escolheu, mesmo que esta passada seja de manhã. Pela Cloud API
    // não há agendamento: sai agora, algumas horas mais cedo.
    const res = await agendarWhatsApp(
      {
        nome: consulta.paciente_nome,
        telefone: consulta.paciente_telefone,
        conexaoId,
      },
      texto,
      new Date(c.agendado_para)
    );

    if (res.enviado) {
      await admin
        .from("confirmacoes")
        .update({
          status: "enviado",
          enviado_em: new Date().toISOString(),
          canal: res.canal,
          tentativas: c.tentativas + 1,
        })
        .eq("id", c.id);
      relatorio.enviadas++;
    } else {
      const tentativas = c.tentativas + 1;
      await admin
        .from("confirmacoes")
        .update({
          tentativas,
          observacao:
            tentativas >= MAX_TENTATIVAS
              ? `Falhou ${tentativas}x no envio automático. Envie pelo painel.`
              : `Última falha: ${res.motivo}`,
        })
        .eq("id", c.id);
      relatorio.falhas++;
    }
  }

  return NextResponse.json({
    ok: true,
    em: new Date().toISOString(),
    canalAutomatico: mergeConfigurado()
      ? "merge (número da própria clínica)"
      : whatsappConfigurado()
        ? "whatsapp (número da plataforma)"
        : "nenhum (envio manual pelo painel)",
    ...relatorio,
  });
}
