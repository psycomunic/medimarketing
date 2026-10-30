import { Suspense } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Banknote,
  CircleDollarSign,
  Eye,
  Info,
  Megaphone,
  MessageCircle,
  MousePointerClick,
  Plug,
  Siren,
  Stethoscope,
  TrendingUp,
} from "lucide-react";
import { Campanhas } from "@/components/app/marketing/campanhas";
import { ImportarRelatorio, OrcamentoDialog } from "@/components/app/marketing/painel-ui";
import { FiltroPeriodo } from "@/components/app/filtro-periodo";
import { Indicador, Painel } from "@/components/app/financeiro/ui";
import { BarrasAgrupadas, LinhaArea, Minigrafico } from "@/components/graficos/graficos";
import { COR, SERIES, pct, reais } from "@/components/graficos/formato";
import { exigirModulo } from "@/lib/acesso";
import { emModoDemo } from "@/lib/supabase/queries";
import { getCampanhas } from "@/lib/supabase/marketing";
import { lerFiltro, PERIODOS } from "@/lib/inicio/painel";
import { montarPainelMidia, PLATAFORMAS, type LinhaCampanha, type Plataforma, type Totais } from "@/lib/marketing/painel";
import { cn } from "@/lib/utils";

export const metadata = { title: "Marketing" };

const NOME: Record<Plataforma, string> = { meta: "Meta Ads", google: "Google Ads" };
/** Cor fixa de cada plataforma nos gráficos. */
const COR_PLAT: Record<Plataforma, string> = { meta: SERIES[1], google: SERIES[4] };
const SELO: Record<Plataforma, string> = { meta: "bg-[#EAF2FC] text-[#1D5FAE]", google: "bg-[#FEF4E2] text-[#B45309]" };

const ORDENS = {
  investimento: { r: "Investimento", f: (c: LinhaCampanha) => c.totais.investimento },
  contatos: { r: "Contatos", f: (c: LinhaCampanha) => c.totais.contatos },
  cpl: { r: "Custo por contato", f: (c: LinhaCampanha) => (c.totais.contatos ? -c.totais.cpl : -Infinity) },
  ctr: { r: "CTR", f: (c: LinhaCampanha) => c.totais.ctr },
} as const;
type Ordem = keyof typeof ORDENS;

const num = (v: number) => Math.round(v).toLocaleString("pt-BR");
const variacao = (atual: number, antes: number) => (antes > 0 ? ((atual - antes) / antes) * 100 : null);

export default async function MarketingPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const { organizacao, role } = await exigirModulo("marketing");
  const orgId = organizacao?.id ?? null;
  const podeEditar = role === "gestor" || role === "super_admin";
  const filtro = lerFiltro(searchParams);
  const um = (k: string) => (typeof searchParams[k] === "string" ? (searchParams[k] as string) : "");
  const plataforma = (PLATAFORMAS as string[]).includes(um("plataforma")) ? (um("plataforma") as Plataforma) : null;
  const ordem: Ordem = um("ordem") in ORDENS ? (um("ordem") as Ordem) : "investimento";

  const [p, campanhasManuais, demo] = await Promise.all([montarPainelMidia(orgId, filtro, plataforma), getCampanhas(orgId), emModoDemo()]);
  const t = p.totais;
  const c = p.comparacao;
  const v = (f: (x: Totais) => number) => (c ? variacao(f(c.atual), f(c.anterior)) : null);
  const at = p.atribuicao.total;
  const quando = p.intervalo.quando;
  const campanhas = [...p.campanhas].sort((x, y) => ORDENS[ordem].f(y) - ORDENS[ordem].f(x));
  const comContato = p.campanhas.filter((x) => x.totais.contatos >= 3);
  const melhor = comContato.length > 1 ? comContato.reduce((m, x) => (x.totais.cpl < m.totais.cpl ? x : m)) : null;
  const pior = comContato.length > 1 ? comContato.reduce((m, x) => (x.totais.cpl > m.totais.cpl ? x : m)) : null;
  const visiveis = plataforma ? [plataforma] : PLATAFORMAS;

  const qs = (mudar: Record<string, string | null>) => {
    const q = new URLSearchParams();
    for (const [k, val] of Object.entries(searchParams)) if (typeof val === "string" && val) q.set(k, val);
    for (const [k, val] of Object.entries(mudar)) (val ? q.set(k, val) : q.delete(k));
    return q.size ? `?${q}` : "";
  };
  const rotuloDia = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

  return (
    <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] gap-6 px-4 py-8 sm:px-5 md:px-8 md:py-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-verde-menta text-teal">
            <Megaphone className="size-6" />
          </span>
          <div>
            <h1 className="text-2xl md:text-3xl">Marketing</h1>
            <p className="mt-1 max-w-2xl text-cinza-suave">
              Meta Ads e Google Ads num painel só: quanto foi investido, quantos contatos vieram e quanto isso virou de paciente e de faturamento.
            </p>
          </div>
        </div>
        {podeEditar && (
          <div className="flex flex-wrap gap-2">
            <OrcamentoDialog
              organizationId={orgId ?? undefined}
              mes={p.orcamento.mes}
              atual={Object.fromEntries(PLATAFORMAS.map((x) => [x, p.orcamento.linhas.find((l) => l.plataforma === x)?.orcado ?? 0])) as Record<Plataforma, number>}
              demo={demo}
            />
            <ImportarRelatorio organizationId={orgId ?? undefined} demo={demo} />
          </div>
        )}
      </header>

      <p className="flex flex-wrap items-center gap-2 rounded-md border border-dashed border-border bg-white px-4 py-3 text-sm text-cinza-suave">
        <Plug className="size-4 shrink-0 text-teal" />
        {p.ultimaData
          ? `Dados até ${rotuloDia(p.ultimaData)}/${p.ultimaData.slice(0, 4)}, pelos relatórios importados.`
          : "Por enquanto os números chegam pelo relatório exportado do Meta e do Google."}{" "}
        A conexão direta pela BM e pelo MCC da Medi Marketing vem na próxima etapa.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <Suspense fallback={<div className="h-10 w-80 rounded-full border border-border bg-white" />}>
          <FiltroPeriodo periodos={PERIODOS} padrao="mes" atual={filtro} />
        </Suspense>
        <nav aria-label="Plataforma" className="inline-flex rounded-full border border-border bg-white p-1 shadow-soft">
          {[null, ...PLATAFORMAS].map((x) => (
            <Link
              key={x ?? "todas"}
              href={`/app/marketing${qs({ plataforma: x })}`}
              scroll={false}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors sm:text-sm",
                x === plataforma ? "bg-azul-medico text-white" : "text-cinza-suave hover:text-azul-medico"
              )}
            >
              {x ? NOME[x] : "Todas"}
            </Link>
          ))}
        </nav>
      </div>

      {!p.temDados ? (
        <div className="rounded-xl border border-border bg-white px-6 py-12 text-center shadow-soft">
          <Megaphone className="mx-auto size-10 text-teal" />
          <p className="mt-3 font-heading text-lg font-semibold text-azul-medico">Nenhum relatório importado ainda</p>
          <p className="mx-auto mt-1 max-w-lg text-sm text-cinza-suave">
            Exporte o relatório de campanhas do Gerenciador de Anúncios (Meta) e do Google Ads, dividido por dia, e importe aqui. O painel
            monta investimento, contatos, custos, orçamento e o caminho até o faturamento.
          </p>
          {podeEditar && (
            <div className="mt-5 flex justify-center">
              <ImportarRelatorio organizationId={orgId ?? undefined} demo={demo} />
            </div>
          )}
        </div>
      ) : (
        <>
          {p.alertas.length > 0 && (
            <ul className="grid gap-2">
              {p.alertas.map((a) => (
                <li
                  key={a.texto}
                  className={cn(
                    "flex items-start gap-2 rounded-lg border px-4 py-2.5 text-sm",
                    a.tom === "critico" ? "border-coral/40 bg-coral/5 text-cinza-texto" : a.tom === "atencao" ? "border-alerta/40 bg-alerta/8 text-cinza-texto" : "border-border bg-white text-cinza-suave"
                  )}
                >
                  {a.tom === "critico" ? <Siren className="mt-0.5 size-4 shrink-0 text-coral" /> : a.tom === "atencao" ? <AlertTriangle className="mt-0.5 size-4 shrink-0 text-alerta" /> : <Info className="mt-0.5 size-4 shrink-0 text-teal" />}
                  {a.texto}
                </li>
              ))}
            </ul>
          )}

          {/* Números principais */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Indicador icone={Banknote} rotulo="Investido" valor={reais(t.investimento)} variacao={v((x) => x.investimento)} inverter nota={quando} destaque />
            <Indicador
              icone={MessageCircle}
              rotulo="Contatos"
              valor={num(t.contatos)}
              variacao={v((x) => x.contatos)}
              nota={`${num(t.leads)} leads · ${num(t.conversas)} conversas no WhatsApp`}
            />
            <Indicador
              icone={CircleDollarSign}
              rotulo="Custo por contato"
              valor={t.contatos ? reais(t.cpl, true) : "—"}
              variacao={c && c.atual.contatos && c.anterior.contatos ? variacao(c.atual.cpl, c.anterior.cpl) : null}
              inverter
              nota="Investimento ÷ leads e conversas"
            />
            <Indicador
              icone={MousePointerClick}
              rotulo="Cliques"
              valor={num(t.cliques)}
              variacao={v((x) => x.cliques)}
              nota={`CTR ${pct(t.ctr, 2)} · CPC ${t.cliques ? reais(t.cpc, true) : "—"}`}
            />
            <Indicador icone={Eye} rotulo="Impressões" valor={num(t.impressoes)} variacao={v((x) => x.impressoes)} nota={`CPM ${t.impressoes ? reais(t.cpm, true) : "—"}${t.alcance ? ` · alcance ${num(t.alcance)}` : ""}`} />
            <Indicador icone={Stethoscope} rotulo="Pacientes atendidos" valor={num(at.atendidos)} nota={`${num(at.primeiras)} primeiras consultas marcadas`} />
            <Indicador icone={CircleDollarSign} rotulo="Custo por paciente" valor={at.custoPorPaciente ? reais(at.custoPorPaciente) : "—"} nota="Investimento ÷ pacientes atendidos" />
            <Indicador
              icone={TrendingUp}
              rotulo="Faturamento dos pacientes"
              valor={reais(at.faturamento)}
              nota={
                at.roas !== null
                  ? `O que pagaram no período os pacientes vindos dos anúncios: ${at.roas.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}× o investido`
                  : "Sem investimento no período"
              }
            />
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            <Painel className="lg:col-span-2" titulo="Investimento por dia" descricao={`Quanto foi gasto em cada plataforma, ${quando}.`}>
              <BarrasAgrupadas
                categorias={p.diario.datas.map(rotuloDia)}
                barras={visiveis.map((x) => ({ nome: NOME[x], cor: COR_PLAT[x], valores: p.diario.investimento[x] }))}
                altura={250}
              />
            </Painel>
            <Painel titulo="Orçamento do mês" descricao={`Dia ${p.orcamento.diasPassados} de ${p.orcamento.diasNoMes}. A projeção segue o ritmo dos dias com dados.`}>
              <ul className="grid gap-5">
                {p.orcamento.linhas.map((o) => {
                  const pctGasto = o.orcado ? (o.gasto / o.orcado) * 100 : 0;
                  const passa = o.orcado > 0 && o.projecao > o.orcado * 1.1;
                  return (
                    <li key={o.plataforma}>
                      <div className="flex items-baseline justify-between gap-2 text-sm">
                        <span className="font-medium text-cinza-texto">{NOME[o.plataforma]}</span>
                        <span className="tabular-nums text-cinza-suave">
                          <strong className="text-azul-medico">{reais(o.gasto)}</strong>
                          {o.orcado ? ` de ${reais(o.orcado)}` : ""}
                        </span>
                      </div>
                      <div className="relative mt-1.5 h-2.5 overflow-hidden rounded-full bg-[var(--g-trilho)]">
                        <div className="h-full rounded-full" style={{ width: `${Math.min(pctGasto, 100)}%`, background: COR_PLAT[o.plataforma] }} />
                        {o.orcado > 0 && (
                          <span
                            aria-hidden
                            className="absolute top-0 h-full w-0.5 bg-cinza-texto/60"
                            style={{ left: `${Math.min((p.orcamento.diasPassados / p.orcamento.diasNoMes) * 100, 100)}%` }}
                            title="Onde o gasto deveria estar hoje"
                          />
                        )}
                      </div>
                      <p className={cn("mt-1 text-xs", passa ? "font-semibold text-[#B45309]" : "text-cinza-suave")}>
                        {o.orcado ? `${pct(pctGasto)} usado · projeção ${reais(o.projecao)}` : o.gasto ? `Projeção ${reais(o.projecao)} · sem orçamento definido` : "Sem gasto no mês"}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </Painel>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <Painel titulo="Contatos por dia" descricao="Leads de formulário e conversas iniciadas no WhatsApp.">
              <BarrasAgrupadas
                categorias={p.diario.datas.map(rotuloDia)}
                barras={[{ nome: "Contatos", cor: COR.receita, valores: p.diario.contatos }]}
                formato="numero"
                altura={220}
              />
            </Painel>
            <Painel titulo="Custo por contato" descricao={p.cplSerie.rotulos.length > 0 && p.diario.datas.length > 21 ? "Por semana: quanto menor, melhor." : "Por dia: quanto menor, melhor."}>
              {/* Sem contato no dia, não há custo por contato: o ponto fica de fora */}
              <LinhaArea
                rotulos={p.cplSerie.rotulos.filter((_, i) => p.cplSerie.valores[i] !== null)}
                series={[{ nome: "Custo por contato", cor: COR.despesa, valores: p.cplSerie.valores.filter((x): x is number => x !== null), area: true }]}
                altura={220}
              />
            </Painel>
          </div>

          {/* Funil até o dinheiro */}
          <Painel titulo="Do anúncio ao faturamento" descricao={`O caminho completo ${quando}. Do CRM em diante contam os pacientes que vieram do Meta Ads ou do Google Ads.`}>
            <ol className="grid gap-2 sm:grid-cols-3 lg:grid-cols-7">
              {[
                { r: "Impressões", v: num(t.impressoes), taxa: null },
                { r: "Cliques", v: num(t.cliques), taxa: t.impressoes ? `${pct(t.ctr, 2)} das impressões` : null },
                { r: "Contatos", v: num(t.contatos), taxa: t.cliques ? `${pct((t.contatos / t.cliques) * 100, 1)} dos cliques` : null },
                { r: "Leads no CRM", v: num(at.leadsCrm), taxa: "registrados na equipe" },
                { r: "1ªs consultas", v: num(at.primeiras), taxa: at.leadsCrm ? `${pct((at.primeiras / at.leadsCrm) * 100, 0)} dos leads` : null },
                { r: "Atendidos", v: num(at.atendidos), taxa: at.primeiras ? `${pct((at.atendidos / at.primeiras) * 100, 0)} compareceram` : null },
                { r: "Faturamento", v: reais(at.faturamento), taxa: at.roas !== null ? `${at.roas.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}× o investido` : null },
              ].map((e, i) => (
                <li key={e.r} className={cn("rounded-lg border px-3 py-3", i === 6 ? "border-teal/40 bg-verde-menta/50" : "border-border bg-branco-clinico")}>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-cinza-suave">{e.r}</p>
                  <p className="mt-1 font-heading text-lg font-bold tabular-nums text-azul-medico">{e.v}</p>
                  {e.taxa && <p className="text-[11px] text-teal">{e.taxa}</p>}
                </li>
              ))}
            </ol>
          </Painel>

          {/* Meta x Google */}
          {!plataforma && (
            <Painel titulo="Meta Ads e Google Ads lado a lado" descricao={`Mesmo período, ${quando}.`} corpo="p-0">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-cinza-suave">
                      <th className="px-5 py-2.5 font-semibold" />
                      {PLATAFORMAS.map((x) => (
                        <th key={x} className="px-5 py-2.5 text-right font-semibold">
                          <span className={cn("rounded-full px-2 py-0.5 normal-case tracking-normal", SELO[x])}>{NOME[x]}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {[
                      { r: "Investimento", f: (x: Plataforma) => reais(p.porPlataforma[x].investimento) },
                      { r: "Do total investido", f: (x: Plataforma) => pct(t.investimento ? (p.porPlataforma[x].investimento / t.investimento) * 100 : 0) },
                      { r: "Contatos", f: (x: Plataforma) => num(p.porPlataforma[x].contatos) },
                      { r: "Custo por contato", f: (x: Plataforma) => (p.porPlataforma[x].contatos ? reais(p.porPlataforma[x].cpl, true) : "—") },
                      { r: "CTR", f: (x: Plataforma) => pct(p.porPlataforma[x].ctr, 2) },
                      { r: "CPC", f: (x: Plataforma) => (p.porPlataforma[x].cliques ? reais(p.porPlataforma[x].cpc, true) : "—") },
                      { r: "Pacientes atendidos", f: (x: Plataforma) => num(p.atribuicao[x].atendidos) },
                      { r: "Custo por paciente", f: (x: Plataforma) => (p.atribuicao[x].custoPorPaciente ? reais(p.atribuicao[x].custoPorPaciente!) : "—") },
                      { r: "Faturamento dos pacientes", f: (x: Plataforma) => reais(p.atribuicao[x].faturamento) },
                      { r: "Retorno (faturamento ÷ investimento)", f: (x: Plataforma) => (p.atribuicao[x].roas !== null ? `${p.atribuicao[x].roas!.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}×` : "—") },
                    ].map((linha) => (
                      <tr key={linha.r}>
                        <td className="px-5 py-2.5 text-cinza-suave">{linha.r}</td>
                        {PLATAFORMAS.map((x) => (
                          <td key={x} className="px-5 py-2.5 text-right font-medium tabular-nums text-cinza-texto">
                            {linha.f(x)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Painel>
          )}

          {/* Campanhas */}
          <Painel titulo="Campanhas" descricao={`${campanhas.length} campanha${campanhas.length === 1 ? "" : "s"} com gasto ${quando}.`} corpo="p-0">
            <div className="flex flex-wrap items-center gap-1.5 border-b border-border px-5 py-2.5 text-xs">
              <span className="text-cinza-suave">Ordenar por</span>
              {(Object.keys(ORDENS) as Ordem[]).map((o) => (
                <Link
                  key={o}
                  href={`/app/marketing${qs({ ordem: o === "investimento" ? null : o })}`}
                  scroll={false}
                  className={cn("rounded-full px-2.5 py-1 font-semibold", o === ordem ? "bg-azul-medico text-white" : "bg-branco-clinico text-cinza-suave hover:text-azul-medico")}
                >
                  {ORDENS[o].r}
                </Link>
              ))}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-cinza-suave">
                    <th className="px-5 py-2.5 font-semibold">Campanha</th>
                    <th className="px-2 py-2.5 text-right font-semibold">Investido</th>
                    <th className="px-2 py-2.5 text-right font-semibold">Impressões</th>
                    <th className="px-2 py-2.5 text-right font-semibold">Cliques</th>
                    <th className="px-2 py-2.5 text-right font-semibold">CTR</th>
                    <th className="px-2 py-2.5 text-right font-semibold">CPC</th>
                    <th className="px-2 py-2.5 text-right font-semibold">Contatos</th>
                    <th className="px-2 py-2.5 text-right font-semibold">Custo/contato</th>
                    <th className="px-5 py-2.5 font-semibold">Gasto por dia</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {campanhas.map((x) => (
                    <tr key={`${x.plataforma}-${x.id}`} className={cn(x === melhor && "bg-verde-menta/30", x === pior && "bg-coral/5")}>
                      <td className="max-w-[18rem] px-5 py-2.5">
                        <span className="block truncate font-medium text-cinza-texto" title={x.nome}>
                          {x.nome}
                        </span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
                          <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-semibold", SELO[x.plataforma])}>{NOME[x.plataforma]}</span>
                          {x === melhor && <span className="text-[10px] font-semibold text-teal">menor custo por contato</span>}
                          {x === pior && <span className="text-[10px] font-semibold text-coral">maior custo por contato</span>}
                        </span>
                      </td>
                      <td className="px-2 py-2.5 text-right font-semibold tabular-nums text-azul-medico">{reais(x.totais.investimento)}</td>
                      <td className="px-2 py-2.5 text-right tabular-nums text-cinza-suave">{num(x.totais.impressoes)}</td>
                      <td className="px-2 py-2.5 text-right tabular-nums text-cinza-suave">{num(x.totais.cliques)}</td>
                      <td className="px-2 py-2.5 text-right tabular-nums text-cinza-suave">{pct(x.totais.ctr, 2)}</td>
                      <td className="px-2 py-2.5 text-right tabular-nums text-cinza-suave">{x.totais.cliques ? reais(x.totais.cpc, true) : "—"}</td>
                      <td className="px-2 py-2.5 text-right tabular-nums text-cinza-texto">{num(x.totais.contatos)}</td>
                      <td className="px-2 py-2.5 text-right tabular-nums">
                        <span className="font-semibold text-cinza-texto">{x.totais.contatos ? reais(x.totais.cpl, true) : "—"}</span>
                        {x.variacaoCpl !== null && (
                          <span className={cn("block text-[11px] font-medium", x.variacaoCpl <= 0 ? "text-[#15803D]" : "text-[#B91C1C]")}>
                            {x.variacaoCpl > 0 ? "+" : "−"}
                            {pct(Math.abs(x.variacaoCpl))}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-2.5">
                        <Minigrafico valores={x.serie} cor={COR_PLAT[x.plataforma]} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="border-t border-border px-5 py-2.5 text-xs text-cinza-suave">
              Contatos: leads de formulário e conversas iniciadas no WhatsApp (no Google, as conversões). A variação do custo por contato
              compara com o mesmo trecho do período anterior: verde é mais barato.
            </p>
          </Painel>
        </>
      )}

      {campanhasManuais.length > 0 && (
        <section className="grid gap-3">
          <div>
            <h2 className="font-heading text-lg font-semibold text-azul-medico">Campanhas lançadas à mão</h2>
            <p className="text-sm text-cinza-suave">O lançamento antigo, campanha por campanha. Com os relatórios importados, ele deixa de ser necessário.</p>
          </div>
          <Campanhas campanhas={campanhasManuais} organizationId={orgId} podeEditar={podeEditar} demo={demo} />
        </section>
      )}
    </div>
  );
}
