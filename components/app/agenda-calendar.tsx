"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  Video,
  CalendarPlus,
} from "lucide-react";
import { linkWhatsApp } from "@/lib/lembretes";
import type { ConsultaComContexto, OpcoesAgenda } from "@/lib/supabase/queries";
import type { Bloqueio, Disponibilidade } from "@/lib/supabase/types";
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
import { FaixaDias, SeletorData } from "@/components/app/agenda-navegacao";
import { BotaoFlutuante, useAcaoFlutuante } from "@/components/app/botao-flutuante";

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
  disponibilidade = [],
  bloqueios = [],
  lembrete = null,
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
  disponibilidade?: Disponibilidade[];
  bloqueios?: Bloqueio[];
  lembrete?: { ativo: boolean; diasUteis: number; hora: number } | null;
  demo?: boolean;
}) {
  // Abre sempre no dia de hoje: é a pergunta de quem entra na agenda
  const [visao, setVisao] = useState<Visao>("dia");
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

  const contarDia = (d: Date) =>
    consultasDoDia(d).filter((c) => c.status !== "cancelada").length;

  // Atalhos: setas passam o período, T volta para hoje. Ignorados
  // enquanto se digita ou com uma janela aberta.
  useEffect(() => {
    function tecla(e: KeyboardEvent) {
      const alvo = e.target as HTMLElement | null;
      if (alvo && (alvo.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(alvo.tagName))) return;
      if (document.querySelector('[role="dialog"]')) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "ArrowLeft") navegar(-1);
      else if (e.key === "ArrowRight") navegar(1);
      else if (e.key === "t" || e.key === "T") setCursor(new Date());
    }
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  });

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

  // "Hoje" só tem efeito quando o período na tela não inclui hoje
  const hojeAgora = new Date();
  const noPeriodoDeHoje =
    visao === "mes"
      ? isSameMonth(cursor, hojeAgora)
      : visao === "semana"
        ? isSameDay(startOfWeek(cursor, { weekStartsOn: 0 }), startOfWeek(hojeAgora, { weekStartsOn: 0 }))
        : isSameDay(cursor, hojeAgora);

  useAcaoFlutuante("fab:nova-consulta", () => abrirNova());

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
      <div className="mt-5 rounded-xl border border-border bg-white p-2 shadow-soft sm:p-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
          <div className="flex shrink-0 overflow-hidden rounded-lg border border-border">
            <button
              onClick={() => navegar(-1)}
              className="grid size-9 place-items-center bg-white text-cinza-suave transition-colors hover:bg-verde-menta hover:text-azul-medico"
              aria-label={visao === "mes" ? "Mês anterior" : visao === "semana" ? "Semana anterior" : "Dia anterior"}
              title={`${visao === "mes" ? "Mês anterior" : visao === "semana" ? "Semana anterior" : "Dia anterior"} (←)`}
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              onClick={() => navegar(1)}
              className="grid size-9 place-items-center border-l border-border bg-white text-cinza-suave transition-colors hover:bg-verde-menta hover:text-azul-medico"
              aria-label={visao === "mes" ? "Próximo mês" : visao === "semana" ? "Próxima semana" : "Próximo dia"}
              title={`${visao === "mes" ? "Próximo mês" : visao === "semana" ? "Próxima semana" : "Próximo dia"} (→)`}
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
          <button
            onClick={() => setCursor(new Date())}
            disabled={noPeriodoDeHoje}
            title="Voltar para hoje (T)"
            className={cn(
              "h-9 shrink-0 rounded-lg border px-3 text-sm font-medium transition-colors",
              noPeriodoDeHoje
                ? "border-border bg-branco-clinico text-cinza-suave"
                : "border-teal bg-verde-menta text-azul-medico hover:bg-teal hover:text-white"
            )}
          >
            Hoje
          </button>
          <SeletorData
            titulo={titulo}
            cursor={cursor}
            onEscolher={setCursor}
            contarDia={contarDia}
          />
        </div>

        {/* Alternador de visão */}
        <div className="flex rounded-lg bg-branco-clinico p-1">
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

        {/* No dia, a semana inteira à mão para pular de um dia para outro */}
        {visao === "dia" && (
          <div className="mt-2.5 border-t border-border pt-2.5">
            <FaixaDias cursor={cursor} onEscolher={setCursor} contarDia={contarDia} />
          </div>
        )}
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
            ["faltou", "Faltou"],
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
      <BotaoFlutuante acoes={[{ rotulo: "Nova consulta", icone: CalendarPlus, evento: "fab:nova-consulta" }]} />
      <NovaConsultaDialog
        aberto={novaAberta}
        data={dataNova}
        onOpenChange={setNovaAberta}
        profissionais={profissionais}
        clinicas={clinicas}
        usuarioId={usuarioId}
        organizationId={organizationId}
        conveniosUsados={opcoes.convenios}
        consultas={consultasIniciais}
        disponibilidade={disponibilidade}
        bloqueios={bloqueios}
        envioAutomatico={envioAutomatico}
        lembrete={lembrete}
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

/** Tom de cada status nos blocos da grade: fundo claro e borda forte. */
const tomStatus: Record<Consulta["status"], { borda: string; fundo: string; texto: string }> = {
  pendente: { borda: "border-l-alerta", fundo: "bg-[#FFF7E8] hover:bg-[#FFF0D4]", texto: "text-[#9A5B00]" },
  confirmada: { borda: "border-l-sucesso", fundo: "bg-[#ECFBF1] hover:bg-[#DDF6E6]", texto: "text-[#15803D]" },
  realizada: { borda: "border-l-teal", fundo: "bg-[#E8F6F4] hover:bg-[#D8EFEC]", texto: "text-teal" },
  cancelada: { borda: "border-l-cinza-suave/50", fundo: "bg-[#F3F5F6] hover:bg-[#EAEEF0]", texto: "text-cinza-suave" },
  faltou: { borda: "border-l-[#8B5CF6]", fundo: "bg-[#F4F0FF] hover:bg-[#EAE3FF]", texto: "text-[#6D28D9]" },
};

/** Minuto atual, atualizado a cada 30 s, para a linha do "agora". */
function useAgora(): Date {
  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  return agora;
}

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
    <div className="overflow-hidden rounded-xl border border-border bg-white shadow-soft">
      <div className="grid grid-cols-7 border-b border-border bg-branco-clinico">
        {DIAS_CURTOS.map((d) => (
          <div
            key={d}
            className="py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider text-cinza-suave"
          >
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {dias.map((d) => {
          const doMes = isSameMonth(d, cursor);
          const consultas = consultasDoDia(d);
          const ativas = consultas.filter((c) => c.status !== "cancelada");
          const fimDeSemana = d.getDay() === 0 || d.getDay() === 6;
          const hoje = isToday(d);
          // Quantos precisam de atenção: pediram remarcação
          const remarcar = consultas.filter(
            (c) => confirmacoes[c.id]?.status === "reagendar"
          ).length;

          return (
            <button
              key={d.toISOString()}
              onClick={() => onDia(d)}
              className={cn(
                "group relative min-h-[76px] border-b border-r border-border p-1.5 text-left transition-colors hover:bg-verde-menta/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal sm:min-h-[118px] sm:p-2",
                !doMes && "bg-branco-clinico/70",
                doMes && fimDeSemana && "bg-branco-clinico/40",
                hoje && "bg-verde-menta/30"
              )}
            >
              <span className="flex items-center justify-between gap-1">
                <span
                  className={cn(
                    "inline-grid size-7 place-items-center rounded-full text-xs font-semibold",
                    hoje
                      ? "bg-teal text-white shadow-sm"
                      : doMes
                        ? "text-azul-medico"
                        : "text-cinza-suave/50"
                  )}
                >
                  {format(d, "d")}
                </span>

                {ativas.length > 0 && (
                  <span className="flex items-center gap-1">
                    {remarcar > 0 && (
                      <span
                        className="size-2 rounded-full bg-coral"
                        title={`${remarcar} pediu para remarcar`}
                      />
                    )}
                    <span className="hidden rounded-full bg-azul-medico/8 px-1.5 py-0.5 text-[10px] font-bold text-azul-medico sm:inline">
                      {ativas.length}
                    </span>
                  </span>
                )}
              </span>

              {/* Celular: só pontinhos, um por consulta */}
              {consultas.length > 0 && (
                <span className="mt-1.5 flex flex-wrap gap-0.5 sm:hidden">
                  {consultas.slice(0, 6).map((c) => (
                    <span key={c.id} className={cn("size-1.5 rounded-full", corStatus[c.status])} />
                  ))}
                </span>
              )}

              <div className="mt-1 hidden space-y-1 sm:block">
                {consultas.slice(0, 3).map((c) => (
                  <div
                    key={c.id}
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      onConsulta(c);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.stopPropagation();
                        onConsulta(c);
                      }
                    }}
                    className={cn(
                      "flex items-center gap-1 truncate rounded-md border-l-[3px] px-1.5 py-0.5 text-[11px] transition-colors",
                      tomStatus[c.status].borda,
                      tomStatus[c.status].fundo,
                      c.status === "cancelada" && "line-through"
                    )}
                  >
                    <span className={cn("shrink-0 font-semibold tabular-nums", tomStatus[c.status].texto)}>
                      {format(new Date(c.data_hora), "HH:mm")}
                    </span>
                    <span className="truncate text-cinza-texto">{c.paciente_nome}</span>
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
                {consultas.length > 3 && (
                  <span className="block pl-1 text-[11px] font-semibold text-teal">
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

/**
 * Distribui as consultas que se sobrepõem lado a lado, como num
 * calendário de verdade: cada grupo de sobreposição divide a largura
 * pelo número de colunas que precisa.
 */
function emColunas(consultas: Consulta[]): Map<string, { coluna: number; total: number }> {
  const res = new Map<string, { coluna: number; total: number }>();
  const ordenadas = [...consultas].sort((a, b) => a.data_hora.localeCompare(b.data_hora));
  let grupo: { id: string; fim: number; coluna: number }[] = [];
  let fimGrupo = -Infinity;

  const fechar = () => {
    const total = Math.max(1, ...grupo.map((g) => g.coluna + 1));
    for (const g of grupo) res.set(g.id, { coluna: g.coluna, total });
    grupo = [];
  };

  for (const c of ordenadas) {
    const ini = new Date(c.data_hora).getTime();
    const fim = ini + (c.duracao_min ?? 30) * 60000;
    if (ini >= fimGrupo) {
      fechar();
      fimGrupo = -Infinity;
    }
    const ocupadas = new Set(grupo.filter((g) => g.fim > ini).map((g) => g.coluna));
    let coluna = 0;
    while (ocupadas.has(coluna)) coluna++;
    grupo.push({ id: c.id, fim, coluna });
    fimGrupo = Math.max(fimGrupo, fim);
  }
  fechar();
  return res;
}

/**
 * Grade de horários da semana.
 *
 * Numa agenda o que importa é ver o vazio tanto quanto o cheio: onde dá
 * para encaixar, onde a manhã está sobrecarregada. A faixa de horas se
 * ajusta ao que existe na semana, com um mínimo de 7h às 20h, e a grade
 * já abre rolada para perto da hora atual.
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
  const agora = useAgora();
  const rolagem = useRef<HTMLDivElement>(null);
  const inicio = startOfWeek(cursor, { weekStartsOn: 0 });
  const dias = eachDayOfInterval({
    start: inicio,
    end: endOfWeek(cursor, { weekStartsOn: 0 }),
  });

  const todas = dias.flatMap((d) => consultasDoDia(d));
  const horas = todas.map((c) => new Date(c.data_hora).getHours());
  const primeira = Math.min(7, ...(horas.length ? horas : [7]));
  const ultima = Math.max(20, ...(horas.length ? horas.map((h) => h + 1) : [20]));
  const faixa = Array.from({ length: ultima - primeira }, (_, i) => primeira + i);

  const ALTURA = 88; // px por hora: 30 min = 44 px, cabe nome e horário
  const semanaAtual = dias.some((d) => isToday(d));
  const primeiraConsulta = horas.length ? Math.min(...horas) : 8;
  const chaveSemana = inicio.getTime();

  // Abre perto do que interessa: a hora atual nesta semana, ou a
  // primeira consulta nas outras
  useEffect(() => {
    const alvo = semanaAtual ? new Date().getHours() - 1 : primeiraConsulta - 1;
    if (rolagem.current) rolagem.current.scrollTop = Math.max(0, (alvo - primeira) * ALTURA);
  }, [semanaAtual, primeiraConsulta, primeira, chaveSemana]);

  const minutoAgora = (agora.getHours() - primeira) * 60 + agora.getMinutes();
  const agoraVisivel = minutoAgora >= 0 && agora.getHours() < ultima;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-white shadow-soft">
      <div className="overflow-x-auto">
        <div className="min-w-[760px]">
          {/* Cabeçalho dos dias */}
          <div className="grid grid-cols-[3.75rem_repeat(7,minmax(0,1fr))] border-b border-border bg-branco-clinico">
            <div />
            {dias.map((d) => {
              const hoje = isToday(d);
              const n = consultasDoDia(d).filter((c) => c.status !== "cancelada").length;
              return (
                <button
                  key={d.toISOString()}
                  onClick={() => onNova(d)}
                  className={cn(
                    "group border-l border-border px-1 py-2.5 text-center transition-colors hover:bg-verde-menta/60",
                    hoje && "bg-verde-menta/50"
                  )}
                  title="Marcar consulta neste dia"
                >
                  <p
                    className={cn(
                      "text-[11px] font-semibold uppercase tracking-wider",
                      hoje ? "text-teal" : "text-cinza-suave"
                    )}
                  >
                    {format(d, "EEE", { locale: ptBR }).replace(".", "")}
                  </p>
                  <p
                    className={cn(
                      "mx-auto mt-1 grid size-9 place-items-center rounded-full font-heading text-lg font-bold",
                      hoje ? "bg-teal text-white shadow-sm" : "text-azul-medico"
                    )}
                  >
                    {format(d, "d")}
                  </p>
                  <p className="mt-1 h-4 text-[10px] font-medium text-cinza-suave">
                    {n > 0 ? `${n} consulta${n === 1 ? "" : "s"}` : ""}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Grade */}
          <div ref={rolagem} className="relative max-h-[620px] overflow-y-auto">
            <div className="grid grid-cols-[3.75rem_repeat(7,minmax(0,1fr))] pt-3">
              {/* Coluna das horas */}
              <div>
                {faixa.map((h) => (
                  <div key={h} style={{ height: ALTURA }} className="relative">
                    <span className="absolute -top-2 right-2.5 text-[11px] font-medium tabular-nums text-cinza-suave">
                      {String(h).padStart(2, "0")}:00
                    </span>
                  </div>
                ))}
              </div>

              {/* Uma coluna por dia */}
              {dias.map((d) => {
                const doDia = consultasDoDia(d);
                const colunas = emColunas(doDia.filter((c) => c.status !== "cancelada"));
                const fimDeSemana = d.getDay() === 0 || d.getDay() === 6;
                const hoje = isToday(d);

                return (
                  <div
                    key={d.toISOString()}
                    className={cn(
                      "relative border-l border-border",
                      fimDeSemana && "bg-branco-clinico/50",
                      hoje && "bg-verde-menta/20"
                    )}
                  >
                    {/* Linhas de hora e meia hora, que também servem de alvo para marcar */}
                    {faixa.map((h) => (
                      <div key={h} style={{ height: ALTURA }} className="border-t border-border/70">
                        {[0, 30].map((m) => (
                          <button
                            key={m}
                            onClick={() => {
                              const alvo = new Date(d);
                              alvo.setHours(h, m, 0, 0);
                              onNova(alvo);
                            }}
                            style={{ height: ALTURA / 2 }}
                            className={cn(
                              "group/slot flex w-full items-center justify-center text-[10px] font-medium text-teal opacity-0 transition hover:bg-verde-menta/60 hover:opacity-100",
                              m === 30 && "border-t border-dashed border-border/50"
                            )}
                            aria-label={`Marcar consulta ${format(d, "dd/MM")} às ${h}:${m === 0 ? "00" : "30"}`}
                          >
                            <Plus className="mr-0.5 size-3" /> {String(h).padStart(2, "0")}:{m === 0 ? "00" : "30"}
                          </button>
                        ))}
                      </div>
                    ))}

                    {/* Linha do agora */}
                    {hoje && agoraVisivel && (
                      <div
                        className="pointer-events-none absolute inset-x-0 z-20 flex items-center"
                        style={{ top: (minutoAgora / 60) * ALTURA }}
                      >
                        <span className="-ml-1.5 size-3 rounded-full bg-coral shadow" />
                        <span className="h-0.5 flex-1 bg-coral" />
                      </div>
                    )}

                    {/* Consultas posicionadas pelo horário */}
                    {doDia.map((c) => {
                      const d0 = new Date(c.data_hora);
                      const minutos = (d0.getHours() - primeira) * 60 + d0.getMinutes();
                      const duracao = c.duracao_min ?? 30;
                      const altura = Math.max((duracao / 60) * ALTURA - 3, 26);
                      const conf = confirmacoes[c.id];
                      const cancelada = c.status === "cancelada";
                      const pos = colunas.get(c.id) ?? { coluna: 0, total: 1 };
                      const largura = 100 / pos.total;
                      const fimC = new Date(d0.getTime() + duracao * 60000);
                      const tom = tomStatus[c.status];

                      // Curta demais para duas linhas: horário e nome lado a lado
                      const compacto = altura < 38;

                      return (
                        <button
                          key={c.id}
                          onClick={() => onConsulta(c)}
                          style={{
                            top: (minutos / 60) * ALTURA + 1,
                            height: altura,
                            left: `calc(${pos.coluna * largura}% + 4px)`,
                            width: `calc(${largura}% - 8px)`,
                          }}
                          className={cn(
                            "absolute z-10 flex overflow-hidden rounded-lg text-left shadow-[0_1px_2px_rgba(15,58,82,0.08)] ring-1 ring-inset ring-black/[0.04] transition-all hover:z-30 hover:-translate-y-px hover:shadow-card",
                            tom.fundo,
                            cancelada && "z-0 opacity-60",
                            conf?.status === "reagendar" && "ring-2 ring-coral/70"
                          )}
                          title={`${format(d0, "HH:mm")}–${format(fimC, "HH:mm")} · ${c.paciente_nome}${c.medico_nome ? ` · ${c.medico_nome}` : ""}`}
                        >
                          {/* Faixa do status, reta, por dentro do cartão */}
                          <span className={cn("w-1 shrink-0", corStatus[c.status])} />

                          <span
                            className={cn(
                              "flex min-w-0 flex-1 px-2",
                              compacto ? "items-center gap-1.5" : cn("flex-col justify-center", altura < 56 ? "py-1" : "justify-start py-1.5")
                            )}
                          >
                            {compacto ? (
                              <>
                                <span className={cn("shrink-0 text-[11px] font-semibold tabular-nums", tom.texto)}>
                                  {format(d0, "HH:mm")}
                                </span>
                                <span
                                  className={cn(
                                    "min-w-0 truncate text-xs font-semibold text-azul-medico",
                                    cancelada && "line-through"
                                  )}
                                >
                                  {c.paciente_nome}
                                </span>
                              </>
                            ) : (
                              <>
                                <span className="flex min-w-0 items-center gap-1">
                                  <span
                                    className={cn(
                                      "min-w-0 truncate text-xs font-semibold leading-tight text-azul-medico",
                                      cancelada && "line-through"
                                    )}
                                  >
                                    {c.paciente_nome}
                                  </span>
                                  {c.tipo === "teleconsulta" && <Video className="size-3 shrink-0 text-cinza-suave" />}
                                </span>
                                <span className={cn("mt-0.5 truncate text-[11px] font-medium tabular-nums", tom.texto)}>
                                  {format(d0, "HH:mm")} – {format(fimC, "HH:mm")}
                                </span>
                                {altura >= 70 && (
                                  <span className="mt-0.5 truncate text-[10px] text-cinza-suave">
                                    {[rotuloTipo[c.tipo], c.medico_nome].filter(Boolean).join(" · ")}
                                  </span>
                                )}
                              </>
                            )}
                          </span>

                          {conf && (
                            <span
                              className={cn(
                                "mr-1.5 mt-1.5 size-2 shrink-0 rounded-full ring-2 ring-white",
                                corConfirmacao[conf.status]
                              )}
                              title={`Confirmação: ${conf.status}`}
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <p className="border-t border-border px-4 py-2 text-[11px] text-cinza-suave">
        Clique num horário vazio para marcar. Contorno vermelho = paciente pediu para reagendar.
        O ponto no canto mostra a confirmação do paciente.
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
    <div className="rounded-xl border border-border bg-white shadow-soft">
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
          {consultas.map((c, i) => {
            const inicio = new Date(c.data_hora);
            // Divisória do agora antes da primeira consulta que ainda vem
            const agoraAqui =
              isToday(cursor) &&
              inicio.getTime() > Date.now() &&
              (i === 0 || new Date(consultas[i - 1].data_hora).getTime() <= Date.now());
            const fim = c.duracao_min
              ? new Date(inicio.getTime() + c.duracao_min * 60000)
              : null;
            const cancelada = c.status === "cancelada";
            const conf = confirmacoes[c.id];
            return (
              <li key={c.id}>
                {agoraAqui && (
                  <div className="mb-2.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-coral">
                    <span className="size-2.5 rounded-full bg-coral" />
                    Agora · {format(new Date(), "HH:mm")}
                    <span className="h-px flex-1 bg-coral/60" />
                  </div>
                )}
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
