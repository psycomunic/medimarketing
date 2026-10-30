import type { PrecoProcedimento } from "@/lib/supabase/types";

/** O preço tem faixa de valor ("de R$ 120 a R$ 250")? */
export const temFaixa = (p: Pick<PrecoProcedimento, "valor" | "valor_max">) => p.valor_max != null && Number(p.valor_max) > Number(p.valor);

/** Valor do meio da faixa, para margem e estimativas. */
export const valorMedio = (p: Pick<PrecoProcedimento, "valor" | "valor_max">) =>
  temFaixa(p) ? (Number(p.valor) + Number(p.valor_max)) / 2 : Number(p.valor);

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: Number.isInteger(v) ? 0 : 2 });

/** "R$ 350" ou "R$ 120 a R$ 250" */
export function textoValor(p: Pick<PrecoProcedimento, "valor" | "valor_max">): string {
  return temFaixa(p) ? `${brl(Number(p.valor))} a ${brl(Number(p.valor_max))}` : brl(Number(p.valor));
}

/** "60 min", "30 a 60 min" ou null */
export function textoDuracao(p: Pick<PrecoProcedimento, "duracao_min" | "duracao_max">): string | null {
  if (!p.duracao_min) return null;
  return p.duracao_max && p.duracao_max > p.duracao_min ? `${p.duracao_min} a ${p.duracao_max} min` : `${p.duracao_min} min`;
}
