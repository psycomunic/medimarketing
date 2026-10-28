/**
 * Cores e formatos dos gráficos. Sem "use client": as telas do servidor
 * e os PDFs usam os mesmos valores dos componentes interativos.
 *
 * Paleta categórica validada (separação para daltonismo e contraste) a
 * partir das cores da marca. A ordem é fixa: a cor segue a série, nunca
 * a posição no ranking.
 */
export const SERIES = ["#1A9E8F", "#2A78D6", "#EB6834", "#6250D6", "#EDA100", "#E87BA4"] as const;

/** Papéis fixos do financeiro: a mesma coisa tem sempre a mesma cor. */
export const COR = {
  receita: "#1A9E8F",
  despesa: "#EB6834",
  lucro: "#0B4F6C",
  previsto: "#9ED9D0",
  neutro: "#B8C4CA",
  grade: "#E8EEF1",
  eixo: "#6B7A82",
  texto: "#2E3A40",
  titulo: "#0B4F6C",
  bom: "#16A34A",
  atencao: "#D97706",
  critico: "#DC2626",
} as const;

/** Até 5 marcas "redondas" no eixo, começando do zero. */
export function escala(max: number, min = 0): number[] {
  const alto = Math.max(max, 0);
  const baixo = Math.min(min, 0);
  const amplitude = alto - baixo || 1;
  const bruto = amplitude / 4;
  const mag = Math.pow(10, Math.floor(Math.log10(bruto)));
  const passo = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((p) => p >= bruto) ?? bruto;
  const ini = Math.floor(baixo / passo) * passo;
  const fim = Math.ceil(alto / passo) * passo;
  const marcas: number[] = [];
  for (let v = ini; v <= fim + passo / 2; v += passo) marcas.push(Math.round(v * 100) / 100);
  return marcas;
}

/** R$ curto para eixo: 12,5 mil · 1,2 mi. */
export function reaisCurto(v: number): string {
  const a = Math.abs(v);
  const sinal = v < 0 ? "−" : "";
  if (a >= 1_000_000) return `${sinal}${(a / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  if (a >= 1_000) return `${sinal}${(a / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  return `${sinal}${Math.round(a).toLocaleString("pt-BR")}`;
}

export function reais(v: number, centavos = false): string {
  return v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: centavos ? 2 : 0,
    maximumFractionDigits: centavos ? 2 : 0,
  });
}

export function pct(v: number, casas = 0): string {
  return `${v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`;
}

