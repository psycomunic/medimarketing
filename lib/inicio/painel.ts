import { bruto, type ResumoMes } from "@/lib/financeiro/calculos";
import type { Bloqueio, Consulta, Disponibilidade, Lancamento } from "@/lib/supabase/types";

/**
 * PAINEL DO DONO
 *
 * Os números do Início do gestor. O recorte (atalhos, intervalo livre e
 * profissional) muda faturamento, consultas e composição; o ritmo do mês, as
 * reservas e a ocupação olham sempre para o mês corrente e para a frente.
 */

export type Periodo = "hoje" | "ontem" | "7d" | "30d" | "mes" | "mes-passado" | "3m" | "ano" | "personalizado";

export const PERIODOS: { chave: Exclude<Periodo, "personalizado">; rotulo: string }[] = [
  { chave: "hoje", rotulo: "Hoje" },
  { chave: "ontem", rotulo: "Ontem" },
  { chave: "7d", rotulo: "7 dias" },
  { chave: "30d", rotulo: "30 dias" },
  { chave: "mes", rotulo: "Mês" },
  { chave: "mes-passado", rotulo: "Mês passado" },
  { chave: "3m", rotulo: "3 meses" },
  { chave: "ano", rotulo: "Ano" },
];

/** O que o dono escolheu ver: período (com datas, no personalizado) e profissional. */
export type Filtro = { periodo: Periodo; de?: string; ate?: string; profissional?: string };

const DATA = /^\d{4}-\d{2}-\d{2}$/;
/** Intervalo personalizado de até dois anos. */
const MAX_DIAS = 731;

export function lerFiltro(sp: Record<string, string | string[] | undefined>): Filtro {
  const um = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const periodo = um("periodo");
  const profissional = um("profissional") || undefined;
  if (periodo === "personalizado") {
    let de = um("de") ?? "";
    let ate = um("ate") ?? de;
    if (DATA.test(de) && DATA.test(ate)) {
      if (ate < de) [de, ate] = [ate, de];
      const limite = somar(new Date(`${ate}T12:00:00`), -(MAX_DIAS - 1));
      if (new Date(`${de}T12:00:00`) < limite) de = iso(limite);
      return { periodo, de, ate, profissional };
    }
  }
  const valido = PERIODOS.some((p) => p.chave === periodo);
  return { periodo: valido ? (periodo as Periodo) : "mes", profissional };
}

/** Compatível com quem só passa o período. */
export function lerPeriodo(v: string | string[] | undefined): Periodo {
  return lerFiltro({ periodo: v }).periodo;
}

export type Recorte = {
  periodo: Periodo;
  filtro: Filtro;
  /** Início (inclusivo) e fim (exclusivo) do recorte, em YYYY-MM-DD. */
  de: string;
  ate: string;
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
  /** O mesmo mês um ano antes (só nos recortes de mês). */
  anoPassado: { rotulo: string; valor: number; pct: number | null } | null;
  /** Só quando o recorte é feito de meses inteiros e sem filtro de profissional. */
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
  /** Dias de atendimento que ainda restam no mês, contando hoje. */
  diasRestantes: number;
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

const dataCurta = (d: Date, agora: Date) =>
  d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", ...(d.getFullYear() !== agora.getFullYear() && { year: "numeric" }) });

export type Intervalo = {
  ini: Date;
  /** Exclusivo. */
  fim: Date;
  /** Começo do período usado na comparação. */
  antIni: Date;
  titulo: string;
  quando: string;
  rotuloComparacao: string;
};

/** Datas, textos e período de comparação de cada filtro. */
export function intervaloDoFiltro(f: Filtro, agora: Date): Intervalo {
  const hoje0 = new Date(agora);
  hoje0.setHours(0, 0, 0, 0);
  const amanha0 = somar(hoje0, 1);
  const mes = (n: number) => new Date(agora.getFullYear(), agora.getMonth() + n, 1);
  switch (f.periodo) {
    case "hoje":
      return { ini: hoje0, fim: amanha0, antIni: somar(hoje0, -7), titulo: "Faturamento de hoje", quando: "hoje", rotuloComparacao: `da ${DIAS[agora.getDay()]} passada` };
    case "ontem": {
      const ontem = somar(hoje0, -1);
      return { ini: ontem, fim: hoje0, antIni: somar(ontem, -7), titulo: "Faturamento de ontem", quando: "ontem", rotuloComparacao: `da ${DIAS[ontem.getDay()]} anterior` };
    }
    case "7d":
      return { ini: somar(hoje0, -6), fim: amanha0, antIni: somar(hoje0, -13), titulo: "Faturamento dos últimos 7 dias", quando: "nos últimos 7 dias", rotuloComparacao: "dos 7 dias anteriores" };
    case "30d":
      return { ini: somar(hoje0, -29), fim: amanha0, antIni: somar(hoje0, -59), titulo: "Faturamento dos últimos 30 dias", quando: "nos últimos 30 dias", rotuloComparacao: "dos 30 dias anteriores" };
    case "mes-passado":
      return { ini: mes(-1), fim: mes(0), antIni: mes(-2), titulo: `Faturamento de ${mesLongo(mes(-1))}`, quando: `em ${mesLongo(mes(-1))}`, rotuloComparacao: `de ${mesLongo(mes(-2))}` };
    case "3m":
      return {
        ini: mes(-2),
        fim: mes(1),
        antIni: mes(-5),
        titulo: `Faturamento de ${mesLongo(mes(-2))} a ${mesLongo(mes(0))}`,
        quando: `de ${mesLongo(mes(-2))} a ${mesLongo(mes(0))}`,
        rotuloComparacao: "do mesmo ponto dos 3 meses anteriores",
      };
    case "ano": {
      const ano = agora.getFullYear();
      return {
        ini: new Date(ano, 0, 1),
        fim: new Date(ano + 1, 0, 1),
        antIni: new Date(ano - 1, 0, 1),
        titulo: `Faturamento de ${ano}`,
        quando: `em ${ano}`,
        rotuloComparacao: `do mesmo período de ${ano - 1}`,
      };
    }
    case "personalizado": {
      const ini = new Date(`${f.de}T00:00:00`);
      const ultimo = new Date(`${f.ate}T00:00:00`);
      const fim = somar(ultimo, 1);
      const dias = Math.round((fim.getTime() - ini.getTime()) / 864e5);
      const texto = dias === 1 ? dataCurta(ini, agora) : `${dataCurta(ini, agora)} a ${dataCurta(ultimo, agora)}`;
      return {
        ini,
        fim,
        antIni: somar(ini, -dias),
        titulo: `Faturamento de ${texto}`,
        quando: dias === 1 ? `em ${texto}` : `de ${texto}`,
        rotuloComparacao: dias === 1 ? "do dia anterior" : `dos ${dias} dias anteriores`,
      };
    }
    default:
      return { ini: mes(0), fim: mes(1), antIni: mes(-1), titulo: `Faturamento de ${mesLongo(mes(0))}`, quando: `em ${mesLongo(mes(0))}`, rotuloComparacao: "do mesmo dia do mês passado" };
  }
}

/** Meses inteiros ("YYYY-MM") que formam o intervalo; vazio se ele corta algum mês. */
function mesesInteiros(ini: Date, fim: Date): string[] {
  if (ini.getDate() !== 1 || fim.getDate() !== 1) return [];
  const lista: string[] = [];
  for (let d = new Date(ini); d < fim; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) lista.push(iso(d).slice(0, 7));
  return lista;
}

export function montarPainel({
  filtro,
  agora,
  consultas,
  receitas,
  serieTicket,
  resumoDe,
  disponibilidade,
  bloqueios,
  receitasAnoPassado = [],
}: {
  filtro: Filtro;
  agora: Date;
  /** Da janela de carga: do começo da comparação até 31 dias à frente. */
  consultas: Consulta[];
  receitas: Lancamento[];
  serieTicket: number[];
  /** Resumo financeiro (com lucro) de um mês "YYYY-MM". Sem ele, o lucro não aparece. */
  resumoDe: ((mes: string) => ResumoMes) | null;
  disponibilidade: Disponibilidade[];
  bloqueios: Bloqueio[];
  /** Receitas de 12 a 13 meses atrás, para o comparativo anual. */
  receitasAnoPassado?: Lancamento[];
}): PainelNumeros {
  const hoje0 = new Date(agora);
  hoje0.setHours(0, 0, 0, 0);
  const amanha0 = somar(hoje0, 1);
  const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
  const inicioProxMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 1);
  const inicioMesAnt = new Date(agora.getFullYear(), agora.getMonth() - 1, 1);

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
  const { ini, fim, antIni, titulo, quando, rotuloComparacao } = intervaloDoFiltro(filtro, agora);
  // Período em andamento: compara só o que já passou com o mesmo trecho do anterior
  const corte = fim < amanha0 ? fim : amanha0;
  const diasComparados = Math.round((corte.getTime() - ini.getTime()) / 864e5);
  // Sem lançamentos desde o começo do período anterior (clínica nova no sistema), a comparação engana
  const primeiro = validas.reduce((m, l) => (l.data_competencia < m ? l.data_competencia : m), "9999-12-31");
  const historiaCompleta = primeiro <= iso(somar(antIni, 7));
  const vComp = diasComparados > 0 && historiaCompleta ? variacao(somaEntre(ini, corte), somaEntre(antIni, somar(antIni, diasComparados))) : null;
  const comparacao: Recorte["comparacao"] = vComp === null ? null : { pct: vComp, rotulo: rotuloComparacao };
  const meses = resumoDe ? mesesInteiros(ini, fim) : [];
  const mesResumo = meses.length === 1 ? meses[0] : null;

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
  const resumos = resumoDe ? meses.map(resumoDe) : [];
  const lucro = resumos.length ? resumos.reduce((x, r) => x + r.lucro, 0) : null;
  const brutoMeses = resumos.reduce((x, r) => x + r.receitaBruta, 0);

  let anoPassado: Recorte["anoPassado"] = null;
  if (mesResumo) {
    const base = new Date(Number(mesResumo.slice(0, 4)) - 1, Number(mesResumo.slice(5, 7)) - 1, 1);
    const prefixo = iso(base).slice(0, 7);
    const valor = receitasAnoPassado
      .filter((l) => l.status !== "cancelado" && l.data_competencia.startsWith(prefixo))
      .reduce((s, l) => s + bruto(l), 0);
    if (valor > 0)
      anoPassado = {
        rotulo: `${mesLongo(base)} de ${base.getFullYear()}`,
        valor,
        pct: variacao(faturamento, valor),
      };
  }

  const recorte: Recorte = {
    periodo: filtro.periodo,
    filtro,
    de: a,
    ate: b,
    titulo,
    quando,
    faturamento,
    comparacao,
    recebido: doRecorteR.filter((l) => l.status === "recebido").reduce((s, l) => s + bruto(l), 0),
    aReceber: doRecorteR.filter((l) => l.status !== "recebido").reduce((s, l) => s + bruto(l), 0),
    ticketMedio: cobrados.length ? cobrados.reduce((s, l) => s + bruto(l), 0) / cobrados.length : 0,
    atendimentos: cobrados.length,
    anoPassado,
    lucro,
    margem: lucro !== null && brutoMeses ? (lucro / brutoMeses) * 100 : null,
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
  const fimReservas = somar(hoje0, 31);
  const futuras = consultas.filter((c) => new Date(c.data_hora) >= agora && new Date(c.data_hora) < fimReservas && ativa(c));
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
    diasRestantes: diasDeAtendimento(hoje0, inicioProxMes, disponibilidade),
  };
}

/** Dias com atendimento entre hoje e o fim do mês (sem disponibilidade: segunda a sábado). */
function diasDeAtendimento(hoje0: Date, fimMes: Date, disponibilidade: Disponibilidade[]): number {
  const semana = new Set(disponibilidade.length ? disponibilidade.map((d) => d.dia_semana) : [1, 2, 3, 4, 5, 6]);
  let total = 0;
  for (let d = new Date(hoje0); d < fimMes; d = somar(d, 1)) if (semana.has(d.getDay())) total += 1;
  return total;
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
