"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarCheck2,
  ChevronLeft,
  ChevronRight,
  CalendarPlus,
  CheckCircle2,
  Clock,
  Loader2,
  MapPin,
  MessageCircle,
  TriangleAlert,
} from "lucide-react";
import type { AgendaPublica, HorarioPublico } from "@/lib/agendar";
import { agendarPeloLink } from "@/lib/actions/agendar";
import { cn } from "@/lib/utils";

/**
 * O paciente marca a própria consulta, em três passos que cabem numa
 * tela de celular cada: escolher o horário, dizer quem é, pronto.
 *
 * Regras de tela: uma coluna, nada cortado (nomes quebram linha, nunca
 * viram "Dr. Fulano de…"), alvos de toque de 48 px, o botão de seguir
 * sempre à vista no rodapé e dizendo o que foi escolhido.
 */

const SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const SEMANA_LONGA = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const MESES_LONGOS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const PERIODOS = [
  { id: "manha", rotulo: "Manhã" },
  { id: "tarde", rotulo: "Tarde" },
  { id: "noite", rotulo: "Noite" },
] as const;

const partes = (dia: string) => {
  const [a, m, d] = dia.split("-").map(Number);
  return { ano: a, mes: m, dia: d };
};
const diaCurto = (dia: string, semana: number) => {
  const p = partes(dia);
  return `${SEMANA[semana]}, ${String(p.dia).padStart(2, "0")}/${String(p.mes).padStart(2, "0")}`;
};
const diaLongo = (dia: string, semana: number) => {
  const p = partes(dia);
  return `${SEMANA_LONGA[semana]}, ${p.dia} de ${MESES_LONGOS[p.mes - 1]}`;
};

function mascaraTelefone(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

const iniciais = (nome: string) =>
  nome
    .replace(/^(dra?\.?|dr\.)\s+/i, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

export function AgendarCliente({ agenda, servicoInicial }: { agenda: AgendaPublica; servicoInicial: string | null }) {
  const router = useRouter();
  const [abertoEm] = useState(() => Date.now());
  const [servicoSlug, setServicoSlug] = useState(
    agenda.servicos.find((s) => s.slug === servicoInicial)?.slug ?? agenda.servicos[0]?.slug ?? ""
  );
  const servico = agenda.servicos.find((s) => s.slug === servicoSlug) ?? agenda.servicos[0];
  const [dia, setDia] = useState<string | null>(servico?.dias[0]?.dia ?? null);
  const diaSel = servico?.dias.find((d) => d.dia === dia) ?? servico?.dias[0] ?? null;
  const periodosDoDia = PERIODOS.filter((p) => diaSel?.horarios.some((h) => h.periodo === p.id));
  const [periodo, setPeriodo] = useState<string>(periodosDoDia[0]?.id ?? "manha");
  const [horario, setHorario] = useState<HorarioPublico | null>(null);
  // Com vários serviços e nenhum no endereço, o paciente escolhe primeiro o serviço:
  // assim a tela dos horários fica curta e cabe sem rolar
  const [etapa, setEtapa] = useState<"servico" | "horario" | "dados" | "pronto">(
    agenda.servicos.length > 1 && !agenda.servicos.some((s) => s.slug === servicoInicial) ? "servico" : "horario"
  );

  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [convenio, setConvenio] = useState("");
  const [aceite, setAceite] = useState(false);
  // E-mail e convênio são opcionais: ficam recolhidos para a tela caber sem rolar
  const [maisDados, setMaisDados] = useState(false);
  const [empresa, setEmpresa] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const faixa = useRef<HTMLDivElement>(null);

  // Trocou o serviço: volta ao primeiro dia com vaga e põe no endereço
  useEffect(() => {
    setDia(servico?.dias[0]?.dia ?? null);
    setHorario(null);
    const base = `/agendar/${agenda.clinica.slug}/${agenda.profissional.slug}`;
    if (agenda.servicos.length > 1) window.history.replaceState(null, "", `${base}/${servicoSlug}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [servicoSlug]);

  // Trocou o dia: o primeiro período com horário
  useEffect(() => {
    setPeriodo(periodosDoDia[0]?.id ?? "manha");
    setHorario(null);
    faixa.current?.querySelector<HTMLElement>('[aria-pressed="true"]')?.scrollIntoView({ block: "nearest", inline: "center" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dia, servicoSlug]);

  // O aviso aparece embaixo, perto da barra fixa: rola até ele ficar à vista
  useEffect(() => {
    if (erro) document.querySelector('[role="alert"]')?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [erro]);

  const horarios = useMemo(() => diaSel?.horarios.filter((h) => h.periodo === periodo) ?? [], [diaSel, periodo]);
  const mesDaFaixa = diaSel ? MESES_LONGOS[partes(diaSel.dia).mes - 1] : "";
  const whatsClinica = agenda.clinica.telefone ? `https://wa.me/55${agenda.clinica.telefone.replace(/\D/g, "")}` : null;

  function confirmar(e: React.FormEvent) {
    e.preventDefault();
    if (!horario || !servico) return;
    setErro(null);
    if (!aceite) {
      setErro("Para marcar, marque a autorização de contato logo acima.");
      document.getElementById("aceite")?.focus();
      return;
    }
    startTransition(async () => {
      const r = await agendarPeloLink({
        clinica: agenda.clinica.slug,
        profissional: agenda.profissional.slug,
        servicoSlug: servico.slug,
        inicio: horario.iso,
        nome,
        telefone,
        email,
        convenio,
        aceite,
        empresa,
        abertoEm,
      });
      if (!r.ok) {
        setErro(r.erro);
        if (r.ocupado) {
          // Volta para a escolha com os horários de agora
          setHorario(null);
          setEtapa("horario");
          router.refresh();
        }
        return;
      }
      setEtapa("pronto");
      window.scrollTo({ top: 0 });
    });
  }

  function baixarIcs() {
    if (!horario || !servico) return;
    const ini = new Date(horario.iso);
    const fim = new Date(ini.getTime() + servico.duracao * 60000);
    const f = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const texto = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Medi Marketing//Agendamento//PT",
      "BEGIN:VEVENT",
      `UID:${ini.getTime()}-${agenda.profissional.slug}@medimarketing.com.br`,
      `DTSTAMP:${f(new Date())}`,
      `DTSTART:${f(ini)}`,
      `DTEND:${f(fim)}`,
      `SUMMARY:${servico.nome} com ${agenda.profissional.nome}`,
      `LOCATION:${[agenda.clinica.nome, agenda.clinica.endereco].filter(Boolean).join(" - ")}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    const url = URL.createObjectURL(new Blob([texto], { type: "text/calendar" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "consulta.ics";
    a.click();
    URL.revokeObjectURL(url);
  }

  /* ------------------------------ Cabeçalho ------------------------------ */
  const cabecalho = (
    <header className="flex items-start gap-3">
      {agenda.profissional.fotoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={agenda.profissional.fotoUrl}
          alt=""
          className="size-14 shrink-0 rounded-full border border-border object-cover"
        />
      ) : (
        <span className="grid size-14 shrink-0 place-items-center rounded-full bg-azul-medico font-heading text-lg font-semibold text-white">
          {iniciais(agenda.profissional.nome)}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-cinza-suave">{agenda.clinica.nome}</p>
        <h1 className="font-heading text-xl font-semibold leading-tight text-azul-medico [overflow-wrap:anywhere]">
          {agenda.profissional.nome}
        </h1>
        {agenda.profissional.especialidade && (
          <p className="mt-0.5 text-sm text-cinza-suave">{agenda.profissional.especialidade}</p>
        )}
      </div>
    </header>
  );

  /* ------------------------------- Pronto ------------------------------- */
  if (etapa === "pronto" && horario && servico && diaSel) {
    return (
      <div className="mx-auto w-full max-w-md px-4 pb-10 pt-8 sm:px-6">
        <div className="rounded-2xl border border-border bg-white p-6 text-center shadow-card">
          <CheckCircle2 className="mx-auto size-14 text-sucesso" />
          <h1 className="mt-3 font-heading text-2xl font-semibold text-azul-medico">Consulta marcada!</h1>
          <p className="mt-1 text-sm text-cinza-suave">
            Você recebe a confirmação no WhatsApp{email ? " e no e-mail" : ""}. Na véspera, enviamos um lembrete.
          </p>
          <dl className="mt-5 space-y-3 rounded-xl bg-verde-menta/60 p-4 text-left">
            <div className="flex items-start gap-3">
              <CalendarCheck2 className="mt-0.5 size-5 shrink-0 text-teal" />
              <div>
                <dt className="sr-only">Quando</dt>
                <dd className="font-semibold text-azul-medico first-letter:uppercase">{diaLongo(diaSel.dia, diaSel.semana)}</dd>
                <dd className="text-sm text-cinza-texto">
                  {horario.hora} · {servico.nome} com {agenda.profissional.nome}
                </dd>
              </div>
            </div>
            {agenda.clinica.endereco && (
              <div className="flex items-start gap-3">
                <MapPin className="mt-0.5 size-5 shrink-0 text-teal" />
                <div>
                  <dt className="sr-only">Onde</dt>
                  <dd className="text-sm text-cinza-texto">
                    {agenda.clinica.nome}
                    <br />
                    {agenda.clinica.endereco}
                  </dd>
                </div>
              </div>
            )}
          </dl>
          <div className="mt-5 grid gap-2">
            <button
              onClick={baixarIcs}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-border bg-white font-semibold text-azul-medico transition-colors hover:border-teal hover:text-teal"
            >
              <CalendarPlus className="size-5" /> Adicionar à minha agenda
            </button>
            {whatsClinica && (
              <a
                href={whatsClinica}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-sucesso font-semibold text-white transition-colors hover:bg-sucesso/90"
              >
                <MessageCircle className="size-5" /> Falar com a clínica
              </a>
            )}
          </div>
        </div>
        <Rodape />
      </div>
    );
  }

  /* -------------------------------- Dados ------------------------------- */
  if (etapa === "dados" && horario && servico && diaSel) {
    return (
      <form onSubmit={confirmar} className="mx-auto w-full max-w-md px-4 pb-32 pt-5 sm:px-6 lg:pb-10">
        <button
          type="button"
          onClick={() => setEtapa("horario")}
          className="inline-flex h-10 items-center gap-1.5 text-sm font-semibold text-teal"
        >
          <ArrowLeft className="size-4" /> Trocar horário
        </button>

        <div className="mt-2 rounded-xl border border-teal/30 bg-verde-menta/60 px-4 py-3">
          <p className="font-semibold text-azul-medico first-letter:uppercase">
            {diaLongo(diaSel.dia, diaSel.semana)}, às {horario.hora}
          </p>
          <p className="mt-0.5 text-sm text-cinza-texto [overflow-wrap:anywhere]">
            {servico.nome} com {agenda.profissional.nome} · {servico.duracao} min
          </p>
        </div>

        <h2 className="mt-6 font-heading text-lg font-semibold text-azul-medico">Seus dados</h2>
        <div className="mt-3 space-y-4">
          <Campo id="nome" rotulo="Nome completo">
            <input
              id="nome"
              required
              autoComplete="name"
              autoCapitalize="words"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className={campoClass}
              placeholder="Como está no documento"
            />
          </Campo>
          <Campo id="telefone" rotulo="WhatsApp" dica="A confirmação e o lembrete chegam por aqui.">
            <input
              id="telefone"
              required
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              value={telefone}
              onChange={(e) => setTelefone(mascaraTelefone(e.target.value))}
              className={campoClass}
              placeholder="(47) 99999-9999"
            />
          </Campo>
          {!maisDados ? (
            <button
              type="button"
              onClick={() => setMaisDados(true)}
              className="inline-flex h-10 items-center text-sm font-semibold text-teal"
            >
              + Adicionar e-mail ou convênio (opcional)
            </button>
          ) : (
            <>
          <Campo id="email" rotulo="E-mail" opcional>
            <input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={campoClass}
              placeholder="voce@email.com"
            />
          </Campo>
          <Campo id="convenio" rotulo="Convênio" opcional>
            <input
              id="convenio"
              value={convenio}
              onChange={(e) => setConvenio(e.target.value)}
              className={campoClass}
              placeholder="Particular, Unimed…"
            />
          </Campo>
            </>
          )}

          {/* Isca para robô: escondida de quem enxerga e de leitor de tela */}
          <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
            <label htmlFor="empresa">Empresa</label>
            <input id="empresa" tabIndex={-1} autoComplete="off" value={empresa} onChange={(e) => setEmpresa(e.target.value)} />
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-white p-3.5">
            <input
              id="aceite"
              type="checkbox"
              checked={aceite}
              onChange={(e) => setAceite(e.target.checked)}
              className="mt-0.5 size-5 shrink-0 accent-teal"
            />
            <span className="text-sm leading-snug text-cinza-texto">
              Autorizo a {agenda.clinica.nome} a usar estes dados para marcar e lembrar minha consulta.
            </span>
          </label>
        </div>

        {erro && (
          <p role="alert" className="mt-4 flex items-start gap-2 rounded-xl bg-coral/10 px-3.5 py-3 text-sm text-coral">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" /> {erro}
          </p>
        )}

        <Barra>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-coral px-5 font-semibold text-white shadow-sm transition-colors hover:bg-coral/90 disabled:opacity-50"
          >
            {pending && <Loader2 className="size-5 animate-spin" />}
            {pending ? "Marcando…" : "Confirmar consulta"}
          </button>
        </Barra>
      </form>
    );
  }

  /* ------------------------------- Serviço ------------------------------- */
  if (etapa === "servico") {
    return (
      <div className="mx-auto w-full max-w-md px-4 pb-10 pt-5 sm:px-6 lg:pt-10">
        {cabecalho}
        <h2 className="mt-6 font-heading text-lg font-semibold text-azul-medico">Qual atendimento você quer marcar?</h2>
        <ul className="mt-3 space-y-2">
          {agenda.servicos.map((s) => (
            <li key={s.slug}>
              <button
                type="button"
                onClick={() => {
                  setServicoSlug(s.slug);
                  setEtapa("horario");
                }}
                className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-border bg-white px-4 py-3 text-left transition-colors hover:border-teal"
              >
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold leading-snug text-azul-medico">{s.nome}</span>
                  <span className="mt-0.5 block text-sm text-cinza-suave">
                    {s.duracao} min{s.preco ? ` · ${s.preco}` : ""}
                    {s.dias.length === 0 ? " · sem horários livres" : ""}
                  </span>
                </span>
                <ChevronRight className="size-5 shrink-0 text-cinza-suave" />
              </button>
            </li>
          ))}
        </ul>
        <Rodape />
      </div>
    );
  }

  /* ------------------------------- Horário ------------------------------- */
  const semVaga = !servico || servico.dias.length === 0;
  const rolarDias = (dir: -1 | 1) => faixa.current?.scrollBy({ left: dir * 300, behavior: "smooth" });

  return (
    <div className="mx-auto w-full max-w-md px-4 pb-24 pt-5 sm:px-6 lg:max-w-4xl lg:pb-10 lg:pt-10">
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-8 lg:rounded-2xl lg:border lg:border-border lg:bg-white lg:p-8 lg:shadow-card">
        <div>
          {cabecalho}

          {servico && (
            <div className="mt-4 flex items-center gap-3 rounded-xl bg-white px-3.5 py-2.5 ring-1 ring-border lg:bg-branco-clinico">
              <p className="min-w-0 flex-1 text-sm text-cinza-texto">
                <strong className="block font-semibold leading-snug text-azul-medico">{servico.nome}</strong>
                <span className="inline-flex items-center gap-1 text-cinza-suave">
                  <Clock className="size-3.5" /> {servico.duracao} min{servico.preco ? ` · ${servico.preco}` : ""}
                </span>
              </p>
              {agenda.servicos.length > 1 && (
                <button
                  type="button"
                  onClick={() => setEtapa("servico")}
                  className="h-10 shrink-0 rounded-lg px-2.5 text-sm font-semibold text-teal hover:bg-verde-menta"
                >
                  Trocar
                </button>
              )}
            </div>
          )}

          {agenda.clinica.endereco && (
            <p className="mt-3 hidden items-start gap-1.5 text-sm text-cinza-suave lg:flex">
              <MapPin className="mt-0.5 size-4 shrink-0 text-teal" /> {agenda.clinica.endereco}
            </p>
          )}
        </div>

        <div className="mt-5 lg:mt-0">
          {semVaga ? (
            <div className="rounded-2xl border border-border bg-white px-5 py-8 text-center">
              <CalendarCheck2 className="mx-auto size-10 text-teal-claro" />
              <p className="mt-3 font-semibold text-azul-medico">Sem horários livres nos próximos {agenda.prazoDias} dias</p>
              <p className="mt-1 text-sm text-cinza-suave">Fale com a clínica que encontramos um horário para você.</p>
              {whatsClinica && (
                <a
                  href={whatsClinica}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-sucesso px-5 font-semibold text-white"
                >
                  <MessageCircle className="size-5" /> Falar com a clínica
                </a>
              )}
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-azul-medico">
                  Dia <span className="font-normal capitalize text-cinza-suave">· {mesDaFaixa}</span>
                </p>
                {servico.dias.length > 4 && (
                  <div className="hidden gap-1 sm:flex">
                    <button
                      type="button"
                      onClick={() => rolarDias(-1)}
                      aria-label="Dias anteriores"
                      className="grid size-9 place-items-center rounded-lg border border-border bg-white text-cinza-suave hover:text-azul-medico"
                    >
                      <ChevronLeft className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => rolarDias(1)}
                      aria-label="Próximos dias"
                      className="grid size-9 place-items-center rounded-lg border border-border bg-white text-cinza-suave hover:text-azul-medico"
                    >
                      <ChevronRight className="size-4" />
                    </button>
                  </div>
                )}
              </div>
              <div
                ref={faixa}
                className="-mx-4 mt-2 flex snap-x gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0 [&::-webkit-scrollbar]:hidden"
              >
                {servico.dias.map((d) => {
                  const p = partes(d.dia);
                  const ativo = d.dia === diaSel?.dia;
                  return (
                    <button
                      key={d.dia}
                      type="button"
                      aria-pressed={ativo}
                      aria-label={diaLongo(d.dia, d.semana)}
                      onClick={() => setDia(d.dia)}
                      className={cn(
                        "flex w-[4.25rem] shrink-0 snap-start flex-col items-center rounded-xl border py-2 transition-colors",
                        ativo
                          ? "border-azul-medico bg-azul-medico text-white"
                          : "border-border bg-white text-cinza-texto hover:border-teal"
                      )}
                    >
                      <span className={cn("text-xs font-semibold uppercase", ativo ? "text-white/80" : "text-cinza-suave")}>
                        {SEMANA[d.semana]}
                      </span>
                      <span className="font-heading text-xl font-semibold leading-tight">{p.dia}</span>
                      <span className={cn("text-[11px]", ativo ? "text-white/75" : "text-cinza-suave")}>{MESES[p.mes - 1]}</span>
                    </button>
                  );
                })}
              </div>

              <p className="mt-5 text-sm font-semibold text-azul-medico">Horário</p>
              {periodosDoDia.length > 1 && (
                <div className="mt-2 grid gap-1 rounded-xl bg-white p-1 ring-1 ring-border" style={{ gridTemplateColumns: `repeat(${periodosDoDia.length}, minmax(0, 1fr))` }} role="tablist">
                  {periodosDoDia.map((p) => {
                    const n = diaSel?.horarios.filter((h) => h.periodo === p.id).length ?? 0;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        role="tab"
                        aria-selected={periodo === p.id}
                        onClick={() => setPeriodo(p.id)}
                        className={cn(
                          "h-10 rounded-lg text-sm font-semibold transition-colors",
                          periodo === p.id ? "bg-verde-menta text-azul-medico" : "text-cinza-suave hover:text-azul-medico"
                        )}
                      >
                        {p.rotulo} <span className="font-normal">· {n}</span>
                      </button>
                    );
                  })}
                </div>
              )}
              <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {horarios.map((h) => (
                  <button
                    key={h.iso}
                    type="button"
                    aria-pressed={horario?.iso === h.iso}
                    onClick={() => {
                      setHorario(h);
                      setErro(null);
                    }}
                    className={cn(
                      "h-12 rounded-xl border text-base font-semibold tabular-nums transition-colors",
                      horario?.iso === h.iso
                        ? "border-teal bg-teal text-white"
                        : "border-border bg-white text-cinza-texto hover:border-teal hover:text-teal"
                    )}
                  >
                    {h.hora}
                  </button>
                ))}
              </div>
            </>
          )}

          {erro && (
            <p role="alert" className="mt-4 flex items-start gap-2 rounded-xl bg-coral/10 px-3.5 py-3 text-sm text-coral">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" /> {erro}
            </p>
          )}

          {!semVaga && (
            <Barra>
              <button
                type="button"
                disabled={!horario}
                onClick={() => {
                  setErro(null);
                  setEtapa("dados");
                  window.scrollTo({ top: 0 });
                }}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-coral px-5 font-semibold text-white shadow-sm transition-colors hover:bg-coral/90 disabled:bg-cinza-suave/30 disabled:text-cinza-suave"
              >
                {horario && diaSel ? `Continuar · ${diaCurto(diaSel.dia, diaSel.semana)} às ${horario.hora}` : "Escolha um horário"}
              </button>
            </Barra>
          )}
        </div>
      </div>
      <Rodape />
    </div>
  );
}

const campoClass =
  "h-12 w-full rounded-xl border border-input bg-white px-3.5 text-base text-cinza-texto shadow-sm placeholder:text-cinza-suave/60 focus-visible:border-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40";

function Campo({
  id,
  rotulo,
  opcional,
  dica,
  children,
}: {
  id: string;
  rotulo: string;
  opcional?: boolean;
  dica?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-cinza-texto">
        {rotulo} {opcional && <span className="font-normal text-cinza-suave">(opcional)</span>}
      </label>
      {children}
      {dica && <p className="mt-1 text-xs text-cinza-suave">{dica}</p>}
    </div>
  );
}

/** Rodapé fixo no celular (com a folga da barra do iPhone); no computador, no lugar. */
function Barra({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-white/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:px-6 lg:static lg:mt-6 lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
      <div className="mx-auto max-w-md lg:max-w-none">{children}</div>
    </div>
  );
}

function Rodape() {
  return <p className="mt-8 text-center text-[11px] text-cinza-suave/80">Agenda online por Medi Marketing</p>;
}
