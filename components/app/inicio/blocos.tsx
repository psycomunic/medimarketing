import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock,
  MessageSquareQuote,
  Paperclip,
} from "lucide-react";
import type { Consulta, IndicadorMensal } from "@/lib/supabase/types";
import type { PendenciaPainel } from "@/lib/supabase/painel";
import type { PassoChecklist } from "@/lib/inicio/dados";
import { formatarHora, rotuloStatus, rotuloTipo } from "@/lib/agenda";
import { corStatus } from "@/lib/agenda";
import { BannerClinica } from "@/components/app/painel/banner-clinica";
import { Painel } from "@/components/app/financeiro/ui";
import { reais } from "@/components/graficos/formato";
import { cn } from "@/lib/utils";

/* ------------------------------ Cabeçalho ------------------------------ */

function comoChamar(nome: string | null): string {
  if (!nome?.trim()) return "tudo bem";
  const limpo = nome.includes("@") ? nome.split("@")[0] : nome;
  const semTitulo = limpo.replace(/^(dra?\.?|sr[a]?\.?)\s*/i, "").trim();
  const primeiro = semTitulo.split(/[\s._-]+/)[0];
  return primeiro.charAt(0).toUpperCase() + primeiro.slice(1);
}

function saudacao(): string {
  const h = Number(new Date().toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: "America/Sao_Paulo" }));
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

export type Atalho = { href: string; rotulo: string; icone: React.ComponentType<{ className?: string }>; principal?: boolean };

export function Cabecalho({
  nome,
  contexto,
  banner,
  atalhos,
}: {
  nome: string | null;
  contexto: string;
  banner?: { url: string; link: string | null; nome: string } | null;
  atalhos: Atalho[];
}) {
  const bruta = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Sao_Paulo" });
  const data = bruta.charAt(0).toUpperCase() + bruta.slice(1);
  return (
    <>
      {banner && <BannerClinica url={banner.url} link={banner.link} nome={banner.nome} className="mb-6" />}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-teal">{data}</p>
          <h1 className="mt-0.5 text-2xl md:text-3xl">
            {saudacao()}, {comoChamar(nome)} 👋
          </h1>
          <p className="mt-1 text-cinza-suave">{contexto}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {atalhos.map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className={cn(
                "inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-all hover:-translate-y-0.5",
                a.principal
                  ? "bg-azul-medico text-white shadow-soft hover:bg-azul-profundo"
                  : "border border-border bg-white text-azul-medico hover:border-teal hover:text-teal"
              )}
            >
              <a.icone className="size-4" />
              {a.rotulo}
            </Link>
          ))}
        </div>
      </header>
    </>
  );
}

/* ---------------------------- Pede atenção ---------------------------- */

export function PedeAtencao({ itens, titulo = "Pede atenção", vazio }: { itens: PendenciaPainel[]; titulo?: string; vazio: string }) {
  const urgentes = itens.filter((i) => i.urgente).length;
  return (
    <Painel
      titulo={titulo}
      descricao={itens.length ? `${itens.length} ${itens.length > 1 ? "itens" : "item"}${urgentes ? `, ${urgentes} urgente${urgentes > 1 ? "s" : ""}` : ""}` : undefined}
      corpo="p-2"
      className="self-start"
    >
      {itens.length === 0 ? (
        <div className="flex items-start gap-3 px-3 py-5">
          <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-sucesso" />
          <div>
            <p className="font-medium text-[#15803D]">Tudo em dia</p>
            <p className="mt-0.5 text-sm text-cinza-suave">{vazio}</p>
          </div>
        </div>
      ) : (
        <ul className="grid gap-0.5">
          {[...itens]
            .sort((a, b) => Number(b.urgente) - Number(a.urgente))
            .map((p) => (
              <li key={p.chave}>
                <Link href={p.href} className="group flex items-start gap-3 rounded-lg px-3 py-3 transition-colors hover:bg-branco-clinico">
                  <span
                    className={cn(
                      "mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg",
                      p.urgente ? "bg-[#FDECEC] text-[#B91C1C]" : "bg-[#FEF4E2] text-[#B45309]"
                    )}
                  >
                    {p.urgente ? <AlertTriangle className="size-4" /> : <Clock className="size-4" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold leading-snug text-cinza-texto">{p.titulo}</span>
                    <span className="mt-0.5 block text-xs leading-snug text-cinza-suave">{p.detalhe}</span>
                  </span>
                  <ChevronRight className="mt-1.5 size-4 shrink-0 text-cinza-suave/40 transition-colors group-hover:text-teal" />
                </Link>
              </li>
            ))}
        </ul>
      )}
    </Painel>
  );
}

/* --------------------------- Agenda de hoje --------------------------- */

/**
 * Linha do tempo do dia: o que já passou fica esmaecido e uma linha
 * marca o "agora" entre a última consulta atendida e a próxima.
 */
export function AgendaHoje({
  consultas,
  mostrarProfissional = false,
  nomes = {},
  titulo = "Agenda de hoje",
}: {
  consultas: Consulta[];
  mostrarProfissional?: boolean;
  nomes?: Record<string, string>;
  titulo?: string;
}) {
  const agora = Date.now();
  const ativas = consultas.filter((c) => c.status !== "cancelada");
  const indiceAgora = ativas.findIndex((c) => new Date(c.data_hora).getTime() > agora);

  return (
    <Painel
      titulo={titulo}
      descricao={
        ativas.length
          ? `${ativas.length} consulta${ativas.length > 1 ? "s" : ""} · ${ativas.filter((c) => c.status === "confirmada" || c.status === "realizada").length} confirmada${ativas.filter((c) => c.status === "confirmada" || c.status === "realizada").length === 1 ? "" : "s"}`
          : undefined
      }
      acao={
        <Link href="/app/agenda" className="inline-flex items-center gap-1 text-sm font-medium text-teal hover:underline">
          Abrir agenda <ArrowRight className="size-4" />
        </Link>
      }
      corpo="p-0"
    >
      {ativas.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <CalendarDays className="mx-auto mb-3 size-10 text-teal-claro" />
          <p className="font-medium text-cinza-texto">Nenhuma consulta hoje</p>
          <p className="mt-1 text-sm text-cinza-suave">Bom momento para retomar leads e pacientes que sumiram.</p>
        </div>
      ) : (
        <ol className="relative px-5 py-4">
          {ativas.map((c, i) => {
            const inicio = new Date(c.data_hora);
            const passou = inicio.getTime() + (c.duracao_min ?? 30) * 60000 < agora;
            return (
              <li key={c.id}>
                {i === indiceAgora && (
                  <div className="mb-3 flex items-center gap-2 pl-[3.25rem] text-[11px] font-semibold uppercase tracking-wide text-coral">
                    <span className="size-2.5 rounded-full bg-coral" />
                    Agora
                    <span className="h-px flex-1 bg-coral/50" />
                  </div>
                )}
                <div className={cn("flex gap-3 pb-3", passou && c.status !== "realizada" && "opacity-60")}>
                  <div className="w-11 shrink-0 pt-0.5 text-right">
                    <p className="font-heading text-sm font-bold tabular-nums text-azul-medico">{formatarHora(c.data_hora)}</p>
                    <p className="text-[10px] text-cinza-suave">{c.duracao_min ?? 30} min</p>
                  </div>
                  <div className="relative flex flex-col items-center">
                    <span className={cn("mt-1.5 size-2.5 shrink-0 rounded-full ring-4 ring-[color:var(--g-halo)]", corStatus[c.status])} />
                    {i < ativas.length - 1 && <span className="mt-1 w-px flex-1 bg-border" />}
                  </div>
                  <Link
                    href="/app/agenda"
                    className="min-w-0 flex-1 rounded-lg border border-border bg-white px-3 py-2 transition-colors hover:border-teal/50 hover:bg-branco-clinico"
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-cinza-texto">{c.paciente_nome}</span>
                      <span className="shrink-0 text-[11px] font-semibold text-cinza-suave">{rotuloStatus[c.status]}</span>
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-cinza-suave">
                      {rotuloTipo[c.tipo]}
                      {mostrarProfissional && nomes[c.medico_id] ? ` · ${nomes[c.medico_id]}` : ""}
                      {c.convenio ? ` · ${c.convenio}` : ""}
                      {c.motivo ? ` · ${c.motivo}` : ""}
                    </span>
                  </Link>
                </div>
              </li>
            );
          })}
          {indiceAgora === -1 && ativas.length > 0 && (
            <li className="flex items-center gap-2 pl-[3.25rem] text-[11px] font-semibold uppercase tracking-wide text-cinza-suave">
              <CheckCircle2 className="size-3.5 text-sucesso" /> Agenda do dia encerrada
            </li>
          )}
        </ol>
      )}
    </Painel>
  );
}

/* --------------------------- Próximos pacientes --------------------------- */

export function ProximosPacientes({ consultas }: { consultas: Consulta[] }) {
  return (
    <Painel titulo="Próximos pacientes" descricao="Depois de hoje." corpo="p-0">
      {consultas.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-cinza-suave">Nada marcado para os próximos dias.</p>
      ) : (
        <ul className="divide-y divide-border">
          {consultas.map((c) => {
            const d = new Date(c.data_hora);
            return (
              <li key={c.id} className="flex items-center gap-3 px-5 py-3">
                <div className="w-14 shrink-0 rounded-lg bg-verde-menta py-1.5 text-center">
                  <p className="text-[10px] font-semibold uppercase text-teal">{d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "")}</p>
                  <p className="font-heading text-sm font-bold tabular-nums text-azul-medico">{formatarHora(c.data_hora)}</p>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-cinza-texto">{c.paciente_nome}</p>
                  <p className="truncate text-xs text-cinza-suave">
                    {d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} · {rotuloTipo[c.tipo]}
                    {c.motivo ? ` · ${c.motivo}` : ""}
                  </p>
                </div>
                {c.tipo === "primeira" && (
                  <span className="shrink-0 rounded-full bg-[#FEF4E2] px-2 py-0.5 text-[10px] font-semibold text-[#B45309]">1ª vez</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Painel>
  );
}

/* ----------------------------- Checklist ----------------------------- */

export function PrimeirosPassos({ passos }: { passos: PassoChecklist[] }) {
  const feitos = passos.filter((p) => p.feito).length;
  if (!passos.length || feitos === passos.length) return null;
  const pct = Math.round((feitos / passos.length) * 100);
  return (
    <section className="overflow-hidden rounded-xl border border-teal/40 bg-white shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-verde-menta/40 px-5 py-4">
        <div>
          <h2 className="font-heading text-base font-semibold text-azul-medico">Primeiros passos da clínica</h2>
          <p className="mt-0.5 text-sm text-cinza-suave">
            {feitos} de {passos.length} prontos. Com tudo pronto, o painel trabalha sozinho por vocês.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="h-2 w-40 overflow-hidden rounded-full bg-[var(--g-trilho)]">
            <div className="h-full rounded-full bg-teal transition-all" style={{ width: `${pct}%` }} />
          </div>
          <span className="font-heading text-sm font-bold tabular-nums text-teal">{pct}%</span>
        </div>
      </div>
      <ul className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-px bg-border">
        {passos.map((p) => (
          <li key={p.chave} className="bg-white">
            <Link href={p.href} className={cn("flex h-full items-start gap-3 px-4 py-3.5 transition-colors hover:bg-branco-clinico", p.feito && "opacity-60")}>
              {p.feito ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-sucesso" /> : <Circle className="mt-0.5 size-5 shrink-0 text-cinza-suave/50" />}
              <span className="min-w-0">
                <span className={cn("block text-sm font-semibold", p.feito ? "text-cinza-suave line-through" : "text-cinza-texto")}>{p.titulo}</span>
                <span className="block text-xs leading-snug text-cinza-suave">{p.detalhe}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ------------------------------- Funil ------------------------------- */

/** Do lead à consulta realizada, no último mês lançado. */
export function FunilComercial({ indicador }: { indicador: IndicadorMensal | null }) {
  if (!indicador) {
    return (
      <Painel titulo="Funil do mês">
        <p className="text-sm text-cinza-suave">Os números aparecem quando o primeiro mês for lançado nos indicadores.</p>
      </Painel>
    );
  }
  const etapas = [
    { rotulo: "Leads", valor: Number(indicador.leads), cor: "#2A78D6" },
    { rotulo: "Agendamentos", valor: Number(indicador.agendamentos), cor: "#1A9E8F" },
    { rotulo: "Consultas realizadas", valor: Number(indicador.comparecimentos), cor: "#0B4F6C" },
  ];
  const max = Math.max(...etapas.map((e) => e.valor), 1);
  const mes = new Date(`${indicador.mes}T12:00:00`).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return (
    <Painel
      titulo="Funil do mês"
      descricao={`Do contato à consulta · ${mes}`}
      acao={
        <Link href="/app/indicadores" className="inline-flex items-center gap-1 text-sm font-medium text-teal hover:underline">
          Indicadores <ArrowRight className="size-4" />
        </Link>
      }
    >
      <ul className="grid gap-3">
        {etapas.map((e, i) => (
          <li key={e.rotulo}>
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="text-cinza-texto">{e.rotulo}</span>
              <span className="font-heading font-bold tabular-nums text-azul-medico">{e.valor.toLocaleString("pt-BR")}</span>
            </div>
            <div className="mt-1.5 h-3 overflow-hidden rounded-full bg-[var(--g-trilho)]">
              <div className="h-full rounded-full" style={{ width: `${Math.max((e.valor / max) * 100, 2)}%`, background: e.cor }} />
            </div>
            {i > 0 && etapas[i - 1].valor > 0 && (
              <p className="mt-1 text-right text-[11px] text-cinza-suave">
                {Math.round((e.valor / etapas[i - 1].valor) * 100)}% da etapa anterior
              </p>
            )}
          </li>
        ))}
      </ul>
      {Number(indicador.investimento) > 0 && (
        <p className="mt-4 rounded-lg bg-branco-clinico px-3 py-2.5 text-xs text-cinza-suave">
          Investimento de <strong className="text-cinza-texto">{reais(Number(indicador.investimento))}</strong> ·{" "}
          {Number(indicador.comparecimentos) > 0 && (
            <>
              <strong className="text-cinza-texto">{reais(Number(indicador.investimento) / Number(indicador.comparecimentos))}</strong> por consulta realizada
            </>
          )}
        </p>
      )}
    </Painel>
  );
}

/* --------------------------- Recado da Medi --------------------------- */

const AUTOMATICOS = ["Informado pela clínica no diagnóstico inicial.", "Informado pela clínica no check-in mensal."];

export function RecadoMedi({ indicadores }: { indicadores: IndicadorMensal[] }) {
  const comRecado = [...indicadores].reverse().find((i) => i.observacao && !AUTOMATICOS.includes(i.observacao));
  const ultimo = indicadores[indicadores.length - 1];
  if (!ultimo) return null;
  const mes = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", { month: "long" });
  return (
    <section className="relative overflow-hidden rounded-xl bg-azul-medico p-5 text-white shadow-soft">
      <MessageSquareQuote className="absolute -right-3 -top-3 size-24 text-white/10" aria-hidden />
      <p className="text-xs font-semibold uppercase tracking-wider text-teal-claro">Recado da Medi Marketing</p>
      <p className="relative mt-2 whitespace-pre-line text-sm leading-relaxed text-white/90">
        {comRecado?.observacao ?? `Os números de ${mes(ultimo.mes)} já estão no painel. Abra o relatório para ver a evolução do mês.`}
      </p>
      <Link
        href={`/app/indicadores/relatorio?mes=${ultimo.mes}`}
        className="relative mt-4 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/25"
      >
        <Paperclip className="size-4" /> Relatório de {mes(ultimo.mes)}
      </Link>
    </section>
  );
}
