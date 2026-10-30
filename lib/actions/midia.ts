"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { bloqueio, contexto, GESTAO, organizacaoAlvo, type ActionResult } from "@/lib/actions/contexto";
import { sincronizarConta } from "@/lib/marketing/sincronizar";

const MSG_SQL = "O painel de mídia ainda não foi ativado. Rode o SQL do Marketing no Supabase.";

const linhaSchema = z.object({
  contaId: z.string().max(60).nullable(),
  campanhaId: z.string().min(1).max(160),
  campanhaNome: z.string().trim().min(1).max(300),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  investimento: z.number().min(0).max(10_000_000),
  impressoes: z.number().int().min(0),
  alcance: z.number().int().min(0),
  cliques: z.number().int().min(0),
  leads: z.number().int().min(0),
  conversas: z.number().int().min(0),
  conversoes: z.number().int().min(0),
});

const importarSchema = z.object({
  organizationId: z.string().optional(),
  plataforma: z.enum(["meta", "google"]),
  linhas: z.array(linhaSchema).min(1, "O relatório está vazio.").max(20000, "Relatório grande demais: exporte um período menor."),
});

/**
 * Grava o relatório importado. Campanha + dia é a chave: importar o mesmo
 * período de novo atualiza os números, sem duplicar.
 */
export async function importarAnuncios(
  input: z.input<typeof importarSchema>
): Promise<{ ok: true; linhas: number } | { ok: false; erro: string }> {
  const p = importarSchema.safeParse(input);
  if (!p.success) return { ok: false, erro: p.error.errors[0]?.message ?? "Dados inválidos." };
  const ctx = await contexto(GESTAO);
  if (ctx.estado !== "ok") return bloqueio(ctx) as { ok: false; erro: string };
  const orgId = organizacaoAlvo(ctx.profile, p.data.organizationId);
  if (!orgId) return { ok: false, erro: "Escolha a clínica." };

  const agora = new Date().toISOString();
  const registros = p.data.linhas.map((l) => ({
    organization_id: orgId,
    plataforma: p.data.plataforma,
    conta_id: l.contaId,
    campanha_id: l.campanhaId,
    campanha_nome: l.campanhaNome,
    data: l.data,
    investimento: Math.round(l.investimento * 100) / 100,
    impressoes: l.impressoes,
    alcance: l.alcance,
    cliques: l.cliques,
    leads: l.leads,
    conversas: l.conversas,
    conversoes: l.conversoes,
    origem: "planilha" as const,
    atualizado_em: agora,
  }));
  for (let i = 0; i < registros.length; i += 500) {
    const { error } = await ctx.supabase
      .from("anuncios_diarios")
      .upsert(registros.slice(i, i + 500), { onConflict: "organization_id,plataforma,campanha_id,data" });
    if (error && /does not exist|schema cache/i.test(error.message)) return { ok: false, erro: MSG_SQL };
    if (error) return { ok: false, erro: "Não foi possível importar o relatório." };
  }
  revalidatePath("/app/marketing");
  return { ok: true, linhas: registros.length };
}

const orcamentoSchema = z.object({
  organizationId: z.string().optional(),
  mes: z.string().regex(/^\d{4}-\d{2}$/),
  meta: z.number().min(0).max(10_000_000),
  google: z.number().min(0).max(10_000_000),
});

/** Verba planejada do mês para cada plataforma. */
export async function salvarOrcamentoMidia(input: z.input<typeof orcamentoSchema>): Promise<ActionResult> {
  const p = orcamentoSchema.safeParse(input);
  if (!p.success) return { ok: false, erro: "Valores inválidos." };
  const ctx = await contexto(GESTAO);
  if (ctx.estado !== "ok") return bloqueio(ctx);
  const orgId = organizacaoAlvo(ctx.profile, p.data.organizationId);
  if (!orgId) return { ok: false, erro: "Escolha a clínica." };
  const mes = `${p.data.mes}-01`;
  const agora = new Date().toISOString();
  const { error } = await ctx.supabase.from("orcamentos_midia").upsert(
    [
      { organization_id: orgId, mes, plataforma: "meta" as const, valor: p.data.meta, atualizado_em: agora },
      { organization_id: orgId, mes, plataforma: "google" as const, valor: p.data.google, atualizado_em: agora },
    ],
    { onConflict: "organization_id,mes,plataforma" }
  );
  if (error && /does not exist|schema cache/i.test(error.message)) return { ok: false, erro: MSG_SQL };
  if (error) return { ok: false, erro: "Não foi possível salvar o orçamento." };
  revalidatePath("/app/marketing");
  return { ok: true };
}

/* ------------------------------ Contas da BM (super admin) ------------------------------ */

const vincularSchema = z.object({
  plataforma: z.enum(["meta", "google"]),
  contaId: z.string().min(3).max(60),
  nome: z.string().trim().min(1).max(200),
  organizationId: z.string().uuid().nullable(),
});

/** Liga (ou desliga) uma conta de anúncio da BM à clínica dona dela. */
export async function vincularContaAnuncio(input: z.input<typeof vincularSchema>): Promise<ActionResult> {
  const p = vincularSchema.safeParse(input);
  if (!p.success) return { ok: false, erro: "Dados inválidos." };
  const ctx = await contexto(["super_admin"]);
  if (ctx.estado !== "ok") return bloqueio(ctx);
  const d = p.data;
  const { error } = await ctx.supabase.from("contas_anuncio").upsert(
    { plataforma: d.plataforma, conta_id: d.contaId, nome: d.nome, organization_id: d.organizationId, ativo: !!d.organizationId },
    { onConflict: "plataforma,conta_id" }
  );
  if (error && /does not exist|schema cache/i.test(error.message)) return { ok: false, erro: "Rode antes o SQL da conexão de mídia (Fase 2)." };
  if (error) return { ok: false, erro: "Não foi possível salvar a ligação." };
  revalidatePath("/app/admin/anuncios");
  return { ok: true };
}

/** Busca agora os números de uma conta (90 dias na primeira vez; 30 depois). */
export async function sincronizarContaAgora(plataforma: "meta" | "google", contaId: string): Promise<{ ok: true; linhas: number } | { ok: false; erro: string }> {
  const ctx = await contexto(["super_admin"]);
  if (ctx.estado !== "ok") return bloqueio(ctx) as { ok: false; erro: string };
  const { data: conta } = await ctx.supabase.from("contas_anuncio").select("*").eq("plataforma", plataforma).eq("conta_id", contaId).maybeSingle();
  if (!conta) return { ok: false, erro: "Ligue a conta a uma clínica antes de sincronizar." };
  const r = await sincronizarConta(conta, conta.ultima_sincronizacao ? 30 : 90);
  revalidatePath("/app/admin/anuncios");
  revalidatePath("/app/marketing");
  return r;
}
