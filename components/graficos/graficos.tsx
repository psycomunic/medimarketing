"use client";

import { useState } from "react";
import { COR, Dica, Legenda, SERIES, escala, pct, reais, reaisCurto, useLargura } from "./base";

type Formato = "reais" | "numero" | "pct";

function fmt(v: number, f: Formato) {
  if (f === "reais") return reais(v);
  if (f === "pct") return pct(v, 1);
  return Math.round(v).toLocaleString("pt-BR");
}
function fmtEixo(v: number, f: Formato) {
  if (f === "reais") return reaisCurto(v);
  if (f === "pct") return `${Math.round(v)}%`;
  return reaisCurto(v);
}

const EIXO_Y = 56;
const RODAPE = 26;
const TOPO = 10;

/** Quantos rótulos do eixo X cabem sem encostar um no outro. */
function passoRotulos(n: number, larguraUtil: number, porRotulo = 54) {
  const cabem = Math.max(1, Math.floor(larguraUtil / porRotulo));
  return Math.max(1, Math.ceil(n / cabem));
}

/* ------------------------------------------------------------------ */
/* Barras agrupadas (com linha opcional)                               */
/* ------------------------------------------------------------------ */

export type Serie = { nome: string; cor: string; valores: number[]; tracejado?: boolean };

/**
 * Barras lado a lado por categoria (ex.: receita e despesa por mês),
 * com uma linha por cima (ex.: lucro). Um eixo só, todos em reais.
 */
export function BarrasAgrupadas({
  categorias,
  barras,
  linhas = [],
  altura = 260,
  formato = "reais",
  destaque,
}: {
  categorias: string[];
  barras: Serie[];
  linhas?: Serie[];
  altura?: number;
  formato?: Formato;
  /** Índice da categoria em destaque (ex.: mês escolhido). */
  destaque?: number;
}) {
  const [ref, largura] = useLargura<HTMLDivElement>();
  const [foco, setFoco] = useState<number | null>(null);

  const todos = [...barras, ...linhas].flatMap((s) => s.valores);
  const marcas = escala(Math.max(...todos, 1), Math.min(...todos, 0));
  const vMin = marcas[0];
  const vMax = marcas[marcas.length - 1];
  const W = largura;
  const util = W - EIXO_Y;
  const H = altura - RODAPE - TOPO;
  const y = (v: number) => TOPO + H - ((v - vMin) / (vMax - vMin || 1)) * H;
  const n = categorias.length;
  const banda = util / Math.max(n, 1);
  const larguraGrupo = Math.min(banda * 0.7, 26 * barras.length + 10);
  const larguraBarra = Math.max(3, (larguraGrupo - (barras.length - 1) * 2) / Math.max(barras.length, 1));
  const cx = (i: number) => EIXO_Y + banda * i + banda / 2;
  const passo = passoRotulos(n, util);

  return (
    <div>
      <Legenda
        className="mb-3"
        itens={[
          ...barras.map((s) => ({ nome: s.nome, cor: s.cor })),
          ...linhas.map((s) => ({ nome: s.nome, cor: s.cor, tipo: (s.tracejado ? "tracejado" : "linha") as "linha" })),
        ]}
      />
      <div ref={ref} className="relative w-full" onMouseLeave={() => setFoco(null)}>
        <svg width={W} height={altura} role="img" aria-label="Gráfico de barras" className="block overflow-visible">
          {marcas.map((m) => (
            <g key={m}>
              <line x1={EIXO_Y} x2={W} y1={y(m)} y2={y(m)} stroke={m === 0 ? COR.neutro : COR.grade} strokeWidth={1} />
              <text x={EIXO_Y - 8} y={y(m)} dy="0.32em" textAnchor="end" fontSize={11} fill={COR.eixo}>
                {fmtEixo(m, formato)}
              </text>
            </g>
          ))}

          {categorias.map((c, i) => (
            <g key={c + i}>
              {(destaque === i || foco === i) && (
                <rect
                  x={EIXO_Y + banda * i + 2}
                  y={TOPO}
                  width={banda - 4}
                  height={H}
                  rx={6}
                  fill={foco === i ? "#EEF6F5" : "#F3F8F9"}
                />
              )}
              {barras.map((s, j) => {
                const v = s.valores[i] ?? 0;
                const x = cx(i) - larguraGrupo / 2 + j * (larguraBarra + 2);
                const topo = y(Math.max(v, 0));
                const base = y(Math.min(v, 0));
                const h = Math.max(base - topo, v === 0 ? 0 : 1);
                const r = Math.min(4, larguraBarra / 2, h);
                // Cantos arredondados só na ponta oposta à linha do zero
                const d =
                  v >= 0
                    ? `M${x},${base} V${topo + r} Q${x},${topo} ${x + r},${topo} H${x + larguraBarra - r} Q${x + larguraBarra},${topo} ${x + larguraBarra},${topo + r} V${base} Z`
                    : `M${x},${topo} V${base - r} Q${x},${base} ${x + r},${base} H${x + larguraBarra - r} Q${x + larguraBarra},${base} ${x + larguraBarra},${base - r} V${topo} Z`;
                return <path key={s.nome} d={d} fill={s.cor} opacity={foco === null || foco === i ? 1 : 0.55} />;
              })}
              {i % passo === 0 && (
                <text
                  x={cx(i)}
                  y={altura - 8}
                  textAnchor="middle"
                  fontSize={11}
                  fill={destaque === i ? COR.titulo : COR.eixo}
                  fontWeight={destaque === i ? 600 : 400}
                >
                  {c}
                </text>
              )}
              <rect
                x={EIXO_Y + banda * i}
                y={0}
                width={banda}
                height={altura}
                fill="transparent"
                onMouseEnter={() => setFoco(i)}
              />
            </g>
          ))}

          {linhas.map((s) => {
            const pts = s.valores.map((v, i) => `${cx(i)},${y(v)}`).join(" ");
            return (
              <g key={s.nome} pointerEvents="none">
                <polyline
                  points={pts}
                  fill="none"
                  stroke="#fff"
                  strokeWidth={5}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                <polyline
                  points={pts}
                  fill="none"
                  stroke={s.cor}
                  strokeWidth={2}
                  strokeDasharray={s.tracejado ? "5 4" : undefined}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                {s.valores.map((v, i) => (
                  <circle key={i} cx={cx(i)} cy={y(v)} r={foco === i ? 4.5 : 3} fill={s.cor} stroke="#fff" strokeWidth={2} />
                ))}
              </g>
            );
          })}
        </svg>
        {foco !== null && (
          <Dica
            x={cx(foco)}
            y={4}
            largura={W}
            titulo={categorias[foco]}
            linhas={[...barras, ...linhas].map((s) => ({ nome: s.nome, cor: s.cor, valor: fmt(s.valores[foco] ?? 0, formato) }))}
          />
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Linha com área (fluxo de caixa, MRR)                                */
/* ------------------------------------------------------------------ */

export function LinhaArea({
  rotulos,
  series,
  altura = 240,
  formato = "reais",
  marcadorHoje,
  limiteZero = true,
}: {
  rotulos: string[];
  series: (Serie & { area?: boolean })[];
  altura?: number;
  formato?: Formato;
  /** Índice do ponto "hoje", que divide realizado de projetado. */
  marcadorHoje?: number;
  limiteZero?: boolean;
}) {
  const [ref, largura] = useLargura<HTMLDivElement>();
  const [foco, setFoco] = useState<number | null>(null);
  const todos = series.flatMap((s) => s.valores);
  const marcas = escala(Math.max(...todos, 1), limiteZero ? Math.min(...todos, 0) : Math.min(...todos));
  const vMin = marcas[0];
  const vMax = marcas[marcas.length - 1];
  const W = largura;
  const util = W - EIXO_Y - 8;
  const H = altura - RODAPE - TOPO;
  const n = rotulos.length;
  const x = (i: number) => EIXO_Y + (n <= 1 ? util / 2 : (util * i) / (n - 1));
  const y = (v: number) => TOPO + H - ((v - vMin) / (vMax - vMin || 1)) * H;
  const passo = passoRotulos(n, util, 60);

  return (
    <div>
      {series.length > 1 && (
        <Legenda
          className="mb-3"
          itens={series.map((s) => ({ nome: s.nome, cor: s.cor, tipo: s.tracejado ? "tracejado" : "linha" }))}
        />
      )}
      <div
        ref={ref}
        className="relative w-full"
        onMouseLeave={() => setFoco(null)}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const px = e.clientX - r.left;
          const i = Math.round(((px - EIXO_Y) / util) * (n - 1));
          setFoco(Math.min(n - 1, Math.max(0, i)));
        }}
      >
        <svg width={W} height={altura} role="img" aria-label="Gráfico de linha" className="block overflow-visible">
          <defs>
            {series.map((s, k) => (
              <linearGradient key={k} id={`area-${k}-${s.cor.slice(1)}`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={s.cor} stopOpacity={0.22} />
                <stop offset="100%" stopColor={s.cor} stopOpacity={0.02} />
              </linearGradient>
            ))}
          </defs>
          {marcas.map((m) => (
            <g key={m}>
              <line x1={EIXO_Y} x2={W} y1={y(m)} y2={y(m)} stroke={m === 0 ? "#C9D3D8" : COR.grade} />
              <text x={EIXO_Y - 8} y={y(m)} dy="0.32em" textAnchor="end" fontSize={11} fill={COR.eixo}>
                {fmtEixo(m, formato)}
              </text>
            </g>
          ))}
          {/* Abaixo de zero: faixa de alerta */}
          {vMin < 0 && (
            <rect x={EIXO_Y} y={y(0)} width={util + 8} height={y(vMin) - y(0)} fill="#FDECE6" opacity={0.6} />
          )}
          {marcadorHoje !== undefined && marcadorHoje >= 0 && marcadorHoje < n && (
            <g>
              <line x1={x(marcadorHoje)} x2={x(marcadorHoje)} y1={TOPO} y2={TOPO + H} stroke={COR.titulo} strokeDasharray="3 3" />
              <text x={x(marcadorHoje) + 4} y={TOPO + 10} fontSize={10} fill={COR.titulo} fontWeight={600}>
                hoje
              </text>
            </g>
          )}
          {series.map((s, k) => {
            const pts = s.valores.map((v, i) => [x(i), y(v)] as const);
            const linha = pts.map(([a, b]) => `${a},${b}`).join(" ");
            const area = `M${pts[0]?.[0] ?? 0},${y(Math.max(vMin, 0))} L${linha.replace(/ /g, " L")} L${pts[pts.length - 1]?.[0] ?? 0},${y(Math.max(vMin, 0))} Z`;
            return (
              <g key={s.nome} pointerEvents="none">
                {s.area && pts.length > 1 && <path d={area} fill={`url(#area-${k}-${s.cor.slice(1)})`} />}
                <polyline
                  points={linha}
                  fill="none"
                  stroke={s.cor}
                  strokeWidth={2}
                  strokeDasharray={s.tracejado ? "5 4" : undefined}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              </g>
            );
          })}
          {rotulos.map((r, i) => {
            // O último ponto ganha rótulo só se não encostar no anterior
            const ultimoMarcado = Math.floor((n - 1) / passo) * passo;
            const mostrar = i % passo === 0 || (i === n - 1 && n - 1 - ultimoMarcado >= Math.ceil(passo * 0.7));
            return mostrar ? (
              <text
                key={i}
                x={x(i)}
                y={altura - 8}
                textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}
                fontSize={11}
                fill={COR.eixo}
              >
                {r}
              </text>
            ) : null;
          })}
          {foco !== null && (
            <g pointerEvents="none">
              <line x1={x(foco)} x2={x(foco)} y1={TOPO} y2={TOPO + H} stroke="#9AA9B0" strokeWidth={1} />
              {series.map((s) => (
                <circle key={s.nome} cx={x(foco)} cy={y(s.valores[foco] ?? 0)} r={4.5} fill={s.cor} stroke="#fff" strokeWidth={2} />
              ))}
            </g>
          )}
        </svg>
        {foco !== null && (
          <Dica
            x={x(foco)}
            y={4}
            largura={W}
            titulo={rotulos[foco]}
            linhas={series.map((s) => ({ nome: s.nome, cor: s.cor, valor: fmt(s.valores[foco] ?? 0, formato) }))}
          />
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Rosca (parte do todo, até 6 fatias)                                 */
/* ------------------------------------------------------------------ */

export function Rosca({
  itens,
  centro,
  formato = "reais",
  tamanho = 168,
  lado = false,
}: {
  itens: { nome: string; valor: number; cor?: string }[];
  centro: { valor: string; rotulo: string };
  formato?: Formato;
  tamanho?: number;
  /** Legenda ao lado da rosca (só em espaços largos). */
  lado?: boolean;
}) {
  const [foco, setFoco] = useState<number | null>(null);
  const positivos = itens.filter((i) => i.valor > 0);
  // Mais de seis fatias vira "Outros": cor nova não é gerada
  const ordenados = [...positivos].sort((a, b) => b.valor - a.valor);
  const lista =
    ordenados.length > 6
      ? [...ordenados.slice(0, 5), { nome: "Outros", valor: ordenados.slice(5).reduce((s, i) => s + i.valor, 0), cor: COR.neutro }]
      : ordenados;
  const total = lista.reduce((s, i) => s + i.valor, 0) || 1;
  const R = tamanho / 2;
  const espessura = 22;
  const r = R - espessura / 2;
  const C = 2 * Math.PI * r;
  let acumulado = 0;

  return (
    <div className={lado ? "flex flex-col items-center gap-5 sm:flex-row" : "flex flex-col items-center gap-5"}>
      <div className="relative shrink-0" style={{ width: tamanho, height: tamanho }}>
        <svg width={tamanho} height={tamanho} viewBox={`0 0 ${tamanho} ${tamanho}`} className="-rotate-90">
          <circle cx={R} cy={R} r={r} fill="none" stroke={COR.grade} strokeWidth={espessura} />
          {lista.map((i, k) => {
            const frac = i.valor / total;
            const comprimento = Math.max(frac * C - 2, 0.5);
            const el = (
              <circle
                key={i.nome}
                cx={R}
                cy={R}
                r={r}
                fill="none"
                stroke={i.cor ?? SERIES[k % SERIES.length]}
                strokeWidth={foco === k ? espessura + 4 : espessura}
                strokeDasharray={`${comprimento} ${C - comprimento}`}
                strokeDashoffset={-acumulado * C}
                onMouseEnter={() => setFoco(k)}
                onMouseLeave={() => setFoco(null)}
                className="transition-[stroke-width]"
              />
            );
            acumulado += frac;
            return el;
          })}
        </svg>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div className="px-6">
            <p className="font-heading text-base font-bold leading-tight text-azul-medico">
              {foco !== null ? fmt(lista[foco].valor, formato) : centro.valor}
            </p>
            <p className="mt-0.5 text-[11px] leading-tight text-cinza-suave">
              {foco !== null ? lista[foco].nome : centro.rotulo}
            </p>
          </div>
        </div>
      </div>
      <ul className="grid w-full min-w-0 gap-2">
        {lista.map((i, k) => (
          <li
            key={i.nome}
            className="flex min-w-0 items-center gap-2 text-sm"
            onMouseEnter={() => setFoco(k)}
            onMouseLeave={() => setFoco(null)}
          >
            <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: i.cor ?? SERIES[k % SERIES.length] }} />
            <span className="min-w-0 flex-1 truncate text-cinza-texto">{i.nome}</span>
            <span className="w-11 shrink-0 text-right tabular-nums text-cinza-suave">{pct((i.valor / total) * 100)}</span>
            <span className="w-24 shrink-0 text-right font-medium tabular-nums text-cinza-texto">{fmt(i.valor, formato)}</span>
          </li>
        ))}
        {!lista.length && <li className="text-sm text-cinza-suave">Sem valores no período.</li>}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Ranking em barras horizontais (HTML: o nome nunca é cortado no SVG) */
/* ------------------------------------------------------------------ */

export function Ranking({
  itens,
  cor = COR.receita,
  formato = "reais",
  limite = 8,
}: {
  itens: { nome: string; valor: number; detalhe?: string }[];
  cor?: string;
  formato?: Formato;
  limite?: number;
}) {
  const lista = [...itens].sort((a, b) => b.valor - a.valor).slice(0, limite);
  const max = Math.max(...lista.map((i) => i.valor), 1);
  if (!lista.length) return <p className="text-sm text-cinza-suave">Sem dados no período.</p>;
  return (
    <ul className="grid gap-3">
      {lista.map((i) => (
        <li key={i.nome} className="min-w-0">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate text-cinza-texto">{i.nome}</span>
            <span className="shrink-0 font-semibold tabular-nums text-azul-medico">{fmt(i.valor, formato)}</span>
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-[#EEF3F5]">
              <div className="h-full rounded-full" style={{ width: `${Math.max((i.valor / max) * 100, 1.5)}%`, background: cor }} />
            </div>
            {i.detalhe && <span className="w-24 shrink-0 truncate text-right text-[11px] text-cinza-suave">{i.detalhe}</span>}
          </div>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/* Cascata (DRE, ponte do MRR)                                         */
/* ------------------------------------------------------------------ */

export type Etapa = { nome: string; valor: number; tipo: "total" | "mais" | "menos" };

/**
 * Do primeiro total ao último, somando e subtraindo. Cada barra flutua
 * a partir de onde a anterior parou, e o valor fica escrito acima.
 */
export function Cascata({ etapas, altura = 260 }: { etapas: Etapa[]; altura?: number }) {
  const [ref, largura] = useLargura<HTMLDivElement>();
  let corrente = 0;
  const barras = etapas.map((e) => {
    if (e.tipo === "total") {
      corrente = e.valor;
      return { ...e, de: 0, ate: e.valor };
    }
    const de = corrente;
    corrente = e.tipo === "mais" ? corrente + e.valor : corrente - e.valor;
    return { ...e, de, ate: corrente };
  });
  const valores = barras.flatMap((b) => [b.de, b.ate]);
  const marcas = escala(Math.max(...valores, 1), Math.min(...valores, 0));
  const vMin = marcas[0];
  const vMax = marcas[marcas.length - 1];
  const W = largura;
  const TOPO_C = 22;
  const RODAPE_C = 40;
  const H = altura - TOPO_C - RODAPE_C;
  const util = W - EIXO_Y;
  const banda = util / etapas.length;
  const larg = Math.min(banda * 0.62, 64);
  const y = (v: number) => TOPO_C + H - ((v - vMin) / (vMax - vMin || 1)) * H;
  // Rótulos de baixo em duas linhas quando a banda é estreita
  const quebra = banda < 90;

  return (
    <div ref={ref} className="relative w-full">
      <svg width={W} height={altura} role="img" aria-label="Gráfico em cascata" className="block">
        {marcas.map((m) => (
          <g key={m}>
            <line x1={EIXO_Y} x2={W} y1={y(m)} y2={y(m)} stroke={m === 0 ? COR.neutro : COR.grade} />
            <text x={EIXO_Y - 8} y={y(m)} dy="0.32em" textAnchor="end" fontSize={11} fill={COR.eixo}>
              {reaisCurto(m)}
            </text>
          </g>
        ))}
        {barras.map((b, i) => {
          const x = EIXO_Y + banda * i + (banda - larg) / 2;
          const topo = y(Math.max(b.de, b.ate));
          const h = Math.max(Math.abs(y(b.de) - y(b.ate)), 1.5);
          const cor = b.tipo === "total" ? (b.ate >= 0 ? COR.lucro : COR.critico) : b.tipo === "mais" ? COR.receita : COR.despesa;
          const palavras = b.nome.split(" ");
          const meio = Math.ceil(palavras.length / 2);
          return (
            <g key={b.nome + i}>
              {i > 0 && (
                <line
                  x1={EIXO_Y + banda * (i - 1) + (banda + larg) / 2}
                  x2={x}
                  y1={y(b.de)}
                  y2={y(b.de)}
                  stroke="#9AA9B0"
                  strokeDasharray="2 3"
                />
              )}
              <rect x={x} y={topo} width={larg} height={h} rx={4} fill={cor} />
              <text x={x + larg / 2} y={topo - 6} textAnchor="middle" fontSize={11} fontWeight={600} fill={COR.texto}>
                {b.tipo === "menos" ? "−" : ""}
                {reaisCurto(Math.abs(b.tipo === "total" ? b.ate : b.valor))}
              </text>
              {quebra && palavras.length > 1 ? (
                <text x={x + larg / 2} y={altura - 22} textAnchor="middle" fontSize={10.5} fill={COR.eixo}>
                  <tspan x={x + larg / 2}>{palavras.slice(0, meio).join(" ")}</tspan>
                  <tspan x={x + larg / 2} dy={13}>
                    {palavras.slice(meio).join(" ")}
                  </tspan>
                </text>
              ) : (
                <text x={x + larg / 2} y={altura - 16} textAnchor="middle" fontSize={11} fill={COR.eixo}>
                  {b.nome}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Medidor de meta e minigráfico                                       */
/* ------------------------------------------------------------------ */

export function Medidor({
  valor,
  meta,
  rotulo,
  formato = "reais",
}: {
  valor: number;
  meta: number;
  rotulo: string;
  formato?: Formato;
}) {
  const p = meta > 0 ? (valor / meta) * 100 : 0;
  const cor = p >= 100 ? COR.bom : p >= 70 ? COR.receita : COR.atencao;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="text-cinza-suave">{rotulo}</span>
        <span className="tabular-nums text-cinza-suave">
          <strong className="text-cinza-texto">{fmt(valor, formato)}</strong> de {fmt(meta, formato)}
        </span>
      </div>
      <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-[#EEF3F5]">
        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(p, 100)}%`, background: cor }} />
      </div>
      <p className="mt-1 text-right text-xs font-semibold tabular-nums" style={{ color: cor }}>
        {pct(p)}
      </p>
    </div>
  );
}

export function Minigrafico({ valores, cor = COR.receita, largura = 96, altura = 32 }: {
  valores: number[];
  cor?: string;
  largura?: number;
  altura?: number;
}) {
  if (valores.length < 2) return null;
  const max = Math.max(...valores);
  const min = Math.min(...valores);
  const x = (i: number) => (largura * i) / (valores.length - 1);
  const y = (v: number) => altura - 3 - ((v - min) / (max - min || 1)) * (altura - 6);
  const pts = valores.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  return (
    <svg width={largura} height={altura} aria-hidden className="block">
      <polyline points={pts} fill="none" stroke={cor} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(valores.length - 1)} cy={y(valores[valores.length - 1])} r={2.5} fill={cor} />
    </svg>
  );
}
