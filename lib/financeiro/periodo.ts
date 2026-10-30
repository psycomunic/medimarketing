/**
 * PERÍODO DO FINANCEIRO
 *
 * O financeiro olha um mês (?mes=2026-10) ou um intervalo livre
 * (?de=2026-07-01&ate=2026-09-30): trimestre, ano, últimos 12 meses ou
 * datas quaisquer. Sem nada na URL, o mês atual. Vale no servidor e no
 * navegador.
 */

export type PeriodoFin = {
  /** Primeiro e último dia (inclusivos), YYYY-MM-DD. */
  de: string;
  ate: string;
  /** Um mês inteiro, do dia 1 ao último. */
  ehMes: boolean;
  /** Feito só de meses inteiros (mês, trimestre, ano...). */
  mesesInteiros: boolean;
  /** Último mês tocado, YYYY-MM: base das séries de 12 meses e das abas só de mês. */
  mes: string;
  /** Meses tocados pelo período, YYYY-MM. */
  meses: string[];
  dias: number;
  /** "outubro de 2026", "jul a set de 2026", "01/10 a 15/10/2026" */
  rotulo: string;
  /** Período de comparação: o mesmo tamanho logo antes. */
  anterior: { de: string; ate: string };
};

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const DATA = /^\d{4}-\d{2}-\d{2}$/;
/** Intervalo máximo: três anos. */
const MAX_DIAS = 1096;

const pad = (n: number) => String(n).padStart(2, "0");
const isoDe = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dia = (s: string) => new Date(`${s}T12:00:00`);
const somarDias = (s: string, n: number) => {
  const d = dia(s);
  d.setDate(d.getDate() + n);
  return isoDe(d);
};
const ultimoDia = (ano: number, mes1: number) => new Date(ano, mes1, 0).getDate();
const fimDoMes = (m: string) => `${m}-${pad(ultimoDia(Number(m.slice(0, 4)), Number(m.slice(5, 7))))}`;
const somarMeses = (m: string, n: number) => {
  const d = new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 1 + n, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
};
const mesAtual = () => isoDe(new Date()).slice(0, 7);

/** Um parâmetro só, mesmo quando a URL repete. */
function um(sp: URLSearchParams | Record<string, string | string[] | undefined>, k: string): string | undefined {
  if (sp instanceof URLSearchParams) return sp.get(k) ?? undefined;
  const v = sp[k];
  return Array.isArray(v) ? v[0] : v;
}

export function periodoFinanceiro(sp: URLSearchParams | Record<string, string | string[] | undefined>): PeriodoFin {
  let de = um(sp, "de") ?? "";
  let ate = um(sp, "ate") ?? "";
  if (DATA.test(de) && DATA.test(ate)) {
    if (ate < de) [de, ate] = [ate, de];
    if ((dia(ate).getTime() - dia(de).getTime()) / 864e5 > MAX_DIAS) de = somarDias(ate, -MAX_DIAS);
    return montar(de, ate);
  }
  const m = um(sp, "mes");
  const mes = m && /^\d{4}-(0[1-9]|1[0-2])$/.test(m) ? m : mesAtual();
  return montar(`${mes}-01`, fimDoMes(mes));
}

function montar(de: string, ate: string): PeriodoFin {
  const dias = Math.round((dia(ate).getTime() - dia(de).getTime()) / 864e5) + 1;
  const mesesInteiros = de.endsWith("-01") && ate === fimDoMes(ate.slice(0, 7));
  const meses: string[] = [];
  for (let m = de.slice(0, 7); m <= ate.slice(0, 7); m = somarMeses(m, 1)) meses.push(m);
  const ehMes = mesesInteiros && meses.length === 1;

  const anterior = mesesInteiros
    ? { de: `${somarMeses(meses[0], -meses.length)}-01`, ate: fimDoMes(somarMeses(meses[0], -1)) }
    : { de: somarDias(de, -dias), ate: somarDias(de, -1) };

  const [a1, m1] = [Number(de.slice(0, 4)), Number(de.slice(5, 7))];
  const [a2, m2] = [Number(ate.slice(0, 4)), Number(ate.slice(5, 7))];
  let rotulo: string;
  if (ehMes) rotulo = `${MESES[m1 - 1]} de ${a1}`;
  else if (mesesInteiros && meses.length === 12 && m1 === 1) rotulo = `ano de ${a1}`;
  else if (mesesInteiros) rotulo = a1 === a2 ? `${MESES_CURTOS[m1 - 1]} a ${MESES_CURTOS[m2 - 1]} de ${a1}` : `${MESES_CURTOS[m1 - 1]}/${a1} a ${MESES_CURTOS[m2 - 1]}/${a2}`;
  else {
    const curta = (s: string, ano: boolean) => `${s.slice(8, 10)}/${s.slice(5, 7)}${ano ? `/${s.slice(0, 4)}` : ""}`;
    rotulo = dias === 1 ? curta(de, true) : `${curta(de, a1 !== a2)} a ${curta(ate, true)}`;
  }
  return { de, ate, ehMes, mesesInteiros, mes: ate.slice(0, 7), meses, dias, rotulo, anterior };
}

/** Os lançamentos cuja data cai no período. */
export function noPeriodo<T>(lista: T[], data: (x: T) => string | null | undefined, p: { de: string; ate: string }): T[] {
  return lista.filter((x) => {
    const d = data(x)?.slice(0, 10);
    return !!d && d >= p.de && d <= p.ate;
  });
}

/** Parâmetros de URL do período (para links entre as abas e as planilhas). */
export function paramsDoPeriodo(p: PeriodoFin): Record<string, string> {
  return p.ehMes ? { mes: p.meses[0] } : { de: p.de, ate: p.ate };
}

/** Atalhos do seletor. Calculados a partir de hoje. */
export function atalhosPeriodo(hoje = new Date()): { chave: string; rotulo: string; de: string; ate: string }[] {
  const m = isoDe(hoje).slice(0, 7);
  const ano = hoje.getFullYear();
  const tri = Math.floor(hoje.getMonth() / 3);
  const triIni = `${ano}-${pad(tri * 3 + 1)}`;
  const triAntIni = somarMeses(triIni, -3);
  const hojeIso = isoDe(hoje);
  return [
    { chave: "mes", rotulo: "Este mês", de: `${m}-01`, ate: fimDoMes(m) },
    { chave: "mes-passado", rotulo: "Mês passado", de: `${somarMeses(m, -1)}-01`, ate: fimDoMes(somarMeses(m, -1)) },
    { chave: "30d", rotulo: "Últimos 30 dias", de: somarDias(hojeIso, -29), ate: hojeIso },
    { chave: "tri", rotulo: "Este trimestre", de: `${triIni}-01`, ate: fimDoMes(somarMeses(triIni, 2)) },
    { chave: "tri-passado", rotulo: "Trimestre passado", de: `${triAntIni}-01`, ate: fimDoMes(somarMeses(triAntIni, 2)) },
    { chave: "ano", rotulo: "Este ano", de: `${ano}-01-01`, ate: `${ano}-12-31` },
    { chave: "ano-passado", rotulo: "Ano passado", de: `${ano - 1}-01-01`, ate: `${ano - 1}-12-31` },
    { chave: "12m", rotulo: "Últimos 12 meses", de: `${somarMeses(m, -11)}-01`, ate: fimDoMes(m) },
  ];
}

/** Anda o período para trás ou para a frente, do mesmo tamanho. */
export function deslocarPeriodo(p: PeriodoFin, n: -1 | 1): { de: string; ate: string } {
  if (p.mesesInteiros) {
    const ini = somarMeses(p.meses[0], n * p.meses.length);
    return { de: `${ini}-01`, ate: fimDoMes(somarMeses(ini, p.meses.length - 1)) };
  }
  return { de: somarDias(p.de, n * p.dias), ate: somarDias(p.ate, n * p.dias) };
}

export const mesCurtoDe = (m: string) => `${MESES_CURTOS[Number(m.slice(5, 7)) - 1]}/${m.slice(2, 4)}`;

/**
 * O período anterior tem dados desde o começo? Sem isso (clínica nova no
 * sistema), a variação contra ele engana: a comparação deve sumir.
 */
export function anteriorCompleto<T>(lista: T[], data: (x: T) => string | null | undefined, anterior: { de: string }): boolean {
  const primeira = lista.reduce((m, x) => {
    const d = data(x)?.slice(0, 10);
    return d && d < m ? d : m;
  }, "9999-12-31");
  return primeira <= somarDias(anterior.de, 31);
}
