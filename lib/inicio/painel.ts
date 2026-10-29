import { bruto, type ResumoMes } from "@/lib/financeiro/calculos";
import type { Bloqueio, Consulta, Disponibilidade, Lancamento } from "@/lib/supabase/types";

/**
 * PAINEL DO DONO
 *
 * Os números do Início do gestor. O recorte (hoje, 7 dias, mês, mês
 * passado) muda faturamento, consultas e composição; o ritmo do mês, as
 * reservas e a ocupação olham sempre para o mês corrente e para a frente.
 */

export type Periodo = "hoje" | "7d" | "mes" | "mes-passado";

export const PERIODOS: { chave: Periodo; rotulo: string }[] = [
  { chave: "hoje", rotulo: "Hoje" },
  { chave: "7d", rotulo: "7 dias" },
  { chave: "mes", rotulo: "Mês" },
  { chave: "mes-passado", rotulo: "Mês passado" },
];

export function lerPeriodo(v: string | string[] | undefined): Periodo {
  const s = Array.isArray(v) ? v[0] : v;
  return PERIODOS.some((p) => p.chave === s) ? (s as Periodo) : "mes";
}

export type Recorte = {
  periodo: Periodo;
  /** "Faturamento de outubro", "Faturamento de hoje"... */
  titulo: string;
  /** "em outubro", "hoje", "nos últimos 7 dias" — completa frases. */
  quando: string;
  faturamento: number;
  /** Variação contra o período equivalente anterior. */
  comparacao: { pct: number; rotulo: string } | null;
  recebido: number;
  aReceber: number;
  ticketMedio: number;
  atendimentos: number;
  /** Só nos recortes de mês fechado ou corrente. */
  lucro: number | null;
  margem: number | null;
  status: { confirmadas: number; pendentes: number; realizadas: number; canceladas: number; faltas: number };
  /** Faltas ÷ (realizadas + faltas): de quem devia ter vindo, quantos não vieram. */
  taxaFaltas: number | null;
  tipos: { primeira: number; retorno: number; teleconsulta: number };
  novosPacientes: number;
  porProfissional: { medicoId: string; valor: number; atendimentos: number }[];
  convenios: { nome: string; valor: number }[];
};

export type Ocupacao = {
  horasDisponiveis: number;
  horasMarcadas: number;
  pct: number;
  porDia: { rotulo: string; pct: number; disponivel: boolean }[];
};

export type PainelNumeros = {
  recorte: Recorte;
  /** Faturamento acumulado dia a dia: este mês (até hoje) e o anterior. */
  ritmo: { dia: number; atual: number | null; anterior: number }[];
  faturamentoMes: number;
  /** Parte do faturamento do mês que vem de hoje para trás. */
  ateHoje: number;
  anteriorTotal: number;
  faturamentoHoje: number;
  /** Ticket médio dos últimos 6 meses. */
  serieTicket: number[];
  reservas: { quantidade: number; valor: number; confirmadas: number };
  proximos14: { rotulo: string; confirmadas: number; aConfirmar: number }[];
  ocupacao: Ocupacao | null;
};

const n = (v: unknown) => Number(v ?? 0) || 0;
const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const somar = (d: Date, dias: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + dias);
  return x;
};
const ativa = (c: Consulta) => c.status !== "cancelada" && c.status !== "faltou";
const mesLongo = (d: Date) => d.toLocaleDateString("pt-BR", { month: "long" });
const DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const DIAS_CURTOS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

export function montarPainel({
  periodo,
  agora,
  consultas,
  receitas,
  serieTicket,
  resumoDe,
  disponibilidade,
  bloqueios,
}: {
  periodo: Periodo;
  agora: Date;
  consultas: Consulta[];
  receitas: Lancamento[];
  serieTicket: number[];
  /** Resumo financeiro (com lucro) de um mês "YYYY-MM". */
  resumoDe: (mes: string) => ResumoMes;
  disponibilidade: Disponibilidade[];
  bloqueios: Bloqueio[];
}): PainelNumeros {
  const hoje0 = new Date(agora);
  hoje0.setHours(0, 0, 0, 0);
  const amanha0 = somar(hoje0, 1);
  const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
  const inicioProxMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 1);
  const inicioMesAnt = new Date(agora.getFullYear(), agora.getMonth() - 1, 1);
  const inicioMesAnt2 = new Date(agora.getFullYear(), agora.getMonth() - 2, 1);

  const validas = receitas.filter((l) => l.status !== "cancelado");
  const somaEntre = (ini: Date, fim: Date) => {
    const a = iso(ini);
    const b = iso(fim);
    return validas.filter((l) => l.data_competencia >= a && l.data_competencia < b).reduce((s, l) => s + bruto(l), 0);
  };

  /* ---------------- Ritmo do mês corrente ---------------- */
  const diasNoMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 0).getDate();
  const diasMesAnt = new Date(agora.getFullYear(), agora.getMonth(), 0).getDate();
  const diaHoje = agora.getDate();
  const porDia = (base: Date, d: number) => somaEntre(new Date(base.getFullYear(), base.getMonth(), d), new Date(base.getFullYear(), base.getMonth(), d + 1));
  let acA = 0;
  let acB = 0;
  const ritmo = Array.from({ length: diasNoMes }, (_, i) => {
    const d = i + 1;
    // Mês anterior mais curto: o acumulado fica parado nos dias que ele não tem
    if (d <= diasMesAnt) acB += porDia(inicioMesAnt, d);
    if (d <= diaHoje) acA += porDia(inicioMes, d);
    return { dia: d, atual: d <= diaHoje ? acA : null, anterior: acB };
  });
  const anteriorMesmoDia = ritmo[Math.min(diaHoje, diasNoMes) - 1]?.anterior ?? 0;

  /* ---------------- Recorte escolhido ---------------- */
  const variacao = (atual: number, antes: number) => (antes > 0 ? ((atual - antes) / antes) * 100 : null);
  let ini: Date;
  let fim: Date;
  let titulo: string;
  let quando: string;
  let comparacao: Recorte["comparacao"];
  let mesResumo: string | null = null;

  if (periodo === "hoje") {
    ini = hoje0;
    fim = amanha0;
    titulo = "Faturamento de hoje";
    quando = "hoje";
    const v = variacao(somaEntre(ini, fim), somaEntre(somar(hoje0, -7), somar(hoje0, -6)));
    comparacao = v === null ? null : { pct: v, rotulo: `da ${DIAS[agora.getDay()]} passada` };
  } else if (periodo === "7d") {
    ini = somar(hoje0, -6);
    fim = amanha0;
    titulo = "Faturamento dos últimos 7 dias";
    quando = "nos últimos 7 dias";
    const v = variacao(somaEntre(ini, fim), somaEntre(somar(hoje0, -13), somar(hoje0, -6)));
    comparacao = v === null ? null : { pct: v, rotulo: "dos 7 dias anteriores" };
  } else if (periodo === "mes-passado") {
    ini = inicioMesAnt;
    fim = inicioMes;
    titulo = `Faturamento de ${mesLongo(inicioMesAnt)}`;
    quando = `em ${mesLongo(inicioMesAnt)}`;
    const v = variacao(somaEntre(ini, fim), somaEntre(inicioMesAnt2, inicioMesAnt));
    comparacao = v === null ? null : { pct: v, rotulo: `de ${mesLongo(inicioMesAnt2)}` };
    mesResumo = iso(inicioMesAnt).slice(0, 7);
  } else {
    ini = inicioMes;
    fim = inicioProxMes;
    titulo = `Faturamento de ${mesLongo(inicioMes)}`;
    quando = `em ${mesLongo(inicioMes)}`;
    // Mês em andamento: compara o que já aconteceu com o mesmo dia do mês passado
    const v = variacao(acA, anteriorMesmoDia);
    comparacao = v === null ? null : { pct: v, rotulo: "do mesmo dia do mês passado" };
    mesResumo = iso(inicioMes).slice(0, 7);
  }

  const a = iso(ini);
  const b = iso(fim);
  const doRecorteR = validas.filter((l) => l.data_competencia >= a && l.data_competencia < b);
  const cobrados = doRecorteR.filter((l) => bruto(l) > 0);
  const faturamento = doRecorteR.reduce((s, l) => s + bruto(l), 0);

  const profs = new Map<string, { valor: number; atendimentos: number }>();
  const convs = new Map<string, number>();
  for (const l of doRecorteR) {
    if (l.medico_id) {
      const p = profs.get(l.medico_id) ?? { valor: 0, atendimentos: 0 };
      p.valor += bruto(l);
      p.atendimentos += 1;
      profs.set(l.medico_id, p);
    }
    const nome = l.convenio?.trim() || (l.forma_pagamento === "convenio" ? "Convênio" : "Particular");
    convs.set(nome, (convs.get(nome) ?? 0) + bruto(l));
  }

  const doRecorteC = consultas.filter((c) => {
    const d = new Date(c.data_hora);
    return d >= ini && d < fim;
  });
  const conta = (s: Consulta["status"]) => doRecorteC.filter((c) => c.status === s).length;
  const status = {
    confirmadas: conta("confirmada"),
    pendentes: conta("pendente"),
    realizadas: conta("realizada"),
    canceladas: conta("cancelada"),
    faltas: conta("faltou"),
  };
  const ativasR = doRecorteC.filter(ativa);
  const resumo = mesResumo ? resumoDe(mesResumo) : null;

  const recorte: Recorte = {
    periodo,
    titulo,
    quando,
    faturamento,
    comparacao,
    recebido: doRecorteR.filter((l) => l.status === "recebido").reduce((s, l) => s + bruto(l), 0),
    aReceber: doRecorteR.filter((l) => l.status !== "recebido").reduce((s, l) => s + bruto(l), 0),
    ticketMedio: cobrados.length ? cobrados.reduce((s, l) => s + bruto(l), 0) / cobrados.length : 0,
    atendimentos: cobrados.length,
    lucro: resumo ? resumo.lucro : null,
    margem: resumo ? resumo.margem : null,
    status,
    taxaFaltas: status.realizadas + status.faltas ? (status.faltas / (status.realizadas + status.faltas)) * 100 : null,
    tipos: {
      primeira: ativasR.filter((c) => c.tipo === "primeira").length,
      retorno: ativasR.filter((c) => c.tipo === "retorno").length,
      teleconsulta: ativasR.filter((c) => c.tipo === "teleconsulta").length,
    },
    novosPacientes: ativasR.filter((c) => c.tipo === "primeira").length,
    porProfissional: [...profs.entries()].map(([medicoId, v]) => ({ medicoId, ...v })).sort((x, y) => y.valor - x.valor),
    convenios: [...convs.entries()].map(([nome, valor]) => ({ nome, valor })).filter((c) => c.valor > 0).sort((x, y) => y.valor - x.valor),
  };

  /* ---------------- Agenda daqui para a frente ---------------- */
  const futuras = consultas.filter((c) => new Date(c.data_hora) >= agora && ativa(c));
  const doDia = (d: Date) => consultas.filter((c) => new Date(c.data_hora).toDateString() === d.toDateString() && ativa(c));
  const proximos14 = Array.from({ length: 14 }, (_, i) => {
    const d = somar(hoje0, i);
    const lista = doDia(d);
    return {
      rotulo: i === 0 ? "hoje" : `${d.getDate()}/${d.getMonth() + 1}`,
      confirmadas: lista.filter((c) => c.status === "confirmada" || c.status === "realizada").length,
      aConfirmar: lista.filter((c) => c.status === "pendente").length,
    };
  });

  return {
    recorte,
    ritmo,
    faturamentoMes: somaEntre(inicioMes, inicioProxMes),
    ateHoje: acA,
    anteriorTotal: acB,
    faturamentoHoje: somaEntre(hoje0, amanha0),
    serieTicket,
    reservas: {
      quantidade: futuras.length,
      valor: futuras.reduce((s, c) => s + n(c.valor), 0),
      confirmadas: futuras.filter((c) => c.status === "confirmada").length,
    },
    proximos14,
    ocupacao: calcularOcupacao(hoje0, consultas, disponibilidade, bloqueios),
  };
}

/**
 * Ocupação dos próximos 7 dias: minutos marcados ÷ minutos de
 * atendimento cadastrados na disponibilidade, descontados os bloqueios.
 */
function calcularOcupacao(
  hoje0: Date,
  consultas: Consulta[],
  disponibilidade: Disponibilidade[],
  bloqueios: Bloqueio[]
): Ocupacao | null {
  if (!disponibilidade.length) return null;
  const minutos = (hhmm: string) => {
    const [h, m] = hhmm.split(":").map(Number);
    return (h || 0) * 60 + (m || 0);
  };
  let totalDisp = 0;
  let totalMarc = 0;
  const porDia = Array.from({ length: 7 }, (_, i) => {
    const d = somar(hoje0, i);
    let disp = 0;
    for (const j of disponibilidade.filter((x) => x.dia_semana === d.getDay())) {
      const ini = new Date(d);
      ini.setMinutes(minutos(j.hora_inicio));
      const fim = new Date(d);
      fim.setMinutes(minutos(j.hora_fim));
      let livre = Math.max((fim.getTime() - ini.getTime()) / 60000, 0);
      for (const b of bloqueios.filter((x) => x.medico_id === j.medico_id)) {
        const bi = Math.max(new Date(b.data_inicio).getTime(), ini.getTime());
        const bf = Math.min(new Date(b.data_fim).getTime(), fim.getTime());
        if (bf > bi) livre -= (bf - bi) / 60000;
      }
      disp += Math.max(livre, 0);
    }
    const marc = consultas
      .filter((c) => new Date(c.data_hora).toDateString() === d.toDateString() && ativa(c))
      .reduce((s, c) => s + (c.duracao_min || 30), 0);
    totalDisp += disp;
    totalMarc += disp ? Math.min(marc, disp) : 0;
    return {
      rotulo: i === 0 ? "hoje" : DIAS_CURTOS[d.getDay()],
      pct: disp ? Math.min((marc / disp) * 100, 100) : 0,
      disponivel: disp > 0,
    };
  });
  if (!totalDisp) return null;
  return {
    horasDisponiveis: totalDisp / 60,
    horasMarcadas: totalMarc / 60,
    pct: (totalMarc / totalDisp) * 100,
    porDia,
  };
}
