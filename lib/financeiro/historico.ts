/**
 * HISTÓRICO DE CAIXA
 *
 * Leitura de fechamentos mensais importados: o que entrou, o que saiu e
 * quanto sobrou, com as conclusões que um consultor tiraria (meses de
 * superávit e déficit, pico e vale do saldo, concentração de receita,
 * peso de distribuição de lucros e de custo financeiro).
 */
import type { ComposicaoFinanceira, FechamentoFinanceiro, NaturezaComposicao } from "@/lib/supabase/types";

const n = (v: unknown) => Number(v ?? 0) || 0;

export const ROTULO_NATUREZA: Record<NaturezaComposicao, string> = {
  convenio: "Convênio",
  particular: "Particular",
  outras: "Outras receitas",
  operacional: "Despesa da operação",
  socios: "Sócios",
  financeiro: "Custo financeiro",
  investimento: "Investimento",
};

export type MesHistorico = {
  mes: string;
  entradas: number;
  saidas: number;
  resultado: number;
  saldo: number | null;
  receitaOperacional: number | null;
};

export type LeituraHistorico = {
  meses: MesHistorico[];
  saldoInicial: number | null;
  saldoFinal: number | null;
  totalEntradas: number;
  totalSaidas: number;
  geracao: number;
  positivos: MesHistorico[];
  negativos: MesHistorico[];
  maiorEntrada: MesHistorico | null;
  melhorMes: MesHistorico | null;
  piorMes: MesHistorico | null;
  pico: MesHistorico | null;
  vale: MesHistorico | null;
  variacaoEntradas: number | null;
  variacaoSaidas: number | null;
  variacaoSaldo: number | null;
  receitas: ComposicaoFinanceira[];
  saidasComp: ComposicaoFinanceira[];
  periodo: { inicio: string; fim: string } | null;
  /** Saídas que não são despesa da operação. */
  socios: number;
  financeiro: number;
  investimento: number;
  operacional: number;
  maiorFonte: ComposicaoFinanceira | null;
  conveniosPct: number;
};

export function lerHistorico(fechamentos: FechamentoFinanceiro[], composicoes: ComposicaoFinanceira[]): LeituraHistorico {
  const ordenados = [...fechamentos].sort((a, b) => a.mes.localeCompare(b.mes));
  const comMovimento = ordenados.filter((f) => f.entradas !== null || f.saidas !== null);
  const primeiroMov = comMovimento[0];
  const anteriores = primeiroMov ? ordenados.filter((f) => f.mes < primeiroMov.mes && f.saldo_final !== null) : [];
  const saldoInicial = anteriores.length ? n(anteriores[anteriores.length - 1].saldo_final) : null;

  const meses: MesHistorico[] = comMovimento.map((f) => ({
    mes: f.mes.slice(0, 7),
    entradas: n(f.entradas),
    saidas: n(f.saidas),
    resultado: n(f.entradas) - n(f.saidas),
    saldo: f.saldo_final === null ? null : n(f.saldo_final),
    receitaOperacional: f.receita_operacional === null ? null : n(f.receita_operacional),
  }));

  const totalEntradas = meses.reduce((s, m) => s + m.entradas, 0);
  const totalSaidas = meses.reduce((s, m) => s + m.saidas, 0);
  const comSaldo = meses.filter((m) => m.saldo !== null);
  const primeiro = meses[0];
  const ultimo = meses[meses.length - 1];
  const varPct = (a?: number | null, b?: number | null) => (a && b ? ((b - a) / Math.abs(a)) * 100 : null);

  const receitas = composicoes.filter((c) => c.tipo === "receita").sort((a, b) => n(b.valor) - n(a.valor));
  const saidasComp = composicoes.filter((c) => c.tipo === "saida").sort((a, b) => n(b.valor) - n(a.valor));
  const somaNat = (nat: NaturezaComposicao) => saidasComp.filter((c) => c.natureza === nat).reduce((s, c) => s + n(c.valor), 0);
  const totalReceitasComp = receitas.reduce((s, c) => s + n(c.valor), 0);

  return {
    meses,
    saldoInicial,
    saldoFinal: ultimo?.saldo ?? null,
    totalEntradas,
    totalSaidas,
    geracao: totalEntradas - totalSaidas,
    positivos: meses.filter((m) => m.resultado >= 0),
    negativos: meses.filter((m) => m.resultado < 0),
    maiorEntrada: meses.reduce<MesHistorico | null>((a, m) => (!a || m.entradas > a.entradas ? m : a), null),
    melhorMes: meses.reduce<MesHistorico | null>((a, m) => (!a || m.resultado > a.resultado ? m : a), null),
    piorMes: meses.reduce<MesHistorico | null>((a, m) => (!a || m.resultado < a.resultado ? m : a), null),
    pico: comSaldo.reduce<MesHistorico | null>((a, m) => (!a || (m.saldo ?? 0) > (a.saldo ?? 0) ? m : a), null),
    vale: comSaldo.reduce<MesHistorico | null>((a, m) => (!a || (m.saldo ?? 0) < (a.saldo ?? 0) ? m : a), null),
    variacaoEntradas: varPct(primeiro?.entradas, ultimo?.entradas),
    variacaoSaidas: varPct(primeiro?.saidas, ultimo?.saidas),
    variacaoSaldo: varPct(saldoInicial, ultimo?.saldo),
    receitas,
    saidasComp,
    periodo: composicoes.length ? { inicio: composicoes[0].inicio, fim: composicoes[0].fim } : null,
    socios: somaNat("socios"),
    financeiro: somaNat("financeiro"),
    investimento: somaNat("investimento"),
    operacional: somaNat("operacional"),
    maiorFonte: receitas[0] ?? null,
    conveniosPct: totalReceitasComp
      ? (receitas.filter((c) => c.natureza === "convenio").reduce((s, c) => s + n(c.valor), 0) / totalReceitasComp) * 100
      : 0,
  };
}
