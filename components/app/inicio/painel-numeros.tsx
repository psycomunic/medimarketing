import Link from "next/link";
import { ArrowDownRight, ArrowRight, ArrowUpRight, CalendarCheck2, CalendarClock, Receipt, Sparkles, UserPlus } from "lucide-react";
import type { PainelNumeros } from "@/lib/inicio/dados";
import type { Consulta } from "@/lib/supabase/types";
import { BarrasAgrupadas, LinhaArea, Medidor, Ranking, Rosca } from "@/components/graficos/graficos";
import { COR, SERIES, pct, reais } from "@/components/graficos/formato";
import { Indicador, Painel } from "@/components/app/financeiro/ui";
import { cn } from "@/lib/utils";

const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

/**
 * Painel principal do dono da clínica: o mês e o dia em números, o ritmo
 * do faturamento contra o mês anterior e a agenda já reservada.
 */
export function PainelDeNumeros({
  p,
  hoje,
  meta,
  lucro,
  margem,
  nomes,
}: {
  p: PainelNumeros;
  hoje: Consulta[];
  meta: number | null;
  lucro: number | null;
  margem: number | null;
  nomes: Record<string, string>;
}) {
  const ritmoPct = p.anteriorMesmoDia ? ((p.ateHoje - p.anteriorMesmoDia) / p.anteriorMesmoDia) * 100 : null;
  const diaHoje = p.ritmo.filter((d) => d.atual !== null).length;
  const agendado = Math.max(p.faturamentoMes - p.ateHoje, 0);
  const metaPct = meta ? (p.faturamentoMes / meta) * 100 : null;
  const totalStatus = p.status.confirmadas + p.status.pendentes + p.status.realizadas + p.status.canceladas;
  const mesNome = new Date().toLocaleDateString("pt-BR", { month: "long", timeZone: "America/Sao_Paulo" });
  const Seta = ritmoPct === null || ritmoPct >= 0 ? ArrowUpRight : ArrowDownRight;

  const ativasHoje = hoje.filter((c) => c.status !== "cancelada");
  const confirmadasHoje = ativasHoje.filter((c) => c.status === "confirmada" || c.status === "realizada").length;
  const agora = Date.now();
  const proxima = ativasHoje
    .filter((c) => new Date(c.data_hora).getTime() >= agora && c.status !== "realizada")
    .sort((a, b) => a.data_hora.localeCompare(b.data_hora))[0];

  const semana = p.proximos14.slice(0, 7);
  const marcadas7 = semana.reduce((s, d) => s + d.confirmadas + d.aConfirmar, 0);
  const confirmadas7 = semana.reduce((s, d) => s + d.confirmadas, 0);
  const tiposTotal = p.tipos.primeira + p.tipos.retorno + p.tipos.teleconsulta;
  const confHoje = `${confirmadasHoje} confirmada${confirmadasHoje === 1 ? "" : "s"}`;

  const mini: { r: string; v: string; n?: string }[] = [
    { r: "Hoje", v: reais(p.faturamentoHoje) },
    { r: "Recebido", v: reais(p.recebidoMes) },
    { r: "A receber", v: reais(p.aReceberMes) },
    lucro !== null
      ? { r: "Lucro", v: reais(lucro), n: margem !== null ? `margem ${pct(margem, 1)}` : undefined }
      : { r: "Ticket médio", v: reais(p.ticketMedio) },
  ];

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      {/* Destaque do mês e números do dia */}
      <div className="grid gap-5 xl:grid-cols-5">
        <section className="relative min-w-0 overflow-hidden rounded-2xl bg-gradient-to-br from-azul-profundo via-azul-medico to-[#0E6A7E] p-5 text-white shadow-card sm:p-6 xl:col-span-3">
          <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full bg-teal/30 blur-3xl" />
          <div aria-hidden className="pointer-events-none absolute -bottom-24 left-1/3 size-56 rounded-full bg-white/5 blur-2xl" />
          <div className="relative">
            <p className="text-xs font-semibold uppercase tracking-wider text-white/70">Faturamento de {mesNome}</p>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
              <p className="font-heading text-[2.5rem] font-bold leading-none tabular-nums sm:text-5xl">{reais(p.faturamentoMes)}</p>
              {ritmoPct !== null && (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
                    ritmoPct >= 0 ? "bg-white/10 text-[#86EFAC] ring-1 ring-inset ring-[#86EFAC]/30" : "bg-white/10 text-[#FDA4AF] ring-1 ring-inset ring-[#FDA4AF]/30"
                  )}
                >
                  <Seta className="size-3.5" />
                  {pct(Math.abs(ritmoPct), 1)} {ritmoPct >= 0 ? "acima" : "abaixo"} do mesmo dia do mês passado
                </span>
              )}
            </div>
            <p className="mt-3 text-sm leading-relaxed text-white/75">
              <strong className="text-white">{reais(p.ateHoje)}</strong> até hoje
              {agendado > 0 && (
                <>
                  {" "}+ <strong className="text-white">{reais(agendado)}</strong> já agendados até o fim do mês
                </>
              )}
              . O mês passado fechou em {reais(p.anteriorTotal)}.
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
          <Indicador icone={UserPlus} rotulo="Novos pacientes" valor={String(p.novosPacientes)} nota="Primeiras consultas no mês" />
          <Indicador
            icone={Receipt}
            rotulo="Ticket médio"
            valor={reais(p.ticketMedio)}
            nota="Por atendimento cobrado"
            serie={p.serieTicket.some((v) => v > 0) ? p.serieTicket : undefined}
            cor={COR.receita}
          />
        </div>
      </div>

      {/* Ritmo do faturamento + situação das consultas */}
      <div className="grid gap-5 lg:grid-cols-3">
        <Painel
          className="lg:col-span-2"
          titulo="Ritmo do faturamento"
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
        <Painel titulo="Consultas do mês" descricao={`${totalStatus} marcadas em ${mesNome}`}>
          {totalStatus ? (
            <Rosca
              itens={[
                { nome: "Realizadas", valor: p.status.realizadas, cor: SERIES[0] },
                { nome: "Confirmadas", valor: p.status.confirmadas, cor: SERIES[1] },
                { nome: "A confirmar", valor: p.status.pendentes, cor: SERIES[4] },
                { nome: "Canceladas", valor: p.status.canceladas, cor: COR.neutro },
              ]}
              centro={{ valor: String(totalStatus), rotulo: "consultas" }}
              formato="numero"
              tamanho={150}
            />
          ) : (
            <Vazio texto="Nenhuma consulta marcada neste mês ainda." />
          )}
        </Painel>
      </div>

      {/* Agenda reservada + confirmação da semana */}
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
        <Painel titulo="Confirmação da semana" descricao="Próximos 7 dias, contando hoje.">
          {marcadas7 ? (
            <div className="grid gap-4">
              <Medidor rotulo="Confirmadas" valor={confirmadas7} meta={marcadas7} formato="numero" />
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg bg-branco-clinico px-3 py-2">
                  <dt className="text-xs text-cinza-suave">Marcadas</dt>
                  <dd className="font-heading text-lg font-bold tabular-nums text-azul-medico">{marcadas7}</dd>
                </div>
                <div className="rounded-lg bg-branco-clinico px-3 py-2">
                  <dt className="text-xs text-cinza-suave">A confirmar</dt>
                  <dd className="font-heading text-lg font-bold tabular-nums text-azul-medico">{marcadas7 - confirmadas7}</dd>
                </div>
              </dl>
              {marcadas7 - confirmadas7 > 0 && (
                <Link
                  href="/app/agenda"
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-azul-medico hover:bg-branco-clinico"
                >
                  Confirmar pacientes <ArrowRight className="size-4" />
                </Link>
              )}
            </div>
          ) : (
            <Vazio texto="Nenhuma consulta marcada para os próximos 7 dias." />
          )}
        </Painel>
      </div>

      {/* Quem atende e o quê */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Painel titulo="Faturamento por profissional" descricao={`Em ${mesNome}.`}>
          {p.porProfissional.length ? (
            <Ranking
              itens={p.porProfissional.map((x) => ({
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
        <Painel titulo="Tipos de atendimento" descricao={`${tiposTotal} consultas em ${mesNome}.`}>
          <TiposBarra tipos={p.tipos} total={tiposTotal} />
        </Painel>
      </div>
    </div>
  );
}

function Vazio({ texto }: { texto: string }) {
  return <p className="grid min-h-32 place-items-center px-4 text-center text-sm text-cinza-suave">{texto}</p>;
}

function TiposBarra({ tipos, total }: { tipos: PainelNumeros["tipos"]; total: number }) {
  const itens = [
    { nome: "Primeira consulta", valor: tipos.primeira, cor: SERIES[3] },
    { nome: "Retorno", valor: tipos.retorno, cor: SERIES[0] },
    { nome: "Teleconsulta", valor: tipos.teleconsulta, cor: SERIES[1] },
  ];
  if (!total) return <Vazio texto="Sem consultas no mês ainda." />;
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
        {pct((tipos.primeira / total) * 100)} das consultas do mês são de pacientes novos.
      </p>
    </div>
  );
}
