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
    plataforma: z.enum(["meta", "google", "organico", "outro"]),
    nome: z.string().trim().min(3, "Dê um nome à campanha."),
    objetivo: z.string().trim().max(120).optional().or(z.literal("")),
    status: z.enum(["ativa", "pausada", "encerrada"]),
    inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data de início inválida."),
    fim: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Data de término inválida.")
      .optional()
      .or(z.literal("")),
    investimento: z.number().min(0),
    impressoes: z.number().int().min(0),
    cliques: z.number().int().min(0),
    leads: z.number().int().min(0),
    agendamentos: z.number().int().min(0),
  })
  // O funil de mídia é uma cascata: cada etapa vem da anterior. Barrar aqui
  // evita CPL e CTR sem sentido no painel.
  .refine((d) => d.cliques <= d.impressoes || d.impressoes === 0, {
    message: "Cliques não podem passar das impressões.",
    path: ["cliques"],
  })
  .refine((d) => d.leads <= d.cliques || d.cliques === 0, {
    message: "Leads não podem passar dos cliques.",
    path: ["leads"],
  })
  .refine((d) => d.agendamentos <= d.leads, {
    message: "Agendamentos não podem passar dos leads.",
    path: ["agendamentos"],
  })
  .refine((d) => !d.fim || d.fim >= d.inicio, {
    message: "O término não pode ser antes do início.",
    path: ["fim"],
  });

export type CampanhaInput = z.input<typeof schema>;

/**
 * Cria ou atualiza uma campanha.
 *
 * Enquanto as APIs de Meta e Google não estão conectadas, é aqui que os
 * números do período entram. As integrações vão alimentar esta mesma
 * tabela na Fase 4.
 */
export async function salvarCampanha(input: CampanhaInput): Promise<ActionResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.errors[0]?.message ?? "Dados inválidos" };
  }

  const ctx = await contexto(GESTAO);
  if (ctx.estado !== "ok") return bloqueio(ctx);

  const d = parsed.data;
  const orgId = organizacaoAlvo(ctx.profile, d.organizationId);
  if (!orgId) return { ok: false, erro: "Selecione a clínica da campanha." };

  const registro = {
    organization_id: orgId,
    plataforma: d.plataforma,
    nome: d.nome,
    objetivo: d.objetivo || null,
    status: d.status,
    inicio: d.inicio,
    fim: d.fim || null,
    investimento: d.investimento,
    impressoes: d.impressoes,
    cliques: d.cliques,
    leads: d.leads,
    agendamentos: d.agendamentos,
  };

  const { error } = d.id
    ? await ctx.supabase.from("campanhas").update(registro).eq("id", d.id)
    : await ctx.supabase.from("campanhas").insert(registro);

  if (error) {
    console.error("[marketing] Erro ao salvar campanha:", error.message);
    return { ok: false, erro: "Não foi possível salvar a campanha." };
  }

  revalidatePath("/app/marketing");
  revalidatePath("/app/indicadores");
  return { ok: true };
}

export async function excluirCampanha(id: string): Promise<ActionResult> {
  const ctx = await contexto(GESTAO);
  if (ctx.estado !== "ok") return bloqueio(ctx);

  const { error } = await ctx.supabase.from("campanhas").delete().eq("id", id);
  if (error) return { ok: false, erro: "Não foi possível excluir a campanha." };

  revalidatePath("/app/marketing");
  return { ok: true };
}
