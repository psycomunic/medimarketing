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
  Stethoscope,
  ShieldCheck,
  Phone,
  Building2,
  UserRound,
  MessageCircle,
} from "lucide-react";
import { linkWhatsApp } from "@/lib/lembretes";
import type { ConsultaComContexto, OpcoesAgenda } from "@/lib/supabase/queries";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  corStatus,
  rotuloStatus,
  rotuloTipo,
  capitalizar,
  DIAS_CURTOS,
} from "@/lib/agenda";
import { cn } from "@/lib/utils";
import { ConsultaDialog } from "@/components/app/consulta-dialog";
import type { ConfirmacaoDaConsulta } from "@/components/app/confirmacoes/bloco-consulta";
import {
  NovaConsultaDialog,
  type OpcaoProfissional,
} from "@/components/app/nova-consulta-dialog";
import {
  AgendaFiltros,
  FILTROS_VAZIOS,
  aplicarFiltros,
  type FiltrosAgenda,
} from "@/components/app/agenda-filtros";

type Visao = "mes" | "semana" | "dia";
type Consulta = ConsultaComContexto;

export function AgendaCalendar({
  consultasIniciais,
  opcoes,
  profissionais = [],
  clinicas = [],
  confirmacoes = {},
  envioAutomatico = false,
  usuarioId,
  organizationId,
  demo = false,
}: {
  consultasIniciais: ConsultaComContexto[];
  opcoes: OpcoesAgenda;
  profissionais?: OpcaoProfissional[];
  clinicas?: { id: string; nome: string }[];
  /** Estado da confirmação por consulta, para a ficha mostrar sem ida ao servidor. */
  confirmacoes?: Record<string, ConfirmacaoDaConsulta>;
  envioAutomatico?: boolean;
  usuarioId?: string;
  organizationId?: string | null;
  demo?: boolean;
}) {
  const [visao, setVisao] = useState<Visao>("mes");
  const [cursor, setCursor] = useState(new Date());
  const [selecionada, setSelecionada] = useState<Consulta | null>(null);
  const [novaAberta, setNovaAberta] = useState(false);
  const [dataNova, setDataNova] = useState<Date | null>(null);
  const [filtros, setFiltros] = useState<FiltrosAgenda>(FILTROS_VAZIOS);

  const consultas = useMemo(
    () => aplicarFiltros(consultasIniciais, filtros),
    [consultasIniciais, filtros]
  );

  // Quem enxerga mais de uma clínica precisa ver de qual é cada consulta
  const multiClinica = opcoes.clinicas.length > 1;

  // Agrupa consultas por dia (yyyy-MM-dd)
  const porDia = useMemo(() => {
    const mapa = new Map<string, Consulta[]>();
    for (const c of consultas) {
      const chave = format(new Date(c.data_hora), "yyyy-MM-dd");
      const arr = mapa.get(chave) ?? [];
      arr.push(c);
      mapa.set(chave, arr);
    }
    return mapa;
  }, [consultas]);

  const consultasDoDia = (d: Date) =>
    (porDia.get(format(d, "yyyy-MM-dd")) ?? []).sort((a, b) =>
      a.data_hora.localeCompare(b.data_hora)
    );

  function navegar(dir: -1 | 1) {
    if (visao === "mes") setCursor((c) => addMonths(c, dir));
    else if (visao === "semana") setCursor((c) => addWeeks(c, dir));
    else setCursor((c) => addDays(c, dir));
  }

  const titulo = capitalizar(
    visao === "mes"
      ? format(cursor, "MMMM 'de' yyyy", { locale: ptBR })
      : visao === "semana"
        ? `${format(startOfWeek(cursor, { weekStartsOn: 0 }), "dd MMM", { locale: ptBR })} – ${format(endOfWeek(cursor, { weekStartsOn: 0 }), "dd MMM", { locale: ptBR })}`
        : format(cursor, "EEEE, dd 'de' MMMM", { locale: ptBR })
  );

  function abrirNova(d?: Date) {
    setDataNova(d ?? cursor);
    setNovaAberta(true);
  }

  // Resumo do que está visível: responde "como está esse período?" sem
  // obrigar a contar cartão por cartão.
  const doPeriodo = useMemo(() => {
    const dentro =
      visao === "mes"
        ? consultas.filter((c) => isSameMonth(new Date(c.data_hora), cursor))
        : visao === "semana"
          ? consultas.filter((c) => {
              const d = new Date(c.data_hora);
              return (
                d >= startOfWeek(cursor, { weekStartsOn: 0 }) &&
                d <= endOfWeek(cursor, { weekStartsOn: 0 })
              );
            })
          : consultas.filter((c) => isSameDay(new Date(c.data_hora), cursor));

    const ativas = dentro.filter((c) => c.status !== "cancelada");

    return {
      total: dentro.length,
      confirmadas: dentro.filter((c) => c.status === "confirmada").length,
      pendentes: dentro.filter((c) => c.status === "pendente").length,
      canceladas: dentro.filter((c) => c.status === "cancelada").length,
      // Só o que ainda pode acontecer entra na previsão de receita
      previsto: ativas.reduce((s, c) => s + Number(c.valor ?? 0), 0),
      aguardandoConfirmacao: ativas.filter((c) => {
        const conf = confirmacoes[c.id];
        return conf && (conf.status === "pendente" || conf.status === "enviado");
      }).length,
    };
  }, [consultas, confirmacoes, cursor, visao]);

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

      {/* Filtros */}
      <div className="mt-6">
        <AgendaFiltros
          filtros={filtros}
          onChange={setFiltros}
          opcoes={opcoes}
          total={consultasIniciais.length}
          visiveis={consultas.length}
        />
      </div>

      {/* Barra de controle */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
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
          <span className="ml-2 font-heading text-lg font-semibold text-azul-medico">
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

      {/* Resumo do período visível */}
      {doPeriodo.total > 0 && (
        <dl className="mt-4 grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-3 lg:grid-cols-5">
          {[
            { r: "consultas", v: String(doPeriodo.total), cor: "text-azul-medico" },
            { r: "confirmadas", v: String(doPeriodo.confirmadas), cor: "text-sucesso" },
            { r: "pendentes", v: String(doPeriodo.pendentes), cor: "text-alerta" },
            {
              r: "sem resposta",
              v: String(doPeriodo.aguardandoConfirmacao),
              cor: "text-cinza-suave",
            },
            {
              r: "previsto",
              v: doPeriodo.previsto
                ? doPeriodo.previsto.toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                    maximumFractionDigits: 0,
                  })
                : "—",
              cor: "text-teal",
            },
          ].map((c) => (
            <div key={c.r} className="bg-white px-4 py-2.5">
              <dd className={cn("font-heading text-lg font-bold", c.cor)}>{c.v}</dd>
              <dt className="text-[11px] text-cinza-suave">{c.r}</dt>
            </div>
          ))}
        </dl>
      )}

      {/* Corpo */}
      <div className="mt-5">
        {visao === "mes" && (
          <MonthView
            cursor={cursor}
            consultasDoDia={consultasDoDia}
            confirmacoes={confirmacoes}
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
            confirmacoes={confirmacoes}
            onConsulta={setSelecionada}
            onNova={abrirNova}
          />
        )}
        {visao === "dia" && (
          <DayView
            cursor={cursor}
            consultas={consultasDoDia(cursor)}
            multiClinica={multiClinica}
            confirmacoes={confirmacoes}
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
        confirmacao={selecionada ? confirmacoes[selecionada.id] ?? null : null}
        envioAutomatico={envioAutomatico}
        demo={demo}
        onOpenChange={(o) => !o && setSelecionada(null)}
      />
      <NovaConsultaDialog
        aberto={novaAberta}
        data={dataNova}
        onOpenChange={setNovaAberta}
        profissionais={profissionais}
        clinicas={clinicas}
        usuarioId={usuarioId}
        organizationId={organizationId}
        onCriada={(quando) => {
          setCursor(quando);
          setVisao("dia");
        }}
      />
    </div>
  );
}

/* ------------------------- Visão de mês ------------------------- */
/** Cor do pontinho de confirmação usado nas visões compactas. */
const corConfirmacao: Record<string, string> = {
  pendente: "bg-cinza-suave/40",
  enviado: "bg-alerta",
  confirmado: "bg-sucesso",
  reagendar: "bg-coral",
  recusado: "bg-coral",
  cancelado: "bg-cinza-suave/40",
};

function MonthView({
  cursor,
  consultasDoDia,
  confirmacoes,
  onDia,
  onConsulta,
}: {
  cursor: Date;
  consultasDoDia: (d: Date) => Consulta[];
  confirmacoes: Record<string, ConfirmacaoDaConsulta>;
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
          const fimDeSemana = d.getDay() === 0 || d.getDay() === 6;
          // Quantos precisam de atenção: pediram remarcação
          const remarcar = consultas.filter(
            (c) => confirmacoes[c.id]?.status === "reagendar"
          ).length;

          return (
            <button
              key={d.toISOString()}
              onClick={() => onDia(d)}
              className={cn(
                "min-h-[112px] border-b border-r border-border p-1.5 text-left transition-colors hover:bg-verde-menta/30 focus:outline-none",
                !doMes && "bg-branco-clinico/60",
                doMes && fimDeSemana && "bg-branco-clinico/40"
              )}
            >
              <span className="flex items-center justify-between gap-1">
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

                {/* Quantas consultas o dia tem, sem precisar contar */}
                {consultas.length > 0 && (
                  <span className="flex items-center gap-1">
                    {remarcar > 0 && (
                      <span
                        className="size-1.5 rounded-full bg-coral"
                        title={`${remarcar} pediu para remarcar`}
                      />
                    )}
                    <span className="rounded-full bg-verde-menta px-1.5 text-[10px] font-bold text-azul-medico">
                      {consultas.length}
                    </span>
                  </span>
                )}
              </span>
              <div className="mt-1 space-y-1">
                {consultas.slice(0, 4).map((c) => (
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
                    {/* Segundo ponto: como está a confirmação do paciente */}
                    {confirmacoes[c.id] && (
                      <span
                        className={cn(
                          "ml-auto size-1.5 shrink-0 rounded-full",
                          corConfirmacao[confirmacoes[c.id].status]
                        )}
                        title={`Confirmação: ${confirmacoes[c.id].status}`}
                      />
                    )}
                  </div>
                ))}
                {consultas.length > 4 && (
                  <span className="pl-1 text-[11px] font-medium text-teal">
                    +{consultas.length - 4} mais
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

/**
 * Grade de horários da semana.
 *
 * Substitui a lista de cartões por dia: numa agenda o que importa é ver
 * o vazio tanto quanto o cheio — onde dá para encaixar, onde a manhã
 * está sobrecarregada. Isso só aparece quando o tempo vira eixo.
 *
 * A faixa de horas se ajusta ao que existe na semana, com um mínimo de
 * 8h às 19h, para uma clínica que atende à noite não ficar com metade da
 * agenda fora da tela.
 */
function WeekView({
  cursor,
  consultasDoDia,
  confirmacoes,
  onConsulta,
  onNova,
}: {
  cursor: Date;
  consultasDoDia: (d: Date) => Consulta[];
  confirmacoes: Record<string, ConfirmacaoDaConsulta>;
  onConsulta: (c: Consulta) => void;
  onNova: (d: Date) => void;
}) {
  const inicio = startOfWeek(cursor, { weekStartsOn: 0 });
  const dias = eachDayOfInterval({
    start: inicio,
    end: endOfWeek(cursor, { weekStartsOn: 0 }),
  });

  const todas = dias.flatMap((d) => consultasDoDia(d));
  const horas = todas.map((c) => new Date(c.data_hora).getHours());
  const primeira = Math.min(8, ...(horas.length ? horas : [8]));
  const ultima = Math.max(19, ...(horas.length ? horas.map((h) => h + 1) : [19]));
  const faixa = Array.from({ length: ultima - primeira }, (_, i) => primeira + i);

  const ALTURA = 56; // px por hora

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-white shadow-soft">
      {/* Cabeçalho dos dias */}
      <div className="grid grid-cols-[3.5rem_repeat(7,1fr)] border-b border-border bg-verde-menta/40">
        <div />
        {dias.map((d) => (
          <button
            key={d.toISOString()}
            onClick={() => onNova(d)}
            className="group border-l border-border py-2 text-center transition-colors hover:bg-verde-menta"
            title="Marcar consulta neste dia"
          >
            <p className="text-[10px] uppercase tracking-wide text-cinza-suave">
              {format(d, "EEE", { locale: ptBR })}
            </p>
            <p
              className={cn(
                "mx-auto mt-0.5 grid size-7 place-items-center rounded-full font-heading text-sm font-bold",
                isToday(d) ? "bg-teal text-white" : "text-azul-medico"
              )}
            >
              {format(d, "dd")}
            </p>
          </button>
        ))}
      </div>

      {/* Grade */}
      <div className="relative max-h-[560px] overflow-y-auto">
        <div className="grid grid-cols-[3.5rem_repeat(7,1fr)]">
          {/* Coluna das horas */}
          <div>
            {faixa.map((h) => (
              <div
                key={h}
                style={{ height: ALTURA }}
                className="relative border-b border-border/60"
              >
                <span className="absolute -top-2 right-2 text-[10px] text-cinza-suave">
                  {String(h).padStart(2, "0")}:00
                </span>
              </div>
            ))}
          </div>

          {/* Uma coluna por dia */}
          {dias.map((d) => {
            const doDia = consultasDoDia(d);
            const fimDeSemana = d.getDay() === 0 || d.getDay() === 6;

            return (
              <div
                key={d.toISOString()}
                className={cn(
                  "relative border-l border-border",
                  fimDeSemana && "bg-branco-clinico/60"
                )}
              >
                {/* Linhas de hora, que também servem de alvo para marcar */}
                {faixa.map((h) => (
                  <button
                    key={h}
                    onClick={() => {
                      const alvo = new Date(d);
                      alvo.setHours(h, 0, 0, 0);
                      onNova(alvo);
                    }}
                    style={{ height: ALTURA }}
                    className="block w-full border-b border-border/60 transition-colors hover:bg-verde-menta/50"
                    aria-label={`Marcar consulta ${format(d, "dd/MM")} às ${h}:00`}
                  />
                ))}

                {/* Consultas posicionadas pelo horário */}
                {doDia.map((c) => {
                  const d0 = new Date(c.data_hora);
                  const minutos =
                    (d0.getHours() - primeira) * 60 + d0.getMinutes();
                  const altura = Math.max(
                    ((c.duracao_min ?? 30) / 60) * ALTURA,
                    22
                  );
                  const conf = confirmacoes[c.id];
                  const cancelada = c.status === "cancelada";

                  return (
                    <button
                      key={c.id}
                      onClick={() => onConsulta(c)}
                      style={{
                        top: (minutos / 60) * ALTURA,
                        height: altura,
                      }}
                      className={cn(
                        "absolute inset-x-1 overflow-hidden rounded-md border-l-4 bg-white px-1.5 py-0.5 text-left shadow-sm transition-all hover:z-10 hover:shadow-soft",
                        cancelada && "opacity-60 line-through",
                        conf?.status === "reagendar"
                          ? "border-l-coral ring-1 ring-coral/30"
                          : "border-l-transparent"
                      )}
                      title={`${format(d0, "HH:mm")} · ${c.paciente_nome}`}
                    >
                      <span className="flex items-center gap-1">
                        <span
                          className={cn(
                            "size-1.5 shrink-0 rounded-full",
                            corStatus[c.status]
                          )}
                        />
                        <span className="truncate text-[10px] font-semibold text-azul-medico">
                          {format(d0, "HH:mm")}
                        </span>
                      </span>
                      <span className="block truncate text-[10px] leading-tight text-cinza-suave">
                        {c.paciente_nome}
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      <p className="border-t border-border px-4 py-2 text-[11px] text-cinza-suave">
        Clique num horário vazio para marcar. Barra vermelha à esquerda =
        paciente pediu para reagendar.
      </p>
    </div>
  );
}

/** Selo curto do estado da confirmação, para caber ao lado da consulta. */
function SeloConfirmacao({
  confirmacao,
}: {
  confirmacao?: ConfirmacaoDaConsulta;
}) {
  if (!confirmacao) return null;

  const mapa: Record<string, { texto: string; classe: string }> = {
    pendente: { texto: "a enviar", classe: "bg-verde-menta text-cinza-suave" },
    enviado: { texto: "aguardando", classe: "bg-alerta/12 text-alerta" },
    confirmado: { texto: "confirmou", classe: "bg-sucesso/12 text-sucesso" },
    reagendar: { texto: "quer remarcar", classe: "bg-coral/12 text-coral" },
    recusado: { texto: "não vem", classe: "bg-coral/12 text-coral" },
    cancelado: { texto: "cancelada", classe: "bg-verde-menta text-cinza-suave" },
  };

  const s = mapa[confirmacao.status];
  if (!s) return null;

  return (
    <span
      className={cn(
        "hidden whitespace-nowrap rounded-full px-2 py-1 text-[10px] font-semibold sm:inline",
        s.classe
      )}
    >
      {s.texto}
    </span>
  );
}

/* ------------------------- Visão de dia ------------------------- */
function DayView({
  cursor,
  consultas,
  multiClinica,
  confirmacoes,
  onConsulta,
  onNova,
}: {
  cursor: Date;
  consultas: Consulta[];
  multiClinica: boolean;
  confirmacoes: Record<string, ConfirmacaoDaConsulta>;
  onConsulta: (c: Consulta) => void;
  onNova: () => void;
}) {
  // Pequeno resumo por status
  const confirmadas = consultas.filter(
    (c) => c.status === "confirmada" || c.status === "realizada"
  ).length;

  return (
    <div className="rounded-lg border border-border bg-white shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-4">
        <p className="font-heading font-semibold text-azul-medico">
          {capitalizar(format(cursor, "EEEE, dd 'de' MMMM", { locale: ptBR }))}
        </p>
        <div className="flex items-center gap-3 text-sm text-cinza-suave">
          <span>
            <strong className="text-azul-medico">{consultas.length}</strong>{" "}
            consulta{consultas.length === 1 ? "" : "s"}
          </span>
          {consultas.length > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-sucesso" />
              {confirmadas} confirmada{confirmadas === 1 ? "" : "s"}
            </span>
          )}
        </div>
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
        <ul className="space-y-2.5 p-3 sm:p-4">
          {consultas.map((c) => {
            const inicio = new Date(c.data_hora);
            const fim = c.duracao_min
              ? new Date(inicio.getTime() + c.duracao_min * 60000)
              : null;
            const cancelada = c.status === "cancelada";
            const conf = confirmacoes[c.id];
            return (
              <li key={c.id}>
                {/* Linha em div, e não em button: o atalho do WhatsApp é um
                    link, e link dentro de botão é HTML inválido. */}
                <div
                  className={cn(
                    "group flex w-full overflow-hidden rounded-xl border bg-white text-left transition-all hover:shadow-soft",
                    conf?.status === "reagendar"
                      ? "border-alerta/50"
                      : "border-border hover:border-teal-claro",
                    cancelada && "opacity-70"
                  )}
                >
                  {/* Barra de status */}
                  <span className={cn("w-1.5 shrink-0", corStatus[c.status])} />

                  <button
                    onClick={() => onConsulta(c)}
                    className="flex min-w-0 flex-1 text-left"
                  >

                  {/* Faixa de horário */}
                  <div className="flex w-[4.5rem] shrink-0 flex-col items-center justify-center border-r border-border bg-branco-clinico py-3">
                    <span className="font-heading text-base font-bold text-azul-medico">
                      {format(inicio, "HH:mm")}
                    </span>
                    {fim && (
                      <span className="text-[11px] text-cinza-suave">
                        {format(fim, "HH:mm")}
                      </span>
                    )}
                  </div>

                  {/* Conteúdo */}
                  <div className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          "truncate font-semibold text-cinza-texto",
                          cancelada && "line-through"
                        )}
                      >
                        {c.paciente_nome}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-cinza-suave">
                        {multiClinica && c.organizacao_nome && (
                          <span className="flex items-center gap-1 font-medium text-azul-medico">
                            <Building2 className="size-3.5 text-teal" />
                            {c.organizacao_nome}
                          </span>
                        )}
                        {c.medico_nome && (
                          <span className="flex items-center gap-1">
                            <UserRound className="size-3.5 text-teal" />
                            {c.medico_nome}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Stethoscope className="size-3.5 text-teal" />
                          {rotuloTipo[c.tipo]}
                        </span>
                        {c.convenio && (
                          <span className="flex items-center gap-1">
                            <ShieldCheck className="size-3.5 text-teal" />
                            {c.convenio}
                          </span>
                        )}
                        {c.paciente_telefone && (
                          <span className="hidden items-center gap-1 sm:flex">
                            <Phone className="size-3.5 text-teal" />
                            {c.paciente_telefone}
                          </span>
                        )}
                      </div>
                      {c.motivo && (
                        <p className="mt-1 truncate text-xs text-cinza-suave/80">
                          {c.motivo}
                        </p>
                      )}
                    </div>

                      <Badge variant={c.status}>{rotuloStatus[c.status]}</Badge>
                    </div>
                  </button>

                  {/* Confirmação à vista, sem precisar abrir a ficha */}
                  <div className="flex shrink-0 items-center gap-1.5 border-l border-border px-3">
                    <SeloConfirmacao confirmacao={conf} />
                    {conf && c.paciente_telefone && (
                      <a
                        href={linkWhatsApp(c.paciente_telefone, conf.mensagem)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className={cn(
                          "grid size-9 place-items-center rounded-md transition-colors",
                          conf.status === "pendente"
                            ? "bg-sucesso/12 text-sucesso hover:bg-sucesso/20"
                            : "text-cinza-suave hover:bg-verde-menta hover:text-teal"
                        )}
                        title={
                          conf.status === "pendente"
                            ? "Enviar confirmação pelo WhatsApp"
                            : "Reenviar pelo WhatsApp"
                        }
                        aria-label={`Enviar confirmação para ${c.paciente_nome} no WhatsApp`}
                      >
                        <MessageCircle className="size-4" />
                      </a>
                    )}
                    <ChevronRight className="size-4 shrink-0 text-cinza-suave/40 transition-colors group-hover:text-teal" />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
