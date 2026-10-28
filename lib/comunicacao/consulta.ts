import "server-only";

import { createAdminClient, adminDisponivel } from "@/lib/supabase/admin";
import { emailConfigurado } from "@/lib/email";
import { envioAutomatico } from "@/lib/envio";
import {
  emailClinicaCancelou,
  emailClinicaConfirmou,
  emailClinicaReagendar,
  emailEquipe,
  emailPacienteAgendada,
  emailPacienteCancelada,
  emailPacienteConfirmou,
  emailPacienteRemarcada,
  type MarcaEmail,
} from "@/lib/email-modelos";
import {
  msgAgendada,
  msgCancelada,
  msgEquipeCanceladaClinica,
  msgEquipeCancelou,
  msgEquipeConfirmou,
  msgEquipeNovaConsulta,
  msgEquipeReagendar,
  msgEquipeRemarcada,
  msgReagendada,
  type AvisoEquipe,
} from "@/lib/mensagens";
import {
  calcularDisparo,
  diaDaSemana,
  diaRelativo,
  formatarData,
  formatarHora,
  urlConfirmacao,
  urlPainel,
} from "@/lib/lembretes";
import { gerarToken } from "@/lib/supabase/confirmacoes";
import { avisarEquipe, clinicaParaEnvio, type ClinicaEnvio } from "@/lib/comunicacao/equipe";
import { cancelarPendentes, enfileirar, type ItemFila } from "@/lib/comunicacao/fila";
import type { EventoEquipe } from "@/lib/comunicacao/eventos";
import type { TipoNotificacao } from "@/lib/supabase/types";
import { rotuloTipo } from "@/lib/agenda";

const rotuloTipoConsulta = (t: string | null) =>
  t ? rotuloTipo[t as keyof typeof rotuloTipo] ?? t : null;

/**
 * O QUE CADA MUDANÇA NA AGENDA COMUNICA
 *
 * Um ponto só para todos os eventos de uma consulta: marcada, cancelada
 * pela clínica, remarcada e a resposta do paciente (pelo link ou
 * registrada por telefone). Cada um decide o que vai ao paciente e o
 * que vai à equipe; quem recebe na equipe e por qual canal é decidido
 * pelas preferências (ver eventos.ts).
 *
 * Tudo passa pela fila: fica registrado, não repete e tenta de novo.
 * Nunca lança — a mudança na agenda já foi salva e não pode ser
 * desfeita por uma mensagem que não saiu.
 */

export type EventoConsulta =
  | { tipo: "nova"; atorId: string | null; avisarPaciente?: boolean }
  | { tipo: "cancelada"; atorId: string | null; avisarPaciente: boolean }
  | { tipo: "remarcada"; atorId: string | null; anterior: string; token?: string | null }
  | {
      tipo: "resposta";
      resposta: "confirmado" | "reagendar" | "recusado";
      /** Nulo: o próprio paciente, pelo link. Preenchido: a equipe registrou. */
      atorId: string | null;
      token?: string | null;
    };

export async function comunicarConsulta(consultaId: string, ev: EventoConsulta): Promise<void> {
  if (!adminDisponivel()) return;
  try {
    await comunicar(consultaId, ev);
  } catch (e) {
    console.error("[comunicacao] Falha:", e instanceof Error ? e.message : e);
  }
}

async function comunicar(consultaId: string, ev: EventoConsulta): Promise<void> {
  const admin = createAdminClient();

  const { data: c } = await admin
    .from("consultas")
    .select(
      "id,organization_id,medico_id,paciente_nome,paciente_telefone,paciente_email,data_hora,tipo,convenio,status"
    )
    .eq("id", consultaId)
    .maybeSingle();
  if (!c?.organization_id) return;

  const [clinica, { data: org }, { data: medico }, { data: ator }] = await Promise.all([
    clinicaParaEnvio(c.organization_id),
    admin
      .from("organizations")
      .select("lembrete_ativo,lembrete_dias_uteis,lembrete_hora,ativo")
      .eq("id", c.organization_id)
      .maybeSingle(),
    admin.from("profiles").select("nome").eq("id", c.medico_id).maybeSingle(),
    ev.atorId
      ? admin.from("profiles").select("nome").eq("id", ev.atorId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  if (!clinica) return;

  const marca: MarcaEmail = {
    clinica: clinica.nome,
    logoUrl: clinica.logo_url,
    emailClinica: clinica.email,
    telefoneClinica: clinica.telefone,
  };
  const endereco = [clinica.endereco, clinica.cidade].filter(Boolean).join(", ") || null;
  const quando = diaRelativo(c.data_hora);
  const base = {
    paciente: c.paciente_nome,
    data: formatarData(c.data_hora),
    hora: formatarHora(c.data_hora),
    diaSemana: diaDaSemana(c.data_hora),
    medico: medico?.nome ?? null,
  };
  const painelAgenda = urlPainel("/app/agenda");
  const aviso: AvisoEquipe = { ...base, telefone: c.paciente_telefone, painel: painelAgenda };
  const nomeAtor = ator?.nome ?? null;
  const momento = Date.now();

  const paciente: ItemFila[] = [];
  const doPaciente = (canal: "whatsapp" | "email", item: Partial<ItemFila>, chave: string) => {
    paciente.push({
      organizationId: c.organization_id,
      evento: item.evento ?? "consulta",
      canal,
      publico: "paciente",
      destino: canal === "email" ? c.paciente_email : c.paciente_telefone,
      destinoNome: c.paciente_nome,
      consultaId: c.id,
      chave,
      ...item,
      payload: {
        ...(canal === "email" ? { remetenteNome: clinica.nome } : { conexaoId: clinica.merge_connection_id ?? null }),
        ...item.payload,
      },
    });
  };
  const whatsappPaciente = !!c.paciente_telefone && envioAutomatico(clinica.merge_connection_id);
  const emailPaciente = !!c.paciente_email && emailConfigurado();

  let equipe: {
    evento: EventoEquipe;
    titulo: string;
    descricao: string;
    tipoPainel: TipoNotificacao;
    prioridade: "alta" | "normal";
    whatsapp: string;
    email: { assunto: string; html: string; texto: string };
    href: string;
    copiaCaixaClinica?: boolean;
  } | null = null;

  /* ---------------------------- Marcada ---------------------------- */
  if (ev.tipo === "nova") {
    // Consulta para breve: o lembrete já teria saído. A confirmação vai
    // junto com o aviso de agendamento, em vez de duas mensagens seguidas.
    // Quem marca pode segurar o aviso (ex.: paciente avisado pessoalmente)
    const avisar = ev.avisarPaciente !== false;
    let link: string | null = null;
    let confirmacaoId: string | null = null;
    const disparo = calcularDisparo(new Date(c.data_hora), org?.lembrete_dias_uteis ?? 1, org?.lembrete_hora ?? 9);
    if (org?.ativo && org.lembrete_ativo && disparo.getTime() <= momento && avisar && (whatsappPaciente || emailPaciente)) {
      const conf = await garantirConfirmacao(c.id, c.organization_id, disparo);
      if (conf) {
        link = urlConfirmacao(conf.token);
        confirmacaoId = conf.id;
      }
    }

    const evento = confirmacaoId ? "lembrete_paciente" : "consulta_nova";
    if (avisar && whatsappPaciente) {
      doPaciente(
        "whatsapp",
        { evento, confirmacaoId, conteudo: msgAgendada({ ...base, clinica: clinica.nome, endereco, link }) },
        `nova:${c.id}:paciente:whatsapp`
      );
    }
    if (avisar && emailPaciente) {
      const m = emailPacienteAgendada(marca, { ...base, endereco, link });
      doPaciente(
        "email",
        { evento, confirmacaoId, assunto: m.assunto, conteudo: m.texto, payload: { html: m.html } },
        `nova:${c.id}:paciente:email`
      );
    }

    const urgente = quando === "hoje" || quando === "amanhã";
    equipe = {
      evento: "consulta_nova",
      tipoPainel: "consulta_nova",
      prioridade: urgente ? "alta" : "normal",
      titulo: `Consulta nova: ${c.paciente_nome}`,
      descricao: `${capitalizar(quando)}, ${base.data} às ${base.hora}${base.medico ? ` com ${base.medico}` : ""}${nomeAtor ? `. Marcada por ${nomeAtor}` : ""}.`,
      href: "/app/agenda",
      whatsapp: msgEquipeNovaConsulta({
        ...aviso,
        marcadoPor: nomeAtor,
        tipo: rotuloTipoConsulta(c.tipo),
        convenio: c.convenio,
        quando,
      }),
      email: emailEquipe(marca, {
        assunto: `Consulta nova: ${c.paciente_nome}, ${base.data} às ${base.hora}`,
        faixa: { texto: urgente ? `Consulta nova para ${quando}` : "Consulta nova na agenda" },
        frase: `${c.paciente_nome} foi marcado(a) na agenda${nomeAtor ? ` por ${nomeAtor}` : ""}.`,
        dados: [
          ["Data", `${base.data} (${base.diaSemana})`],
          ["Horário", base.hora],
          ["Profissional", base.medico],
          ["Tipo", rotuloTipoConsulta(c.tipo)],
          ["Convênio", c.convenio],
          ["Telefone", c.paciente_telefone],
        ],
        botao: { texto: "Ver na agenda", url: painelAgenda },
      }),
    };
  }

  /* ---------------------- Cancelada pela clínica --------------------- */
  if (ev.tipo === "cancelada") {
    // Nada do que estava programado para esta consulta deve sair
    await cancelarPendentes(c.id);
    await admin
      .from("confirmacoes")
      .update({ status: "cancelado" })
      .eq("consulta_id", c.id)
      .in("status", ["pendente", "enviado"]);

    if (ev.avisarPaciente) {
      if (whatsappPaciente) {
        doPaciente(
          "whatsapp",
          { evento: "consulta_cancelada", conteudo: msgCancelada({ ...base, clinica: clinica.nome }) },
          `cancelada:${c.id}:${momento}:paciente:whatsapp`
        );
      }
      if (emailPaciente) {
        const m = emailPacienteCancelada(marca, base);
        doPaciente(
          "email",
          { evento: "consulta_cancelada", assunto: m.assunto, conteudo: m.texto, payload: { html: m.html } },
          `cancelada:${c.id}:${momento}:paciente:email`
        );
      }
    }

    equipe = {
      evento: "consulta_cancelada",
      tipoPainel: "cancelamento",
      prioridade: "normal",
      titulo: `Consulta cancelada: ${c.paciente_nome}`,
      descricao: `${capitalizar(quando)}, ${base.data} às ${base.hora}${base.medico ? ` com ${base.medico}` : ""}${nomeAtor ? `. Cancelada por ${nomeAtor}` : ""}. O horário ficou livre.`,
      href: "/app/agenda",
      whatsapp: msgEquipeCanceladaClinica({ ...aviso, por: nomeAtor }),
      email: emailEquipe(marca, {
        assunto: `Cancelada: ${c.paciente_nome}, ${base.data} às ${base.hora}`,
        faixa: { texto: "Consulta cancelada", cor: "#B45309", fundo: "#FEF3C7" },
        frase: `A consulta de ${c.paciente_nome} foi cancelada${nomeAtor ? ` por ${nomeAtor}` : ""}. O horário ficou livre.`,
        dados: [
          ["Data", `${base.data} (${base.diaSemana})`],
          ["Horário", base.hora],
          ["Profissional", base.medico],
          ["Telefone", c.paciente_telefone],
        ],
        botao: { texto: "Ver a agenda", url: painelAgenda },
      }),
    };
  }

  /* ----------------------------- Remarcada --------------------------- */
  if (ev.tipo === "remarcada") {
    const anterior = `${formatarData(ev.anterior)} às ${formatarHora(ev.anterior)}`;
    const link = ev.token ? urlConfirmacao(ev.token) : null;

    if (whatsappPaciente) {
      doPaciente(
        "whatsapp",
        { evento: "consulta_remarcada", conteudo: msgReagendada({ ...base, clinica: clinica.nome, endereco, link }) },
        `remarcada:${c.id}:${c.data_hora}:paciente:whatsapp`
      );
    }
    if (emailPaciente) {
      const m = emailPacienteRemarcada(marca, { ...base, link });
      doPaciente(
        "email",
        { evento: "consulta_remarcada", assunto: m.assunto, conteudo: m.texto, payload: { html: m.html } },
        `remarcada:${c.id}:${c.data_hora}:paciente:email`
      );
    }

    equipe = {
      evento: "consulta_remarcada",
      tipoPainel: "consulta_remarcada",
      prioridade: quando === "hoje" || quando === "amanhã" ? "alta" : "normal",
      titulo: `Consulta remarcada: ${c.paciente_nome}`,
      descricao: `Agora ${quando}, ${base.data} às ${base.hora} (antes: ${anterior})${nomeAtor ? `. Por ${nomeAtor}` : ""}.`,
      href: "/app/agenda",
      whatsapp: msgEquipeRemarcada({ ...aviso, anterior, por: nomeAtor }),
      email: emailEquipe(marca, {
        assunto: `Remarcada: ${c.paciente_nome}, agora ${base.data} às ${base.hora}`,
        faixa: { texto: "Consulta remarcada", cor: "#B45309", fundo: "#FEF3C7" },
        frase: `A consulta de ${c.paciente_nome} mudou de horário${nomeAtor ? ` (${nomeAtor})` : ""}.`,
        dados: [
          ["Novo horário", `${base.data} (${base.diaSemana}), ${base.hora}`],
          ["Antes", anterior],
          ["Profissional", base.medico],
          ["Telefone", c.paciente_telefone],
        ],
        botao: { texto: "Ver na agenda", url: painelAgenda },
      }),
    };
  }

  /* ------------------------ Resposta do paciente ----------------------- */
  if (ev.tipo === "resposta") {
    const pelaEquipe = !!ev.atorId;
    const painel = urlPainel("/app/confirmacoes");
    const comPainel = { ...base, telefone: c.paciente_telefone, painel };

    // Recibo do paciente, só quando ele mesmo confirmou pelo link
    if (ev.resposta === "confirmado" && !pelaEquipe && emailPaciente && ev.token) {
      const m = emailPacienteConfirmou(marca, { ...base, link: urlConfirmacao(ev.token) });
      doPaciente(
        "email",
        { evento: "paciente_confirmou", assunto: m.assunto, conteudo: m.texto, payload: { html: m.html } },
        `resposta:${c.id}:${momento}:paciente:email`
      );
    }

    const origem = pelaEquipe ? ` (registrado por ${nomeAtor ?? "a equipe"})` : "";
    const quandoTxt = `${base.data} às ${base.hora}`;
    const contato = c.paciente_telefone ? ` · ${c.paciente_telefone}` : "";

    const porResposta = {
      confirmado: {
        evento: "paciente_confirmou" as const,
        tipoPainel: "confirmacao" as const,
        prioridade: "normal" as const,
        titulo: `${c.paciente_nome} confirmou a presença`,
        descricao: `Consulta de ${quandoTxt}${base.medico ? ` com ${base.medico}` : ""}${origem}.`,
        whatsapp: msgEquipeConfirmou(comPainel),
        email: pelaEquipe
          ? emailEquipe(marca, {
              assunto: `${c.paciente_nome} confirmou a consulta de ${quandoTxt}`,
              faixa: { texto: "Paciente confirmou a presença", cor: "#16A34A", fundo: "#DCFCE7" },
              frase: `${c.paciente_nome} confirmou por telefone${origem}.`,
              dados: [["Data", `${base.data} (${base.diaSemana})`], ["Horário", base.hora], ["Profissional", base.medico]],
              botao: { texto: "Abrir a agenda", url: painelAgenda },
            })
          : emailClinicaConfirmou(marca, comPainel),
        copiaCaixaClinica: false,
      },
      reagendar: {
        evento: "paciente_remarcar" as const,
        tipoPainel: "reagendamento" as const,
        prioridade: "alta" as const,
        titulo: `${c.paciente_nome} pediu para reagendar`,
        descricao: `Consulta de ${quandoTxt}${contato}${origem}. O horário segue reservado: combine o novo o quanto antes.`,
        whatsapp: msgEquipeReagendar(comPainel),
        email: emailClinicaReagendar(marca, comPainel),
        copiaCaixaClinica: true,
      },
      recusado: {
        evento: "paciente_cancelou" as const,
        tipoPainel: "cancelamento" as const,
        prioridade: "alta" as const,
        titulo: `${c.paciente_nome} não vai comparecer`,
        descricao: `A consulta de ${quandoTxt} foi cancelada${contato}${origem}. O horário está livre para encaixe.`,
        whatsapp: msgEquipeCancelou(comPainel),
        email: emailClinicaCancelou(marca, comPainel),
        copiaCaixaClinica: true,
      },
    }[ev.resposta];

    if (ev.resposta === "recusado") await cancelarPendentes(c.id);

    equipe = { ...porResposta, href: "/app/confirmacoes" };
  }

  await enfileirar(paciente);

  if (equipe) {
    await avisarEquipe({
      organizationId: c.organization_id,
      evento: equipe.evento,
      chave: `${equipe.evento}:${c.id}:${momento}`,
      consultaId: c.id,
      medicoId: c.medico_id,
      atorId: ev.atorId,
      titulo: equipe.titulo,
      descricao: equipe.descricao,
      href: equipe.href,
      tipoPainel: equipe.tipoPainel,
      prioridade: equipe.prioridade,
      whatsapp: equipe.whatsapp,
      email: equipe.email,
      copiaCaixaClinica: equipe.copiaCaixaClinica,
      clinica: clinica as ClinicaEnvio,
    });
  }
}

/** Confirmação da consulta, criada agora se ainda não existir. */
async function garantirConfirmacao(
  consultaId: string,
  organizationId: string,
  disparo: Date
): Promise<{ id: string; token: string } | null> {
  const admin = createAdminClient();
  const { data: existente } = await admin
    .from("confirmacoes")
    .select("id,token,status")
    .eq("consulta_id", consultaId)
    .maybeSingle();

  if (existente) {
    if (existente.status !== "pendente") return null;
    await admin.from("confirmacoes").update({ enfileirado_em: new Date().toISOString() }).eq("id", existente.id);
    return existente;
  }

  const { data, error } = await admin
    .from("confirmacoes")
    .insert({
      consulta_id: consultaId,
      organization_id: organizationId,
      token: gerarToken(),
      agendado_para: disparo.toISOString(),
      enfileirado_em: new Date().toISOString(),
      canal: null,
      enviado_em: null,
      respondido_em: null,
      observacao: null,
    })
    .select("id,token")
    .single();

  if (error) {
    console.error("[comunicacao] Confirmação não criada:", error.message);
    return null;
  }
  return data;
}

function capitalizar(t: string): string {
  return t.charAt(0).toUpperCase() + t.slice(1);
}
