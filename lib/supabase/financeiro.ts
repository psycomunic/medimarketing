import { createClient } from "@/lib/supabase/server";
import { emModoDemo } from "@/lib/supabase/queries";
import { demoLancamentos } from "@/lib/demo-modulos";
import type { FormaPagamento, Lancamento } from "@/lib/supabase/types";

/** Primeiro e último dia de um mês "YYYY-MM". */
export function limitesDoMes(mes: string): { de: string; ate: string } {
  const [ano, m] = mes.split("-").map(Number);
  const ultimo = new Date(ano, m, 0).getDate();
  return { de: `${mes}-01`, ate: `${mes}-${String(ultimo).padStart(2, "0")}` };
}

/** Mês corrente no formato "YYYY-MM". */
export function mesCorrente(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Lançamentos num intervalo de competência (datas "YYYY-MM-DD"). */
export async function getLancamentos(
  organizationId: string | null,
  de: string,
  ate: string
): Promise<Lancamento[]> {
  if (await emModoDemo()) {
    return demoLancamentos().filter(
      (l) => l.data_competencia >= de && l.data_competencia <= ate
    );
  }
  if (!organizationId) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("lancamentos")
    .select("*")
    .eq("organization_id", organizationId)
    .gte("data_competencia", de)
    .lte("data_competencia", ate)
    .order("data_competencia", { ascending: false });

  return data ?? [];
}

/** Meses com lançamento, do mais recente para o mais antigo. */
export async function getMesesDisponiveis(
  organizationId: string | null
): Promise<string[]> {
  let datas: string[];

  if (await emModoDemo()) {
    datas = demoLancamentos().map((l) => l.data_competencia);
  } else if (organizationId) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("lancamentos")
      .select("data_competencia")
      .eq("organization_id", organizationId)
      .order("data_competencia", { ascending: false })
      .limit(2000);
    datas = (data ?? []).map((l) => l.data_competencia);
  } else {
    datas = [];
  }

  const meses = [...new Set(datas.map((d) => d.slice(0, 7)))].sort((a, b) =>
    b.localeCompare(a)
  );

  // Sem histórico, o seletor ainda precisa oferecer o mês atual
  return meses.length ? meses : [mesCorrente()];
}

/* ------------------------------------------------------------------ */
/* Cálculos                                                            */
/* ------------------------------------------------------------------ */

export type ResumoFinanceiro = {
  bruto: number;
  custos: number;
  liquido: number;
  recebido: number;
  aReceber: number;
  atrasado: number;
  atendimentos: number;
  /** Pacientes distintos no período. */
  pacientes: number;
  ticketMedio: number;
  /** Margem sobre o faturamento bruto. */
  margem: number;
};

/** Cancelado não entra em nada: não é receita nem previsão. */
const validos = (lista: Lancamento[]) => lista.filter((l) => l.status !== "cancelado");

export function resumirFinanceiro(lancamentos: Lancamento[]): ResumoFinanceiro {
  const lista = validos(lancamentos);

  const bruto = lista.reduce((s, l) => s + Number(l.valor), 0);
  const custos = lista.reduce((s, l) => s + Number(l.custo), 0);
  const pacientes = new Set(lista.map((l) => l.paciente_nome)).size;
  // Retorno tem valor zero e distorceria o ticket médio
  const cobrados = lista.filter((l) => Number(l.valor) > 0);

  return {
    bruto,
    custos,
    liquido: bruto - custos,
    recebido: lista
      .filter((l) => l.status === "recebido")
      .reduce((s, l) => s + Number(l.valor), 0),
    aReceber: lista
      .filter((l) => l.status === "previsto")
      .reduce((s, l) => s + Number(l.valor), 0),
    atrasado: lista
      .filter((l) => l.status === "atrasado")
      .reduce((s, l) => s + Number(l.valor), 0),
    atendimentos: lista.length,
    pacientes,
    ticketMedio: cobrados.length
      ? cobrados.reduce((s, l) => s + Number(l.valor), 0) / cobrados.length
      : 0,
    margem: bruto ? ((bruto - custos) / bruto) * 100 : 0,
  };
}

export type LinhaProcedimento = {
  procedimento: string;
  categoria: string | null;
  quantidade: number;
  bruto: number;
  custo: number;
  liquido: number;
  ticket: number;
};

/** Receita agrupada por procedimento, do que mais fatura para o que menos. */
export function porProcedimento(lancamentos: Lancamento[]): LinhaProcedimento[] {
  const mapa = new Map<string, LinhaProcedimento>();

  for (const l of validos(lancamentos)) {
    const atual = mapa.get(l.procedimento) ?? {
      procedimento: l.procedimento,
      categoria: l.categoria,
      quantidade: 0,
      bruto: 0,
      custo: 0,
      liquido: 0,
      ticket: 0,
    };
    atual.quantidade += 1;
    atual.bruto += Number(l.valor);
    atual.custo += Number(l.custo);
    mapa.set(l.procedimento, atual);
  }

  return [...mapa.values()]
    .map((p) => ({
      ...p,
      liquido: p.bruto - p.custo,
      ticket: p.quantidade ? p.bruto / p.quantidade : 0,
    }))
    .sort((a, b) => b.bruto - a.bruto);
}

/** Receita por forma de pagamento — mostra a dependência de convênio. */
export function porFormaPagamento(
  lancamentos: Lancamento[]
): { forma: FormaPagamento; total: number; quantidade: number }[] {
  const mapa = new Map<FormaPagamento, { total: number; quantidade: number }>();

  for (const l of validos(lancamentos)) {
    const atual = mapa.get(l.forma_pagamento) ?? { total: 0, quantidade: 0 };
    atual.total += Number(l.valor);
    atual.quantidade += 1;
    mapa.set(l.forma_pagamento, atual);
  }

  return [...mapa.entries()]
    .map(([forma, v]) => ({ forma, ...v }))
    .sort((a, b) => b.total - a.total);
}

/**
 * Valor do paciente ao longo do tempo.
 *
 * Aproximação honesta do LTV: quanto cada paciente já deixou no período
 * carregado e quantas vezes voltou. Vira LTV de verdade quando houver
 * histórico completo, e não só a janela consultada.
 */
export type LinhaPaciente = {
  paciente: string;
  atendimentos: number;
  total: number;
};

export function porPaciente(lancamentos: Lancamento[]): LinhaPaciente[] {
  const mapa = new Map<string, LinhaPaciente>();

  for (const l of validos(lancamentos)) {
    const atual = mapa.get(l.paciente_nome) ?? {
      paciente: l.paciente_nome,
      atendimentos: 0,
      total: 0,
    };
    atual.atendimentos += 1;
    atual.total += Number(l.valor);
    mapa.set(l.paciente_nome, atual);
  }

  return [...mapa.values()].sort((a, b) => b.total - a.total);
}
