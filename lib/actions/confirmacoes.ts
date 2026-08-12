"use server";

import { revalidatePath } from "next/cache";
import {
  bloqueio,
  contexto,
  OPERACIONAL,
  type ActionResult,
  type Contexto,
} from "@/lib/actions/contexto";
import { createAdminClient, adminDisponivel } from "@/lib/supabase/admin";
import { gerarToken } from "@/lib/supabase/confirmacoes";
import {
  calcularDisparo,
  diaDaSemana,
  formatarData,
  formatarHora,
  montarMensagem,
  urlConfirmacao,
} from "@/lib/lembretes";
import { enviarWhatsApp, envioAutomatico } from "@/lib/envio";
import { msgReagendada } from "@/lib/mensagens";
import { mergeConfigurado } from "@/lib/merge";
import { emailConfigurado, enviarEmail } from "@/lib/email";
import { emailPacienteRemarcada } from "@/lib/email-modelos";
import { marcaDaClinica } from "@/lib/supabase/destinatarios";
import type { Confirmacao, StatusConfirmacao } from "@/lib/supabase/types";

function revalidar() {
  revalidatePath("/app/confirmacoes");
  revalidatePath("/app/agenda");
}

/**
 * Confere se a confirmação pertence à clínica de quem está pedindo.
 *
 * A leitura usa a service role — a mesma que a página do paciente — e é
 * por isso que a checagem de clínica precisa ser explícita aqui.
 */
type Autorizado = {
  admin: ReturnType<typeof createAdminClient>;
  conf: Confirmacao;
  ctx: Extract<Contexto, { estado: "ok" }>;
};

async function autorizar(
  confirmacaoId: string
): Promise<Autorizado | { erro: ActionResult }> {
  const ctx = await contexto(OPERACIONAL);
  if (ctx.estado !== "ok") return { erro: bloqueio(ctx) };
  if (!adminDisponivel()) {
    return {
      erro: {
        ok: false,
        erro: "Falta a SUPABASE_SERVICE_ROLE_KEY para operar as confirmações.",
      },
    };
  }

  const admin = createAdminClient();
  const { data: conf } = await admin
    .from("confirmacoes")
    .select("*")
    .eq("id", confirmacaoId)
    .maybeSingle();

  if (!conf) return { erro: { ok: false, erro: "Confirmação não encontrada." } };

  if (
    ctx.profile.role !== "super_admin" &&
    conf.organization_id !== ctx.profile.organization_id
  ) {
    return { erro: { ok: false, erro: "Essa consulta não é da sua clínica." } };
  }

  return { admin, conf, ctx };
}

/**
 * Marca como enviado depois que a recepção disparou pelo WhatsApp.
 *
 * É o par do botão "Abrir no WhatsApp": o link `wa.me` leva o texto
 * pronto, mas quem aperta enviar é a pessoa — o sistema não tem como
 * saber, então ela confirma aqui.
 */
export async function marcarEnviado(id: string): Promise<ActionResult> {
  const r = await autorizar(id);
  if ("erro" in r) return r.erro;

  const { error } = await r.admin
    .from("confirmacoes")
    .update({
      status: "enviado",
      enviado_em: new Date().toISOString(),
      canal: "manual",
      tentativas: r.conf.tentativas + 1,
    })
    .eq("id", id);

  if (error) return { ok: false, erro: "Não foi possível marcar como enviado." };

  revalidar();
  return { ok: true };
}

/** Dispara agora pela API oficial, sem esperar o horário programado. */
export async function enviarAgora(id: string): Promise<ActionResult> {
  const r = await autorizar(id);
  if ("erro" in r) return r.erro;

  const { data: consulta } = await r.admin
    .from("consultas")
    .select("paciente_nome,paciente_telefone,data_hora,medico_id")
    .eq("id", r.conf.consulta_id)
    .maybeSingle();

  if (!consulta?.paciente_telefone) {
    return { ok: false, erro: "Esta consulta não tem telefone cadastrado." };
  }

  const [{ data: org }, { data: medico }] = await Promise.all([
    r.admin
      .from("organizations")
      .select("nome,endereco,cidade,mensagem_lembrete,merge_connection_id")
      .eq("id", r.conf.organization_id)
      .maybeSingle(),
    r.admin.from("profiles").select("nome").eq("id", consulta.medico_id).maybeSingle(),
  ]);

  const conexaoId = org?.merge_connection_id ?? null;

  if (!envioAutomatico(conexaoId)) {
    return {
      ok: false,
      erro: mergeConfigurado()
        ? "Esta clínica ainda não escolheu o número de WhatsApp em Configurações. Use o botão de envio manual."
        : "Envio automático não configurado. Use o botão de envio manual.",
    };
  }

  const texto = montarMensagem({
    paciente: consulta.paciente_nome,
    dataHora: consulta.data_hora,
    medico: medico?.nome ?? null,
    clinica: org?.nome ?? "a clínica",
    endereco: [org?.endereco, org?.cidade].filter(Boolean).join(" — ") || null,
    link: urlConfirmacao(r.conf.token),
    modelo: org?.mensagem_lembrete,
  });

  const envio = await enviarWhatsApp(
    {
      nome: consulta.paciente_nome,
      telefone: consulta.paciente_telefone,
      conexaoId,
    },
    texto
  );
  if (!envio.enviado) {
    return {
      ok: false,
      erro: `Não foi possível enviar (${envio.detalhe ?? envio.motivo}).`,
    };
  }

  await r.admin
    .from("confirmacoes")
    .update({
      status: "enviado",
      enviado_em: new Date().toISOString(),
      canal: envio.canal,
      tentativas: r.conf.tentativas + 1,
    })
    .eq("id", id);

  revalidar();
  return { ok: true };
}

/** Registra por fora a resposta que o paciente deu por telefone. */
export async function registrarResposta(
  id: string,
  status: StatusConfirmacao,
  observacao?: string
): Promise<ActionResult> {
  if (!["confirmado", "reagendar", "recusado", "pendente"].includes(status)) {
    return { ok: false, erro: "Status inválido." };
  }

  const r = await autorizar(id);
  if ("erro" in r) return r.erro;

  const { error } = await r.admin
    .from("confirmacoes")
    .update({
      status,
      respondido_em: status === "pendente" ? null : new Date().toISOString(),
      observacao: observacao?.trim() || r.conf.observacao,
    })
    .eq("id", id);

  if (error) return { ok: false, erro: "Não foi possível registrar a resposta." };

  // Mesma consequência da resposta pelo link, para a agenda não divergir
  if (status === "confirmado") {
    await r.admin
      .from("consultas")
      .update({ status: "confirmada" })
      .eq("id", r.conf.consulta_id);
  } else if (status === "recusado") {
    await r.admin
      .from("consultas")
      .update({ status: "cancelada" })
      .eq("id", r.conf.consulta_id);
  }

  revalidar();
  return { ok: true };
}

/**
 * Move a consulta para um novo horário e reabre a confirmação.
 *
 * É a saída do pedido de reagendamento: em vez de o atendente ir à
 * agenda, cancelar e recriar, ele resolve na mesma tela onde viu o
 * pedido. O token é mantido de propósito — a pessoa ainda tem a
 * mensagem antiga no WhatsApp, e abrir o mesmo link mostra a data nova.
 */
export async function reagendarConsulta(
  confirmacaoId: string,
  novaDataHora: string
): Promise<ActionResult> {
  const r = await autorizar(confirmacaoId);
  if ("erro" in r) return r.erro;

  const quando = new Date(novaDataHora);
  if (Number.isNaN(quando.getTime())) {
    return { ok: false, erro: "Data inválida." };
  }
  if (quando.getTime() <= Date.now()) {
    return { ok: false, erro: "Escolha um horário no futuro." };
  }

  const { error: erroConsulta } = await r.admin
    .from("consultas")
    .update({ data_hora: quando.toISOString(), status: "pendente" })
    .eq("id", r.conf.consulta_id);

  if (erroConsulta) {
    console.error("[confirmacoes] Erro ao reagendar:", erroConsulta.message);
    return { ok: false, erro: "Não foi possível mudar o horário." };
  }

  const { data: org } = await r.admin
    .from("organizations")
    .select("lembrete_dias_uteis,lembrete_hora")
    .eq("id", r.conf.organization_id)
    .maybeSingle();

  // A confirmação volta à estaca zero: horário novo, lembrete novo.
  const { error } = await r.admin
    .from("confirmacoes")
    .update({
      status: "pendente",
      agendado_para: calcularDisparo(
        quando,
        org?.lembrete_dias_uteis ?? 1,
        org?.lembrete_hora ?? 9
      ).toISOString(),
      enviado_em: null,
      respondido_em: null,
      canal: null,
      tentativas: 0,
      observacao: `Reagendada em ${new Date().toLocaleDateString("pt-BR")} a pedido do paciente.`,
    })
    .eq("id", confirmacaoId);

  if (error) {
    return {
      ok: false,
      erro: "Horário alterado, mas o lembrete não foi reprogramado.",
    };
  }

  // O paciente pediu para remarcar: avisar que foi atendido é o que
  // fecha o ciclo. Vai pelos dois canais — o WhatsApp é o que ele
  // realmente lê, o e-mail é o que fica guardado.
  const { data: consulta } = await r.admin
    .from("consultas")
    .select("paciente_nome,paciente_email,paciente_telefone,medico_id")
    .eq("id", r.conf.consulta_id)
    .maybeSingle();

  if (consulta) {
    const [marca, { data: medico }, { data: orgEnvio }] = await Promise.all([
      marcaDaClinica(r.conf.organization_id),
      r.admin.from("profiles").select("nome").eq("id", consulta.medico_id).maybeSingle(),
      r.admin
        .from("organizations")
        .select("nome,endereco,cidade,merge_connection_id")
        .eq("id", r.conf.organization_id)
        .maybeSingle(),
    ]);

    const dados = {
      paciente: consulta.paciente_nome,
      data: formatarData(quando.toISOString()),
      hora: formatarHora(quando.toISOString()),
      diaSemana: diaDaSemana(quando.toISOString()),
      medico: medico?.nome ?? null,
      link: urlConfirmacao(r.conf.token),
    };

    const avisos: Promise<unknown>[] = [];

    if (emailConfigurado() && consulta.paciente_email && marca) {
      const modelo = emailPacienteRemarcada(marca, dados);
      avisos.push(
        enviarEmail({
          para: consulta.paciente_email,
          assunto: modelo.assunto,
          html: modelo.html,
          texto: modelo.texto,
          remetenteNome: marca.clinica,
        })
      );
    }

    if (consulta.paciente_telefone && orgEnvio) {
      avisos.push(
        enviarWhatsApp(
          {
            nome: consulta.paciente_nome,
            telefone: consulta.paciente_telefone,
            conexaoId: orgEnvio.merge_connection_id ?? null,
          },
          msgReagendada({
            ...dados,
            clinica: orgEnvio.nome,
            endereco:
              [orgEnvio.endereco, orgEnvio.cidade].filter(Boolean).join(" — ") || null,
          })
        )
      );
    }

    // Nenhum aviso pode derrubar a remarcação que já foi feita
    await Promise.allSettled(avisos);
  }

  revalidar();
  revalidatePath("/app/notificacoes");
  return { ok: true };
}

/**
 * Cria a confirmação de uma consulta que ainda não tem.
 *
 * Serve para o caso de a consulta ter sido marcada depois da última
 * passada do cron e a recepção querer enviar já.
 */
export async function criarParaConsulta(consultaId: string): Promise<ActionResult> {
  const ctx = await contexto(OPERACIONAL);
  if (ctx.estado !== "ok") return bloqueio(ctx);
  if (!adminDisponivel()) {
    return { ok: false, erro: "Falta a SUPABASE_SERVICE_ROLE_KEY." };
  }

  const admin = createAdminClient();
  const { data: consulta } = await admin
    .from("consultas")
    .select("id,organization_id,data_hora")
    .eq("id", consultaId)
    .maybeSingle();

  if (!consulta?.organization_id) {
    return { ok: false, erro: "Consulta não encontrada." };
  }
  if (
    ctx.profile.role !== "super_admin" &&
    consulta.organization_id !== ctx.profile.organization_id
  ) {
    return { ok: false, erro: "Essa consulta não é da sua clínica." };
  }

  const { data: org } = await admin
    .from("organizations")
    .select("lembrete_dias_uteis,lembrete_hora")
    .eq("id", consulta.organization_id)
    .maybeSingle();

  const { error } = await admin.from("confirmacoes").insert({
    consulta_id: consulta.id,
    organization_id: consulta.organization_id,
    token: gerarToken(),
    agendado_para: calcularDisparo(
      new Date(consulta.data_hora),
      org?.lembrete_dias_uteis ?? 1,
      org?.lembrete_hora ?? 9
    ).toISOString(),
    canal: null,
    enviado_em: null,
    respondido_em: null,
    observacao: null,
  });

  if (error) {
    if (/duplicate|unique/i.test(error.message)) {
      return { ok: false, erro: "Esta consulta já tem uma confirmação." };
    }
    return { ok: false, erro: "Não foi possível criar a confirmação." };
  }

  revalidar();
  return { ok: true };
}
