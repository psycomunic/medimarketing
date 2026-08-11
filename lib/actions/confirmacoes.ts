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
import { calcularDisparo, montarMensagem, urlConfirmacao } from "@/lib/lembretes";
import { enviarWhatsApp, whatsappConfigurado } from "@/lib/envio";
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

  if (!whatsappConfigurado()) {
    return {
      ok: false,
      erro: "WhatsApp oficial não configurado. Use o botão de envio manual.",
    };
  }

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
      .select("nome,endereco,cidade,mensagem_lembrete")
      .eq("id", r.conf.organization_id)
      .maybeSingle(),
    r.admin.from("profiles").select("nome").eq("id", consulta.medico_id).maybeSingle(),
  ]);

  const texto = montarMensagem({
    paciente: consulta.paciente_nome,
    dataHora: consulta.data_hora,
    medico: medico?.nome ?? null,
    clinica: org?.nome ?? "a clínica",
    endereco: [org?.endereco, org?.cidade].filter(Boolean).join(" — ") || null,
    link: urlConfirmacao(r.conf.token),
    modelo: org?.mensagem_lembrete,
  });

  const envio = await enviarWhatsApp(consulta.paciente_telefone, texto);
  if (!envio.enviado) {
    return { ok: false, erro: `Não foi possível enviar (${envio.motivo}).` };
  }

  await r.admin
    .from("confirmacoes")
    .update({
      status: "enviado",
      enviado_em: new Date().toISOString(),
      canal: "whatsapp",
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
