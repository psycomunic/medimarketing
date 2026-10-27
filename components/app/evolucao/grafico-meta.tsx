"use client";

import {
  Area,
  CartesianGrid,
  ComposedChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatarReais, rotuloMes } from "@/lib/indicadores";

const CORES = {
  serie: "#1A9E8F",
  meta: "#0B4F6C",
  base: "#E8F6F3",
  grade: "#E2ECEF",
  texto: "#6B7A82",
};

const eixo = { fontSize: 11, fill: CORES.texto };

/**
 * Faturamento mês a mês, com o marco zero sombreado e a meta como
 * linha de referência. Uma série só: o título nomeia, sem legenda.
 */
export function GraficoMeta({
  pontos,
  meta,
  baseInicio,
  baseFim,
}: {
  pontos: { mes: string; faturamento: number; estimado: boolean }[];
  meta: number | null;
  baseInicio: string;
  baseFim: string;
}) {
  const dados = pontos.map((p) => ({ ...p, rotulo: rotuloMes(p.mes) }));
  const maior = Math.max(meta ?? 0, ...dados.map((d) => d.faturamento));

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={dados} margin={{ top: 16, right: 12, left: 4, bottom: 0 }}>
          <CartesianGrid stroke={CORES.grade} vertical={false} />
          <ReferenceArea
            x1={rotuloMes(baseInicio)}
            x2={rotuloMes(baseFim)}
            fill={CORES.base}
            fillOpacity={1}
            ifOverflow="extendDomain"
            label={{ value: "Marco zero", position: "insideTop", fontSize: 11, fill: CORES.texto }}
          />
          <XAxis dataKey="rotulo" tick={eixo} axisLine={false} tickLine={false} />
          <YAxis
            tick={eixo}
            axisLine={false}
            tickLine={false}
            width={64}
            domain={[0, Math.ceil(maior * 1.1)]}
            tickFormatter={(v: number) =>
              v >= 1000 ? `${Math.round(v / 1000)} mil` : String(v)
            }
          />
          <Tooltip
            cursor={{ stroke: CORES.grade, strokeWidth: 1 }}
            content={({ active, payload, label }) => {
              const p = payload?.[0]?.payload as (typeof dados)[number] | undefined;
              if (!active || !p) return null;
              return (
                <div className="rounded-lg border border-border bg-white px-3 py-2 shadow-card">
                  <p className="text-xs font-semibold text-azul-medico">{label}</p>
                  <p className="text-xs text-cinza-suave">
                    Faturamento:{" "}
                    <strong className="text-cinza-texto">{formatarReais(p.faturamento)}</strong>
                    {p.estimado && " (estimado)"}
                  </p>
                  {meta ? (
                    <p className="text-xs text-cinza-suave">
                      Meta: <strong className="text-cinza-texto">{formatarReais(meta)}</strong>
                    </p>
                  ) : null}
                </div>
              );
            }}
          />
          {meta ? (
            <ReferenceLine
              y={meta}
              stroke={CORES.meta}
              strokeDasharray="6 4"
              strokeWidth={1.5}
              label={{ value: `Meta ${formatarReais(meta)}`, position: "insideTopRight", fontSize: 11, fill: CORES.meta }}
            />
          ) : null}
          <Area
            type="monotone"
            dataKey="faturamento"
            stroke={CORES.serie}
            strokeWidth={2}
            fill={CORES.serie}
            fillOpacity={0.08}
            dot={{ r: 4, fill: CORES.serie, stroke: "#fff", strokeWidth: 2 }}
            activeDot={{ r: 5, stroke: "#fff", strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
