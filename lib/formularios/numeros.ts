/**
 * Leitura dos números que a clínica digitou como texto livre.
 *
 * O diagnóstico aceita "82.400", "R$ 82 mil", "~20 mil (estimativa)" e
 * "não medimos" de propósito: forçar formato faria a clínica inventar
 * precisão que não tem. Aqui esse texto vira número para o painel, sem
 * perder a informação de que era aproximado ou inexistente.
 *
 * O resultado é sempre uma proposta: a equipe revisa antes de gravar.
 */

export type ValorLido = {
  valor: number | null;
  estimativa: boolean;
  semDado: boolean;
};

const SEM_DADO = /n[aã]o\s+(medimos|sabemos|temos|sei|informado)|sem\s+dados?|^n\/?a$|^-+$|^—$|^x$/i;
const APROXIMADO = /~|≈|aprox|estimad|estimativa|cerca|em\s+torno|mais\s+ou\s+menos|m[eé]dia\s+de|\+-/i;

export function lerValor(texto: string | null | undefined): ValorLido {
  const bruto = (texto ?? "").trim();
  if (!bruto) return { valor: null, estimativa: false, semDado: false };
  if (SEM_DADO.test(bruto)) return { valor: null, estimativa: false, semDado: true };

  const estimativa = APROXIMADO.test(bruto);
  const t = bruto.toLowerCase().replace(/r\$\s*/g, "");

  const m = /(-?\d[\d.,]*)\s*(mil|k|mi|milh[oõ]es|milh[aã]o)?/.exec(t);
  if (!m) return { valor: null, estimativa, semDado: false };

  let numero = normalizar(m[1]);
  if (numero === null) return { valor: null, estimativa, semDado: false };

  const escala = m[2];
  if (escala === "mil" || escala === "k") numero *= 1_000;
  else if (escala && escala.startsWith("mi")) numero *= 1_000_000;

  return { valor: Math.round(numero * 100) / 100, estimativa, semDado: false };
}

/**
 * "82.400" → 82400 · "82.400,50" → 82400.5 · "3,5" → 3.5 · "1.5" → 1.5
 * Ponto seguido de exatamente três dígitos é separador de milhar, como
 * se escreve no Brasil.
 */
function normalizar(s: string): number | null {
  let x = s.replace(/[.,]$/, "");
  const temVirgula = x.includes(",");
  const temPonto = x.includes(".");

  if (temVirgula && temPonto) {
    x = x.replace(/\./g, "").replace(",", ".");
  } else if (temVirgula) {
    // "82,400" escrito à americana; "3,5" é decimal
    x = /^-?[1-9]\d{0,2},\d{3}$/.test(x) ? x.replace(",", "") : x.replace(",", ".");
  } else if (temPonto) {
    x = /^\d{1,3}(\.\d{3})+$/.test(x) ? x.replace(/\./g, "") : x;
  }

  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

/** Contagens não têm fração: "58,5 pacientes" vira 59. */
export function inteiro(v: ValorLido): ValorLido {
  return v.valor === null ? v : { ...v, valor: Math.round(v.valor) };
}
