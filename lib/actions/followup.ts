"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { bloqueio, contexto, organizacaoAlvo, type ActionResult } from "@/lib/actions/contexto";

const MSG_SEM_SQL = "O follow-up ainda não foi ativado. Rode o SQL da atualização no Supabase.";

/** A clínica é sempre a do paciente: o super admin também acerta sem escolher. */
async function clinicaDoPaciente(
  supabase: Extract<Awaited<ReturnType<typeof contexto>>, { estado: "ok" }>["supabase"],
  pacienteId: string
) {
  const { data } = await supabase.from("pacientes").select("organization_id").eq("id", pacienteId).maybeSingle();
  return data?.organization_id ?? null;
}

function revalidar(pacienteId?: string) {
  revalidatePath("/app/followups");
  revalidatePath("/app");
  if (pacienteId) revalidatePath(`/app/pacientes/${pacienteId}`);
}

/* ------------------------------ Tarefas ------------------------------ */

const tarefaSchema = z.object({
  pacienteId: z.string().uuid(),
  titulo: z.string().trim().min(3, "Descreva o follow-up.").max(200),
  tipo: z.enum(["ligar", "whatsapp", "orcamento", "retorno", "outro"]),
  vencimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Escolha a data."),
  responsavelId: z.string().uuid().optional().or(z.literal("")),
});

export async function criarTarefa(input: z.input<typeof tarefaSchema>): Promise<ActionResult> {
  const parsed = tarefaSchema.safeParse(input);
  if (!parsed.success) return { ok: false, erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const ctx = await contexto();
  if (ctx.estado !== "ok") return bloqueio(ctx);
  const d = parsed.data;
  const orgId = await clinicaDoPaciente(ctx.supabase, d.pacienteId);
  if (!orgId) return { ok: false, erro: "Paciente não encontrado." };

  const { error } = await ctx.supabase.from("paciente_tarefas").insert({
    organization_id: orgId,
    paciente_id: d.pacienteId,
    titulo: d.titulo,
    tipo: d.tipo,
    vencimento: d.vencimento,
    // Sem responsável escolhido, fica com quem criou
    responsavel_id: d.responsavelId || ctx.profile.id,
    criado_por: ctx.profile.id,
  });
  if (error) return { ok: false, erro: error.code === "42P01" ? MSG_SEM_SQL : "Não foi possível criar o follow-up." };
  revalidar(d.pacienteId);
  return { ok: true };
}

/** Concluir registra quem fez e, opcionalmente, o que aconteceu. */
export async function concluirTarefa(id: string, resultado?: string): Promise<ActionResult> {
  const ctx = await contexto();
  if (ctx.estado !== "ok") return bloqueio(ctx);
  const { data, error } = await ctx.supabase
    .from("paciente_tarefas")
    .update({
      status: "feita",
      resultado: resultado?.trim().slice(0, 1000) || null,
      concluida_em: new Date().toISOString(),
      concluida_por: ctx.profile.id,
    })
    .eq("id", id)
    .select("paciente_id")
    .maybeSingle();
  if (error || !data) return { ok: false, erro: "Não foi possível concluir." };
  revalidar(data.paciente_id);
  return { ok: true };
}

export async function reabrirTarefa(id: string): Promise<ActionResult> {
  const ctx = await contexto();
  if (ctx.estado !== "ok") return bloqueio(ctx);
  const { data, error } = await ctx.supabase
    .from("paciente_tarefas")
    .update({ status: "aberta", concluida_em: null, concluida_por: null })
    .eq("id", id)
    .select("paciente_id")
    .maybeSingle();
  if (error || !data) return { ok: false, erro: "Não foi possível reabrir." };
  revalidar(data.paciente_id);
  return { ok: true };
}

/** Adiar para uma nova data (amanhã, próxima semana…). */
export async function adiarTarefa(id: string, vencimento: string): Promise<ActionResult> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(vencimento)) return { ok: false, erro: "Data inválida." };
  const ctx = await contexto();
  if (ctx.estado !== "ok") return bloqueio(ctx);
  const { data, error } = await ctx.supabase
    .from("paciente_tarefas")
    .update({ vencimento })
    .eq("id", id)
    .select("paciente_id")
    .maybeSingle();
  if (error || !data) return { ok: false, erro: "Não foi possível adiar." };
  revalidar(data.paciente_id);
  return { ok: true };
}

export async function excluirTarefa(id: string): Promise<ActionResult> {
  const ctx = await contexto();
  if (ctx.estado !== "ok") return bloqueio(ctx);
  const { data, error } = await ctx.supabase.from("paciente_tarefas").delete().eq("id", id).select("paciente_id");
  if (error) return { ok: false, erro: "Não foi possível excluir." };
  if (!data?.length) return { ok: false, erro: "Só quem criou o follow-up ou o dono da clínica pode excluir." };
  revalidar(data[0].paciente_id);
  return { ok: true };
}

/* ------------------------------ Anotações ------------------------------ */

export async function criarNota(pacienteId: string, texto: string): Promise<ActionResult> {
  const t = texto.trim();
  if (t.length < 2) return { ok: false, erro: "Escreva a anotação." };
  if (t.length > 4000) return { ok: false, erro: "Anotação longa demais (máximo de 4.000 caracteres)." };
  const ctx = await contexto();
  if (ctx.estado !== "ok") return bloqueio(ctx);
  const orgId = await clinicaDoPaciente(ctx.supabase, pacienteId);
  if (!orgId) return { ok: false, erro: "Paciente não encontrado." };
  const { error } = await ctx.supabase.from("paciente_notas").insert({
    organization_id: orgId,
    paciente_id: pacienteId,
    autor_id: ctx.profile.id,
    texto: t,
  });
  if (error) return { ok: false, erro: error.code === "42P01" ? MSG_SEM_SQL : "Não foi possível salvar a anotação." };
  revalidar(pacienteId);
  return { ok: true };
}

export async function fixarNota(id: string, fixada: boolean): Promise<ActionResult> {
  const ctx = await contexto();
  if (ctx.estado !== "ok") return bloqueio(ctx);
  const { data, error } = await ctx.supabase.from("paciente_notas").update({ fixada }).eq("id", id).select("paciente_id").maybeSingle();
  if (error || !data) return { ok: false, erro: "Não foi possível atualizar." };
  revalidar(data.paciente_id);
  return { ok: true };
}

export async function excluirNota(id: string): Promise<ActionResult> {
  const ctx = await contexto();
  if (ctx.estado !== "ok") return bloqueio(ctx);
  const { data, error } = await ctx.supabase.from("paciente_notas").delete().eq("id", id).select("paciente_id");
  if (error) return { ok: false, erro: "Não foi possível excluir." };
  if (!data?.length) return { ok: false, erro: "Só quem escreveu a anotação ou o dono da clínica pode excluir." };
  revalidar(data[0].paciente_id);
  return { ok: true };
}

/* ------------------------------ Segmentos ------------------------------ */

const CHAVES_FILTRO = ["busca", "situacao", "convenio", "profissional", "tag", "servico", "ordem"] as const;

export async function salvarSegmento(nome: string, filtros: Record<string, string>, organizationId?: string): Promise<ActionResult> {
  const n = nome.trim();
  if (n.length < 2 || n.length > 80) return { ok: false, erro: "Dê um nome ao segmento (até 80 caracteres)." };
  const limpos = Object.fromEntries(
    CHAVES_FILTRO.filter((k) => typeof filtros[k] === "string" && filtros[k].trim()).map((k) => [k, filtros[k].trim().slice(0, 120)])
  );
  if (!Object.keys(limpos).length) return { ok: false, erro: "Escolha algum filtro antes de salvar." };
  const ctx = await contexto();
  if (ctx.estado !== "ok") return bloqueio(ctx);
  const orgId = organizacaoAlvo(ctx.profile, organizationId);
  if (!orgId) return { ok: false, erro: "Escolha a clínica." };
  const { error } = await ctx.supabase
    .from("segmentos_pacientes")
    .insert({ organization_id: orgId, nome: n, filtros: limpos, criado_por: ctx.profile.id });
  if (error) return { ok: false, erro: error.code === "42P01" ? MSG_SEM_SQL : "Não foi possível salvar o segmento." };
  revalidatePath("/app/pacientes");
  return { ok: true };
}

export async function excluirSegmento(id: string): Promise<ActionResult> {
  const ctx = await contexto();
  if (ctx.estado !== "ok") return bloqueio(ctx);
  const { data, error } = await ctx.supabase.from("segmentos_pacientes").delete().eq("id", id).select("id");
  if (error || !data?.length) return { ok: false, erro: "Só quem criou o segmento ou o dono pode excluir." };
  revalidatePath("/app/pacientes");
  return { ok: true };
}
