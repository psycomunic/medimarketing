"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatarNumero, formatarReais, rotuloMes } from "@/lib/indicadores";
import type { IndicadorMensal } from "@/lib/supabase/types";

// Tokens da marca (Recharts precisa de cor literal, não classe do Tailwind)
const CORES = {
  azul: "#0B4F6C",
  teal: "#1A9E8F",
  tealClaro: "#5FC9B8",
  coral: "#FF6B6B",
  grade: "#E2ECEF",
  texto: "#6B7A82",
};

const eixo = { fontSize: 11, fill: CORES.texto };

function Caixa({
  ativo,
  itens,
  rotulo,
  moeda,
}: {
  ativo?: boolean;
  itens?: { name: string; value: number; color: string }[];
  rotulo?: string;
  moeda?: boolean;
}) {
  if (!ativo || !itens?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-white px-3 py-2 shadow-card">
      <p className="mb-1 text-xs font-semibold text-azul-medico">{rotulo}</p>
      {itens.map((i) => (
        <p key={i.name} className="flex items-center gap-2 text-xs text-cinza-suave">
          <span className="size-2 rounded-full" style={{ background: i.color }} />
          {i.name}:{" "}
          <strong className="text-cinza-texto">
            {moeda ? formatarReais(i.value) : formatarNumero(i.value)}
          </strong>
        </p>
      ))}
    </div>
  );
}

/** Investimento em marketing contra o faturamento gerado. */
export function GraficoRetorno({ meses }: { meses: IndicadorMensal[] }) {
  const dados = meses.map((m) => ({
    mes: rotuloMes(m.mes),
    Investimento: Number(m.investimento),
    Faturamento: Number(m.faturamento),
  }));

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={dados} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={CORES.grade} vertical={false} />
          <XAxis dataKey="mes" tick={eixo} tickLine={false} axisLine={false} />
          <YAxis
            tick={eixo}
            tickLine={false}
            axisLine={false}
            width={64}
            tickFormatter={(v: number) =>
              v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)
            }
          />
          <Tooltip
            cursor={{ fill: "rgba(26,158,143,0.06)" }}
            content={(p) => (
              <Caixa
                ativo={p.active}
                rotulo={String(p.label ?? "")}
                moeda
                itens={(p.payload ?? []).map((i) => ({
                  name: String(i.name),
                  value: Number(i.value),
                  color: String(i.color),
                }))}
              />
            )}
          />
          <Legend
            wrapperStyle={{ fontSize: 12, color: CORES.texto, paddingTop: 8 }}
            iconType="circle"
          />
          <Bar
            dataKey="Investimento"
            fill={CORES.tealClaro}
            radius={[4, 4, 0, 0]}
            maxBarSize={34}
          />
          <Line
            type="monotone"
            dataKey="Faturamento"
            stroke={CORES.azul}
            strokeWidth={2.5}
            dot={{ r: 3, fill: CORES.azul }}
            activeDot={{ r: 5 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Evolução do funil mês a mês. */
export function GraficoFunil({ meses }: { meses: IndicadorMensal[] }) {
  const dados = meses.map((m) => ({
    mes: rotuloMes(m.mes),
    Leads: m.leads,
    Agendamentos: m.agendamentos,
    Comparecimentos: m.comparecimentos,
  }));

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={dados} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={CORES.grade} vertical={false} />
          <XAxis dataKey="mes" tick={eixo} tickLine={false} axisLine={false} />
          <YAxis tick={eixo} tickLine={false} axisLine={false} width={40} />
          <Tooltip
            cursor={{ stroke: CORES.grade }}
            content={(p) => (
              <Caixa
                ativo={p.active}
                rotulo={String(p.label ?? "")}
                itens={(p.payload ?? []).map((i) => ({
                  name: String(i.name),
                  value: Number(i.value),
                  color: String(i.color),
                }))}
              />
            )}
          />
          <Legend
            wrapperStyle={{ fontSize: 12, color: CORES.texto, paddingTop: 8 }}
            iconType="circle"
          />
          <Line
            type="monotone"
            dataKey="Leads"
            stroke={CORES.tealClaro}
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="Agendamentos"
            stroke={CORES.teal}
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="Comparecimentos"
            stroke={CORES.coral}
            strokeWidth={2.5}
            dot={{ r: 3, fill: CORES.coral }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
