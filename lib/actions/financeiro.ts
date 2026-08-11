"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  bloqueio,
  contexto,
  organizacaoAlvo,
  GESTAO,
  type ActionResult,
} from "@/lib/actions/contexto";

const schema = z
  .object({
    id: z.string().optional(),
    organizationId: z.string().optional(),
    pacienteNome: z.string().trim().min(2, "Informe o nome do paciente."),
    procedimento: z.string().trim().min(2, "Informe o procedimento."),
    categoria: z.string().trim().max(60).optional().or(z.literal("")),
    valor: z.number().min(0),
    custo: z.number().min(0),
    formaPagamento: z.enum([
      "pix",
      "dinheiro",
      "cartao_credito",
      "cartao_debito",
      "convenio",
      "boleto",
    ]),
    status: z.enum(["previsto", "recebido", "atrasado", "cancelado"]),
    dataCompetencia: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida."),
    dataRecebimento: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Data de recebimento inválida.")
      .optional()
      .or(z.literal("")),
    observacao: z.string().trim().max(500).optional().or(z.literal("")),
  })
  .refine((d) => d.custo <= d.valor || d.valor === 0, {
    message: "O custo não pode ser maior que o valor cobrado.",
    path: ["custo"],
  });

export type LancamentoInput = z.input<typeof schema>;

/** Registra ou corrige uma receita de procedimento. */
export async function salvarLancamento(
  input: LancamentoInput
): Promise<ActionResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.errors[0]?.message ?? "Dados inválidos" };
  }

  const ctx = await contexto(GESTAO);
  if (ctx.estado !== "ok") return bloqueio(ctx);

  const d = parsed.data;
  const orgId = organizacaoAlvo(ctx.profile, d.organizationId);
  if (!orgId) return { ok: false, erro: "Selecione a clínica do lançamento." };

  // Marcar como recebido sem informar a data assume que caiu hoje
  const recebimento =
    d.status === "recebido"
      ? d.dataRecebimento || new Date().toISOString().slice(0, 10)
      : null;

  const registro = {
    organization_id: orgId,
    consulta_id: null,
    paciente_nome: d.pacienteNome,
    procedimento: d.procedimento,
    categoria: d.categoria || null,
    valor: d.valor,
    custo: d.custo,
    forma_pagamento: d.formaPagamento,
    status: d.status,
    data_competencia: d.dataCompetencia,
    data_recebimento: recebimento,
    observacao: d.observacao || null,
  };

  const { error } = d.id
    ? await ctx.supabase.from("lancamentos").update(registro).eq("id", d.id)
    : await ctx.supabase.from("lancamentos").insert(registro);

  if (error) {
    console.error("[financeiro] Erro ao salvar lançamento:", error.message);
    return { ok: false, erro: "Não foi possível salvar o lançamento." };
  }

  revalidatePath("/app/financeiro");
  return { ok: true };
}

/** Baixa rápida: marca como recebido sem abrir o formulário inteiro. */
export async function baixarLancamento(id: string): Promise<ActionResult> {
  const ctx = await contexto(GESTAO);
  if (ctx.estado !== "ok") return bloqueio(ctx);

  const { error } = await ctx.supabase
    .from("lancamentos")
    .update({
      status: "recebido",
      data_recebimento: new Date().toISOString().slice(0, 10),
    })
    .eq("id", id);

  if (error) return { ok: false, erro: "Não foi possível dar baixa." };

  revalidatePath("/app/financeiro");
  return { ok: true };
}

export async function excluirLancamento(id: string): Promise<ActionResult> {
  const ctx = await contexto(GESTAO);
  if (ctx.estado !== "ok") return bloqueio(ctx);

  const { error } = await ctx.supabase.from("lancamentos").delete().eq("id", id);
  if (error) return { ok: false, erro: "Não foi possível excluir o lançamento." };

  revalidatePath("/app/financeiro");
  return { ok: true };
}
