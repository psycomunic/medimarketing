"use client";

import { useMemo, useState } from "react";
import {
  addDays,
  addMonths,
  addWeeks,
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
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  CalendarDays,
} from "lucide-react";
import type { Consulta } from "@/lib/supabase/types";
import { Button } from "@/components/ui/button";
import { corStatus } from "@/lib/agenda";
import { cn } from "@/lib/utils";
import { ConsultaDialog } from "@/components/app/consulta-dialog";
import { NovaConsultaDialog } from "@/components/app/nova-consulta-dialog";
import { DIAS_CURTOS } from "@/lib/agenda";

type Visao = "mes" | "semana" | "dia";

export function AgendaCalendar({
  consultasIniciais,
}: {
  consultasIniciais: Consulta[];
}) {
  const [visao, setVisao] = useState<Visao>("mes");
  const [cursor, setCursor] = useState(new Date());
  const [selecionada, setSelecionada] = useState<Consulta | null>(null);
  const [novaAberta, setNovaAberta] = useState(false);
  const [dataNova, setDataNova] = useState<Date | null>(null);

  // Agrupa consultas por dia (yyyy-MM-dd)
  const porDia = useMemo(() => {
    const mapa = new Map<string, Consulta[]>();
    for (const c of consultasIniciais) {
      const chave = format(new Date(c.data_hora), "yyyy-MM-dd");
      const arr = mapa.get(chave) ?? [];
      arr.push(c);
      mapa.set(chave, arr);
    }
    return mapa;
  }, [consultasIniciais]);

  const consultasDoDia = (d: Date) =>
    (porDia.get(format(d, "yyyy-MM-dd")) ?? []).sort((a, b) =>
      a.data_hora.localeCompare(b.data_hora)
    );

  function navegar(dir: -1 | 1) {
    if (visao === "mes") setCursor((c) => addMonths(c, dir));
    else if (visao === "semana") setCursor((c) => addWeeks(c, dir));
    else setCursor((c) => addDays(c, dir));
  }

  const titulo =
    visao === "mes"
      ? format(cursor, "MMMM 'de' yyyy", { locale: ptBR })
      : visao === "semana"
        ? `${format(startOfWeek(cursor, { weekStartsOn: 0 }), "dd MMM", { locale: ptBR })} – ${format(endOfWeek(cursor, { weekStartsOn: 0 }), "dd MMM", { locale: ptBR })}`
        : format(cursor, "EEEE, dd 'de' MMMM", { locale: ptBR });

  function abrirNova(d?: Date) {
    setDataNova(d ?? cursor);
    setNovaAberta(true);
  }

  return (
    <div>
      {/* Cabeçalho */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl">Agenda</h1>
          <p className="mt-1 text-cinza-suave">
            Suas consultas marcadas pela nossa equipe, em tempo real.
          </p>
        </div>
        <Button variant="primary" onClick={() => abrirNova()}>
          <Plus className="size-4" /> Nova consulta
        </Button>
      </header>

      {/* Barra de controle */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navegar(-1)}
            className="grid size-9 place-items-center rounded-md border border-border bg-white text-cinza-suave transition-colors hover:text-azul-medico"
            aria-label="Anterior"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            onClick={() => navegar(1)}
            className="grid size-9 place-items-center rounded-md border border-border bg-white text-cinza-suave transition-colors hover:text-azul-medico"
            aria-label="Próximo"
          >
            <ChevronRight className="size-4" />
          </button>
          <button
            onClick={() => setCursor(new Date())}
            className="rounded-md border border-border bg-white px-3 py-1.5 text-sm font-medium text-cinza-texto transition-colors hover:text-azul-medico"
          >
            Hoje
          </button>
          <span className="ml-2 font-heading text-lg font-semibold capitalize text-azul-medico">
            {titulo}
          </span>
        </div>

        {/* Alternador de visão */}
        <div className="flex rounded-lg border border-border bg-white p-1">
          {(["mes", "semana", "dia"] as Visao[]).map((v) => (
            <button
              key={v}
              onClick={() => setVisao(v)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors",
                visao === v
                  ? "bg-azul-medico text-white"
                  : "text-cinza-suave hover:text-azul-medico"
              )}
            >
              {v === "mes" ? "Mês" : v}
            </button>
          ))}
        </div>
      </div>

      {/* Corpo */}
      <div className="mt-5">
        {visao === "mes" && (
          <MonthView
            cursor={cursor}
            consultasDoDia={consultasDoDia}
            onDia={(d) => {
              setCursor(d);
              setVisao("dia");
            }}
            onConsulta={setSelecionada}
          />
        )}
        {visao === "semana" && (
          <WeekView
            cursor={cursor}
            consultasDoDia={consultasDoDia}
            onConsulta={setSelecionada}
            onNova={abrirNova}
          />
        )}
        {visao === "dia" && (
          <DayView
            cursor={cursor}
            consultas={consultasDoDia(cursor)}
            onConsulta={setSelecionada}
            onNova={() => abrirNova(cursor)}
          />
        )}
      </div>

      {/* Legenda de status */}
      <div className="mt-6 flex flex-wrap gap-4 text-xs text-cinza-suave">
        {(
          [
            ["confirmada", "Confirmada"],
            ["pendente", "Pendente"],
            ["realizada", "Realizada"],
            ["cancelada", "Cancelada"],
          ] as const
        ).map(([k, label]) => (
          <span key={k} className="flex items-center gap-1.5">
            <span className={cn("size-2.5 rounded-full", corStatus[k])} />
            {label}
          </span>
        ))}
      </div>

      {/* Modais */}
      <ConsultaDialog
        consulta={selecionada}
        onOpenChange={(o) => !o && setSelecionada(null)}
      />
      <NovaConsultaDialog
        aberto={novaAberta}
        data={dataNova}
        onOpenChange={setNovaAberta}
      />
    </div>
  );
}

/* ------------------------- Visão de mês ------------------------- */
function MonthView({
  cursor,
  consultasDoDia,
  onDia,
  onConsulta,
}: {
  cursor: Date;
  consultasDoDia: (d: Date) => Consulta[];
  onDia: (d: Date) => void;
  onConsulta: (c: Consulta) => void;
}) {
  const inicio = startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 });
  const fim = endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 });
  const dias = eachDayOfInterval({ start: inicio, end: fim });

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-white shadow-soft">
      <div className="grid grid-cols-7 border-b border-border bg-verde-menta/40">
        {DIAS_CURTOS.map((d) => (
          <div
            key={d}
            className="py-2 text-center text-xs font-semibold uppercase tracking-wide text-cinza-suave"
          >
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {dias.map((d) => {
          const doMes = isSameMonth(d, cursor);
          const consultas = consultasDoDia(d);
          return (
            <button
              key={d.toISOString()}
              onClick={() => onDia(d)}
              className={cn(
                "min-h-[92px] border-b border-r border-border p-1.5 text-left transition-colors hover:bg-verde-menta/30 focus:outline-none",
                !doMes && "bg-branco-clinico/60"
              )}
            >
              <span
                className={cn(
                  "inline-grid size-6 place-items-center rounded-full text-xs font-medium",
                  isToday(d)
                    ? "bg-teal text-white"
                    : doMes
                      ? "text-cinza-texto"
                      : "text-cinza-suave/50"
                )}
              >
                {format(d, "d")}
              </span>
              <div className="mt-1 space-y-1">
                {consultas.slice(0, 3).map((c) => (
                  <div
                    key={c.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onConsulta(c);
                    }}
                    className="flex items-center gap-1 truncate rounded bg-verde-menta px-1.5 py-0.5 text-[11px] text-cinza-texto hover:bg-teal-claro/30"
                  >
                    <span className={cn("size-1.5 shrink-0 rounded-full", corStatus[c.status])} />
                    <span className="truncate">
                      {format(new Date(c.data_hora), "HH:mm")} {c.paciente_nome}
                    </span>
                  </div>
                ))}
                {consultas.length > 3 && (
                  <span className="pl-1 text-[11px] font-medium text-teal">
                    +{consultas.length - 3} mais
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------- Visão de semana ------------------------- */
function WeekView({
  cursor,
  consultasDoDia,
  onConsulta,
  onNova,
}: {
  cursor: Date;
  consultasDoDia: (d: Date) => Consulta[];
  onConsulta: (c: Consulta) => void;
  onNova: (d: Date) => void;
}) {
  const inicio = startOfWeek(cursor, { weekStartsOn: 0 });
  const dias = eachDayOfInterval({ start: inicio, end: endOfWeek(cursor, { weekStartsOn: 0 }) });

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
      {dias.map((d) => {
        const consultas = consultasDoDia(d);
        return (
          <div
            key={d.toISOString()}
            className="rounded-lg border border-border bg-white p-3 shadow-soft"
          >
            <div className="mb-2 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase text-cinza-suave">
                  {format(d, "EEE", { locale: ptBR })}
                </p>
                <p
                  className={cn(
                    "font-heading text-lg font-semibold",
                    isToday(d) ? "text-teal" : "text-azul-medico"
                  )}
                >
                  {format(d, "dd")}
                </p>
              </div>
              <button
                onClick={() => onNova(d)}
                className="grid size-6 place-items-center rounded-md text-cinza-suave hover:text-teal"
                aria-label="Nova consulta"
              >
                <Plus className="size-4" />
              </button>
            </div>
            <div className="space-y-1.5">
              {consultas.length === 0 && (
                <p className="py-2 text-center text-xs text-cinza-suave/70">—</p>
              )}
              {consultas.map((c) => (
                <button
                  key={c.id}
                  onClick={() => onConsulta(c)}
                  className="flex w-full items-center gap-2 rounded-md border border-border bg-branco-clinico px-2 py-1.5 text-left hover:border-teal-claro"
                >
                  <span className={cn("size-2 shrink-0 rounded-full", corStatus[c.status])} />
                  <span className="min-w-0">
                    <span className="block text-xs font-semibold text-azul-medico">
                      {format(new Date(c.data_hora), "HH:mm")}
                    </span>
                    <span className="block truncate text-xs text-cinza-suave">
                      {c.paciente_nome}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------- Visão de dia ------------------------- */
function DayView({
  cursor,
  consultas,
  onConsulta,
  onNova,
}: {
  cursor: Date;
  consultas: Consulta[];
  onConsulta: (c: Consulta) => void;
  onNova: () => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-white shadow-soft">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <p className="font-heading font-semibold capitalize text-azul-medico">
          {format(cursor, "EEEE, dd 'de' MMMM", { locale: ptBR })}
        </p>
        <span className="text-sm text-cinza-suave">
          {consultas.length} consulta{consultas.length === 1 ? "" : "s"}
        </span>
      </div>

      {consultas.length === 0 ? (
        <div className="px-5 py-16 text-center text-cinza-suave">
          <CalendarDays className="mx-auto mb-3 size-10 text-teal-claro" />
          <p>Nenhuma consulta neste dia.</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={onNova}>
            <Plus className="size-4" /> Adicionar consulta
          </Button>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {consultas.map((c) => (
            <li key={c.id}>
              <button
                onClick={() => onConsulta(c)}
                className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-verde-menta/30"
              >
                <div className="flex w-16 shrink-0 flex-col items-center rounded-lg bg-verde-menta py-2">
                  <span className="text-sm font-bold text-azul-medico">
                    {format(new Date(c.data_hora), "HH:mm")}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-cinza-texto">
                    {c.paciente_nome}
                  </p>
                  <p className="text-sm capitalize text-cinza-suave">{c.tipo}</p>
                </div>
                <span className={cn("size-3 rounded-full", corStatus[c.status])} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
