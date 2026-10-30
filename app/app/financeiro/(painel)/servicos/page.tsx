import { Suspense } from "react";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, CalendarClock, Crown, Flame, Info, Receipt, Sheet } from "lucide-react";
import { exigirModulo } from "@/lib/acesso";
import { lerFiltro, PERIODOS } from "@/lib/inicio/painel";
import { carregarServicos } from "@/lib/financeiro/servicos-dados";
import { SEM_SERVICO, type LinhaServico, type Matriz } from "@/lib/financeiro/servicos-analise";
import { BarrasAgrupadas, LinhaArea, Ranking } from "@/components/graficos/graficos";
import { COR, SERIES, pct, reais } from "@/components/graficos/formato";
import { Indicador, Painel } from "@/components/app/financeiro/ui";
import { FiltroPeriodo } from "@/components/app/filtro-periodo";
import { cn } from "@/lib/utils";

export const metadata = { title: "Serviços · Financeiro" };

const ORDENS = {
  faturamento: { rotulo: "Faturamento", f: (l: LinhaServico) => l.faturamento },
  procura: { rotulo: "Procura", f: (l: LinhaServico) => l.marcadas },
  ticket: { rotulo: "Ticket", f: (l: LinhaServico) => l.ticket },
  margem: { rotulo: "Margem", f: (l: LinhaServico) => l.margem ?? -1 },
  crescimento: { rotulo: "Crescimento", f: (l: LinhaServico) => l.variacao ?? -Infinity },
} as const;
type Ordem = keyof typeof ORDENS;

const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export default async function ServicosPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const { organizacao } = await exigirModulo("financeiro");
  const filtro = lerFiltro(searchParams);
  const { analise: a, intervalo, profissionais, profissional } = await carregarServicos(organizacao?.id ?? null, filtro);
  const ordemBruta = typeof searchParams.ordem === "string" ? searchParams.ordem : "";
  const ordem: Ordem = ordemBruta in ORDENS ? (ordemBruta as Ordem) : "faturamento";
  const linhas = [...a.linhas].sort((x, y) => ORDENS[ordem].f(y) - ORDENS[ordem].f(x));
  const comServico = a.linhas.filter((l) => l.chave !== SEM_SERVICO);
  const maisFatura = comServico.find((l) => l.faturamento > 0) ?? null;
  const maisProcurado = [...comServico].sort((x, y) => y.marcadas - x.marcadas)[0];
  const quando = intervalo.quando;

  // Links que mantêm o filtro
  const qs = (mudar: Record<string, string | null>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams)) if (typeof v === "string" && v) p.set(k, v);
    for (const [k, v] of Object.entries(mudar)) (v ? p.set(k, v) : p.delete(k));
    return p.size ? `?${p}` : "";
  };

  const semTabela = !comServico.some((l) => l.naTabela);
  const portas = comServico.filter((l) => l.novos > 0).sort((x, y) => y.novos - x.novos);
  const rotuloMes = (m: string) => `${MESES[Number(m.slice(5, 7)) - 1]}/${m.slice(2, 4)}`;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-lg font-semibold text-azul-medico">Serviços</h2>
          <p className="text-sm text-cinza-suave">Procura e faturamento de cada serviço da Tabela de preços, {quando}.</p>
        </div>
        <a
          href={`/app/financeiro/exportar-servicos${qs({ ordem: null })}`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-azul-medico transition-colors hover:border-teal hover:text-teal"
        >
          <Sheet className="size-4" /> Planilha
        </a>
      </div>
      <Suspense fallback={<div className="h-10 w-80 rounded-full border border-border bg-white" />}>
        <FiltroPeriodo
          periodos={PERIODOS}
          padrao="mes"
          atual={filtro}
          profissionais={profissionais}
          profissional={profissional ?? undefined}
        />
      </Suspense>

      {semTabela && (
        <p className="flex items-start gap-2 rounded-lg border border-alerta/40 bg-alerta/8 px-4 py-3 text-sm text-cinza-texto">
          <Info className="mt-0.5 size-4 shrink-0 text-alerta" />
          <span>
            Nenhum serviço na Tabela de preços ainda.{" "}
            <Link href="/app/financeiro/configuracoes" className="font-medium text-teal hover:underline">
              Cadastre os serviços
            </Link>{" "}
            para escolher na consulta e ver os números aqui.
          </span>
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Indicador
          icone={Crown}
          rotulo="Mais faturou"
          valor={maisFatura ? maisFatura.nome : "—"}
          nota={maisFatura ? `${reais(maisFatura.faturamento)} · ${pct(maisFatura.participacao)} do total` : `Sem faturamento ${quando}`}
          destaque
        />
        <Indicador
          icone={Flame}
          rotulo="Mais procurado"
          valor={maisProcurado && maisProcurado.marcadas ? maisProcurado.nome : "—"}
          nota={maisProcurado && maisProcurado.marcadas ? `${maisProcurado.marcadas} consulta${maisProcurado.marcadas === 1 ? "" : "s"} marcada${maisProcurado.marcadas === 1 ? "" : "s"}` : "Sem consultas com serviço"}
        />
        <Indicador
          icone={Receipt}
          rotulo="Faturamento dos serviços"
          valor={reais(a.faturamento)}
          nota={`Ticket médio ${reais(a.ticket)}${a.margem !== null ? ` · margem ${pct(a.margem)}` : ""}`}
        />
        <Indicador icone={CalendarClock} rotulo="Agendado · 30 dias" valor={String(a.futuras)} nota={`${reais(a.valorFuturo)} previstos`} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Painel titulo="Quanto cada serviço rende" descricao={`Faturamento ${quando}.`}>
          <Ranking itens={comServico.filter((l) => l.faturamento > 0).map((l) => ({ nome: l.nome, valor: l.faturamento, detalhe: pct(l.participacao) }))} />
        </Painel>
        <Painel titulo="Os mais procurados" descricao={`Consultas marcadas ${quando}, sem as canceladas.`}>
          <Ranking
            cor={SERIES[1]}
            formato="numero"
            itens={comServico.filter((l) => l.marcadas > 0).map((l) => ({ nome: l.nome, valor: l.marcadas, detalhe: `${l.realizadas} realizada${l.realizadas === 1 ? "" : "s"}` }))}
          />
        </Painel>
      </div>

      {/* Tabela completa */}
      <Painel
        titulo="Todos os serviços"
        descricao={
          a.semServico > 0
            ? `${a.semServico} consulta${a.semServico === 1 ? "" : "s"} do período sem serviço definido (marcadas antes desta função ou como "outro serviço").`
            : "Serviços sem movimento também aparecem: mostram o que não está vendendo."
        }
        corpo="p-0"
      >
        <div className="flex flex-wrap items-center gap-1.5 border-b border-border px-5 py-2.5 text-xs">
          <span className="text-cinza-suave">Ordenar por</span>
          {(Object.keys(ORDENS) as Ordem[]).map((o) => (
            <Link
              key={o}
              href={qs({ ordem: o === "faturamento" ? null : o })}
              scroll={false}
              className={cn(
                "rounded-full px-2.5 py-1 font-semibold transition-colors",
                o === ordem ? "bg-azul-medico text-white" : "bg-branco-clinico text-cinza-suave hover:text-azul-medico"
              )}
            >
              {ORDENS[o].rotulo}
            </Link>
          ))}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-cinza-suave">
                <th className="px-5 py-2.5 font-semibold">Serviço</th>
                <th className="px-2 py-2.5 text-right font-semibold">Procura</th>
                <th className="px-2 py-2.5 text-right font-semibold">Faltas</th>
                <th className="px-2 py-2.5 text-right font-semibold">Faturamento</th>
                <th className="w-32 px-2 py-2.5 font-semibold">Do total</th>
                <th className="px-2 py-2.5 text-right font-semibold">Ticket real</th>
                <th className="px-2 py-2.5 text-right font-semibold">Margem</th>
                <th className="px-5 py-2.5 text-right font-semibold">Agendado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {linhas.map((l) => {
                const parado = l.marcadas === 0 && l.faturamento === 0;
                return (
                  <tr key={l.chave} className={cn(parado && "text-cinza-suave")}>
                    <td className="px-5 py-2.5">
                      <span className={cn("font-medium", parado ? "text-cinza-suave" : "text-cinza-texto", l.chave === SEM_SERVICO && "italic")}>{l.nome}</span>
                      <span className="block text-xs text-cinza-suave">
                        {l.chave === SEM_SERVICO ? "Consultas e receitas sem serviço" : [l.categoria, l.precoTabela ? `tabela ${l.precoTabela}` : null, !l.naTabela ? "fora da tabela" : null].filter(Boolean).join(" · ")}
                      </span>
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums">
                      <span className="font-semibold text-cinza-texto">{l.marcadas}</span>
                      <span className="block text-xs text-cinza-suave">{l.realizadas} realizada{l.realizadas === 1 ? "" : "s"}</span>
                    </td>
                    <td className={cn("px-2 py-2.5 text-right tabular-nums", (l.taxaFaltas ?? 0) > 10 ? "font-semibold text-[#B45309]" : "text-cinza-suave")}>
                      {l.taxaFaltas !== null ? pct(l.taxaFaltas) : "—"}
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums">
                      <span className="font-semibold text-azul-medico">{reais(l.faturamento)}</span>
                      {l.variacao !== null && (
                        <span className={cn("flex items-center justify-end gap-0.5 text-xs font-medium", l.variacao >= 0 ? "text-[#15803D]" : "text-[#B91C1C]")}>
                          {l.variacao >= 0 ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
                          {pct(Math.abs(l.variacao))}
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--g-trilho)]">
                          <div className="h-full rounded-full bg-teal" style={{ width: `${Math.min(l.participacao, 100)}%` }} />
                        </div>
                        <span className="w-10 text-right text-xs tabular-nums text-cinza-suave">{pct(l.participacao)}</span>
                      </div>
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums text-cinza-texto">{l.atendimentos ? reais(l.ticket) : "—"}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums text-cinza-texto">{l.margem !== null ? pct(l.margem) : "—"}</td>
                    <td className="px-5 py-2.5 text-right tabular-nums">
                      <span className="text-cinza-texto">{l.futuras || "—"}</span>
                      {l.valorFuturo > 0 && <span className="block text-xs text-cinza-suave">{reais(l.valorFuturo)}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="border-t border-border px-5 py-2.5 text-xs text-cinza-suave">
          Procura: consultas marcadas no período, sem as canceladas. Faltas: de quem devia ter vindo, quantos não vieram. Ticket real: o
          faturamento dividido pelos atendimentos cobrados. A margem usa o custo direto da tabela. Agendado: os próximos 30 dias.
        </p>
      </Painel>

      {a.mensal.series.length > 0 && (
        <Painel titulo="Evolução dos principais serviços" descricao="Faturamento mês a mês, nos 12 meses até o fim do período.">
          <LinhaArea
            rotulos={a.mensal.meses.map(rotuloMes)}
            series={a.mensal.series.map((s, i) => ({ nome: s.nome, cor: SERIES[i % SERIES.length], valores: s.valores }))}
            altura={260}
          />
        </Painel>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <Painel titulo="Dias de maior procura" descricao={`Consultas marcadas por dia da semana, ${quando}.`}>
          <BarrasAgrupadas
            categorias={DIAS}
            barras={[{ nome: "Consultas", cor: COR.receita, valores: a.porDiaSemana }]}
            formato="numero"
            altura={220}
          />
        </Painel>
        <Painel titulo="Horários de maior procura" descricao={`Consultas marcadas por hora de início, ${quando}.`}>
          {a.porHora.length ? (
            <BarrasAgrupadas
              categorias={a.porHora.map((h) => `${h.hora}h`)}
              barras={[{ nome: "Consultas", cor: SERIES[1], valores: a.porHora.map((h) => h.n) }]}
              formato="numero"
              altura={220}
            />
          ) : (
            <p className="text-sm text-cinza-suave">Sem consultas no período.</p>
          )}
        </Painel>
      </div>

      <Painel
        titulo="Porta de entrada"
        descricao="Por qual serviço os pacientes novos chegam, e quantos dos que já foram atendidos marcaram de novo."
        corpo="p-0"
      >
        {portas.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-cinza-suave">
                  <th className="px-5 py-2.5 font-semibold">Serviço</th>
                  <th className="px-2 py-2.5 text-right font-semibold">Pacientes novos</th>
                  <th className="px-2 py-2.5 text-right font-semibold">Voltaram</th>
                  <th className="px-5 py-2.5 font-semibold">Voltaram para</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {portas.map((l) => (
                  <tr key={l.chave}>
                    <td className="px-5 py-2.5 font-medium text-cinza-texto">{l.nome}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums text-cinza-texto">{l.novos}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums">
                      {l.novosAtendidos ? (
                        <>
                          <span className="font-semibold text-azul-medico">{pct((l.voltaram / l.novosAtendidos) * 100)}</span>
                          <span className="block text-xs text-cinza-suave">
                            {l.voltaram} de {l.novosAtendidos} atendido{l.novosAtendidos === 1 ? "" : "s"}
                          </span>
                        </>
                      ) : (
                        <span className="text-xs text-cinza-suave">ainda não atendidos</span>
                      )}
                    </td>
                    <td className="px-5 py-2.5 text-cinza-texto">{l.depois ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-5 py-6 text-sm text-cinza-suave">Nenhuma primeira consulta com serviço {quando}.</p>
        )}
      </Painel>

      <div className="grid gap-5 xl:grid-cols-2">
        <TabelaMatriz titulo="Por profissional" descricao="Faturamento de cada serviço por quem atendeu." m={a.porProfissional} />
        <TabelaMatriz titulo="Por convênio" descricao="Faturamento de cada serviço por forma de cobrança." m={a.porConvenio} />
      </div>
    </div>
  );
}

function TabelaMatriz({ titulo, descricao, m }: { titulo: string; descricao: string; m: Matriz }) {
  return (
    <Painel titulo={titulo} descricao={descricao} corpo="p-0">
      {m.linhas.length && m.colunas.length ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth: `${200 + m.colunas.length * 110}px` }}>
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-cinza-suave">
                <th className="px-5 py-2.5 font-semibold">Serviço</th>
                {m.colunas.map((c) => (
                  <th key={c} className="px-2 py-2.5 text-right font-semibold normal-case">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {m.linhas.map((l) => {
                const max = Math.max(...l.valores, 1);
                return (
                  <tr key={l.nome}>
                    <td className="px-5 py-2 font-medium text-cinza-texto">{l.nome}</td>
                    {l.valores.map((v, i) => (
                      <td key={i} className="px-2 py-2 text-right tabular-nums">
                        {v > 0 ? (
                          <span
                            className="rounded px-1.5 py-0.5 text-cinza-texto"
                            // Mais forte onde o serviço mais fatura
                            style={{ backgroundColor: `color-mix(in srgb, #1A9E8F ${Math.round((v / max) * 22)}%, transparent)` }}
                          >
                            {reais(v)}
                          </span>
                        ) : (
                          <span className="text-cinza-suave/60">—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="px-5 py-6 text-sm text-cinza-suave">Sem faturamento no período.</p>
      )}
    </Painel>
  );
}
