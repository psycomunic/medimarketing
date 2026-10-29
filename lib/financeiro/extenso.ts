/**
 * Valor em reais por extenso, para recibo: 1.250,50 → "mil duzentos e
 * cinquenta reais e cinquenta centavos".
 */
const UNIDADES = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove"];
const DEZ_A_DEZENOVE = ["dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
const DEZENAS = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
const CENTENAS = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];

function ate999(n: number): string {
  if (n === 0) return "";
  if (n === 100) return "cem";
  const c = Math.floor(n / 100);
  const resto = n % 100;
  const partes: string[] = [];
  if (c) partes.push(CENTENAS[c]);
  if (resto) {
    if (resto < 10) partes.push(UNIDADES[resto]);
    else if (resto < 20) partes.push(DEZ_A_DEZENOVE[resto - 10]);
    else {
      const d = Math.floor(resto / 10);
      const u = resto % 10;
      partes.push(u ? `${DEZENAS[d]} e ${UNIDADES[u]}` : DEZENAS[d]);
    }
  }
  return partes.join(" e ");
}

function inteiro(n: number): string {
  if (n === 0) return "zero";
  const grupos = [
    { valor: Math.floor(n / 1_000_000) % 1000, um: "um milhão", varios: "milhões" },
    { valor: Math.floor(n / 1000) % 1000, um: "mil", varios: "mil" },
    { valor: n % 1000, um: "", varios: "" },
  ];
  const partes: string[] = [];
  grupos.forEach((g, i) => {
    if (!g.valor) return;
    if (i === 0) partes.push(g.valor === 1 ? g.um : `${ate999(g.valor)} ${g.varios}`);
    else if (i === 1) partes.push(g.valor === 1 ? "mil" : `${ate999(g.valor)} mil`);
    else partes.push(ate999(g.valor));
  });
  // "mil e duzentos", mas "mil duzentos e cinquenta"
  if (partes.length > 1) {
    const ultimo = n % 1000;
    if (ultimo && (ultimo < 100 || ultimo % 100 === 0)) {
      const fim = partes.pop()!;
      return `${partes.join(" ")} e ${fim}`;
    }
  }
  return partes.join(" ");
}

export function reaisPorExtenso(valor: number): string {
  const centavosTotais = Math.round(Math.abs(valor) * 100);
  const reais = Math.floor(centavosTotais / 100);
  const centavos = centavosTotais % 100;
  const partes: string[] = [];
  if (reais) {
    const milhaoRedondo = reais >= 1_000_000 && reais % 1_000_000 === 0;
    partes.push(`${inteiro(reais)}${milhaoRedondo ? " de" : ""} ${reais === 1 ? "real" : "reais"}`);
  }
  if (centavos) partes.push(`${inteiro(centavos)} ${centavos === 1 ? "centavo" : "centavos"}`);
  return partes.join(" e ") || "zero reais";
}
