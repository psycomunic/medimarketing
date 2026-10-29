import Link from "next/link";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CalendarCheck2,
  CalendarClock,
  Receipt,
  Sparkles,
  UserPlus,
  UserX,
} from "lucide-react";
import { PERIODOS, type PainelNumeros } from "@/lib/inicio/painel";
import type { Consulta } from "@/lib/supabase/types";
import { BarrasAgrupadas, LinhaArea, Medidor, Ranking, Rosca } from "@/components/graficos/graficos";
import { COR, SERIES, pct, reais } from "@/components/graficos/formato";
import { Indicador, Painel } from "@/components/app/financeiro/ui";
import { cn } from "@/lib/utils";

const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

/** Cor fixa da falta: o mesmo roxo da agenda. */
const COR_FALTA = "#8B5CF6";
/** Acima disso a falta pede ação (lembrete, confirmação, régua). */
const FALTAS_ALERTA = 10;

/**
 * Painel principal do dono da clínica: o período escolhido em números,
 * o ritmo do faturamento no mês e a agenda que já está reservada.
 */
export function PainelDeNumeros({
  p,
  hoje,
  meta,
  nomes,
}: {
  p: PainelNumeros;
  hoje: Consulta[];
  meta: number | null;
  nomes: Record<string, string>;
}) {
  const r = p.recorte;
  const ehMes = r.periodo === "mes";
  const diaHoje = p.ritmo.filter((d) => d.atual !== null).length;
  const agendado = Math.max(p.faturamentoMes - p.ateHoje, 0);
  const metaPct = ehMes && meta ? (p.faturamentoMes / meta) * 100 : null;
  const st = r.status;
  const totalStatus = st.confirmadas + st.pendentes + st.realizadas + st.canceladas + st.faltas;
  const tiposTotal = r.tipos.primeira + r.tipos.retorno + r.tipos.teleconsulta;
  const subiu = r.comparacao === null || r.comparacao.pct >= 0;
  const Seta = subiu ? ArrowUpRight : ArrowDownRight;

  const ativasHoje = hoje.filter((c) => c.status !== "cancelada" && c.status !== "faltou");
  const confirmadasHoje = ativasHoje.filter((c) => c.status === "confirmada" || c.status === "realizada").length;
  const agora = Date.now();
  const proxima = ativasHoje
    .filter((c) => new Date(c.data_hora).getTime() >= agora && c.status !== "realizada")
    .sort((a, b) => a.data_hora.localeCompare(b.data_hora))[0];
  const confHoje = `${confirmadasHoje} confirmada${confirmadasHoje === 1 ? "" : "s"}`;

  const semana = p.proximos14.slice(0, 7);
  const marcadas7 = semana.reduce((s, d) => s + d.confirmadas + d.aConfirmar, 0);
  const confirmadas7 = semana.reduce((s, d) => s + d.confirmadas, 0);
  const aConfirmar7 = marcadas7 - confirmadas7;

  const mini: { r: string; v: string; n?: string }[] = [
    ehMes ? { r: "Hoje", v: reais(p.faturamentoHoje) } : { r: "Atendimentos", v: String(r.atendimentos) },
    { r: "Recebido", v: reais(r.recebido) },
    { r: "A receber", v: reais(r.aReceber) },
    r.lucro !== null
      ? { r: "Lucro", v: reais(r.lucro), n: r.margem !== null ? `margem ${pct(r.margem, 1)}` : undefined }
      : { r: "Ticket médio", v: reais(r.ticketMedio) },
  ];

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      {/* Período */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-heading text-lg font-semibold text-azul-medico">Visão geral</h2>
        <nav aria-label="Período" className="inline-flex rounded-full border border-border bg-white p-1 shadow-soft">
          {PERIODOS.map((x) => (
            <Link
              key={x.chave}
              href={x.chave === "mes" ? "/app" : `/app?periodo=${x.chave}`}
              scroll={false}
              aria-current={x.chave === r.periodo ? "page" : undefined}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors sm:px-4 sm:text-sm",
                x.chave === r.periodo ? "bg-azul-medico text-white" : "text-cinza-suave hover:text-azul-medico"
              )}
            >
              {x.rotulo}
            </Link>
          ))}
        </nav>
      </div>

      {/* Destaque do período e números do dia */}
      <div className="grid gap-5 xl:grid-cols-5">
        <section className="relative min-w-0 overflow-hidden rounded-2xl bg-gradient-to-br from-azul-profundo via-azul-medico to-[#0E6A7E] p-5 text-white shadow-card sm:p-6 xl:col-span-3">
          <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full bg-teal/30 blur-3xl" />
          <div aria-hidden className="pointer-events-none absolute -bottom-24 left-1/3 size-56 rounded-full bg-white/5 blur-2xl" />
          <div className="relative">
            <p className="text-xs font-semibold uppercase tracking-wider text-white/70">{r.titulo}</p>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
              <p className="font-heading text-[2.5rem] font-bold leading-none tabular-nums sm:text-5xl">{reais(r.faturamento)}</p>
              {r.comparacao && (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold ring-1 ring-inset",
                    subiu ? "text-[#86EFAC] ring-[#86EFAC]/30" : "text-[#FDA4AF] ring-[#FDA4AF]/30"
                  )}
                >
                  <Seta className="size-3.5" />
                  {pct(Math.abs(r.comparacao.pct), 1)} {subiu ? "acima" : "abaixo"} {r.comparacao.rotulo}
                </span>
              )}
            </div>
            <p className="mt-3 text-sm leading-relaxed text-white/75">
              {ehMes ? (
                <>
                  <strong className="text-white">{reais(p.ateHoje)}</strong> até hoje
                  {agendado > 0 && (
                    <>
                      {" "}+ <strong className="text-white">{reais(agendado)}</strong> já agendados até o fim do mês
                    </>
                  )}
                  . O mês passado fechou em {reais(p.anteriorTotal)}.
                  {r.anoPassado && (
                    <>
                      {" "}Em {r.anoPassado.rotulo}, foram {reais(r.anoPassado.valor)}.
                    </>
                  )}
                </>
              ) : (
                <>
                  {r.atendimentos} atendimento{r.atendimentos === 1 ? "" : "s"} cobrado{r.atendimentos === 1 ? "" : "s"} {r.quando}, ticket médio de{" "}
                  <strong className="text-white">{reais(r.ticketMedio)}</strong>.
                  {r.anoPassado && r.anoPassado.pct !== null && (
                    <>
                      {" "}Contra {r.anoPassado.rotulo}:{" "}
                      <strong className={r.anoPassado.pct >= 0 ? "text-[#86EFAC]" : "text-[#FDA4AF]"}>
                        {r.anoPassado.pct >= 0 ? "+" : "−"}
                        {pct(Math.abs(r.anoPassado.pct), 1)}
                      </strong>
                      .
                    </>
                  )}
                </>
              )}
            </p>

            {meta && metaPct !== null && (
              <div className="mt-5">
                <div className="flex items-baseline justify-between gap-3 text-xs text-white/75">
                  <span>Meta do mês</span>
                  <span>
                    <strong className="text-white">{pct(metaPct)}</strong> de {reais(meta)}
                  </span>
                </div>
                <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-white/15">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#5EEAD4] to-[#86EFAC]"
                    style={{ width: `${Math.min(metaPct, 100)}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-white/75">
                  {p.faturamentoMes >= meta ? (
                    <>Meta batida. Tudo o que entrar agora é acima do planejado.</>
                  ) : p.diasRestantes > 0 ? (
                    <>
                      Faltam <strong className="text-white">{reais(meta - p.faturamentoMes)}</strong> além do que já está agendado:{" "}
                      <strong className="text-white">{reais((meta - p.faturamentoMes) / p.diasRestantes)}</strong> por dia de atendimento nos{" "}
                      {p.diasRestantes} dia{p.diasRestantes === 1 ? "" : "s"} que restam.
                    </>
                  ) : (
                    <>Faltaram {reais(meta - p.faturamentoMes)} para a meta.</>
                  )}
                </p>
              </div>
            )}

            <dl className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {mini.map((x) => (
                <div key={x.r} className="min-w-0 rounded-xl bg-white/10 px-3 py-2.5 ring-1 ring-inset ring-white/10">
                  <dt className="text-[11px] font-medium text-white/70">{x.r}</dt>
                  <dd className="truncate font-heading text-base font-bold tabular-nums">{x.v}</dd>
                  {x.n && <dd className="text-[10px] text-white/60">{x.n}</dd>}
                </div>
              ))}
            </dl>
          </div>
        </section>

        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:col-span-2">
          <Indicador
            icone={CalendarCheck2}
            rotulo="Consultas hoje"
            valor={String(ativasHoje.length)}
            nota={proxima ? `${confHoje} · próxima às ${hora(proxima.data_hora)}` : confHoje}
          />
          <Indicador
            icone={CalendarClock}
            rotulo="Reservas · 30 dias"
            valor={String(p.reservas.quantidade)}
            nota={`${reais(p.reservas.valor)} previstos`}
            destaque
          />
          <Indicador icone={UserPlus} rotulo="Novos pacientes" valor={String(r.novosPacientes)} nota={`Primeiras consultas ${r.quando}`} />
          <Indicador
            icone={Receipt}
            rotulo="Ticket médio"
            valor={reais(r.ticketMedio)}
            nota="Por atendimento cobrado"
            serie={p.serieTicket.some((v) => v > 0) ? p.serieTicket : undefined}
            cor={COR.receita}
          />
        </div>
      </div>

      {/* Ritmo do mês + situação das consultas do período */}
      <div className="grid gap-5 lg:grid-cols-3">
        <Painel
          className="lg:col-span-2"
          titulo="Ritmo do faturamento no mês"
          descricao="Acumulado dia a dia: este mês contra o mês passado."
          acao={
            <Link href="/app/financeiro" className="inline-flex items-center gap-1 text-sm font-medium text-teal hover:underline">
              Financeiro <ArrowRight className="size-4" />
            </Link>
          }
        >
          {p.anteriorTotal || p.ateHoje ? (
            <LinhaArea
              rotulos={p.ritmo.map((d) => `dia ${d.dia}`)}
              series={[
                { nome: "Este mês", cor: COR.receita, valores: p.ritmo.slice(0, diaHoje).map((d) => d.atual ?? 0), area: true },
                { nome: "Mês passado", cor: COR.neutro, valores: p.ritmo.map((d) => d.anterior), tracejado: true },
              ]}
              altura={250}
              marcadorHoje={diaHoje - 1}
            />
          ) : (
            <Vazio texto="O ritmo aparece quando as primeiras receitas forem lançadas." />
          )}
        </Painel>
        <Painel titulo="Consultas" descricao={`${totalStatus} marcadas ${r.quando}`}>
          {totalStatus ? (
            <div className="grid gap-4">
              <Rosca
                itens={[
                  { nome: "Realizadas", valor: st.realizadas, cor: SERIES[0] },
                  { nome: "Confirmadas", valor: st.confirmadas, cor: SERIES[1] },
                  { nome: "A confirmar", valor: st.pendentes, cor: SERIES[4] },
                  { nome: "Faltaram", valor: st.faltas, cor: COR_FALTA },
                  { nome: "Canceladas", valor: st.canceladas, cor: COR.neutro },
                ]}
                centro={{ valor: String(totalStatus), rotulo: "consultas" }}
                formato="numero"
                tamanho={150}
              />
              <TaxaFaltas taxa={r.taxaFaltas} faltas={st.faltas} />
            </div>
          ) : (
            <Vazio texto={`Nenhuma consulta marcada ${r.quando}.`} />
          )}
        </Painel>
      </div>

      {/* Agenda reservada + próximos 7 dias */}
      <div className="grid gap-5 lg:grid-cols-3">
        <Painel
          className="lg:col-span-2"
          titulo="Agenda reservada · próximos 14 dias"
          descricao="Consultas já marcadas em cada dia."
          acao={
            <Link href="/app/agenda" className="inline-flex items-center gap-1 text-sm font-medium text-teal hover:underline">
              Agenda <ArrowRight className="size-4" />
            </Link>
          }
        >
          <BarrasAgrupadas
            categorias={p.proximos14.map((d) => d.rotulo)}
            barras={[
              { nome: "Confirmadas", cor: COR.receita, valores: p.proximos14.map((d) => d.confirmadas) },
              { nome: "A confirmar", cor: SERIES[4], valores: p.proximos14.map((d) => d.aConfirmar) },
            ]}
            destaque={0}
            formato="numero"
            altura={230}
          />
        </Painel>
        <Painel titulo="Próximos 7 dias" descricao="Ocupação da agenda e confirmações.">
          <div className="grid gap-5">
            {p.ocupacao ? (
              <div>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-cinza-texto">Ocupação da agenda</span>
                  <strong className="font-heading tabular-nums text-azul-medico">{pct(p.ocupacao.pct)}</strong>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[var(--g-trilho)]">
                  <div className="h-full rounded-full bg-teal" style={{ width: `${Math.min(Math.max(p.ocupacao.pct, 1), 100)}%` }} />
                </div>
                <p className="mt-1.5 text-xs text-cinza-suave">
                  {horas(p.ocupacao.horasMarcadas)} marcadas de {horas(p.ocupacao.horasDisponiveis)} de atendimento.
                </p>
                <ul className="mt-3 grid grid-cols-7 gap-1.5" aria-label="Ocupação por dia">
                  {p.ocupacao.porDia.map((d, i) => (
                    <li
                      key={i}
                      className="grid justify-items-center gap-1"
                      title={d.disponivel ? `${d.rotulo}: ${pct(d.pct)} ocupado` : `${d.rotulo}: sem atendimento`}
                    >
                      <span className="relative h-12 w-full max-w-6 overflow-hidden rounded-md bg-[var(--g-trilho)]">
                        {d.disponivel && (
                          <span className="absolute inset-x-0 bottom-0 rounded-md bg-teal" style={{ height: `${Math.max(d.pct, 4)}%` }} />
                        )}
                      </span>
                      <span className={cn("text-[10px]", i === 0 ? "font-semibold text-azul-medico" : "text-cinza-suave")}>{d.rotulo}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="rounded-lg bg-branco-clinico px-3 py-2.5 text-xs text-cinza-suave">
                Cadastre os horários de atendimento em{" "}
                <Link href="/app/disponibilidade" className="font-medium text-teal hover:underline">
                  Disponibilidade
                </Link>{" "}
                para ver a ocupação da agenda.
              </p>
            )}
            {marcadas7 ? (
              <div>
                <Medidor rotulo="Confirmadas" valor={confirmadas7} meta={marcadas7} formato="numero" />
                {aConfirmar7 > 0 && (
                  <Link
                    href="/app/confirmacoes"
                    className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-azul-medico hover:bg-branco-clinico"
                  >
                    Confirmar {aConfirmar7} paciente{aConfirmar7 === 1 ? "" : "s"} <ArrowRight className="size-4" />
                  </Link>
                )}
              </div>
            ) : (
              <p className="text-sm text-cinza-suave">Nenhuma consulta marcada para os próximos 7 dias.</p>
            )}
          </div>
        </Painel>
      </div>

      {/* Quem atende, por onde paga e o quê */}
      <div className="grid gap-5 lg:grid-cols-3">
        <Painel titulo="Faturamento por profissional" descricao={`${capitalizar(r.quando)}.`}>
          {r.porProfissional.length ? (
            <Ranking
              itens={r.porProfissional.map((x) => ({
                nome: nomes[x.medicoId] ?? "Profissional",
                valor: x.valor,
                detalhe: `${x.atendimentos} atend.`,
              }))}
              cor={SERIES[1]}
              limite={5}
            />
          ) : (
            <Vazio texto="Aparece quando as receitas tiverem o profissional que atendeu." />
          )}
        </Painel>
        <Painel titulo="Convênio × particular" descricao={`Faturamento ${r.quando}.`}>
          {r.convenios.length ? (
            <Rosca
              itens={coresConvenios(r.convenios)}
              centro={{ valor: pct(participacaoParticular(r.convenios)), rotulo: "particular" }}
              tamanho={140}
            />
          ) : (
            <Vazio texto={`Sem receitas ${r.quando}.`} />
          )}
        </Painel>
        <Painel titulo="Tipos de atendimento" descricao={`${tiposTotal} consultas ${r.quando}.`}>
          <TiposBarra tipos={r.tipos} total={tiposTotal} quando={r.quando} />
        </Painel>
      </div>
    </div>
  );
}

const capitalizar = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

function horas(h: number) {
  const inteiras = Math.floor(h);
  const min = Math.round((h - inteiras) * 60);
  return min ? `${inteiras}h${String(min).padStart(2, "0")}` : `${inteiras}h`;
}

/** Particular sempre na cor da receita; convênios seguem a ordem fixa da paleta. */
function coresConvenios(itens: { nome: string; valor: number }[]) {
  const ordem = [SERIES[1], SERIES[3], SERIES[2], SERIES[4], SERIES[5]];
  let k = 0;
  return itens.map((c) => ({ ...c, cor: c.nome === "Particular" ? SERIES[0] : ordem[k++ % ordem.length] }));
}

function participacaoParticular(itens: { nome: string; valor: number }[]) {
  const total = itens.reduce((s, i) => s + i.valor, 0);
  const part = itens.find((i) => i.nome === "Particular")?.valor ?? 0;
  return total ? (part / total) * 100 : 0;
}

function TaxaFaltas({ taxa, faltas }: { taxa: number | null; faltas: number }) {
  if (taxa === null) return null;
  if (!faltas)
    return (
      <p className="flex items-center gap-2 rounded-lg bg-branco-clinico px-3 py-2.5 text-sm text-cinza-texto">
        <UserX className="size-4 shrink-0 text-[#7C3AED]" /> Nenhuma falta. Todos os pacientes vieram.
      </p>
    );
  const alta = taxa > FALTAS_ALERTA;
  const Icone = alta ? AlertTriangle : UserX;
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-lg px-3 py-2.5 text-sm",
        alta ? "bg-[#FFF4E5] text-[#9A5B00]" : "bg-branco-clinico text-cinza-texto"
      )}
    >
      <Icone className={cn("mt-0.5 size-4 shrink-0", alta ? "text-[#D97706]" : "text-[#7C3AED]")} />
      <p>
        <strong className="tabular-nums">{pct(taxa, 1)}</strong> de faltas
        <span className={alta ? undefined : "text-cinza-suave"}>
          {" "}· {faltas} paciente{faltas === 1 ? "" : "s"} não {faltas === 1 ? "veio" : "vieram"}
          {alta ? ". Vale reforçar os lembretes." : "."}
        </span>
      </p>
    </div>
  );
}

function Vazio({ texto }: { texto: string }) {
  return <p className="grid min-h-32 place-items-center px-4 text-center text-sm text-cinza-suave">{texto}</p>;
}

function TiposBarra({ tipos, total, quando }: { tipos: PainelNumeros["recorte"]["tipos"]; total: number; quando: string }) {
  const itens = [
    { nome: "Primeira consulta", valor: tipos.primeira, cor: SERIES[3] },
    { nome: "Retorno", valor: tipos.retorno, cor: SERIES[0] },
    { nome: "Teleconsulta", valor: tipos.teleconsulta, cor: SERIES[1] },
  ];
  if (!total) return <Vazio texto={`Sem consultas ${quando}.`} />;
  return (
    <div>
      <div className="flex h-3 gap-0.5 overflow-hidden rounded-full">
        {itens
          .filter((i) => i.valor > 0)
          .map((i) => (
            <div key={i.nome} title={`${i.nome}: ${i.valor}`} style={{ width: `${(i.valor / total) * 100}%`, background: i.cor }} />
          ))}
      </div>
      <ul className="mt-4 grid gap-2 text-sm">
        {itens.map((i) => (
          <li key={i.nome} className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-2 text-cinza-texto">
              <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: i.cor }} />
              <span className="truncate">{i.nome}</span>
            </span>
            <span className="shrink-0 tabular-nums text-cinza-suave">
              <strong className="text-cinza-texto">{i.valor}</strong> · {pct((i.valor / total) * 100)}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-4 flex items-center gap-1.5 text-xs text-cinza-suave">
        <Sparkles className="size-3.5 shrink-0 text-teal" />
        {pct((tipos.primeira / total) * 100)} das consultas são de pacientes novos.
      </p>
    </div>
  );
}
