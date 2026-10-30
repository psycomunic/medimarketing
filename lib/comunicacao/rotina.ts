import "server-only";
import { sincronizarMidia } from "@/lib/marketing/sincronizar";
import { processarDisparos } from "@/lib/disparos";
import { gerarMensalidades } from "@/lib/financeiro/rotina";

import { createAdminClient, adminDisponivel } from "@/lib/supabase/admin";
import { getDevidas, gerarPendentes } from "@/lib/supabase/confirmacoes";
import { emailConfigurado } from "@/lib/email";
import { envioAutomatico } from "@/lib/envio";
import { emailAgendaDoDia, emailEquipe, emailPacienteLembrete, type ItemAgenda } from "@/lib/email-modelos";
import { msgAgendaDoDia } from "@/lib/mensagens";
import {
  diaDaSemana,
  diaEmBrasilia,
  diaRelativo,
  formatarData,
  formatarHora,
  horaEmBrasilia,
  limitesDoDia,
  montarMensagem,
  proximoDiaUtil,
  urlConfirmacao,
  urlPainel,
} from "@/lib/lembretes";
import { avisarEquipe, clinicaParaEnvio, membrosDaClinica } from "@/lib/comunicacao/equipe";
import { canaisEfetivos } from "@/lib/comunicacao/eventos";
import { enfileirar, processarFila, type ItemFila, type RelatorioFila } from "@/lib/comunicacao/fila";

/**
 * ROTINA DE COMUNICAÇÃO
 *
 * Chamada a cada 10 minutos pelo Supabase (pg_cron) e uma vez por dia
 * pelo cron da Vercel, de reserva. Cada passada:
 *
 *   1. cria a confirmação das consultas novas (com a hora do lembrete);
 *   2. põe na fila os lembretes que venceram;
 *   3. de manhã, o resumo da agenda de cada profissional;
 *   4. à tarde, o alerta de quem ainda não confirmou o próximo dia útil;
 *   5. entrega o que está na fila e tenta de novo o que falhou.
 *
 * Tudo é idempotente: rodar duas vezes seguidas não manda nada duas
 * vezes, porque cada mensagem tem uma chave única na fila.
 */

const HORIZONTE_DIAS = 30;
/** Alerta de pendentes: a partir das 15h, até as 20h. */
const HORA_VESPERA = 15;
/** O resumo só sai até 3 horas depois da hora escolhida. */
const JANELA_RESUMO_H = 3;

export type RelatorioRotina = {
  confirmacoesCriadas: number;
  lembretes: number;
  resumos: number;
  alertasVespera: number;
  mensalidades: number;
  disparos: number;
  /** Linhas (campanha × dia) trazidas do Meta Ads. */
  midia: number;
  fila: RelatorioFila;
};

export async function rodarRotina(): Promise<RelatorioRotina> {
  const relatorio: RelatorioRotina = {
    confirmacoesCriadas: 0,
    lembretes: 0,
    resumos: 0,
    alertasVespera: 0,
    mensalidades: 0,
    disparos: 0,
    midia: 0,
    fila: { enviados: 0, falhas: 0, ignorados: 0 },
  };
  if (!adminDisponivel()) return relatorio;

  const admin = createAdminClient();
  const { data: orgs } = await admin.from("organizations").select("*").eq("ativo", true);

  // 1) Confirmações das consultas que ainda não têm
  const ate = new Date(Date.now() + HORIZONTE_DIAS * 86_400_000);
  for (const org of orgs ?? []) {
    if (!org.lembrete_ativo) continue;
    relatorio.confirmacoesCriadas += await gerarPendentes(org, ate);
  }

  // Cada etapa isolada: uma falha não pode calar as outras
  const etapas: [keyof RelatorioRotina, () => Promise<number>][] = [
    ["lembretes", enfileirarLembretes],
    ["resumos", () => resumosDoDia((orgs ?? []).map((o) => o.id))],
    ["alertasVespera", () => alertasDeVespera((orgs ?? []).map((o) => o.id))],
    ["mensalidades", gerarMensalidades],
    // Campanhas: programa só o que vence nos próximos minutos
    ["disparos", processarDisparos],
    // Mídia: números das contas de anúncio ligadas às clínicas
    ["midia", sincronizarMidia],
  ];
  for (const [nome, etapa] of etapas) {
    try {
      (relatorio[nome] as number) = await etapa();
    } catch (e) {
      console.error(`[rotina/${nome}]`, e instanceof Error ? e.message : e);
    }
  }

  relatorio.fila = await processarFila();
  return relatorio;
}

/* ------------------------------------------------------------------ */
/* Lembrete do paciente                                                */
/* ------------------------------------------------------------------ */

async function enfileirarLembretes(): Promise<number> {
  const admin = createAdminClient();
  const devidas = await getDevidas(new Date().toISOString());
  let total = 0;

  for (const c of devidas) {
    const { data: consulta } = await admin
      .from("consultas")
      .select("paciente_nome,paciente_telefone,paciente_email,data_hora,medico_id,status")
      .eq("id", c.consulta_id)
      .maybeSingle();

    const agora = new Date().toISOString();

    // Cancelada ou já passou: encerra sem enviar
    if (!consulta || consulta.status === "cancelada" || consulta.data_hora < agora) {
      await admin
        .from("confirmacoes")
        .update({
          status: "cancelado",
          enfileirado_em: agora,
          observacao: consulta && consulta.status !== "cancelada" ? "O horário passou antes do lembrete." : c.observacao,
        })
        .eq("id", c.id);
      continue;
    }

    const org = c.organizacao;
    const { data: medico } = await admin.from("profiles").select("nome").eq("id", consulta.medico_id).maybeSingle();
    const endereco = [org.endereco, org.cidade].filter(Boolean).join(", ") || null;
    const link = urlConfirmacao(c.token);
    const conexaoId = org.merge_connection_id ?? null;

    const itens: ItemFila[] = [];
    const comum = {
      organizationId: c.organization_id,
      evento: "lembrete_paciente",
      publico: "paciente" as const,
      destinoNome: consulta.paciente_nome,
      consultaId: c.consulta_id,
      confirmacaoId: c.id,
    };
    // A chave leva a hora do disparo: remarcou, é outro lembrete
    const chave = `lembrete:${c.id}:${c.agendado_para}`;

    if (consulta.paciente_telefone && envioAutomatico(conexaoId)) {
      itens.push({
        ...comum,
        canal: "whatsapp",
        destino: consulta.paciente_telefone,
        conteudo: montarMensagem({
          paciente: consulta.paciente_nome,
          dataHora: consulta.data_hora,
          medico: medico?.nome ?? null,
          clinica: org.nome,
          endereco,
          link,
          modelo: org.mensagem_lembrete,
        }),
        payload: { conexaoId },
        chave: `${chave}:whatsapp`,
      });
    }

    if (consulta.paciente_email && emailConfigurado()) {
      const m = emailPacienteLembrete(
        { clinica: org.nome, logoUrl: org.logo_url, emailClinica: org.email, telefoneClinica: org.telefone },
        {
          paciente: consulta.paciente_nome,
          data: formatarData(consulta.data_hora),
          hora: formatarHora(consulta.data_hora),
          diaSemana: diaDaSemana(consulta.data_hora),
          medico: medico?.nome ?? null,
          endereco,
          link,
          quando: diaRelativo(consulta.data_hora),
        }
      );
      itens.push({
        ...comum,
        canal: "email",
        destino: consulta.paciente_email,
        assunto: m.assunto,
        conteudo: m.texto,
        payload: { html: m.html, remetenteNome: org.nome },
        chave: `${chave}:email`,
      });
    }

    await admin
      .from("confirmacoes")
      .update({
        enfileirado_em: agora,
        ...(itens.length
          ? {}
          : {
              observacao: consulta.paciente_telefone
                ? "Sem WhatsApp conectado: envie pelo painel."
                : "Paciente sem telefone e sem e-mail.",
            }),
      })
      .eq("id", c.id);

    await enfileirar(itens);
    total += itens.length ? 1 : 0;
  }

  return total;
}

/* ------------------------------------------------------------------ */
/* Resumo da agenda do dia                                             */
/* ------------------------------------------------------------------ */

const SITUACAO: Record<string, string> = {
  confirmado: "confirmou",
  enviado: "aguardando resposta",
  reagendar: "pediu para remarcar",
  pendente: "lembrete ainda não enviado",
};

async function resumosDoDia(orgIds: string[]): Promise<number> {
  const hora = horaEmBrasilia();
  const dia = diaEmBrasilia();
  const { inicio, fim } = limitesDoDia(dia);
  const admin = createAdminClient();
  let total = 0;

  for (const orgId of orgIds) {
    const { data: consultas } = await admin
      .from("consultas")
      .select("id,medico_id,paciente_nome,data_hora,status,tipo")
      .eq("organization_id", orgId)
      .gte("data_hora", inicio.toISOString())
      .lt("data_hora", fim.toISOString())
      .neq("status", "cancelada")
      .order("data_hora");
    if (!consultas?.length) continue;

    // Quem já recebeu hoje não entra de novo
    const { data: feitos } = await admin
      .from("envios")
      .select("usuario_id")
      .eq("organization_id", orgId)
      .eq("evento", "agenda_do_dia")
      .like("chave", `agenda:${dia}:%`);
    const jaFoi = new Set((feitos ?? []).map((f) => f.usuario_id));
    const medicos = [...new Set(consultas.map((c) => c.medico_id))].filter((m) => !jaFoi.has(m));
    if (!medicos.length) continue;

    const membros = await membrosDaClinica(orgId);
    const clinica = await clinicaParaEnvio(orgId);
    if (!clinica) continue;

    const { data: confs } = await admin
      .from("confirmacoes")
      .select("consulta_id,status")
      .in("consulta_id", consultas.map((c) => c.id));
    const statusConf = new Map((confs ?? []).map((c) => [c.consulta_id, c.status]));

    for (const medicoId of medicos) {
      const m = membros.find((x) => x.id === medicoId);
      if (!m) continue;
      if (hora < m.resumoHora || hora >= m.resumoHora + JANELA_RESUMO_H) continue;
      if (!canaisEfetivos("agenda_do_dia", m.role, true, m.canais).length) continue;

      const itens: ItemAgenda[] = consultas
        .filter((c) => c.medico_id === medicoId)
        .map((c) => ({
          hora: formatarHora(c.data_hora),
          paciente: c.paciente_nome,
          tipo: null,
          situacao:
            c.status === "confirmada"
              ? "confirmou"
              : c.status === "realizada"
                ? "atendido"
                : SITUACAO[statusConf.get(c.id) ?? ""] ?? "a confirmar",
        }));

      const painel = urlPainel("/app/agenda");
      const dados = { nome: m.nome, data: formatarData(inicio.toISOString()), diaSemana: diaDaSemana(inicio.toISOString()), itens, painel };

      total += await avisarEquipe({
        organizationId: orgId,
        evento: "agenda_do_dia",
        chave: `agenda:${dia}`,
        medicoId,
        somente: [medicoId],
        titulo: `Sua agenda de hoje: ${itens.length} consulta${itens.length === 1 ? "" : "s"}`,
        descricao: itens.map((i) => `${i.hora} ${i.paciente} (${i.situacao})`).join(" · "),
        href: "/app/agenda",
        tipoPainel: "agenda",
        whatsapp: msgAgendaDoDia(dados),
        email: emailAgendaDoDia(
          { clinica: clinica.nome, logoUrl: clinica.logo_url, emailClinica: clinica.email, telefoneClinica: clinica.telefone },
          dados
        ),
        membros,
        clinica,
      });
    }
  }

  return total;
}

/* ------------------------------------------------------------------ */
/* Véspera: quem ainda não confirmou                                   */
/* ------------------------------------------------------------------ */

async function alertasDeVespera(orgIds: string[]): Promise<number> {
  const hora = horaEmBrasilia();
  if (hora < HORA_VESPERA || hora >= 20) return 0;

  const alvo = proximoDiaUtil();
  const hoje = diaEmBrasilia();
  const { inicio, fim } = limitesDoDia(alvo);
  const admin = createAdminClient();
  let total = 0;

  for (const orgId of orgIds) {
    const { count: jaFoi } = await admin
      .from("envios")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .like("chave", `vespera:${hoje}:%`);
    if (jaFoi) continue;

    const { data: pendentes } = await admin
      .from("consultas")
      .select("id,paciente_nome,data_hora,paciente_telefone")
      .eq("organization_id", orgId)
      .eq("status", "pendente")
      .gte("data_hora", inicio.toISOString())
      .lt("data_hora", fim.toISOString())
      .order("data_hora");
    if (!pendentes?.length) continue;

    const clinica = await clinicaParaEnvio(orgId);
    if (!clinica) continue;

    const quando = diaRelativo(inicio.toISOString());
    const n = pendentes.length;
    const titulo = `${n} paciente${n === 1 ? "" : "s"} de ${quando} sem confirmação`;
    const lista = pendentes.map((p) => `${formatarHora(p.data_hora)} ${p.paciente_nome}`);
    const painel = urlPainel("/app/confirmacoes");

    total += await avisarEquipe({
      organizationId: orgId,
      evento: "pendentes_vespera",
      chave: `vespera:${hoje}`,
      titulo,
      descricao: `${lista.slice(0, 6).join(" · ")}${n > 6 ? ` e mais ${n - 6}` : ""}. Vale ligar ou reenviar o lembrete.`,
      href: "/app/confirmacoes",
      tipoPainel: "lembrete_atrasado",
      prioridade: "alta",
      whatsapp: [`*${titulo}*`, "", ...lista, "", `Confirmações: ${painel}`].join("\n"),
      email: emailEquipe(
        { clinica: clinica.nome, logoUrl: clinica.logo_url, emailClinica: clinica.email, telefoneClinica: clinica.telefone },
        {
          assunto: titulo,
          faixa: { texto: titulo, cor: "#B45309", fundo: "#FEF3C7" },
          frase: "Estes pacientes ainda não responderam ao lembrete:",
          dados: pendentes.map((p) => [formatarHora(p.data_hora), `${p.paciente_nome}${p.paciente_telefone ? ` · ${p.paciente_telefone}` : ""}`]),
          botao: { texto: "Abrir Confirmações", url: painel },
        }
      ),
      clinica,
    });
  }

  return total;
}
