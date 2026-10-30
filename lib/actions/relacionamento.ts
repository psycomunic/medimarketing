"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { bloqueio, contexto, GESTAO, OPERACIONAL, type ActionResult } from "@/lib/actions/contexto";

const MSG_SQL = "As automações ainda não foram ativadas. Rode o SQL da Fase 4A no Supabase.";
const TIPOS = ["aniversario", "faltou", "pos_consulta"] as const;

function revalidar() {
  revalidatePath("/app/retencao");
  revalidatePath("/app");
}

const contatoSchema = z.object({
  chave: z.string().min(3).max(120),
  tipo: z.enum(TIPOS),
  pacienteId: z.string().uuid().nullable(),
  consultaId: z.string().uuid().nullable(),
  nome: z.string().trim().min(1).max(160),
  status: z.enum(["enviado", "pulado"]),
  mensagem: z.string().max(2000).optional(),
});

/** Marca um contato da lista como enviado (ou pulado): ele sai da lista. */
export async function registrarContato(input: z.input<typeof contatoSchema>): Promise<ActionResult> {
  const p = contatoSchema.safeParse(input);
  if (!p.success) return { ok: false, erro: "Dados inválidos." };
  const ctx = await contexto(OPERACIONAL);
  if (ctx.estado !== "ok") return bloqueio(ctx);
  const orgId = ctx.profile.organization_id;
  if (!orgId) return { ok: false, erro: "Abra a clínica para registrar o contato." };
  const d = p.data;
  const { error } = await ctx.supabase.from("contatos_relacionamento").insert({
    organization_id: orgId,
    chave: d.chave,
    tipo: d.tipo,
    paciente_id: d.pacienteId,
    consulta_id: d.consultaId,
    nome: d.nome,
    status: d.status,
    mensagem: d.status === "enviado" ? d.mensagem ?? null : null,
    feito_por: ctx.profile.id,
  });
  // Outra pessoa da equipe marcou antes: já está feito
  if (error && /duplicate key|contatos_relacionamento_chave/i.test(error.message)) {
    revalidar();
    return { ok: true };
  }
  if (error && /does not exist|schema cache/i.test(error.message)) return { ok: false, erro: MSG_SQL };
  if (error) return { ok: false, erro: "Não foi possível registrar o contato." };
  revalidar();
  return { ok: true };
}

/** Volta um contato para a lista (marcado por engano). */
export async function desfazerContato(id: string): Promise<ActionResult> {
  const ctx = await contexto(OPERACIONAL);
  if (ctx.estado !== "ok") return bloqueio(ctx);
  const { error } = await ctx.supabase.from("contatos_relacionamento").delete().eq("id", id);
  if (error) return { ok: false, erro: "Não foi possível desfazer." };
  revalidar();
  return { ok: true };
}

const configSchema = z.object({
  tipo: z.enum(TIPOS),
  ativa: z.boolean(),
  mensagem: z.string().trim().min(10, "Escreva a mensagem.").max(1500),
  dias: z.coerce.number().int().min(0).max(30),
});

/** Liga, desliga e ajusta a mensagem e o prazo de uma automação. */
export async function salvarAutomacao(input: z.input<typeof configSchema>): Promise<ActionResult> {
  const p = configSchema.safeParse(input);
  if (!p.success) return { ok: false, erro: p.error.errors[0]?.message ?? "Dados inválidos." };
  const ctx = await contexto(GESTAO);
  if (ctx.estado !== "ok") return bloqueio(ctx);
  const orgId = ctx.profile.organization_id;
  if (!orgId) return { ok: false, erro: "Abra a clínica para configurar." };
  const { error } = await ctx.supabase
    .from("automacoes_config")
    .upsert({ organization_id: orgId, ...p.data, atualizado_em: new Date().toISOString() }, { onConflict: "organization_id,tipo" });
  if (error && /does not exist|schema cache/i.test(error.message)) return { ok: false, erro: MSG_SQL };
  if (error) return { ok: false, erro: "Não foi possível salvar." };
  revalidar();
  return { ok: true };
}
