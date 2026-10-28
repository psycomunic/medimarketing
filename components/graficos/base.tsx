"use client";

import { useEffect, useRef, useState } from "react";

export { COR, SERIES, escala, pct, reais, reaisCurto } from "./formato";

/**
 * KIT DE GRÁFICOS
 *
 * Gráficos em SVG próprio, sem biblioteca: o texto sai nítido na tela e
 * no PDF, e cada rótulo é posicionado por nós — é o que garante que nada
 * se sobreponha. A largura é medida do contêiner; no PDF o contêiner tem
 * largura fixa, então o desenho é o mesmo da tela.
 *
 * Paleta categórica validada (separação para daltonismo e contraste) a
 * partir das cores da marca. A ordem é fixa: a cor segue a série, nunca
 * a posição no ranking.
 */
/** Mede a largura do contêiner; começa num valor razoável para o servidor. */
export function useLargura<T extends HTMLElement>(inicial = 640) {
  const ref = useRef<T>(null);
  const [largura, setLargura] = useState(inicial);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const medir = () => setLargura(Math.max(240, Math.round(el.getBoundingClientRect().width)));
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, largura] as const;
}

/** Legenda em linha, sempre presente com duas séries ou mais. */
export function Legenda({
  itens,
  className = "",
}: {
  itens: { nome: string; cor: string; tipo?: "barra" | "linha" | "tracejado" }[];
  className?: string;
}) {
  return (
    <ul className={`flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-cinza-suave ${className}`}>
      {itens.map((i) => (
        <li key={i.nome} className="flex items-center gap-1.5">
          {i.tipo === "linha" ? (
            <span className="h-0.5 w-4 rounded-full" style={{ background: i.cor }} />
          ) : i.tipo === "tracejado" ? (
            <span className="w-4 border-t-2 border-dashed" style={{ borderColor: i.cor }} />
          ) : (
            <span className="size-2.5 rounded-[3px]" style={{ background: i.cor }} />
          )}
          {i.nome}
        </li>
      ))}
    </ul>
  );
}

/** Caixa do tooltip. Fica dentro do gráfico e nunca sai pelas bordas. */
export function Dica({
  x,
  y,
  largura,
  titulo,
  linhas,
}: {
  x: number;
  y: number;
  largura: number;
  titulo: string;
  linhas: { nome: string; valor: string; cor?: string }[];
}) {
  const W = 184;
  const esquerda = Math.min(Math.max(x - W / 2, 0), largura - W);
  return (
    <div
      className="pointer-events-none absolute z-20 rounded-lg border border-border bg-white px-3 py-2 shadow-card print:hidden"
      style={{ left: esquerda, top: Math.max(0, y), width: W }}
    >
      <p className="mb-1 text-xs font-semibold text-azul-medico">{titulo}</p>
      {linhas.map((l) => (
        <p key={l.nome} className="flex items-center justify-between gap-2 text-xs text-cinza-suave">
          <span className="flex min-w-0 items-center gap-1.5">
            {l.cor && <span className="size-2 shrink-0 rounded-full" style={{ background: l.cor }} />}
            <span className="truncate">{l.nome}</span>
          </span>
          <strong className="shrink-0 tabular-nums text-cinza-texto">{l.valor}</strong>
        </p>
      ))}
    </div>
  );
}
