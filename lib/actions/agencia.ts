"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { bloqueio, contexto, type ActionResult } from "@/lib/actions/contexto";
import { vencimentoDe } from "@/lib/financeiro/agencia";
import type { Contrato, ContratoEvento } from "@/lib/supabase/types";

/**
 * AÇÕES DO FINANCEIRO DA AGÊNCIA (só a equipe Medi Marketing)
 *
 * Toda mudança de valor de contrato grava um evento: é dele que sai o
 * MRR de cada mês, a ponte (novo, expansão, contração, cancelamento) e
 * a retenção. Editar o contrato sem evento faria o histórico mentir.
 */

const SO_AGENCIA = ["super_admin"] as const;
const MSG_SQL = "O financeiro da agência ainda não foi instalado. Rode o SQL do financeiro no Supabase.";

function revalidar() {
  revalidatePath("/app/admin/financeiro", "layout");
  revalidatePath("/app/clinicas", "layout");
}

function erroBanco(error: { message: string } | null, padrao: string): ActionResult {
  if (error && /does not exist|schema cache|column/i.test(error.message)) return { ok: false, erro: MSG_SQL };
  if (error && /contratos_um_ativo|duplicate key/i.test(error.message)) {
    return { ok: false, erro: "Esta clínica já tem um contrato ativo. Edite o existente." };
  }
  console.error("[agencia]", error?.message);
  return { ok: false, erro: padrao };
}

const hoje = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.");

/* ------------------------------ Contratos ------------------------------ */

const contratoSchema = z.object({
  id: z.string().optional(),
  organizationId: z.string().min(1, "Escolha a clínica."),
  plano: z.enum(["essencial", "performance", "full"]),
  mensalidade: z.coerce.number().min(0).max(1_000_000),
  implantacao: z.coerce.number().min(0).max(1_000_000).default(0),
  inicio: data,
  fidelidadeMeses: z.coerce.number().int().min(0).max(60),
  diaVencimento: z.coerce.number().int().min(1).max(28),
  reajuste: z.string().trim().max(20).default("IPCA"),
  responsavel: z.string().trim().max(80).optional().or(z.literal("")),
  observacao: z.string().trim().max(500).optional().or(z.literal("")),
  /** Data em que a mudança de valor passa a valer (upgrade/downgrade). */
  vigencia: data.optional(),
  gerarImplantacao: z.boolean().default(true),
});

export type ContratoInput = z.input<typeof contratoSchema>;

export async function salvarContrato(input: ContratoInput): Promise<ActionResult> {
  const p = contratoSchema.safeParse(input);
  if (!p.success) return { ok: false, erro: p.error.errors[0]?.message ?? "Dados inválidos." };
  const ctx = await contexto(SO_AGENCIA);
  if (ctx.estado !== "ok") return bloqueio(ctx);
  const d = p.data;
  const db = ctx.supabase;

  const registro = {
    organization_id: d.organizationId,
    plano: d.plano,
    mensalidade: d.mensalidade,
    implantacao: d.implantacao,
    inicio: d.inicio,
    fidelidade_meses: d.fidelidadeMeses,
    dia_vencimento: d.diaVencimento,
    reajuste: d.reajuste || "IPCA",
    responsavel: d.responsavel || null,
    observacao: d.observacao || null,
    atualizado_em: new Date().toISOString(),
  };

  if (d.id) {
    const { data: antes } = await db.from("contratos").select("*").eq("id", d.id).maybeSingle();
    if (!antes) return { ok: false, erro: "Contrato não encontrado." };
    const { error } = await db.from("contratos").update(registro).eq("id", d.id);
    if (error) return erroBanco(error, "Não foi possível salvar o contrato.");
    const anterior = Number((antes as Contrato).mensalidade);
    if (anterior !== d.mensalidade && (antes as Contrato).status === "ativo") {
      await db.from("contrato_eventos").insert({
        contrato_id: d.id,
        tipo: d.mensalidade > anterior ? "upgrade" : "downgrade",
        data: d.vigencia || hoje(),
        mrr_antes: anterior,
        mrr_depois: d.mensalidade,
        observacao: `Plano ${d.plano}`,
      });
    }
    // O plano da clínica acompanha o contrato
    await db.from("organizations").update({ plano: d.plano }).eq("id", d.organizationId);
    revalidar();
    return { ok: true };
  }

  const { data: novo, error } = await db
    .from("contratos")
    .insert({ ...registro, status: "ativo" })
    .select("id")
    .single();
  if (error || !novo) return erroBanco(error, "Não foi possível criar o contrato.");

  await db.from("contrato_eventos").insert({
    contrato_id: novo.id,
    tipo: "novo",
    data: d.inicio,
    mrr_antes: 0,
    mrr_depois: d.mensalidade,
    observacao: `Plano ${d.plano}`,
  });
  await db.from("organizations").update({ plano: d.plano }).eq("id", d.organizationId);

  if (d.implantacao > 0 && d.gerarImplantacao) {
    await db.from("faturas").insert({
      organization_id: d.organizationId,
      contrato_id: novo.id,
      competencia: `${d.inicio.slice(0, 7)}-01`,
      descricao: "Implantação",
      valor: d.implantacao,
      vencimento: d.inicio,
      status: "aberta",
      tipo: "implantacao",
    });
  }
  revalidar();
  return { ok: true };
}

const statusSchema = z.object({
  id: z.string().min(1),
  acao: z.enum(["pausar", "reativar", "cancelar"]),
  data: data,
  motivo: z.string().trim().max(300).optional().or(z.literal("")),
});

export async function mudarStatusContrato(input: z.input<typeof statusSchema>): Promise<ActionResult> {
  const p = statusSchema.safeParse(input);
  if (!p.success) return { ok: false, erro: p.error.errors[0]?.message ?? "Dados inválidos." };
  const ctx = await contexto(SO_AGENCIA);
  if (ctx.estado !== "ok") return bloqueio(ctx);
  const d = p.data;
  const db = ctx.supabase;
  const { data: c } = await db.from("contratos").select("*").eq("id", d.id).maybeSingle();
  if (!c) return { ok: false, erro: "Contrato não encontrado." };
  const contrato = c as Contrato;
  const valor = Number(contrato.mensalidade);

  const mapa: Record<string, { status: Contrato["status"]; tipo: ContratoEvento["tipo"]; antes: number; depois: number }> = {
    pausar: { status: "pausado", tipo: "pausa", antes: valor, depois: 0 },
    reativar: { status: "ativo", tipo: "reativacao", antes: 0, depois: valor },
    cancelar: { status: "cancelado", tipo: "cancelamento", antes: contrato.status === "ativo" ? valor : 0, depois: 0 },
  };
  const m = mapa[d.acao];
  if (contrato.status === m.status) return { ok: false, erro: "O contrato já está nessa situação." };

  const { error } = await db
    .from("contratos")
    .update({
      status: m.status,
      cancelado_em: d.acao === "cancelar" ? d.data : null,
      motivo_saida: d.acao === "cancelar" ? d.motivo || null : contrato.motivo_saida,
      atualizado_em: new Date().toISOString(),
    })
    .eq("id", d.id);
  if (error) return erroBanco(error, "Não foi possível atualizar o contrato.");

  await db.from("contrato_eventos").insert({
    contrato_id: d.id,
    tipo: m.tipo,
    data: d.data,
    mrr_antes: m.antes,
    mrr_depois: m.depois,
    observacao: d.motivo || null,
  });

  // Cancelado: as mensalidades futuras em aberto deixam de existir
  if (d.acao === "cancelar") {
    await db
      .from("faturas")
      .update({ status: "cancelada" })
      .eq("contrato_id", d.id)
      .eq("status", "aberta")
      .gt("vencimento", d.data);
  }
  revalidar();
  return { ok: true };
}

/* ------------------------------- Faturas ------------------------------- */

/** Gera as mensalidades de um mês para todos os contratos ativos. Idempotente. */
export async function gerarFaturasDoMes(mes: string): Promise<ActionResult & { criadas?: number }> {
  if (!/^\d{4}-\d{2}$/.test(mes)) return { ok: false, erro: "Mês inválido." };
  const ctx = await contexto(SO_AGENCIA);
  if (ctx.estado !== "ok") return bloqueio(ctx);
  const db = ctx.supabase;
  const { data: contratos, error } = await db.from("contratos").select("*").eq("status", "ativo");
  if (error) return erroBanco(error, "Não foi possível ler os contratos.");
  const competencia = `${mes}-01`;
  const linhas = (contratos as Contrato[])
    .filter((c) => c.inicio.slice(0, 7) <= mes && Number(c.mensalidade) > 0)
    .map((c) => ({
      organization_id: c.organization_id,
      contrato_id: c.id,
      competencia,
      descricao: "Mensalidade",
      valor: Number(c.mensalidade),
      vencimento: vencimentoDe(c, mes),
      status: "aberta" as const,
      tipo: "mensalidade" as const,
    }));
  if (!linhas.length) return { ok: true, criadas: 0 };
  const { data: criadas, error: e2 } = await db
    .from("faturas")
    .upsert(linhas, { onConflict: "contrato_id,competencia", ignoreDuplicates: true })
    .select("id");
  if (e2) return erroBanco(e2, "Não foi possível gerar as faturas.");
  revalidar();
  return { ok: true, criadas: criadas?.length ?? 0 };
}

export async function pagarFatura(id: string, pagoEm: string, forma: string): Promise<ActionResult> {
  const ctx = await contexto(SO_AGENCIA);
  if (ctx.estado !== "ok") return bloqueio(ctx);
  const { error } = await ctx.supabase
    .from("faturas")
    .update({ status: "paga", pago_em: pagoEm || hoje(), forma_pagamento: forma || "pix" })
    .eq("id", id);
  if (error) return erroBanco(error, "Não foi possível dar baixa.");
  revalidar();
  return { ok: true };
}

export async function reabrirFatura(id: string): Promise<ActionResult> {
  const ctx = await contexto(SO_AGENCIA);
  if (ctx.estado !== "ok") return bloqueio(ctx);
  const { error } = await ctx.supabase
    .from("faturas")
    .update({ status: "aberta", pago_em: null, forma_pagamento: null })
    .eq("id", id);
  if (error) return erroBanco(error, "Não foi possível reabrir.");
  revalidar();
  return { ok: true };
}

export async function cancelarFatura(id: string): Promise<ActionResult> {
  const ctx = await contexto(SO_AGENCIA);
  if (ctx.estado !== "ok") return bloqueio(ctx);
  const { error } = await ctx.supabase.from("faturas").update({ status: "cancelada" }).eq("id", id);
  if (error) return erroBanco(error, "Não foi possível cancelar.");
  revalidar();
  return { ok: true };
}

const avulsaSchema = z.object({
  organizationId: z.string().min(1, "Escolha a clínica."),
  descricao: z.string().trim().min(2, "Descreva a cobrança."),
  valor: z.coerce.number().positive("Informe o valor."),
  vencimento: data,
});

export async function criarFaturaAvulsa(input: z.input<typeof avulsaSchema>): Promise<ActionResult> {
  const p = avulsaSchema.safeParse(input);
  if (!p.success) return { ok: false, erro: p.error.errors[0]?.message ?? "Dados inválidos." };
  const ctx = await contexto(SO_AGENCIA);
  if (ctx.estado !== "ok") return bloqueio(ctx);
  const d = p.data;
  const { error } = await ctx.supabase.from("faturas").insert({
    organization_id: d.organizationId,
    competencia: `${d.vencimento.slice(0, 7)}-01`,
    descricao: d.descricao,
    valor: d.valor,
    vencimento: d.vencimento,
    status: "aberta",
    tipo: "avulsa",
  });
  if (error) return erroBanco(error, "Não foi possível criar a cobrança.");
  revalidar();
  return { ok: true };
}

/* -------------------------------- Custos -------------------------------- */

const custoSchema = z.object({
  id: z.string().optional(),
  descricao: z.string().trim().min(2, "Descreva o custo."),
  categoria: z.enum(["ferramentas", "equipe", "midia", "impostos", "estrutura", "outros"]),
  valor: z.coerce.number().positive("Informe o valor."),
  competencia: z.string().regex(/^\d{4}-\d{2}$/, "Mês inválido."),
  recorrente: z.boolean().default(true),
  organizationId: z.string().optional().or(z.literal("")),
});

export type CustoInput = z.input<typeof custoSchema>;

export async function salvarCusto(input: CustoInput): Promise<ActionResult> {
  const p = custoSchema.safeParse(input);
  if (!p.success) return { ok: false, erro: p.error.errors[0]?.message ?? "Dados inválidos." };
  const ctx = await contexto(SO_AGENCIA);
  if (ctx.estado !== "ok") return bloqueio(ctx);
  const d = p.data;
  const registro = {
    descricao: d.descricao,
    categoria: d.categoria,
    valor: d.valor,
    competencia: `${d.competencia}-01`,
    recorrente: d.recorrente,
    organization_id: d.organizationId || null,
  };
  const { error } = d.id
    ? await ctx.supabase.from("custos_agencia").update(registro).eq("id", d.id)
    : await ctx.supabase.from("custos_agencia").insert(registro);
  if (error) return erroBanco(error, "Não foi possível salvar o custo.");
  revalidar();
  return { ok: true };
}

export async function excluirCusto(id: string): Promise<ActionResult> {
  const ctx = await contexto(SO_AGENCIA);
  if (ctx.estado !== "ok") return bloqueio(ctx);
  const { error } = await ctx.supabase.from("custos_agencia").delete().eq("id", id);
  if (error) return erroBanco(error, "Não foi possível excluir.");
  revalidar();
  return { ok: true };
}

/** Copia os custos recorrentes do mês anterior para o mês informado. */
export async function repetirCustosRecorrentes(mes: string): Promise<ActionResult> {
  const ctx = await contexto(SO_AGENCIA);
  if (ctx.estado !== "ok") return bloqueio(ctx);
  const [a, m] = mes.split("-").map(Number);
  const anterior = new Date(a, m - 2, 1);
  const compAnterior = `${anterior.getFullYear()}-${String(anterior.getMonth() + 1).padStart(2, "0")}-01`;
  const db = ctx.supabase;
  const [{ data: base }, { data: ja }] = await Promise.all([
    db.from("custos_agencia").select("*").eq("competencia", compAnterior).eq("recorrente", true),
    db.from("custos_agencia").select("descricao").eq("competencia", `${mes}-01`),
  ]);
  const existentes = new Set((ja ?? []).map((c) => c.descricao));
  const novos = (base ?? [])
    .filter((c) => !existentes.has(c.descricao))
    .map((c) => ({
      descricao: c.descricao,
      categoria: c.categoria,
      valor: c.valor,
      competencia: `${mes}-01`,
      recorrente: true,
      organization_id: c.organization_id,
    }));
  if (!novos.length) return { ok: false, erro: "Nada a copiar: os recorrentes já estão neste mês." };
  const { error } = await db.from("custos_agencia").insert(novos);
  if (error) return erroBanco(error, "Não foi possível copiar.");
  revalidar();
  return { ok: true };
}
