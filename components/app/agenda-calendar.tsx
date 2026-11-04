"use client";

import type { Fechamento, PrecoProcedimento, ProfissionalServico } from "@/lib/supabase/types";
import { fechamentoNoIntervalo, type RegraFechamento } from "@/lib/agenda-horarios";
import { catalogoServicos } from "@/lib/servicos";

import type { PacienteBasico } from "@/lib/supabase/pacientes";
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
import {
  coresDosProfissionais,
  limiteValido,
  lotado,
  ocupacaoDoIntervalo,
  type CorProfissional,
} from "@/lib/agenda-capacidade";
import { BotaoFlutuante, useAcaoFlutuante } from "@/components/app/botao-flutuante";
import { AgendaLinks, type LinkDaAgenda } from "@/components/app/agenda-links";

type Visao = "mes" | "semana" | "dia";
type Consulta = ConsultaComContexto;

export function AgendaCalendar({
  consultasIniciais,
  pacientes = [],
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
  servicos = [],
  limite: limiteBruto = null,
  podeApagar = false,
  fechamentos = [],
  vinculos = [],
  linksAgenda = [],
}: {
  /** Link de agendamento de cada profissional, para mandar daqui mesmo. */
  linksAgenda?: LinkDaAgenda[];
  /** Horários fechados por profissional e serviço. */
  fechamentos?: Fechamento[];
  /** Que serviço cada profissional atende. */
  vinculos?: ProfissionalServico[];
  /** Gestor: apaga consultas marcadas por engano. */
  podeApagar?: boolean;
  consultasIniciais: ConsultaComContexto[];
  /** Banco de pacientes: entra na busca da Nova consulta. */
  pacientes?: PacienteBasico[];
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
  /** Tabela de preços: os serviços para escolher na consulta. */
  servicos?: PrecoProcedimento[];
  /** Consultas ao mesmo tempo que a clínica aceita (nulo = sem limite). */
  limite?: number | null;
}) {
  // Abre sempre no dia de hoje: é a pergunta de quem entra na agenda
  const [visao, setVisao] = useState<Visao>("dia");
  const [cursor, setCursor] = useState(new Date());
  const [selecionada, setSelecionada] = useState<Consulta | null>(null);
  const [novaAberta, setNovaAberta] = useState(false);
  const [dataNova, setDataNova] = useState<Date | null>(null);
  const [medicoNova, setMedicoNova] = useState<string | null>(null);
  const limite = limiteValido(limiteBruto);
  // A mesma pessoa tem a mesma cor em todas as visões
  const cores = useMemo(() => coresDosProfissionais(profissionais), [profissionais]);
  // Nome do serviço de um fechamento, para a célula dizer o que está fechado
  const nomeServico = useMemo(() => {
    const mapa = new Map<string, string>();
    for (const s of catalogoServicos(servicos)) for (const l of s.linhas) mapa.set(l.id, s.nome);
    return mapa;
  }, [servicos]);
  const [filtros, setFiltros] = useState<FiltrosAgenda>(FILTROS_VAZIOS);

  const consultas = useMemo(
    () => aplicarFiltros(consultasIniciais, filtros),
    [consultasIniciais, filtros]
  );

  // Quem enxerga mais de uma clínica precisa ver de qual é cada consulta
  const multiClinica = opcoes.clinicas.length > 1;
  // Serviços da tabela e os que já aparecem nas consultas carregadas
  const nomesServicos = useMemo(
    () =>
      [...new Set([...servicos.map((p) => p.procedimento.trim()), ...consultasIniciais.map((c) => c.servico_nome?.trim() ?? "")].filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, "pt-BR")
      ),
    [servicos, consultasIniciais]
  );

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

  // No celular o título encolhe: "Qua, 04 nov" cabe ao lado das setas
  const tituloCurto = capitalizar(
    visao === "mes"
      ? format(cursor, "MMM yyyy", { locale: ptBR })
      : visao === "semana"
        ? `${format(startOfWeek(cursor, { weekStartsOn: 0 }), "dd/MM")} – ${format(endOfWeek(cursor, { weekStartsOn: 0 }), "dd/MM")}`
        : format(cursor, "EEE, dd MMM", { locale: ptBR }).replace(".", "")
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

  function abrirNova(d?: Date, medicoId?: string) {
    setDataNova(d ?? cursor);
    setMedicoNova(medicoId ?? null);
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
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl">Agenda</h1>
          <p className="mt-1 hidden text-cinza-suave sm:block">
            Suas consultas marcadas pela nossa equipe, em tempo real.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-2">
          <AgendaLinks links={linksAgenda} />
          {/* No celular, o "+" da barra inferior marca a consulta */}
          <Button variant="primary" onClick={() => abrirNova()} className="hidden lg:inline-flex">
            <Plus className="size-4" /> Nova consulta
          </Button>
        </div>
      </header>

      {/* Filtros */}
      <div className="mt-4 sm:mt-6">
        <AgendaFiltros
          filtros={filtros}
          onChange={setFiltros}
          opcoes={opcoes}
          total={consultasIniciais.length}
          visiveis={consultas.length}
          servicos={nomesServicos}
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
            tituloCurto={tituloCurto}
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

      {/* Corpo: o calendário logo abaixo da navegação, sem nada no caminho */}
      <div className="mt-3 sm:mt-4">
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
            cores={cores}
            profissionais={profissionais}
            limite={limite}
            onConsulta={setSelecionada}
            onNova={abrirNova}
            onDia={(d) => {
              setCursor(d);
              setVisao("dia");
            }}
          />
        )}
        {visao === "dia" && (
          <DayView
            cursor={cursor}
            consultas={consultasDoDia(cursor)}
            multiClinica={multiClinica}
            confirmacoes={confirmacoes}
            profissionais={profissionais}
            cores={cores}
            limite={limite}
            fechamentos={fechamentos}
            nomeServico={nomeServico}
            onConsulta={setSelecionada}
            onNova={(quando, medicoId) => abrirNova(quando ?? cursor, medicoId)}
          />
        )}
      </div>

      {/* Resumo do período visível */}
      {doPeriodo.total > 0 && (
        <dl className="mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-border bg-border lg:grid-cols-5">
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
            <div key={c.r} className="bg-white px-3 py-2.5 sm:px-4">
              <dd className={cn("font-heading text-lg font-bold", c.cor)}>{c.v}</dd>
              <dt className="text-[11px] text-cinza-suave">{c.r}</dt>
            </div>
          ))}
        </dl>
      )}

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
        servicos={servicos}
        profissionais={profissionais}
        consultas={consultasIniciais}
        podeApagar={podeApagar}
        onOpenChange={(o) => !o && setSelecionada(null)}
      />
      {/* No celular o "+" da barra inferior já faz isso */}
      <div className="hidden lg:block">
        <BotaoFlutuante acoes={[{ rotulo: "Nova consulta", icone: CalendarPlus, evento: "fab:nova-consulta" }]} />
      </div>
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
        pacientesBanco={pacientes}
        servicos={servicos}
        disponibilidade={disponibilidade}
        bloqueios={bloqueios}
        envioAutomatico={envioAutomatico}
        lembrete={lembrete}
        limite={limite}
        medicoInicial={medicoNova}
        fechamentos={fechamentos}
        vinculos={vinculos}
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

/** A partir de quantas consultas lado a lado a semana agrupa o horário. */
const DENSO = 3;

/** Consultas agrupadas pelo minuto em que começam, em ordem. */
function agruparPorInicio(consultas: Consulta[]): { inicio: Date; duracao: number; itens: Consulta[] }[] {
  const mapa = new Map<string, { inicio: Date; duracao: number; itens: Consulta[] }>();
  for (const c of consultas) {
    const g = mapa.get(c.data_hora) ?? { inicio: new Date(c.data_hora), duracao: 0, itens: [] };
    g.itens.push(c);
    g.duracao = Math.max(g.duracao, c.duracao_min ?? 30);
    mapa.set(c.data_hora, g);
  }
  return [...mapa.values()].sort((a, b) => a.inicio.getTime() - b.inicio.getTime());
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
  cores,
  profissionais,
  limite,
  onConsulta,
  onNova,
  onDia,
}: {
  cursor: Date;
  consultasDoDia: (d: Date) => Consulta[];
  confirmacoes: Record<string, ConfirmacaoDaConsulta>;
  cores: Map<string, CorProfissional>;
  profissionais: { id: string; nome: string }[];
  limite: number | null;
  onConsulta: (c: Consulta) => void;
  onNova: (d: Date) => void;
  /** Abre o dia: é onde um horário com muita gente cabe por inteiro. */
  onDia: (d: Date) => void;
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
                const ativasDia = doDia.filter((c) => c.status !== "cancelada");
                const colunas = emColunas(ativasDia);
                // Três ou mais ao mesmo tempo não cabem lado a lado num sétimo
                // da tela: o grupo vira um bloco por horário, que abre o dia
                const densas = ativasDia.filter((c) => (colunas.get(c.id)?.total ?? 1) >= DENSO);
                const agregados = agruparPorInicio(densas);
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
                        {[0, 30].map((m) => {
                          const alvo = new Date(d);
                          alvo.setHours(h, m, 0, 0);
                          const cheio = lotado(ocupacaoDoIntervalo(ativasDia, alvo, 30), limite);
                          return cheio ? (
                            <div
                              key={m}
                              style={{ height: ALTURA / 2 }}
                              className={cn(
                                "bg-[repeating-linear-gradient(135deg,transparent,transparent_6px,rgba(232,93,74,0.08)_6px,rgba(232,93,74,0.08)_12px)]",
                                m === 30 && "border-t border-dashed border-border/50"
                              )}
                              title={`${String(h).padStart(2, "0")}:${m === 0 ? "00" : "30"} lotado`}
                            />
                          ) : (
                            <button
                              key={m}
                              onClick={() => onNova(alvo)}
                              style={{ height: ALTURA / 2 }}
                              className={cn(
                                "group/slot flex w-full items-center justify-center text-[10px] font-medium text-teal opacity-0 transition hover:bg-verde-menta/60 hover:opacity-100",
                                m === 30 && "border-t border-dashed border-border/50"
                              )}
                              aria-label={`Marcar consulta ${format(d, "dd/MM")} às ${h}:${m === 0 ? "00" : "30"}`}
                            >
                              <Plus className="mr-0.5 size-3" /> {String(h).padStart(2, "0")}:{m === 0 ? "00" : "30"}
                            </button>
                          );
                        })}
                      </div>
                    ))}

                    {/* Horários com muita gente: um bloco por horário */}
                    {agregados.map((g, gi) => {
                      const minutos = (g.inicio.getHours() - primeira) * 60 + g.inicio.getMinutes();
                      const proximo = agregados[gi + 1];
                      const ate = proximo ? (proximo.inicio.getTime() - g.inicio.getTime()) / 60000 : g.duracao;
                      const altura = Math.max((Math.min(g.duracao, ate) / 60) * ALTURA - 3, 30);
                      const oc = ocupacaoDoIntervalo(ativasDia, g.inicio, 30);
                      const cheio = lotado(oc, limite);
                      return (
                        <button
                          key={g.inicio.toISOString()}
                          onClick={() => onDia(d)}
                          style={{ top: (minutos / 60) * ALTURA + 1, height: altura }}
                          className={cn(
                            "absolute inset-x-1 z-10 flex flex-col overflow-hidden rounded-lg border bg-white px-2 py-1 text-left shadow-[0_1px_2px_rgba(15,58,82,0.08)] transition-all hover:z-30 hover:-translate-y-px hover:shadow-card",
                            cheio ? "border-coral/50" : "border-teal/40"
                          )}
                          title={g.itens.map((c) => `${format(new Date(c.data_hora), "HH:mm")} ${c.paciente_nome} · ${c.medico_nome ?? ""}`).join("\n")}
                        >
                          <span className="flex items-center gap-1">
                            <span className="text-[11px] font-semibold tabular-nums text-azul-medico">
                              {format(g.inicio, "HH:mm")}
                            </span>
                            <span
                              className={cn(
                                "rounded-full px-1.5 text-[10px] font-semibold",
                                cheio ? "bg-coral/15 text-coral" : "bg-verde-menta text-teal"
                              )}
                            >
                              {limite !== null ? `${oc.simultaneas}/${limite}` : `${g.itens.length}`}
                            </span>
                          </span>
                          <span className="mt-0.5 flex flex-wrap gap-0.5">
                            {g.itens.map((c) => (
                              <span
                                key={c.id}
                                className={cn("size-2 rounded-full", cores.get(c.medico_id)?.ponto ?? "bg-teal")}
                              />
                            ))}
                          </span>
                          {altura >= 52 && (
                            <span className="mt-0.5 truncate text-[10px] text-cinza-suave">
                              {g.itens.length} consultas · ver o dia
                            </span>
                          )}
                        </button>
                      );
                    })}

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
                    {doDia.filter((c) => !densas.includes(c)).map((c) => {
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
                                    {[c.servico_nome || rotuloTipo[c.tipo], c.medico_nome].filter(Boolean).join(" · ")}
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
        O ponto no canto mostra a confirmação do paciente. Três ou mais consultas no mesmo horário viram um
        bloco com uma bolinha por profissional: clique para abrir o dia.
      </p>
      {profissionais.length > 1 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 border-t border-border px-4 py-2 text-[11px] text-cinza-suave">
          {[...profissionais]
            .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
            .map((p) => (
              <span key={p.id} className="flex items-center gap-1.5">
                <span className={cn("size-2.5 rounded-full", cores.get(p.id)?.ponto ?? "bg-teal")} />
                {p.nome}
              </span>
            ))}
        </div>
      )}
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

type ProfissionalDia = { id: string; nome: string; organization_id: string | null };

/** Início do bloco de meia hora em que o horário cai, em minutos do dia. */
function blocoDe(d: Date): number {
  const m = d.getHours() * 60 + d.getMinutes();
  return m - (m % 30);
}

/**
 * O dia de uma clínica com vários profissionais.
 *
 * Duas leituras do mesmo dia: por profissional (colunas lado a lado, uma
 * por pessoa, com as horas nas linhas: às 10:30 aparecem os cinco
 * atendimentos juntos, cada um embaixo de quem atende) e em lista, por
 * horário. No celular as colunas não cabem, então vale a lista agrupada,
 * que mostra a mesma ocupação ("10:30 · 4 de 5").
 */
function DayView({
  cursor,
  consultas,
  multiClinica,
  confirmacoes,
  profissionais,
  cores,
  limite,
  fechamentos,
  nomeServico,
  onConsulta,
  onNova,
}: {
  cursor: Date;
  consultas: Consulta[];
  multiClinica: boolean;
  confirmacoes: Record<string, ConfirmacaoDaConsulta>;
  profissionais: ProfissionalDia[];
  cores: Map<string, CorProfissional>;
  limite: number | null;
  fechamentos: RegraFechamento[];
  nomeServico: Map<string, string>;
  onConsulta: (c: Consulta) => void;
  /** Sem argumentos: o dia. Com horário e profissional: já preenchidos. */
  onNova: (quando?: Date, medicoId?: string) => void;
}) {
  // Pequeno resumo por status
  const confirmadas = consultas.filter(
    (c) => c.status === "confirmada" || c.status === "realizada"
  ).length;

  // Colunas: quem atende nas clínicas do dia (ou em todas, num dia vazio),
  // mais quem tem consulta e não está mais na lista da equipe
  const colunas = useMemo(() => {
    const orgs = new Set(consultas.map((c) => c.organization_id).filter(Boolean));
    const lista: ProfissionalDia[] = profissionais.filter(
      (p) => (orgs.size === 0 && !multiClinica) || orgs.has(p.organization_id ?? "")
    );
    for (const c of consultas) {
      if (!lista.some((p) => p.id === c.medico_id)) {
        lista.push({ id: c.medico_id, nome: c.medico_nome ?? "Profissional", organization_id: c.organization_id });
      }
    }
    return lista.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [consultas, profissionais, multiClinica]);

  const variosProfissionais = colunas.length > 1;
  const [modo, setModo] = useState<"profissional" | "lista">("profissional");
  const porProfissional = variosProfissionais && modo === "profissional";

  return (
    <div className="rounded-xl border border-border bg-white shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3 sm:px-5 sm:py-4">
        <p className="hidden font-heading font-semibold text-azul-medico sm:block">
          {capitalizar(format(cursor, "EEEE, dd 'de' MMMM", { locale: ptBR }))}
        </p>
        <div className="flex flex-wrap items-center gap-3 text-sm text-cinza-suave">
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
          {limite !== null && (
            <span className="text-xs">até {limite} por horário</span>
          )}
          {variosProfissionais && (
            <div className="hidden rounded-lg bg-branco-clinico p-0.5 md:flex">
              {(
                [
                  ["profissional", "Por profissional"],
                  ["lista", "Lista"],
                ] as const
              ).map(([m, rotulo]) => (
                <button
                  key={m}
                  onClick={() => setModo(m)}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                    modo === m ? "bg-white text-azul-medico shadow-sm" : "text-cinza-suave hover:text-azul-medico"
                  )}
                >
                  {rotulo}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {porProfissional && (
        <div className="hidden md:block">
          <GradeProfissionais
            cursor={cursor}
            consultas={consultas}
            colunas={colunas}
            cores={cores}
            limite={limite}
            fechamentos={fechamentos}
            nomeServico={nomeServico}
            confirmacoes={confirmacoes}
            onConsulta={onConsulta}
            onNova={onNova}
          />
        </div>
      )}

      <div className={cn(porProfissional && "md:hidden")}>
        {consultas.length === 0 ? (
          <div className="px-5 py-16 text-center text-cinza-suave">
            <CalendarDays className="mx-auto mb-3 size-10 text-teal-claro" />
            <p>Nenhuma consulta neste dia.</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => onNova()}>
              <Plus className="size-4" /> Adicionar consulta
            </Button>
          </div>
        ) : (
          <ListaPorHorario
            cursor={cursor}
            consultas={consultas}
            multiClinica={multiClinica}
            confirmacoes={confirmacoes}
            cores={variosProfissionais ? cores : null}
            limite={limite}
            onConsulta={onConsulta}
          />
        )}
      </div>
    </div>
  );
}

/**
 * Grade do dia por profissional: colunas = quem atende, linhas = blocos
 * de 30 minutos. Cada consulta fica na linha em que começa; nas linhas
 * seguintes que ela ainda ocupa, a coluna mostra uma faixa de
 * continuação, para o vazio e o ocupado se lerem de longe.
 */
function GradeProfissionais({
  cursor,
  consultas,
  colunas,
  cores,
  limite,
  fechamentos,
  nomeServico,
  confirmacoes,
  onConsulta,
  onNova,
}: {
  cursor: Date;
  consultas: Consulta[];
  colunas: ProfissionalDia[];
  cores: Map<string, CorProfissional>;
  limite: number | null;
  fechamentos: RegraFechamento[];
  nomeServico: Map<string, string>;
  confirmacoes: Record<string, ConfirmacaoDaConsulta>;
  onConsulta: (c: Consulta) => void;
  onNova: (quando?: Date, medicoId?: string) => void;
}) {
  const agora = useAgora();
  const ativas = consultas.filter((c) => c.status !== "cancelada");

  // Faixa de horas: das 8h às 18h, esticando para o que existir no dia
  const inicios = consultas.map((c) => blocoDe(new Date(c.data_hora)));
  const fins = consultas.map((c) => {
    const d = new Date(c.data_hora);
    return d.getHours() * 60 + d.getMinutes() + (c.duracao_min ?? 30);
  });
  const primeiro = Math.min(8 * 60, ...inicios);
  const ultimo = Math.max(18 * 60, ...fins.map((f) => Math.ceil(f / 30) * 30));
  const blocos = Array.from({ length: (ultimo - primeiro) / 30 }, (_, i) => primeiro + i * 30);

  const hoje = isToday(cursor);
  const blocoAgora = hoje ? blocoDe(agora) : -1;
  const largura = `minmax(${colunas.length > 4 ? "9.5rem" : "11rem"}, 1fr)`;

  const diaTexto = format(cursor, "yyyy-MM-dd");
  const semana = cursor.getDay();
  // Fechamentos do profissional que pegam este bloco (de um serviço ou de todos)
  const fechadosNoBloco = (medicoId: string, m: number) =>
    fechamentos.filter(
      (f) =>
        f.medico_id === medicoId &&
        fechamentoNoIntervalo([f], { medicoId, servicoId: f.servico_id, dia: diaTexto, semana, ini: m, fim: m + 30 })
    );

  const emData = (m: number) => {
    const d = new Date(cursor);
    d.setHours(Math.floor(m / 60), m % 60, 0, 0);
    return d;
  };

  return (
    <div className="overflow-x-auto">
      <div style={{ minWidth: `${5.5 + colunas.length * 9.5}rem` }}>
        {/* Cabeçalho: um profissional por coluna, com a cor dele */}
        <div
          className="sticky top-0 z-20 grid border-b border-border bg-branco-clinico"
          style={{ gridTemplateColumns: `5.5rem repeat(${colunas.length}, ${largura})` }}
        >
          <div className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-cinza-suave">
            Horário
          </div>
          {colunas.map((p) => {
            const cor = cores.get(p.id);
            const n = ativas.filter((c) => c.medico_id === p.id).length;
            return (
              <div key={p.id} className="flex min-w-0 items-center gap-2 border-l border-border px-3 py-2.5">
                <span className={cn("size-2.5 shrink-0 rounded-full", cor?.ponto ?? "bg-teal")} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-azul-medico">{p.nome}</span>
                  <span className="block text-[11px] text-cinza-suave">
                    {n ? `${n} consulta${n === 1 ? "" : "s"}` : "agenda livre"}
                  </span>
                </span>
              </div>
            );
          })}
        </div>

        {blocos.map((m) => {
          const quando = emData(m);
          const oc = ocupacaoDoIntervalo(ativas, quando, 30);
          const cheio = lotado(oc, limite);
          const passou = quando.getTime() + 30 * 60000 <= agora.getTime();

          return (
            <div
              key={m}
              className={cn(
                "grid border-b border-border/70",
                m % 60 === 30 && "border-dashed",
                cheio && "bg-coral/[0.04]"
              )}
              style={{ gridTemplateColumns: `5.5rem repeat(${colunas.length}, ${largura})` }}
            >
              {/* Hora e ocupação do bloco */}
              <div className={cn("flex flex-col justify-center px-3 py-2", m === blocoAgora && "bg-coral/10")}>
                <span
                  className={cn(
                    "text-sm font-semibold tabular-nums",
                    m === blocoAgora ? "text-coral" : passou ? "text-cinza-suave" : "text-azul-medico"
                  )}
                >
                  {hhmm(m)}
                </span>
                {oc.simultaneas > 0 && (
                  <span
                    className={cn(
                      "mt-0.5 w-fit rounded-full px-1.5 text-[10px] font-semibold tabular-nums",
                      cheio ? "bg-coral/15 text-coral" : "bg-verde-menta text-teal"
                    )}
                    title={limite !== null ? `${oc.simultaneas} de ${limite} consultas neste horário` : undefined}
                  >
                    {limite !== null ? `${oc.simultaneas}/${limite}` : oc.simultaneas}
                  </span>
                )}
                {cheio && <span className="mt-0.5 text-[10px] font-semibold text-coral">lotado</span>}
              </div>

              {colunas.map((p) => {
                const cor = cores.get(p.id);
                const aqui = consultas.filter(
                  (c) => c.medico_id === p.id && blocoDe(new Date(c.data_hora)) === m
                );
                const fechados = fechadosNoBloco(p.id, m);
                const fechTodos = fechados.find((f) => f.servico_id === null) ?? null;
                const fechParcial = fechados.filter((f) => f.servico_id !== null);
                // Consulta que começou antes e ainda ocupa este bloco
                const continua =
                  aqui.length === 0 &&
                  ativas.some((c) => {
                    const ini = new Date(c.data_hora);
                    const a = ini.getHours() * 60 + ini.getMinutes();
                    return c.medico_id === p.id && a < m && a + (c.duracao_min ?? 30) > m;
                  });

                return (
                  <div key={p.id} className="min-h-[3.25rem] border-l border-border p-1">
                    {aqui.length > 0 ? (
                      <div className="flex flex-col gap-1">
                        {aqui.map((c) => (
                          <CartaoGrade
                            key={c.id}
                            consulta={c}
                            cor={cor}
                            confirmacao={confirmacoes[c.id]}
                            onClick={() => onConsulta(c)}
                          />
                        ))}
                      </div>
                    ) : continua ? (
                      <div className={cn("h-full min-h-[2.75rem] rounded-md border-l-[3px]", cor?.fundo, cor?.borda)} />
                    ) : fechTodos ? (
                      <div
                        className="flex h-full min-h-[2.75rem] items-center justify-center rounded-md bg-[repeating-linear-gradient(135deg,rgba(107,122,130,0.06),rgba(107,122,130,0.06)_6px,rgba(107,122,130,0.13)_6px,rgba(107,122,130,0.13)_12px)] px-1 text-center text-[10px] font-medium text-cinza-suave"
                        title={`Agenda fechada${fechTodos.motivo ? `: ${fechTodos.motivo}` : ""}`}
                      >
                        {m === inicioDoFechamento(fechTodos) ? `Fechado${fechTodos.motivo ? ` · ${fechTodos.motivo}` : ""}` : ""}
                      </div>
                    ) : cheio || passou ? (
                      <div
                        className={cn("h-full min-h-[2.75rem] rounded-md", cheio && "bg-[repeating-linear-gradient(135deg,transparent,transparent_6px,rgba(232,93,74,0.07)_6px,rgba(232,93,74,0.07)_12px)]")}
                        title={cheio ? "Horário lotado" : undefined}
                      />
                    ) : (
                      <button
                        onClick={() => onNova(quando, p.id)}
                        className={cn(
                          "group/cel relative flex h-full min-h-[2.75rem] w-full flex-col items-center justify-center rounded-md text-[11px] font-medium text-teal transition hover:bg-verde-menta/60",
                          fechParcial.length > 0 && "bg-cinza-suave/[0.06]"
                        )}
                        aria-label={`Marcar consulta com ${p.nome} às ${hhmm(m)}`}
                        title={
                          fechParcial.length
                            ? `Sem ${fechParcial.map((f) => nomeServico.get(f.servico_id ?? "") ?? "serviço").join(", ")} neste horário`
                            : undefined
                        }
                      >
                        <span className="flex items-center opacity-0 transition group-hover/cel:opacity-100 group-focus-visible/cel:opacity-100">
                          <Plus className="mr-0.5 size-3" /> {hhmm(m)}
                        </span>
                        {fechParcial.length > 0 && (
                          <span className="px-1 text-center text-[10px] leading-tight text-cinza-suave">
                            sem {fechParcial.map((f) => nomeServico.get(f.servico_id ?? "") ?? "serviço").join(", ")}
                          </span>
                        )}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      <p className="border-t border-border px-4 py-2 text-[11px] text-cinza-suave">
        Clique num espaço vazio para marcar com aquele profissional, já no horário. Faixa colorida = consulta
        que continua do horário anterior. Listras vermelhas = horário lotado; cinza = agenda fechada.
      </p>
    </div>
  );
}

/** Bloco de 30 min em que o fechamento começa: é onde vai o rótulo. */
function inicioDoFechamento(f: RegraFechamento): number {
  const [h, m] = f.hora_inicio.split(":").map(Number);
  const ini = h * 60 + m;
  return ini - (ini % 30);
}

/** Consulta dentro da célula do profissional: nome, horário e serviço. */
function CartaoGrade({
  consulta: c,
  cor,
  confirmacao,
  onClick,
}: {
  consulta: Consulta;
  cor?: CorProfissional;
  confirmacao?: ConfirmacaoDaConsulta;
  onClick: () => void;
}) {
  const ini = new Date(c.data_hora);
  const fim = new Date(ini.getTime() + (c.duracao_min ?? 30) * 60000);
  const cancelada = c.status === "cancelada";
  const tom = tomStatus[c.status];

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full overflow-hidden rounded-md text-left shadow-[0_1px_2px_rgba(15,58,82,0.08)] ring-1 ring-inset ring-black/[0.04] transition-all hover:-translate-y-px hover:shadow-card",
        tom.fundo,
        cancelada && "opacity-60",
        confirmacao?.status === "reagendar" && "ring-2 ring-coral/70"
      )}
      title={`${format(ini, "HH:mm")}–${format(fim, "HH:mm")} · ${c.paciente_nome}${c.medico_nome ? ` · ${c.medico_nome}` : ""}`}
    >
      <span className={cn("w-1 shrink-0", corStatus[c.status])} />
      <span className="min-w-0 flex-1 px-2 py-1.5">
        <span className="flex items-center gap-1">
          <span className={cn("min-w-0 truncate text-xs font-semibold text-azul-medico", cancelada && "line-through")}>
            {c.paciente_nome}
          </span>
          {c.tipo === "teleconsulta" && <Video className="size-3 shrink-0 text-cinza-suave" />}
          {c.origem === "link" && <SeloLink />}
        </span>
        <span className={cn("block truncate text-[11px] font-medium tabular-nums", tom.texto)}>
          {format(ini, "HH:mm")} – {format(fim, "HH:mm")}
        </span>
        {c.servico_nome && (
          <span className={cn("block truncate text-[10px] font-medium", cor?.texto ?? "text-cinza-suave")}>
            {c.servico_nome}
          </span>
        )}
      </span>
      {confirmacao && (
        <span
          className={cn("mr-1.5 mt-1.5 size-2 shrink-0 rounded-full ring-2 ring-white", corConfirmacao[confirmacao.status])}
          title={`Confirmação: ${confirmacao.status}`}
        />
      )}
    </button>
  );
}

/**
 * Lista do dia agrupada por horário: cada grupo diz quantas consultas há
 * naquele horário e, com limite, quantas cabem. É a leitura do celular e
 * a de quem prefere lista no computador.
 */
function ListaPorHorario({
  cursor,
  consultas,
  multiClinica,
  confirmacoes,
  cores,
  limite,
  onConsulta,
}: {
  cursor: Date;
  consultas: Consulta[];
  multiClinica: boolean;
  confirmacoes: Record<string, ConfirmacaoDaConsulta>;
  /** Nulo com um profissional só: a cor não diria nada. */
  cores: Map<string, CorProfissional> | null;
  limite: number | null;
  onConsulta: (c: Consulta) => void;
}) {
  const ativas = consultas.filter((c) => c.status !== "cancelada");
  const grupos: { hora: string; inicio: Date; itens: Consulta[] }[] = [];
  for (const c of consultas) {
    const d = new Date(c.data_hora);
    const hora = format(d, "HH:mm");
    const g = grupos.find((x) => x.hora === hora);
    if (g) g.itens.push(c);
    else grupos.push({ hora, inicio: d, itens: [c] });
  }
  const agrupar = grupos.some((g) => g.itens.length > 1) || limite !== null;

  return (
    <div className="space-y-4 p-3 sm:p-4">
      {grupos.map((g, i) => {
        // Divisória do agora antes do primeiro horário que ainda vem
        const agoraAqui =
          isToday(cursor) &&
          g.inicio.getTime() > Date.now() &&
          (i === 0 || grupos[i - 1].inicio.getTime() <= Date.now());
        const oc = ocupacaoDoIntervalo(ativas, g.inicio, 30);
        const cheio = lotado(oc, limite);

        return (
          <section key={g.hora}>
            {agoraAqui && (
              <div className="mb-2.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-coral">
                <span className="size-2.5 rounded-full bg-coral" />
                Agora · {format(new Date(), "HH:mm")}
                <span className="h-px flex-1 bg-coral/60" />
              </div>
            )}
            {agrupar && (
              <div className="mb-2 flex items-center gap-2">
                <span className="font-heading text-sm font-bold tabular-nums text-azul-medico">{g.hora}</span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                    cheio ? "bg-coral/12 text-coral" : "bg-verde-menta text-teal"
                  )}
                >
                  {limite !== null
                    ? `${oc.simultaneas} de ${limite}${cheio ? " · lotado" : ""}`
                    : `${g.itens.length} consulta${g.itens.length === 1 ? "" : "s"}`}
                </span>
                <span className="h-px flex-1 bg-border" />
              </div>
            )}
            <ul className="space-y-2.5">
              {g.itens.map((c) => (
                <LinhaConsulta
                  key={c.id}
                  consulta={c}
                  multiClinica={multiClinica}
                  confirmacao={confirmacoes[c.id]}
                  cor={cores?.get(c.medico_id) ?? null}
                  onConsulta={onConsulta}
                />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function LinhaConsulta({
  consulta: c,
  multiClinica,
  confirmacao: conf,
  cor,
  onConsulta,
}: {
  consulta: Consulta;
  multiClinica: boolean;
  confirmacao?: ConfirmacaoDaConsulta;
  cor: CorProfissional | null;
  onConsulta: (c: Consulta) => void;
}) {
  const inicio = new Date(c.data_hora);
  const fim = c.duracao_min ? new Date(inicio.getTime() + c.duracao_min * 60000) : null;
  const cancelada = c.status === "cancelada";

  return (
    <li>
      {/* Linha em div, e não em button: o atalho do WhatsApp é um
          link, e link dentro de botão é HTML inválido. No celular tudo
          empilha (nada espremido em colunas); no computador, em linha. */}
      <div
        className={cn(
          "group flex w-full overflow-hidden rounded-xl border bg-white text-left transition-all hover:shadow-soft",
          conf?.status === "reagendar" ? "border-alerta/50" : "border-border hover:border-teal-claro",
          cancelada && "opacity-70"
        )}
      >
        {/* Barra de status */}
        <span className={cn("w-1.5 shrink-0", corStatus[c.status])} />

        <button onClick={() => onConsulta(c)} className="flex min-w-0 flex-1 text-left">
          {/* Faixa de horário */}
          <div className="flex w-14 shrink-0 flex-col items-center justify-center border-r border-border bg-branco-clinico py-3 sm:w-[4.5rem]">
            <span className="font-heading text-[15px] font-bold tabular-nums text-azul-medico sm:text-base">{format(inicio, "HH:mm")}</span>
            {fim && <span className="text-[11px] tabular-nums text-cinza-suave">{format(fim, "HH:mm")}</span>}
          </div>

          {/* Conteúdo */}
          <div className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 sm:px-4 sm:py-3">
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                <span
                  className={cn(
                    "font-semibold leading-snug text-cinza-texto [overflow-wrap:anywhere]",
                    cancelada && "line-through"
                  )}
                >
                  {c.paciente_nome}
                </span>
                {c.origem === "link" && <SeloLink />}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-cinza-suave">
                {/* No celular a situação vai aqui, em texto, no lugar do selo da direita */}
                <span className={cn("font-semibold sm:hidden", tomStatus[c.status].texto)}>{rotuloStatus[c.status]}</span>
                {multiClinica && c.organizacao_nome && (
                  <span className="flex items-center gap-1 font-medium text-azul-medico">
                    <Building2 className="size-3.5 shrink-0 text-teal" />
                    {c.organizacao_nome}
                  </span>
                )}
                {c.medico_nome && (
                  <span className={cn("flex items-center gap-1", cor && "font-semibold", cor?.texto)}>
                    {cor ? (
                      <span className={cn("size-2.5 shrink-0 rounded-full", cor.ponto)} />
                    ) : (
                      <UserRound className="size-3.5 shrink-0 text-teal" />
                    )}
                    {c.medico_nome}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Stethoscope className="size-3.5 shrink-0 text-teal" />
                  {c.servico_nome ? `${c.servico_nome} · ${rotuloTipo[c.tipo]}` : rotuloTipo[c.tipo]}
                </span>
                {c.convenio && (
                  <span className="flex items-center gap-1">
                    <ShieldCheck className="size-3.5 shrink-0 text-teal" />
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
              {c.motivo && <p className="mt-1 truncate text-xs text-cinza-suave/80">{c.motivo}</p>}
            </div>

            <Badge variant={c.status} className="hidden shrink-0 sm:inline-flex">
              {rotuloStatus[c.status]}
            </Badge>
          </div>
        </button>

        {/* Confirmação à vista, sem precisar abrir a ficha */}
        <div className="flex shrink-0 items-center gap-1.5 border-l border-border px-2 sm:px-3">
          <SeloConfirmacao confirmacao={conf} />
          {conf && c.paciente_telefone ? (
            <a
              href={linkWhatsApp(c.paciente_telefone, conf.mensagem)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className={cn(
                "grid size-10 place-items-center rounded-md transition-colors",
                conf.status === "pendente"
                  ? "bg-sucesso/12 text-sucesso hover:bg-sucesso/20"
                  : "text-cinza-suave hover:bg-verde-menta hover:text-teal"
              )}
              title={conf.status === "pendente" ? "Enviar confirmação pelo WhatsApp" : "Reenviar pelo WhatsApp"}
              aria-label={`Enviar confirmação para ${c.paciente_nome} no WhatsApp`}
            >
              <MessageCircle className="size-4" />
            </a>
          ) : (
            <ChevronRight className="size-4 shrink-0 text-cinza-suave/40 transition-colors group-hover:text-teal" />
          )}
          {conf && c.paciente_telefone && (
            <ChevronRight className="hidden size-4 shrink-0 text-cinza-suave/40 transition-colors group-hover:text-teal sm:block" />
          )}
        </div>
      </div>
    </li>
  );
}

/** O próprio paciente marcou pelo link de agendamento. */
function SeloLink() {
  return (
    <span
      className="shrink-0 rounded-full bg-azul-medico/10 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-azul-medico"
      title="Marcada pelo paciente pelo link de agendamento"
    >
      via link
    </span>
  );
}

/** "10:30" a partir dos minutos do dia. */
function hhmm(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}
