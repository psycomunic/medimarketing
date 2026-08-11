"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  bloqueio,
  contexto,
  organizacaoAlvo,
  OPERACIONAL,
  type ActionResult,
} from "@/lib/actions/contexto";

const CANAIS = [
  "whatsapp",
  "instagram",
  "facebook",
  "telefone",
  "email",
  "presencial",
] as const;

const passoSchema = z.object({
  atrasoHoras: z.number().int().min(0).max(24 * 180),
  canal: z.enum(CANAIS),
  mensagem: z.string().trim().min(5, "Escreva a mensagem do passo.").max(1000),
});

const reguaSchema = z.object({
  id: z.string().optional(),
  organizationId: z.string().optional(),
  tipo: z.enum(["reabordagem", "no_show", "reativacao", "recall", "pos_consulta"]),
  nome: z.string().trim().min(3, "Dê um nome à régua."),
  descricao: z.string().trim().max(500).optional().or(z.literal("")),
  ativa: z.boolean(),
  passos: z.array(passoSchema).min(1, "A régua precisa de pelo menos um passo.").max(8),
});

export type ReguaInput = z.input<typeof reguaSchema>;

/**
 * Cria ou atualiza uma régua com todos os passos.
 *
 * Os passos são reescritos por inteiro a cada salvamento: a cadência é
 * curta (até 8 passos) e regravar tudo evita ter que reconciliar ordens
 * quando a pessoa reordena ou remove um passo do meio.
 */
export async function salvarRegua(input: ReguaInput): Promise<ActionResult> {
  const parsed = reguaSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.errors[0]?.message ?? "Dados inválidos" };
  }

  const ctx = await contexto(OPERACIONAL);
  if (ctx.estado !== "ok") return bloqueio(ctx);

  const d = parsed.data;
  const orgId = organizacaoAlvo(ctx.profile, d.organizationId);
  if (!orgId) return { ok: false, erro: "Selecione a clínica da régua." };

  const registro = {
    organization_id: orgId,
    tipo: d.tipo,
    nome: d.nome,
    descricao: d.descricao || null,
    ativa: d.ativa,
  };

  let reguaId = d.id;

  if (reguaId) {
    const { error } = await ctx.supabase
      .from("reguas")
      .update(registro)
      .eq("id", reguaId);
    if (error) return { ok: false, erro: "Não foi possível salvar a régua." };
  } else {
    const { data, error } = await ctx.supabase
      .from("reguas")
      .insert(registro)
      .select("id")
      .single();
    if (error || !data) return { ok: false, erro: "Não foi possível criar a régua." };
    reguaId = data.id;
  }

  await ctx.supabase.from("regua_passos").delete().eq("regua_id", reguaId);

  const { error: erroPassos } = await ctx.supabase.from("regua_passos").insert(
    d.passos.map((p, i) => ({
      regua_id: reguaId as string,
      ordem: i + 1,
      atraso_horas: p.atrasoHoras,
      canal: p.canal,
      mensagem: p.mensagem,
    }))
  );

  if (erroPassos) {
    console.error("[retencao] Erro nos passos:", erroPassos.message);
    return { ok: false, erro: "A régua foi salva, mas os passos falharam." };
  }

  revalidatePath("/app/retencao");
  return { ok: true };
}

/** Liga ou desliga a régua sem abrir o editor. */
export async function alternarRegua(
  id: string,
  ativa: boolean
): Promise<ActionResult> {
  const ctx = await contexto(OPERACIONAL);
  if (ctx.estado !== "ok") return bloqueio(ctx);

  const { error } = await ctx.supabase.from("reguas").update({ ativa }).eq("id", id);
  if (error) return { ok: false, erro: "Não foi possível alterar a régua." };

  revalidatePath("/app/retencao");
  return { ok: true };
}

export async function excluirRegua(id: string): Promise<ActionResult> {
  const ctx = await contexto(OPERACIONAL);
  if (ctx.estado !== "ok") return bloqueio(ctx);

  const { error } = await ctx.supabase.from("reguas").delete().eq("id", id);
  if (error) return { ok: false, erro: "Não foi possível excluir a régua." };

  revalidatePath("/app/retencao");
  return { ok: true };
}
