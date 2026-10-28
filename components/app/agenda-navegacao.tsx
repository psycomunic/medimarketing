"use client";

import { useEffect, useRef, useState } from "react";
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { DIAS_CURTOS } from "@/lib/agenda";
import { cn } from "@/lib/utils";

/**
 * Seletor de data: o título do período vira um botão que abre um mini
 * calendário. Com ele, ir para "daqui a três semanas" é um clique, e não
 * vinte cliques na seta.
 */
export function SeletorData({
  titulo,
  cursor,
  onEscolher,
  contarDia,
}: {
  titulo: string;
  cursor: Date;
  onEscolher: (d: Date) => void;
  /** Quantas consultas ativas o dia tem, para o pontinho. */
  contarDia: (d: Date) => number;
}) {
  const [aberto, setAberto] = useState(false);
  const [mes, setMes] = useState(cursor);
  const caixa = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (aberto) setMes(cursor);
  }, [aberto, cursor]);

  // Fecha ao clicar fora ou apertar Esc
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [aberto]);

  const dias = eachDayOfInterval({
    start: startOfWeek(startOfMonth(mes), { weekStartsOn: 0 }),
    end: endOfWeek(endOfMonth(mes), { weekStartsOn: 0 }),
  });

  return (
    <div ref={caixa} className="relative min-w-0">
      <button
        type="button"
        onClick={() => setAberto(!aberto)}
        aria-expanded={aberto}
        className="flex min-w-0 items-center gap-2 rounded-lg px-2.5 py-1.5 text-left transition-colors hover:bg-verde-menta/60"
      >
        <CalendarDays className="size-4 shrink-0 text-teal" />
        <span className="truncate font-heading text-base font-semibold text-azul-medico sm:text-lg">
          {titulo}
        </span>
        <ChevronDown className={cn("size-4 shrink-0 text-cinza-suave transition-transform", aberto && "rotate-180")} />
      </button>

      {aberto && (
        <div className="absolute left-0 top-full z-40 mt-2 w-[19rem] max-w-[calc(100vw-2.5rem)] rounded-xl border border-border bg-white p-3 shadow-card">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setMes(addMonths(mes, -1))}
              className="grid size-8 place-items-center rounded-md text-cinza-suave hover:bg-verde-menta hover:text-azul-medico"
              aria-label="Mês anterior"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="font-heading text-sm font-semibold capitalize text-azul-medico">
              {format(mes, "MMMM 'de' yyyy", { locale: ptBR })}
            </span>
            <button
              type="button"
              onClick={() => setMes(addMonths(mes, 1))}
              className="grid size-8 place-items-center rounded-md text-cinza-suave hover:bg-verde-menta hover:text-azul-medico"
              aria-label="Próximo mês"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>

          <div className="mt-2 grid grid-cols-7 text-center text-[10px] font-semibold uppercase text-cinza-suave">
            {DIAS_CURTOS.map((d) => (
              <span key={d} className="py-1">
                {d.charAt(0)}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {dias.map((d) => {
              const n = contarDia(d);
              const escolhido = isSameDay(d, cursor);
              return (
                <button
                  key={d.toISOString()}
                  type="button"
                  onClick={() => {
                    onEscolher(d);
                    setAberto(false);
                  }}
                  className={cn(
                    "relative grid h-9 place-items-center rounded-lg text-sm transition-colors",
                    escolhido
                      ? "bg-azul-medico font-semibold text-white"
                      : isToday(d)
                        ? "font-semibold text-teal ring-1 ring-inset ring-teal"
                        : isSameMonth(d, mes)
                          ? "text-cinza-texto hover:bg-verde-menta"
                          : "text-cinza-suave/40 hover:bg-verde-menta/50"
                  )}
                >
                  {format(d, "d")}
                  {n > 0 && (
                    <span
                      className={cn(
                        "absolute bottom-1 size-1 rounded-full",
                        escolhido ? "bg-white" : "bg-teal"
                      )}
                    />
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex gap-2 border-t border-border pt-3">
            {[
              { r: "Hoje", d: new Date() },
              { r: "Amanhã", d: addDays(new Date(), 1) },
              { r: "+7 dias", d: addDays(new Date(), 7) },
            ].map((a) => (
              <button
                key={a.r}
                type="button"
                onClick={() => {
                  onEscolher(a.d);
                  setAberto(false);
                }}
                className="flex-1 rounded-md border border-border py-1.5 text-xs font-medium text-cinza-texto hover:border-teal hover:text-teal"
              >
                {a.r}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Faixa com os sete dias da semana do dia escolhido. Um clique troca o
 * dia; as setas da ponta passam a semana inteira.
 */
export function FaixaDias({
  cursor,
  onEscolher,
  contarDia,
}: {
  cursor: Date;
  onEscolher: (d: Date) => void;
  contarDia: (d: Date) => number;
}) {
  const inicio = startOfWeek(cursor, { weekStartsOn: 0 });
  const dias = eachDayOfInterval({ start: inicio, end: addDays(inicio, 6) });

  return (
    <div className="flex items-stretch gap-1.5">
      <button
        type="button"
        onClick={() => onEscolher(addDays(cursor, -7))}
        className="grid w-8 shrink-0 place-items-center rounded-lg border border-border bg-white text-cinza-suave transition-colors hover:border-teal hover:text-teal"
        aria-label="Semana anterior"
        title="Semana anterior"
      >
        <ChevronLeft className="size-4" />
      </button>

      <div className="grid min-w-0 flex-1 grid-cols-7 gap-1.5">
        {dias.map((d) => {
          const escolhido = isSameDay(d, cursor);
          const hoje = isToday(d);
          const n = contarDia(d);
          return (
            <button
              key={d.toISOString()}
              type="button"
              onClick={() => onEscolher(d)}
              className={cn(
                "flex min-w-0 flex-col items-center rounded-lg border px-1 py-2 transition-all",
                escolhido
                  ? "border-azul-medico bg-azul-medico text-white shadow-soft"
                  : hoje
                    ? "border-teal bg-verde-menta/60 text-azul-medico hover:bg-verde-menta"
                    : "border-border bg-white text-cinza-texto hover:border-teal/60 hover:bg-verde-menta/30"
              )}
            >
              <span
                className={cn(
                  "text-[10px] font-semibold uppercase tracking-wide",
                  escolhido ? "text-white/75" : hoje ? "text-teal" : "text-cinza-suave"
                )}
              >
                {hoje ? "Hoje" : format(d, "EEE", { locale: ptBR }).replace(".", "")}
              </span>
              <span className="font-heading text-lg font-bold leading-tight">{format(d, "d")}</span>
              <span
                className={cn(
                  "mt-0.5 h-4 rounded-full px-1.5 text-[10px] font-semibold leading-4",
                  n === 0
                    ? "text-transparent"
                    : escolhido
                      ? "bg-white/20 text-white"
                      : "bg-teal/12 text-teal"
                )}
              >
                {n > 0 ? n : "·"}
              </span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => onEscolher(addDays(cursor, 7))}
        className="grid w-8 shrink-0 place-items-center rounded-lg border border-border bg-white text-cinza-suave transition-colors hover:border-teal hover:text-teal"
        aria-label="Próxima semana"
        title="Próxima semana"
      >
        <ChevronRight className="size-4" />
      </button>
    </div>
  );
}
