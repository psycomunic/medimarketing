/**
 * CÁLCULOS DO FINANCEIRO DA AGÊNCIA
 *
 * O MRR é reconstruído a partir do histórico de eventos de cada contrato
 * (novo, upgrade, downgrade, pausa, reativação, cancelamento). Assim a
 * ponte do mês e a série histórica saem da mesma fonte e batem entre si.
 */
import type { Contrato, ContratoEvento, CustoAgencia, Fatura } from "@/lib/supabase/types";
import { diasEntre, hojeIso, somarDias, ultimosMeses } from "./calculos";

const n = (v: unknown) => Number(v ?? 0) || 0;

export const PRECO_SUGERIDO: Record<"essencial" | "performance" | "full", number> = { essencial: 1900, performance: 3500, full: 5800 };
export const ROTULO_PLANO: Record<string, string> = { essencial: "Essencial", performance: "Performance", full: "Full / Parceria" };

export const CATEGORIAS_CUSTO: { id: CustoAgencia["categoria"]; rotulo: string }[] = [
  { id: "ferramentas", rotulo: "Ferramentas e software" },
  { id: "equipe", rotulo: "Equipe" },
  { id: "midia", rotulo: "Mídia própria" },
  { id: "impostos", rotulo: "Impostos" },
  { id: "estrutura", rotulo: "Estrutura" },
  { id: "outros", rotulo: "Outros" },
];
export const rotuloCusto = (c: string) => CATEGORIAS_CUSTO.find((x) => x.id === c)?.rotulo ?? "Outros";

export const ROTULO_EVENTO: Record<ContratoEvento["tipo"], string> = {
  novo: "Novo cliente",
  upgrade: "Upgrade",
  downgrade: "Downgrade",
  pausa: "Pausa",
  reativacao: "Reativação",
  cancelamento: "Cancelamento",
};

export const fimDoMes = (mes: string) => {
  const [a, m] = mes.split("-").map(Number);
  return `${mes}-${String(new Date(a, m, 0).getDate()).padStart(2, "0")}`;
};

/** MRR de cada contrato numa data: o valor do último evento até ali. */
function mrrNaData(eventos: ContratoEvento[], data: string): Map<string, number> {
  const mapa = new Map<string, { data: string; criado: string; valor: number }>();
  for (const e of eventos) {
    if (e.data > data) continue;
    const atual = mapa.get(e.contrato_id);
    if (!atual || e.data > atual.data || (e.data === atual.data && e.created_at > atual.criado)) {
      mapa.set(e.contrato_id, { data: e.data, criado: e.created_at, valor: n(e.mrr_depois) });
    }
  }
  return new Map([...mapa.entries()].map(([k, v]) => [k, v.valor]));
}

export function mrrEm(eventos: ContratoEvento[], data: string): number {
  return [...mrrNaData(eventos, data).values()].reduce((s, v) => s + v, 0);
}

export function clientesAtivosEm(eventos: ContratoEvento[], data: string): number {
  return [...mrrNaData(eventos, data).values()].filter((v) => v > 0).length;
}

export type PonteMrr = {
  inicio: number;
  novo: number;
  expansao: number;
  contracao: number;
  cancelado: number;
  fim: number;
};

export function ponteDoMes(eventos: ContratoEvento[], mes: string): PonteMrr {
  const doMes = eventos.filter((e) => e.data.startsWith(mes));
  const soma = (tipos: ContratoEvento["tipo"][], f: (e: ContratoEvento) => number) =>
    doMes.filter((e) => tipos.includes(e.tipo)).reduce((s, e) => s + f(e), 0);
  const inicio = mrrEm(eventos, somarDias(`${mes}-01`, -1));
  return {
    inicio,
    novo: soma(["novo"], (e) => n(e.mrr_depois) - n(e.mrr_antes)),
    expansao: soma(["upgrade", "reativacao"], (e) => n(e.mrr_depois) - n(e.mrr_antes)),
    contracao: soma(["downgrade", "pausa"], (e) => n(e.mrr_antes) - n(e.mrr_depois)),
    cancelado: soma(["cancelamento"], (e) => n(e.mrr_antes) - n(e.mrr_depois)),
    fim: mrrEm(eventos, fimDoMes(mes)),
  };
}

export type PontoMrr = { mes: string; mrr: number; clientes: number; churnLogo: number; churnReceita: number };

export function serieMrr(eventos: ContratoEvento[], meses: string[]): PontoMrr[] {
  return meses.map((mes) => {
    const p = ponteDoMes(eventos, mes);
    const clientesInicio = clientesAtivosEm(eventos, somarDias(`${mes}-01`, -1));
    const saidas = eventos.filter((e) => e.data.startsWith(mes) && e.tipo === "cancelamento").length;
    return {
      mes,
      mrr: p.fim,
      clientes: clientesAtivosEm(eventos, fimDoMes(mes)),
      churnLogo: clientesInicio ? (saidas / clientesInicio) * 100 : 0,
      churnReceita: p.inicio ? (p.cancelado / p.inicio) * 100 : 0,
    };
  });
}

/**
 * Retenção líquida de receita em 12 meses: dos clientes que pagavam há
 * um ano, quanto eles pagam hoje (com upgrades e saídas).
 */
export function nrr12(eventos: ContratoEvento[], hoje = hojeIso()): number | null {
  const antes = mrrNaData(eventos, somarDias(hoje, -365));
  const agora = mrrNaData(eventos, hoje);
  let base = 0;
  let atual = 0;
  for (const [id, v] of antes) {
    if (v <= 0) continue;
    base += v;
    atual += agora.get(id) ?? 0;
  }
  return base ? (atual / base) * 100 : null;
}

export type Indicadores = {
  mrr: number;
  arr: number;
  clientes: number;
  arpa: number;
  churnMedio: number;
  ltv: number | null;
  nrr: number | null;
  contratado12: number;
};

export function indicadoresAgencia(contratos: Contrato[], eventos: ContratoEvento[], mesAtual: string): Indicadores {
  const ativos = contratos.filter((c) => c.status === "ativo");
  const mrr = ativos.reduce((s, c) => s + n(c.mensalidade), 0);
  const serie = serieMrr(eventos, ultimosMeses(mesAtual, 6));
  const churnMedio = serie.length ? serie.reduce((s, p) => s + p.churnLogo, 0) / serie.length : 0;
  const arpa = ativos.length ? mrr / ativos.length : 0;
  return {
    mrr,
    arr: mrr * 12,
    clientes: ativos.length,
    arpa,
    churnMedio,
    // Vida média = 1 / churn mensal. Sem cancelamento, não dá para estimar
    ltv: churnMedio > 0 ? arpa / (churnMedio / 100) : null,
    nrr: nrr12(eventos),
    contratado12: ativos.reduce((s, c) => s + n(c.mensalidade) * mesesRestantes(c, 12), 0),
  };
}

/** Meses de mensalidade garantidos pela fidelidade, até um teto. */
export function mesesRestantes(c: Contrato, teto: number, hoje = hojeIso()): number {
  const fim = fimFidelidade(c);
  const restam = Math.ceil(diasEntre(hoje, fim) / 30);
  return Math.min(Math.max(restam, 0), teto);
}

export function fimFidelidade(c: Contrato): string {
  const [a, m, d] = c.inicio.split("-").map(Number);
  const f = new Date(a, m - 1 + n(c.fidelidade_meses), d);
  return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, "0")}-${String(f.getDate()).padStart(2, "0")}`;
}

/* ------------------------------------------------------------------ */
/* Faturas                                                             */
/* ------------------------------------------------------------------ */

export const vencida = (f: Fatura, hoje = hojeIso()) => f.status === "aberta" && f.vencimento < hoje;

export function resumoFaturas(faturas: Fatura[], mes: string, hoje = hojeIso()) {
  const doMes = faturas.filter((f) => f.competencia.startsWith(mes) && f.status !== "cancelada");
  const emAberto = faturas.filter((f) => f.status === "aberta");
  const vencidas = emAberto.filter((f) => vencida(f, hoje));
  return {
    faturado: doMes.reduce((s, f) => s + n(f.valor), 0),
    recebido: doMes.filter((f) => f.status === "paga").reduce((s, f) => s + n(f.valor), 0),
    aberto: emAberto.filter((f) => !vencida(f, hoje)).reduce((s, f) => s + n(f.valor), 0),
    vencido: vencidas.reduce((s, f) => s + n(f.valor), 0),
    clientesInadimplentes: new Set(vencidas.map((f) => f.organization_id)).size,
    faixas: [
      { rotulo: "1 a 15 dias", min: 1, max: 15 },
      { rotulo: "16 a 30 dias", min: 16, max: 30 },
      { rotulo: "31 a 60 dias", min: 31, max: 60 },
      { rotulo: "Mais de 60 dias", min: 61, max: Infinity },
    ].map((fx) => {
      const lista = vencidas.filter((f) => {
        const d = diasEntre(f.vencimento, hoje);
        return d >= fx.min && d <= fx.max;
      });
      return { ...fx, valor: lista.reduce((s, f) => s + n(f.valor), 0), quantidade: lista.length };
    }),
  };
}

/** Data de vencimento da mensalidade de um mês, no dia do contrato. */
export function vencimentoDe(c: Contrato, mes: string): string {
  return `${mes}-${String(Math.min(n(c.dia_vencimento) || 10, 28)).padStart(2, "0")}`;
}

/* ------------------------------------------------------------------ */
/* Margem por cliente e saúde                                          */
/* ------------------------------------------------------------------ */

export type MargemCliente = {
  organizationId: string;
  receita: number;
  custoDireto: number;
  rateio: number;
  margem: number;
  margemPct: number;
};

/**
 * Receita do mês menos o custo atribuído ao cliente e a parte dele nos
 * custos gerais (rateio igual entre os clientes ativos).
 */
export function margemPorCliente(contratos: Contrato[], custos: CustoAgencia[], mes: string): MargemCliente[] {
  const ativos = contratos.filter((c) => c.status === "ativo");
  const doMes = custos.filter((c) => c.competencia.startsWith(mes));
  const gerais = doMes.filter((c) => !c.organization_id).reduce((s, c) => s + n(c.valor), 0);
  const rateio = ativos.length ? gerais / ativos.length : 0;
  return ativos
    .map((c) => {
      const direto = doMes.filter((x) => x.organization_id === c.organization_id).reduce((s, x) => s + n(x.valor), 0);
      const receita = n(c.mensalidade);
      const margem = receita - direto - rateio;
      return {
        organizationId: c.organization_id,
        receita,
        custoDireto: direto,
        rateio,
        margem,
        margemPct: receita ? (margem / receita) * 100 : 0,
      };
    })
    .sort((a, b) => a.margemPct - b.margemPct);
}

export type Risco = { nivel: "alto" | "medio" | "baixo"; pontos: number; motivos: string[] };

/** Sinais de que a clínica pode sair: quanto mais pontos, maior o risco. */
export function riscoDoCliente(
  c: Contrato,
  faturas: Fatura[],
  sinais: { diasSemAcesso: number | null; retornoCaindo: boolean },
  hoje = hojeIso()
): Risco {
  const motivos: string[] = [];
  let pontos = 0;
  const vencidas = faturas.filter((f) => f.organization_id === c.organization_id && vencida(f, hoje));
  if (vencidas.length) {
    pontos += vencidas.length > 1 ? 45 : 30;
    motivos.push(vencidas.length > 1 ? `${vencidas.length} faturas vencidas` : "Fatura vencida");
  }
  const diasFim = diasEntre(hoje, fimFidelidade(c));
  if (diasFim >= 0 && diasFim <= 60) {
    pontos += 20;
    motivos.push(`Fidelidade termina em ${diasFim} dias`);
  }
  if (c.status === "pausado") {
    pontos += 30;
    motivos.push("Contrato pausado");
  }
  if (sinais.diasSemAcesso !== null && sinais.diasSemAcesso > 14) {
    pontos += sinais.diasSemAcesso > 30 ? 25 : 15;
    motivos.push(`${sinais.diasSemAcesso} dias sem entrar no painel`);
  }
  if (sinais.retornoCaindo) {
    pontos += 20;
    motivos.push("Retorno do marketing caindo");
  }
  return { nivel: pontos >= 45 ? "alto" : pontos >= 20 ? "medio" : "baixo", pontos, motivos };
}
