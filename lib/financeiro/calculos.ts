/**
 * CÁLCULOS DO FINANCEIRO DA CLÍNICA
 *
 * Funções puras: a tela, o PDF e a rotina usam as mesmas, e o número
 * que aparece no painel é sempre o mesmo do relatório.
 *
 * Convenções:
 * - Receita bruta = valor cobrado menos desconto (o que o paciente ou o
 *   convênio deve).
 * - Receita líquida = bruta menos taxa da maquininha e glosa.
 * - Cancelado não entra em nada.
 * - Despesa entra no mês do vencimento (competência de caixa simples).
 */
import type {
  CategoriaDespesa,
  ConfigFinanceira,
  Despesa,
  FormaPagamento,
  Lancamento,
  RegraRepasse,
} from "@/lib/supabase/types";

export const CATEGORIAS_DESPESA: { id: CategoriaDespesa; rotulo: string; fixaPadrao: boolean }[] = [
  { id: "aluguel", rotulo: "Aluguel e condomínio", fixaPadrao: true },
  { id: "equipe", rotulo: "Equipe e salários", fixaPadrao: true },
  { id: "pro_labore", rotulo: "Pró-labore", fixaPadrao: true },
  { id: "insumos", rotulo: "Material e insumos", fixaPadrao: false },
  { id: "laboratorio", rotulo: "Laboratório", fixaPadrao: false },
  { id: "marketing", rotulo: "Marketing", fixaPadrao: true },
  { id: "sistemas", rotulo: "Sistemas e software", fixaPadrao: true },
  { id: "impostos", rotulo: "Impostos e taxas", fixaPadrao: false },
  { id: "taxas", rotulo: "Tarifas bancárias", fixaPadrao: false },
  { id: "manutencao", rotulo: "Manutenção", fixaPadrao: false },
  { id: "outros", rotulo: "Outros", fixaPadrao: false },
];

export const rotuloCategoria = (c: string) =>
  CATEGORIAS_DESPESA.find((x) => x.id === c)?.rotulo ?? "Outros";

export const TAXAS_PADRAO: Record<FormaPagamento, number> = {
  pix: 0,
  dinheiro: 0,
  cartao_debito: 1.6,
  cartao_credito: 3.5,
  boleto: 2,
  convenio: 0,
};

export const CONFIG_PADRAO = (orgId: string): ConfigFinanceira => ({
  organization_id: orgId,
  taxas: TAXAS_PADRAO,
  imposto: 6,
  reserva_glosa: 7,
  saldo_inicial: 0,
  meta_lucro: null,
  atualizado_em: new Date(0).toISOString(),
});

const n = (v: unknown) => Number(v ?? 0) || 0;
export const validos = (l: Lancamento[]) => l.filter((x) => x.status !== "cancelado");

export const bruto = (l: Lancamento) => Math.max(n(l.valor) - n(l.desconto), 0);
export const liquido = (l: Lancamento) => bruto(l) - n(l.taxa) - n(l.glosa);

/** Taxa em reais de uma forma de pagamento, pela configuração da clínica. */
export function taxaDe(valor: number, forma: FormaPagamento, config: ConfigFinanceira | null): number {
  const p = config?.taxas?.[forma] ?? TAXAS_PADRAO[forma] ?? 0;
  return Math.round(valor * p) / 100;
}

/** Quando o dinheiro de uma receita entra (ou entrou) no caixa. */
export function dataDeEntrada(l: Lancamento): string {
  if (l.status === "recebido" && l.data_recebimento) return l.data_recebimento;
  if (l.previsao_recebimento) return l.previsao_recebimento;
  // Convênio e crédito costumam cair em ~30 dias
  if (l.forma_pagamento === "convenio" || l.forma_pagamento === "cartao_credito") {
    return somarDias(l.data_competencia, 30);
  }
  return l.data_competencia;
}

export function somarDias(iso: string, dias: number): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

export function diasEntre(a: string, b: string): number {
  return Math.round(
    (new Date(`${b.slice(0, 10)}T12:00:00`).getTime() - new Date(`${a.slice(0, 10)}T12:00:00`).getTime()) / 86400000
  );
}

export const hojeIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/* ------------------------------------------------------------------ */
/* Resumo do mês                                                       */
/* ------------------------------------------------------------------ */

export type ResumoMes = {
  receitaBruta: number;
  recebido: number;
  aReceber: number;
  atrasado: number;
  taxas: number;
  glosas: number;
  descontos: number;
  custosDiretos: number;
  impostos: number;
  repasse: number;
  despesas: number;
  despesasFixas: number;
  despesasPagas: number;
  despesasAbertas: number;
  lucro: number;
  margem: number;
  atendimentos: number;
  pacientes: number;
  ticketMedio: number;
  convenio: number;
  particular: number;
};

export function resumoMes(
  lancamentos: Lancamento[],
  despesas: Despesa[],
  config: ConfigFinanceira | null,
  repasse = 0
): ResumoMes {
  const lista = validos(lancamentos);
  const desp = despesas.filter((d) => d.status !== "cancelada");
  const receitaBruta = lista.reduce((s, l) => s + bruto(l), 0);
  const taxas = lista.reduce((s, l) => s + n(l.taxa), 0);
  const glosas = lista.reduce((s, l) => s + n(l.glosa), 0);
  const custosDiretos = lista.reduce((s, l) => s + n(l.custo), 0);
  const impostos = (receitaBruta * n(config?.imposto ?? 6)) / 100;
  const despesasTotal = desp.reduce((s, d) => s + n(d.valor), 0);
  const lucro = receitaBruta - taxas - glosas - custosDiretos - impostos - repasse - despesasTotal;
  const cobrados = lista.filter((l) => bruto(l) > 0);

  return {
    receitaBruta,
    recebido: lista.filter((l) => l.status === "recebido").reduce((s, l) => s + liquido(l), 0),
    aReceber: lista.filter((l) => l.status === "previsto").reduce((s, l) => s + liquido(l), 0),
    atrasado: lista.filter((l) => l.status === "atrasado").reduce((s, l) => s + liquido(l), 0),
    taxas,
    glosas,
    descontos: lista.reduce((s, l) => s + n(l.desconto), 0),
    custosDiretos,
    impostos,
    repasse,
    despesas: despesasTotal,
    despesasFixas: desp.filter((d) => d.fixa).reduce((s, d) => s + n(d.valor), 0),
    despesasPagas: desp.filter((d) => d.status === "paga").reduce((s, d) => s + n(d.valor), 0),
    despesasAbertas: desp.filter((d) => d.status === "aberta").reduce((s, d) => s + n(d.valor), 0),
    lucro,
    margem: receitaBruta ? (lucro / receitaBruta) * 100 : 0,
    atendimentos: lista.length,
    pacientes: new Set(lista.map((l) => l.paciente_nome.trim().toLowerCase())).size,
    ticketMedio: cobrados.length ? cobrados.reduce((s, l) => s + bruto(l), 0) / cobrados.length : 0,
    convenio: lista.filter((l) => l.forma_pagamento === "convenio").reduce((s, l) => s + bruto(l), 0),
    particular: lista.filter((l) => l.forma_pagamento !== "convenio").reduce((s, l) => s + bruto(l), 0),
  };
}

/** Variação percentual com proteção para base zero. */
export function variacao(atual: number, anterior: number): number | null {
  if (!anterior) return null;
  return ((atual - anterior) / Math.abs(anterior)) * 100;
}

/* ------------------------------------------------------------------ */
/* Resultado (DRE gerencial)                                           */
/* ------------------------------------------------------------------ */

export type LinhaDre = {
  chave: string;
  rotulo: string;
  valor: number;
  /** total = subtotal em negrito; menos = dedução. */
  tipo: "total" | "mais" | "menos";
  nivel: 0 | 1;
};

export function dre(r: ResumoMes): LinhaDre[] {
  const liquida = r.receitaBruta - r.impostos - r.glosas;
  const contribuicao = liquida - r.custosDiretos - r.taxas - r.repasse;
  const variaveis = r.despesas - r.despesasFixas;
  return [
    { chave: "bruta", rotulo: "Receita bruta", valor: r.receitaBruta, tipo: "total", nivel: 0 },
    { chave: "impostos", rotulo: "Impostos sobre a receita", valor: r.impostos, tipo: "menos", nivel: 1 },
    { chave: "glosas", rotulo: "Glosas de convênio", valor: r.glosas, tipo: "menos", nivel: 1 },
    { chave: "liquida", rotulo: "Receita líquida", valor: liquida, tipo: "total", nivel: 0 },
    { chave: "custos", rotulo: "Custos dos procedimentos", valor: r.custosDiretos, tipo: "menos", nivel: 1 },
    { chave: "taxas", rotulo: "Taxas de cartão e boleto", valor: r.taxas, tipo: "menos", nivel: 1 },
    { chave: "repasse", rotulo: "Repasse aos profissionais", valor: r.repasse, tipo: "menos", nivel: 1 },
    { chave: "contribuicao", rotulo: "Margem de contribuição", valor: contribuicao, tipo: "total", nivel: 0 },
    { chave: "fixas", rotulo: "Despesas fixas", valor: r.despesasFixas, tipo: "menos", nivel: 1 },
    { chave: "variaveis", rotulo: "Outras despesas", valor: variaveis, tipo: "menos", nivel: 1 },
    { chave: "lucro", rotulo: "Lucro do mês", valor: r.lucro, tipo: "total", nivel: 0 },
  ];
}

/**
 * Ponto de equilíbrio: quanto a clínica precisa faturar para pagar as
 * despesas fixas, dada a margem de contribuição atual.
 */
export function pontoEquilibrio(r: ResumoMes) {
  const liquida = r.receitaBruta - r.impostos - r.glosas;
  const contribuicao = liquida - r.custosDiretos - r.taxas - r.repasse;
  const indice = r.receitaBruta ? contribuicao / r.receitaBruta : 0;
  const fixas = r.despesas;
  if (indice <= 0) return { receitaNecessaria: null, consultas: null, falta: null, indice };
  const receitaNecessaria = fixas / indice;
  return {
    receitaNecessaria,
    consultas: r.ticketMedio ? Math.ceil(receitaNecessaria / r.ticketMedio) : null,
    falta: Math.max(receitaNecessaria - r.receitaBruta, 0),
    indice,
  };
}

/* ------------------------------------------------------------------ */
/* Séries e quebras                                                    */
/* ------------------------------------------------------------------ */

export type PontoMensal = { mes: string; receita: number; despesas: number; lucro: number };

/** Uma linha por mês (YYYY-MM), na ordem recebida. */
export function serieMensal(
  meses: string[],
  lancamentos: Lancamento[],
  despesas: Despesa[],
  config: ConfigFinanceira | null
): PontoMensal[] {
  return meses.map((mes) => {
    const r = resumoMes(
      lancamentos.filter((l) => l.data_competencia.startsWith(mes)),
      despesas.filter((d) => d.vencimento.startsWith(mes)),
      config
    );
    const saidas = r.despesas + r.custosDiretos + r.taxas + r.impostos + r.glosas;
    return { mes, receita: r.receitaBruta, despesas: saidas, lucro: r.lucro };
  });
}

export function porCategoria(despesas: Despesa[]) {
  const mapa = new Map<string, number>();
  for (const d of despesas) {
    if (d.status === "cancelada") continue;
    mapa.set(d.categoria, (mapa.get(d.categoria) ?? 0) + n(d.valor));
  }
  return [...mapa.entries()]
    .map(([categoria, valor]) => ({ categoria, nome: rotuloCategoria(categoria), valor }))
    .sort((a, b) => b.valor - a.valor);
}

export function porForma(lancamentos: Lancamento[]) {
  const mapa = new Map<FormaPagamento, number>();
  for (const l of validos(lancamentos)) mapa.set(l.forma_pagamento, (mapa.get(l.forma_pagamento) ?? 0) + bruto(l));
  return [...mapa.entries()].map(([forma, valor]) => ({ forma, valor })).sort((a, b) => b.valor - a.valor);
}

export function porProcedimento(lancamentos: Lancamento[]) {
  const mapa = new Map<string, { nome: string; quantidade: number; valor: number; custo: number }>();
  for (const l of validos(lancamentos)) {
    const k = l.procedimento.trim();
    const atual = mapa.get(k) ?? { nome: k, quantidade: 0, valor: 0, custo: 0 };
    atual.quantidade += 1;
    atual.valor += bruto(l);
    atual.custo += n(l.custo);
    mapa.set(k, atual);
  }
  return [...mapa.values()].sort((a, b) => b.valor - a.valor);
}

export type LinhaConvenio = {
  convenio: string;
  atendimentos: number;
  faturado: number;
  glosado: number;
  recebido: number;
  pendente: number;
  taxaGlosa: number;
  /** Dias, em média, entre o atendimento e o pagamento. */
  prazoMedio: number | null;
  liquidoPorAtendimento: number;
};

export function porConvenio(lancamentos: Lancamento[]): LinhaConvenio[] {
  const mapa = new Map<string, Lancamento[]>();
  for (const l of validos(lancamentos)) {
    if (l.forma_pagamento !== "convenio") continue;
    const k = l.convenio?.trim() || "Convênio não informado";
    mapa.set(k, [...(mapa.get(k) ?? []), l]);
  }
  return [...mapa.entries()]
    .map(([convenio, lista]) => {
      const faturado = lista.reduce((s, l) => s + bruto(l), 0);
      const glosado = lista.reduce((s, l) => s + n(l.glosa), 0);
      const recebidos = lista.filter((l) => l.status === "recebido");
      const prazos = recebidos
        .filter((l) => l.data_recebimento)
        .map((l) => diasEntre(l.data_competencia, l.data_recebimento!));
      const recebido = recebidos.reduce((s, l) => s + liquido(l), 0);
      return {
        convenio,
        atendimentos: lista.length,
        faturado,
        glosado,
        recebido,
        pendente: lista.filter((l) => l.status !== "recebido").reduce((s, l) => s + liquido(l), 0),
        taxaGlosa: faturado ? (glosado / faturado) * 100 : 0,
        prazoMedio: prazos.length ? Math.round(prazos.reduce((a, b) => a + b, 0) / prazos.length) : null,
        liquidoPorAtendimento: lista.length ? (faturado - glosado) / lista.length : 0,
      };
    })
    .sort((a, b) => b.faturado - a.faturado);
}

/* ------------------------------------------------------------------ */
/* Caixa                                                               */
/* ------------------------------------------------------------------ */

export type DiaCaixa = { dia: string; entradas: number; saidas: number; saldo: number };

/**
 * Saldo dia a dia a partir de hoje: o que está em caixa (informado na
 * configuração), mais o que vai entrar, menos as contas a vencer.
 * Atrasados ficam de fora — são incertos e aparecem em alerta próprio.
 */
export function projecaoCaixa(
  lancamentos: Lancamento[],
  despesas: Despesa[],
  saldoInicial: number,
  dias = 30,
  inicio = hojeIso()
): DiaCaixa[] {
  const fim = somarDias(inicio, dias - 1);
  const entradas = new Map<string, number>();
  const saidas = new Map<string, number>();
  for (const l of validos(lancamentos)) {
    if (l.status !== "previsto") continue;
    let d = dataDeEntrada(l);
    if (d < inicio) d = inicio;
    if (d > fim) continue;
    entradas.set(d, (entradas.get(d) ?? 0) + liquido(l));
  }
  for (const x of despesas) {
    if (x.status !== "aberta") continue;
    const d = x.vencimento < inicio ? inicio : x.vencimento;
    if (d > fim) continue;
    saidas.set(d, (saidas.get(d) ?? 0) + n(x.valor));
  }
  const res: DiaCaixa[] = [];
  let saldo = saldoInicial;
  for (let i = 0; i < dias; i++) {
    const dia = somarDias(inicio, i);
    const e = entradas.get(dia) ?? 0;
    const s = saidas.get(dia) ?? 0;
    saldo += e - s;
    res.push({ dia, entradas: e, saidas: s, saldo });
  }
  return res;
}

/** Recebíveis atrasados por faixa de dias. */
export function faixasAtraso(lancamentos: Lancamento[], hoje = hojeIso()) {
  const faixas = [
    { rotulo: "1 a 30 dias", min: 1, max: 30, valor: 0, quantidade: 0 },
    { rotulo: "31 a 60 dias", min: 31, max: 60, valor: 0, quantidade: 0 },
    { rotulo: "61 a 90 dias", min: 61, max: 90, valor: 0, quantidade: 0 },
    { rotulo: "Mais de 90 dias", min: 91, max: Infinity, valor: 0, quantidade: 0 },
  ];
  for (const l of validos(lancamentos)) {
    if (l.status === "recebido") continue;
    const atraso = diasEntre(dataDeEntrada(l), hoje);
    if (atraso < 1 && l.status !== "atrasado") continue;
    const f = faixas.find((x) => Math.max(atraso, 1) >= x.min && Math.max(atraso, 1) <= x.max)!;
    f.valor += liquido(l);
    f.quantidade += 1;
  }
  return faixas;
}

/* ------------------------------------------------------------------ */
/* Repasse                                                             */
/* ------------------------------------------------------------------ */

export type LinhaRepasse = {
  medicoId: string;
  atendimentos: number;
  base: number;
  valor: number;
  regra: RegraRepasse | null;
};

export function calcularRepasses(lancamentos: Lancamento[], regras: RegraRepasse[]): LinhaRepasse[] {
  const porMedico = new Map<string, Lancamento[]>();
  for (const l of validos(lancamentos)) {
    if (!l.medico_id) continue;
    porMedico.set(l.medico_id, [...(porMedico.get(l.medico_id) ?? []), l]);
  }
  return [...porMedico.entries()].map(([medicoId, lista]) => {
    const regra = regras.find((r) => r.medico_id === medicoId) ?? null;
    const considerados = regra?.so_recebido ? lista.filter((l) => l.status === "recebido") : lista;
    const base = considerados.reduce((s, l) => s + (regra?.base === "bruto" ? bruto(l) : liquido(l) - n(l.custo)), 0);
    const valor = !regra
      ? 0
      : regra.tipo === "percentual"
        ? (base * n(regra.valor)) / 100
        : considerados.filter((l) => bruto(l) > 0).length * n(regra.valor);
    return { medicoId, atendimentos: considerados.length, base, valor: Math.round(valor * 100) / 100, regra };
  });
}

/* ------------------------------------------------------------------ */
/* Meses                                                               */
/* ------------------------------------------------------------------ */

/** Os últimos N meses (YYYY-MM) terminando em `fim`, do mais antigo ao mais novo. */
export function ultimosMeses(fim: string, quantidade: number): string[] {
  const [a, m] = fim.split("-").map(Number);
  const lista: string[] = [];
  for (let i = quantidade - 1; i >= 0; i--) {
    const d = new Date(a, m - 1 - i, 1);
    lista.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return lista;
}

const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const MESES_LONGOS = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

export const mesCurto = (mes: string) => {
  const [a, m] = mes.split("-").map(Number);
  return `${MESES_CURTOS[m - 1]}/${String(a).slice(2)}`;
};
export const mesLongo = (mes: string) => {
  const [a, m] = mes.split("-").map(Number);
  return `${MESES_LONGOS[m - 1]} de ${a}`;
};
export const mesAnterior = (mes: string) => ultimosMeses(mes, 2)[0];
