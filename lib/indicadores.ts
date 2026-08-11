/**
 * Cálculos e formatação dos indicadores.
 *
 * Funções puras, sem acesso a banco: servem tanto para o painel da clínica
 * quanto para a visão consolidada do administrativo.
 */
import type { IndicadorMensal } from "@/lib/supabase/types";

export type Kpis = {
  investimento: number;
  leads: number;
  agendamentos: number;
  comparecimentos: number;
  faturamento: number;
  /** Custo por lead */
  cpl: number;
  /** Custo por paciente que efetivamente compareceu */
  custoPorPaciente: number;
  ticketMedio: number;
  /** Faturamento dividido pelo investimento (ex.: 4.8 = 4,8x) */
  roi: number;
  /** Percentuais de conversão entre etapas do funil */
  taxaLeadAgendamento: number;
  taxaAgendamentoComparecimento: number;
  taxaLeadPaciente: number;
};

const div = (a: number, b: number) => (b > 0 ? a / b : 0);
const pct = (a: number, b: number) => (b > 0 ? (a / b) * 100 : 0);

/** Soma uma lista de meses e deriva os indicadores calculados. */
export function calcularKpis(meses: IndicadorMensal[]): Kpis {
  const soma = meses.reduce(
    (acc, m) => ({
      investimento: acc.investimento + Number(m.investimento),
      leads: acc.leads + m.leads,
      agendamentos: acc.agendamentos + m.agendamentos,
      comparecimentos: acc.comparecimentos + m.comparecimentos,
      faturamento: acc.faturamento + Number(m.faturamento),
    }),
    { investimento: 0, leads: 0, agendamentos: 0, comparecimentos: 0, faturamento: 0 }
  );

  return {
    ...soma,
    cpl: div(soma.investimento, soma.leads),
    custoPorPaciente: div(soma.investimento, soma.comparecimentos),
    ticketMedio: div(soma.faturamento, soma.comparecimentos),
    roi: div(soma.faturamento, soma.investimento),
    taxaLeadAgendamento: pct(soma.agendamentos, soma.leads),
    taxaAgendamentoComparecimento: pct(soma.comparecimentos, soma.agendamentos),
    taxaLeadPaciente: pct(soma.comparecimentos, soma.leads),
  };
}

/** Variação percentual entre dois valores (0 quando não há base). */
export function variacao(atual: number, anterior: number): number {
  if (!anterior) return 0;
  return ((atual - anterior) / anterior) * 100;
}

/**
 * Etapas do método. Os meses são fatiados a partir do início do
 * acompanhamento: primeiro mês, primeiro trimestre, primeiro semestre e ano.
 */
export type EtapaMetodo = {
  rotulo: string;
  meses: number;
  kpis: Kpis;
  /** Ainda não há histórico suficiente para essa janela */
  parcial: boolean;
};

export function etapasDoMetodo(meses: IndicadorMensal[]): EtapaMetodo[] {
  const emOrdem = [...meses].sort((a, b) => a.mes.localeCompare(b.mes));
  const janelas = [
    { rotulo: "30 dias", meses: 1 },
    { rotulo: "90 dias", meses: 3 },
    { rotulo: "180 dias", meses: 6 },
    { rotulo: "360 dias", meses: 12 },
  ];

  return janelas.map((j) => ({
    rotulo: j.rotulo,
    meses: j.meses,
    kpis: calcularKpis(emOrdem.slice(0, j.meses)),
    parcial: emOrdem.length < j.meses,
  }));
}

/* ------------------------------------------------------------------ */
/* Formatação                                                          */
/* ------------------------------------------------------------------ */

const moeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

const moedaCentavos = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function formatarReais(valor: number, comCentavos = false): string {
  return comCentavos ? moedaCentavos.format(valor) : moeda.format(valor);
}

export function formatarNumero(valor: number): string {
  return new Intl.NumberFormat("pt-BR").format(Math.round(valor));
}

export function formatarPercentual(valor: number, casas = 0): string {
  return `${valor.toFixed(casas).replace(".", ",")}%`;
}

export function formatarMultiplicador(valor: number): string {
  return `${valor.toFixed(1).replace(".", ",")}x`;
}

/** "2026-08-01" vira "ago/26". */
export function rotuloMes(mes: string): string {
  const [ano, m] = mes.split("-");
  const nomes = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${nomes[Number(m) - 1]}/${ano.slice(2)}`;
}

/** "2026-08-01" vira "Agosto de 2026". */
export function mesPorExtenso(mes: string): string {
  const [ano, m] = mes.split("-");
  const nomes = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ];
  return `${nomes[Number(m) - 1]} de ${ano}`;
}

/** Primeiro dia do mês atual no formato do banco. */
export function mesAtual(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
