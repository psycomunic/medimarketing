"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  bloqueio,
  contexto,
  GESTAO,
  OPERACIONAL,
  organizacaoAlvo,
  type ActionResult,
} from "@/lib/actions/contexto";
import { adminDisponivel, createAdminClient } from "@/lib/supabase/admin";
import { CONFIG_PADRAO, taxaDe } from "@/lib/financeiro/calculos";
import type { ConfigFinanceira, FormaPagamento } from "@/lib/supabase/types";

/**
 * AÇÕES DO FINANCEIRO DA CLÍNICA
 *
 * Gestor (e a equipe Medi) mexe em tudo. A atendente só registra o
 * pagamento de uma consulta — e isso passa pelo servidor com a service
 * role, porque ela não enxerga o resto do financeiro.
 */

const MSG_SQL = "O financeiro ainda não foi instalado. Rode o SQL do financeiro no Supabase.";

function revalidar() {
  revalidatePath("/app/financeiro", "layout");
  revalidatePath("/app");
}

function erroBanco(error: { message: string } | null, padrao: string): ActionResult {
  if (error && /does not exist|schema cache|column/i.test(error.message)) return { ok: false, erro: MSG_SQL };
  console.error("[financeiro]", error?.message);
  return { ok: false, erro: padrao };
}

const dinheiro = z.coerce.number().min(0, "O valor não pode ser negativo.").max(10_000_000);
const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.");
const formas = z.enum(["pix", "dinheiro", "cartao_credito", "cartao_debito", "convenio", "boleto"]);

/* ------------------------------ Despesas ------------------------------ */

const despesaSchema = z.object({
  id: z.string().optional(),
  organizationId: z.string().optional(),
  descricao: z.string().trim().min(2, "Descreva a despesa."),
  categoria: z.string().min(1),
  fornecedor: z.string().trim().max(120).optional().or(z.literal("")),
  valor: dinheiro.refine((v) => v > 0, "Informe o valor."),
  vencimento: data,
  paga: z.boolean().default(false),
  fixa: z.boolean().default(false),
  /** Repetir todo mês (cria os próximos 11). */
  recorrente: z.boolean().default(false),
  /** Dividir em parcelas mensais. */
  parcelas: z.coerce.number().int().min(1).max(48).default(1),
  observacao: z.string().trim().max(500).optional().or(z.literal("")),
});

export type DespesaInput = z.input<typeof despesaSchema>;

const somarMeses = (iso: string, meses: number) => {
  const [a, m, d] = iso.split("-").map(Number);
  const ultimo = new Date(a, m - 1 + meses + 1, 0).getDate();
  const r = new Date(a, m - 1 + meses, Math.min(d, ultimo));
  return `${r.getFullYear()}-${String(r.getMonth() + 1).padStart(2, "0")}-${String(r.getDate()).padStart(2, "0")}`;
};

export async function salvarDespesa(input: DespesaInput): Promise<ActionResult> {
  const p = despesaSchema.safeParse(input);
  if (!p.success) return { ok: false, erro: p.error.errors[0]?.message ?? "Dados inválidos." };
  const ctx = await contexto(GESTAO);
  if (ctx.estado !== "ok") return bloqueio(ctx);
  const d = p.data;
  const orgId = organizacaoAlvo(ctx.profile, d.organizationId);
  if (!orgId) return { ok: false, erro: "Clínica inválida." };

  const base = {
    organization_id: orgId,
    descricao: d.descricao,
    categoria: d.categoria as never,
    fornecedor: d.fornecedor || null,
    fixa: d.fixa,
    observacao: d.observacao || null,
  };

  if (d.id) {
    const { error } = await ctx.supabase
      .from("despesas")
      .update({
        ...base,
        valor: d.valor,
        vencimento: d.vencimento,
        status: d.paga ? "paga" : "aberta",
        pago_em: d.paga ? d.vencimento : null,
      })
      .eq("id", d.id)
      .eq("organization_id", orgId);
    if (error) return erroBanco(error, "Não foi possível salvar a despesa.");
    revalidar();
    return { ok: true };
  }

  const grupo = d.recorrente || d.parcelas > 1 ? crypto.randomUUID() : null;
  const quantas = d.parcelas > 1 ? d.parcelas : d.recorrente ? 12 : 1;
  const valorParcela = d.parcelas > 1 ? Math.round((d.valor / d.parcelas) * 100) / 100 : d.valor;
  const linhas = Array.from({ length: quantas }, (_, i) => ({
    ...base,
    valor: valorParcela,
    vencimento: somarMeses(d.vencimento, i),
    status: (i === 0 && d.paga ? "paga" : "aberta") as "paga" | "aberta",
    pago_em: i === 0 && d.paga ? d.vencimento : null,
    recorrente: d.recorrente,
    grupo,
    parcela: d.parcelas > 1 ? i + 1 : null,
    parcelas: d.parcelas > 1 ? d.parcelas : null,
  }));
  const { error } = await ctx.supabase.from("despesas").insert(linhas);
  if (error) return erroBanco(error, "Não foi possível salvar a despesa.");
  revalidar();
  return { ok: true };
}

export async function pagarDespesa(id: string, pagoEm?: string): Promise<ActionResult> {
  const ctx = await contexto(GESTAO);
  if (ctx.estado !== "ok") return bloqueio(ctx);
  const hoje = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
  const { error } = await ctx.supabase
    .from("despesas")
    .update({ status: "paga", pago_em: pagoEm || hoje })
    .eq("id", id);
  if (error) return erroBanco(error, "Não foi possível marcar como paga.");
  revalidar();
  return { ok: true };
}

export async function reabrirDespesa(id: string): Promise<ActionResult> {
  const ctx = await contexto(GESTAO);
  if (ctx.estado !== "ok") return bloqueio(ctx);
  const { error } = await ctx.supabase.from("despesas").update({ status: "aberta", pago_em: null }).eq("id", id);
  if (error) return erroBanco(error, "Não foi possível reabrir.");
  revalidar();
  return { ok: true };
}

/** Exclui uma despesa; com `seguintes`, também as próximas do mesmo grupo ainda em aberto. */
export async function excluirDespesa(id: string, seguintes = false): Promise<ActionResult> {
  const ctx = await contexto(GESTAO);
  if (ctx.estado !== "ok") return bloqueio(ctx);
  const { data: d } = await ctx.supabase.from("despesas").select("grupo,vencimento").eq("id", id).maybeSingle();
  let q = ctx.supabase.from("despesas").delete();
  q = seguintes && d?.grupo ? q.eq("grupo", d.grupo).gte("vencimento", d.vencimento).neq("status", "paga") : q.eq("id", id);
  const { error } = await q;
  if (error) return erroBanco(error, "Não foi possível excluir.");
  revalidar();
  return { ok: true };
}

/* ------------------------------ Receitas ------------------------------ */

const receitaSchema = z.object({
  id: z.string().optional(),
  organizationId: z.string().optional(),
  pacienteNome: z.string().trim().min(2, "Informe o paciente."),
  procedimento: z.string().trim().min(2, "Informe o procedimento."),
  categoria: z.string().trim().max(60).optional().or(z.literal("")),
  valor: dinheiro,
  custo: dinheiro.default(0),
  desconto: dinheiro.default(0),
  forma: formas,
  convenio: z.string().trim().max(80).optional().or(z.literal("")),
  parcelas: z.coerce.number().int().min(1).max(24).default(1),
  competencia: data,
  recebido: z.boolean().default(false),
  dataRecebimento: data.optional().or(z.literal("")),
  medicoId: z.string().optional().or(z.literal("")),
  observacao: z.string().trim().max(500).optional().or(z.literal("")),
});

export type ReceitaInput = z.input<typeof receitaSchema>;

async function configDe(orgId: string): Promise<ConfigFinanceira> {
  if (!adminDisponivel()) return CONFIG_PADRAO(orgId);
  const { data } = await createAdminClient().from("config_financeira").select("*").eq("organization_id", orgId).maybeSingle();
  return (data as ConfigFinanceira | null) ?? CONFIG_PADRAO(orgId);
}

export async function salvarReceita(input: ReceitaInput): Promise<ActionResult> {
  const p = receitaSchema.safeParse(input);
  if (!p.success) return { ok: false, erro: p.error.errors[0]?.message ?? "Dados inválidos." };
  const ctx = await contexto(GESTAO);
  if (ctx.estado !== "ok") return bloqueio(ctx);
  const d = p.data;
  const orgId = organizacaoAlvo(ctx.profile, d.organizationId);
  if (!orgId) return { ok: false, erro: "Clínica inválida." };
  if (d.desconto > d.valor) return { ok: false, erro: "O desconto é maior que o valor." };

  const config = await configDe(orgId);
  const liquido = d.valor - d.desconto;
  const registro = {
    organization_id: orgId,
    paciente_nome: d.pacienteNome,
    procedimento: d.procedimento,
    categoria: d.categoria || null,
    valor: d.valor,
    custo: d.custo,
    desconto: d.desconto,
    forma_pagamento: d.forma as FormaPagamento,
    convenio: d.forma === "convenio" ? d.convenio || null : null,
    parcelas: d.parcelas,
    taxa: taxaDe(liquido, d.forma as FormaPagamento, config),
    data_competencia: d.competencia,
    status: (d.recebido ? "recebido" : "previsto") as "recebido" | "previsto",
    data_recebimento: d.recebido ? d.dataRecebimento || d.competencia : null,
    medico_id: d.medicoId || null,
    observacao: d.observacao || null,
    atualizado_em: new Date().toISOString(),
  };

  const { error } = d.id
    ? await ctx.supabase.from("lancamentos").update(registro).eq("id", d.id).eq("organization_id", orgId)
    : await ctx.supabase.from("lancamentos").insert({ ...registro, consulta_id: null, origem: "manual" });
  if (error) return erroBanco(error, "Não foi possível salvar a receita.");
  revalidar();
  return { ok: true };
}

export async function excluirReceita(id: string): Promise<ActionResult> {
  const ctx = await contexto(GESTAO);
  if (ctx.estado !== "ok") return bloqueio(ctx);
  const { error } = await ctx.supabase.from("lancamentos").update({ status: "cancelado" }).eq("id", id);
  if (error) return erroBanco(error, "Não foi possível cancelar.");
  revalidar();
  return { ok: true };
}

const recebimentoSchema = z.object({
  lancamentoId: z.string().optional(),
  consultaId: z.string().optional(),
  forma: formas,
  convenio: z.string().trim().max(80).optional().or(z.literal("")),
  valor: dinheiro.optional(),
  desconto: dinheiro.default(0),
  parcelas: z.coerce.number().int().min(1).max(24).default(1),
  data: data,
  /** Falso deixa como "a receber" (convênio, boleto). */
  recebido: z.boolean().default(true),
});

export type RecebimentoInput = z.input<typeof recebimentoSchema>;

/**
 * Registra o pagamento de uma consulta (ou de uma receita). A atendente
 * também pode: é ela quem está no balcão quando o paciente paga.
 */
export async function registrarRecebimento(input: RecebimentoInput): Promise<ActionResult> {
  const p = recebimentoSchema.safeParse(input);
  if (!p.success) return { ok: false, erro: p.error.errors[0]?.message ?? "Dados inválidos." };
  const ctx = await contexto(OPERACIONAL);
  if (ctx.estado !== "ok") return bloqueio(ctx);
  if (!adminDisponivel()) return { ok: false, erro: "Falta a SUPABASE_SERVICE_ROLE_KEY nas variáveis de ambiente." };
  const d = p.data;
  const admin = createAdminClient();

  let lanc: { id: string; organization_id: string; valor: number } | null = null;
  if (d.lancamentoId) {
    const { data: l } = await admin.from("lancamentos").select("id,organization_id,valor").eq("id", d.lancamentoId).maybeSingle();
    lanc = l;
  } else if (d.consultaId) {
    const { sincronizarReceita } = await import("@/lib/financeiro/agenda");
    await sincronizarReceita(d.consultaId);
    const { data: l } = await admin.from("lancamentos").select("id,organization_id,valor").eq("consulta_id", d.consultaId).maybeSingle();
    lanc = l;
    if (!lanc) {
      // Consulta sem valor cadastrado: cria a receita agora com o valor informado
      const { data: c } = await admin
        .from("consultas")
        .select("id,organization_id,medico_id,paciente_nome,data_hora,tipo")
        .eq("id", d.consultaId)
        .maybeSingle();
      if (!c) return { ok: false, erro: "Consulta não encontrada." };
      const { data: novo, error } = await admin
        .from("lancamentos")
        .insert({
          organization_id: c.organization_id!,
          consulta_id: c.id,
          medico_id: c.medico_id,
          paciente_nome: c.paciente_nome,
          procedimento: "Consulta",
          categoria: "Consultas",
          valor: d.valor ?? 0,
          custo: 0,
          forma_pagamento: d.forma,
          status: "previsto",
          data_competencia: new Date(c.data_hora).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }),
          data_recebimento: null,
          observacao: null,
          origem: "agenda",
        })
        .select("id,organization_id,valor")
        .single();
      if (error) return erroBanco(error, "Não foi possível registrar o pagamento.");
      lanc = novo;
    }
  }
  if (!lanc) return { ok: false, erro: "Receita não encontrada." };
  if (ctx.profile.role !== "super_admin" && lanc.organization_id !== ctx.profile.organization_id) {
    return { ok: false, erro: "Essa receita não é da sua clínica." };
  }

  const valor = d.valor ?? Number(lanc.valor);
  if (d.desconto > valor) return { ok: false, erro: "O desconto é maior que o valor." };
  const config = await configDe(lanc.organization_id);
  const { error } = await admin
    .from("lancamentos")
    .update({
      valor,
      desconto: d.desconto,
      forma_pagamento: d.forma,
      convenio: d.forma === "convenio" ? d.convenio || null : null,
      parcelas: d.parcelas,
      taxa: taxaDe(valor - d.desconto, d.forma, config),
      status: d.recebido ? "recebido" : "previsto",
      data_recebimento: d.recebido ? d.data : null,
      previsao_recebimento: d.recebido ? null : d.data,
      atualizado_em: new Date().toISOString(),
    })
    .eq("id", lanc.id);
  if (error) return erroBanco(error, "Não foi possível registrar o pagamento.");
  revalidar();
  revalidatePath("/app/agenda");
  return { ok: true };
}

export async function registrarGlosa(lancamentoId: string, valor: number, motivo: string): Promise<ActionResult> {
  const ctx = await contexto(GESTAO);
  if (ctx.estado !== "ok") return bloqueio(ctx);
  if (!(valor >= 0)) return { ok: false, erro: "Valor inválido." };
  const { data: l } = await ctx.supabase.from("lancamentos").select("valor,desconto").eq("id", lancamentoId).maybeSingle();
  if (!l) return { ok: false, erro: "Receita não encontrada." };
  if (valor > Number(l.valor) - Number(l.desconto ?? 0)) return { ok: false, erro: "A glosa é maior que o valor faturado." };
  const { error } = await ctx.supabase
    .from("lancamentos")
    .update({ glosa: valor, glosa_motivo: motivo.trim() || null })
    .eq("id", lancamentoId);
  if (error) return erroBanco(error, "Não foi possível registrar a glosa.");
  revalidar();
  return { ok: true };
}

/** Marca como recebidos vários lançamentos de convênio de uma vez (lote pago). */
export async function receberLote(ids: string[], dataPagamento: string): Promise<ActionResult> {
  const ctx = await contexto(GESTAO);
  if (ctx.estado !== "ok") return bloqueio(ctx);
  if (!ids.length) return { ok: false, erro: "Escolha ao menos um atendimento." };
  const { error } = await ctx.supabase
    .from("lancamentos")
    .update({ status: "recebido", data_recebimento: dataPagamento })
    .in("id", ids);
  if (error) return erroBanco(error, "Não foi possível dar baixa.");
  revalidar();
  return { ok: true };
}

/* --------------------------- Tabela de preços --------------------------- */

const precoSchema = z.object({
  id: z.string().optional(),
  organizationId: z.string().optional(),
  procedimento: z.string().trim().min(2, "Informe o procedimento."),
  categoria: z.string().trim().max(60).optional().or(z.literal("")),
  convenio: z.string().trim().max(80).optional().or(z.literal("")),
  valor: dinheiro,
  custo: dinheiro.default(0),
  duracao: z.coerce.number().int().min(0).max(600).optional(),
});

export type PrecoInput = z.input<typeof precoSchema>;

export async function salvarPreco(input: PrecoInput): Promise<ActionResult> {
  const p = precoSchema.safeParse(input);
  if (!p.success) return { ok: false, erro: p.error.errors[0]?.message ?? "Dados inválidos." };
  const ctx = await contexto(GESTAO);
  if (ctx.estado !== "ok") return bloqueio(ctx);
  const d = p.data;
  const orgId = organizacaoAlvo(ctx.profile, d.organizationId);
  if (!orgId) return { ok: false, erro: "Clínica inválida." };
  const registro = {
    organization_id: orgId,
    procedimento: d.procedimento,
    categoria: d.categoria || null,
    convenio: d.convenio || null,
    valor: d.valor,
    custo: d.custo,
    duracao_min: d.duracao || null,
    ativo: true,
  };
  const { error } = d.id
    ? await ctx.supabase.from("tabela_precos").update(registro).eq("id", d.id)
    : await ctx.supabase.from("tabela_precos").insert(registro);
  if (error) return erroBanco(error, "Não foi possível salvar o preço.");
  revalidar();
  return { ok: true };
}

export async function excluirPreco(id: string): Promise<ActionResult> {
  const ctx = await contexto(GESTAO);
  if (ctx.estado !== "ok") return bloqueio(ctx);
  const { error } = await ctx.supabase.from("tabela_precos").delete().eq("id", id);
  if (error) return erroBanco(error, "Não foi possível excluir.");
  revalidar();
  return { ok: true };
}

/* ----------------------------- Configuração ----------------------------- */

const configSchema = z.object({
  organizationId: z.string().optional(),
  taxas: z.record(z.coerce.number().min(0).max(30)),
  imposto: z.coerce.number().min(0).max(40),
  reservaGlosa: z.coerce.number().min(0).max(50),
  saldoInicial: z.coerce.number().min(-10_000_000).max(100_000_000),
  metaLucro: z.coerce.number().min(0).max(100_000_000).optional().nullable(),
});

export type ConfigInput = z.input<typeof configSchema>;

export async function salvarConfigFinanceira(input: ConfigInput): Promise<ActionResult> {
  const p = configSchema.safeParse(input);
  if (!p.success) return { ok: false, erro: p.error.errors[0]?.message ?? "Dados inválidos." };
  const ctx = await contexto(GESTAO);
  if (ctx.estado !== "ok") return bloqueio(ctx);
  const d = p.data;
  const orgId = organizacaoAlvo(ctx.profile, d.organizationId);
  if (!orgId) return { ok: false, erro: "Clínica inválida." };
  const { error } = await ctx.supabase.from("config_financeira").upsert({
    organization_id: orgId,
    taxas: d.taxas,
    imposto: d.imposto,
    reserva_glosa: d.reservaGlosa,
    saldo_inicial: d.saldoInicial,
    meta_lucro: d.metaLucro || null,
    atualizado_em: new Date().toISOString(),
  });
  if (error) return erroBanco(error, "Não foi possível salvar a configuração.");
  revalidar();
  return { ok: true };
}

/* ------------------------------- Repasse ------------------------------- */

const regraSchema = z.object({
  organizationId: z.string().optional(),
  medicoId: z.string().min(1),
  tipo: z.enum(["percentual", "fixo"]),
  valor: z.coerce.number().min(0).max(100_000),
  base: z.enum(["bruto", "liquido"]),
  soRecebido: z.boolean(),
});

export type RegraInput = z.input<typeof regraSchema>;

export async function salvarRegraRepasse(input: RegraInput): Promise<ActionResult> {
  const p = regraSchema.safeParse(input);
  if (!p.success) return { ok: false, erro: "Regra inválida." };
  const ctx = await contexto(GESTAO);
  if (ctx.estado !== "ok") return bloqueio(ctx);
  const d = p.data;
  if (d.tipo === "percentual" && d.valor > 100) return { ok: false, erro: "O percentual vai até 100%." };
  const orgId = organizacaoAlvo(ctx.profile, d.organizationId);
  if (!orgId) return { ok: false, erro: "Clínica inválida." };
  const { error } = await ctx.supabase.from("regras_repasse").upsert(
    {
      organization_id: orgId,
      medico_id: d.medicoId,
      tipo: d.tipo,
      valor: d.valor,
      base: d.base,
      so_recebido: d.soRecebido,
    },
    { onConflict: "organization_id,medico_id" }
  );
  if (error) return erroBanco(error, "Não foi possível salvar a regra.");
  revalidar();
  return { ok: true };
}

export async function fecharRepasse(input: {
  organizationId?: string;
  medicoId: string;
  competencia: string;
  atendimentos: number;
  base: number;
  valor: number;
}): Promise<ActionResult> {
  const ctx = await contexto(GESTAO);
  if (ctx.estado !== "ok") return bloqueio(ctx);
  const orgId = organizacaoAlvo(ctx.profile, input.organizationId);
  if (!orgId) return { ok: false, erro: "Clínica inválida." };
  const { error } = await ctx.supabase.from("repasses").upsert(
    {
      organization_id: orgId,
      medico_id: input.medicoId,
      competencia: input.competencia,
      atendimentos: input.atendimentos,
      base: input.base,
      valor: input.valor,
      status: "fechado",
      fechado_por: ctx.profile.id,
    },
    { onConflict: "organization_id,medico_id,competencia" }
  );
  if (error) return erroBanco(error, "Não foi possível fechar o repasse.");
  revalidar();
  return { ok: true };
}

export async function pagarRepasse(id: string, pagoEm: string): Promise<ActionResult> {
  const ctx = await contexto(GESTAO);
  if (ctx.estado !== "ok") return bloqueio(ctx);
  const { data: r } = await ctx.supabase.from("repasses").select("*").eq("id", id).maybeSingle();
  if (!r) return { ok: false, erro: "Repasse não encontrado." };
  const { error } = await ctx.supabase.from("repasses").update({ status: "pago", pago_em: pagoEm }).eq("id", id);
  if (error) return erroBanco(error, "Não foi possível marcar como pago.");
  revalidar();
  return { ok: true };
}

export async function reabrirRepasse(id: string): Promise<ActionResult> {
  const ctx = await contexto(GESTAO);
  if (ctx.estado !== "ok") return bloqueio(ctx);
  const { error } = await ctx.supabase.from("repasses").delete().eq("id", id).neq("status", "pago");
  if (error) return erroBanco(error, "Não foi possível reabrir.");
  revalidar();
  return { ok: true };
}

export type PagamentoDaConsulta = {
  lancamento: import("@/lib/supabase/types").Lancamento | null;
  /** Falso para o médico: ele vê a agenda, não o caixa. */
  podeRegistrar: boolean;
};

/** Situação do pagamento de uma consulta, para a ficha na agenda. */
export async function lerPagamentoConsulta(consultaId: string): Promise<PagamentoDaConsulta | null> {
  const ctx = await contexto();
  if (ctx.estado !== "ok") return null;
  const podeRegistrar = OPERACIONAL.includes(ctx.profile.role);
  if (!podeRegistrar || !adminDisponivel()) return { lancamento: null, podeRegistrar: false };
  const admin = createAdminClient();
  const { data } = await admin.from("lancamentos").select("*").eq("consulta_id", consultaId).maybeSingle();
  if (data && ctx.profile.role !== "super_admin" && data.organization_id !== ctx.profile.organization_id) return null;
  return { lancamento: (data as import("@/lib/supabase/types").Lancamento | null) ?? null, podeRegistrar };
}

/* --------------------------- Histórico de caixa --------------------------- */

const fechamentoSchema = z.object({
  organizationId: z.string().optional(),
  mes: z.string().regex(/^\d{4}-\d{2}$/, "Mês inválido."),
  entradas: z.coerce.number().min(0).max(100_000_000).nullable(),
  saidas: z.coerce.number().min(0).max(100_000_000).nullable(),
  saldoFinal: z.coerce.number().min(-100_000_000).max(100_000_000).nullable(),
  receitaOperacional: z.coerce.number().min(0).max(100_000_000).nullable(),
  observacao: z.string().trim().max(300).optional().or(z.literal("")),
});

export type FechamentoInput = z.input<typeof fechamentoSchema>;

/** Lança ou corrige o fechamento de caixa de um mês. */
export async function salvarFechamento(input: FechamentoInput): Promise<ActionResult> {
  const p = fechamentoSchema.safeParse(input);
  if (!p.success) return { ok: false, erro: p.error.errors[0]?.message ?? "Dados inválidos." };
  const ctx = await contexto(GESTAO);
  if (ctx.estado !== "ok") return bloqueio(ctx);
  const d = p.data;
  const orgId = organizacaoAlvo(ctx.profile, d.organizationId);
  if (!orgId) return { ok: false, erro: "Clínica inválida." };
  const { error } = await ctx.supabase.from("fechamentos_financeiros").upsert(
    {
      organization_id: orgId,
      mes: `${d.mes}-01`,
      entradas: d.entradas,
      saidas: d.saidas,
      saldo_final: d.saldoFinal,
      receita_operacional: d.receitaOperacional,
      observacao: d.observacao || null,
      origem: "manual",
    },
    { onConflict: "organization_id,mes" }
  );
  if (error) return erroBanco(error, "Não foi possível salvar o fechamento.");
  revalidar();
  revalidatePath("/app/clinicas", "layout");
  return { ok: true };
}

export async function excluirFechamento(id: string): Promise<ActionResult> {
  const ctx = await contexto(GESTAO);
  if (ctx.estado !== "ok") return bloqueio(ctx);
  const { error } = await ctx.supabase.from("fechamentos_financeiros").delete().eq("id", id);
  if (error) return erroBanco(error, "Não foi possível excluir.");
  revalidar();
  revalidatePath("/app/clinicas", "layout");
  return { ok: true };
}
