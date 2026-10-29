import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, FileDown, Landmark, PiggyBank, Sparkles, TriangleAlert } from "lucide-react";
import type { ComposicaoFinanceira, FechamentoFinanceiro } from "@/lib/supabase/types";
import type { LeituraHistorico } from "@/lib/financeiro/historico";
import { ROTULO_NATUREZA } from "@/lib/financeiro/historico";
import { mesCurto, mesLongo } from "@/lib/financeiro/calculos";
import { BarrasAgrupadas, Cascata, LinhaArea, Rosca } from "@/components/graficos/graficos";
import { COR, SERIES, pct, reais } from "@/components/graficos/formato";
import { Indicador, Painel, Vazio } from "./ui";
import { TabelaFechamentos } from "./fechamentos-ui";

const nomeMes = (m: string) => {
  const t = mesLongo(m).split(" de ")[0];
  return t.charAt(0).toUpperCase() + t.slice(1);
};
const sinal = (v: number) => `${v >= 0 ? "+" : "−"}${reais(Math.abs(v), true)}`;

export function frasesHistorico(h: LeituraHistorico) {
  const alertas: { titulo: string; texto: string }[] = [];
  const destaques: { titulo: string; texto: string }[] = [];
  if (h.geracao >= 0) {
    alertas.push({ titulo: "Sustentar a geração de caixa", texto: `A geração do período foi positiva em ${sinal(h.geracao)}, mas a margem é estreita: pede disciplina nos próximos meses.` });
  } else {
    alertas.push({ titulo: "Caixa consumido no período", texto: `Saiu mais do que entrou: ${sinal(h.geracao)}. Rever saídas não operacionais e o ritmo de recebimento.` });
  }
  if (h.melhorMes && h.piorMes && h.piorMes.resultado < 0)
    alertas.push({
      titulo: "Volatilidade de caixa",
      texto: `Oscilação de ${sinal(h.melhorMes.resultado)} (${nomeMes(h.melhorMes.mes)}) a ${sinal(h.piorMes.resultado)} (${nomeMes(h.piorMes.mes)}). Planejamento de tesouraria é essencial.`,
    });
  const totalRec = h.receitas.reduce((s, c) => s + Number(c.valor), 0);
  if (h.maiorFonte && totalRec && Number(h.maiorFonte.valor) / totalRec > 0.25)
    alertas.push({
      titulo: "Concentração de receita",
      texto: `${h.maiorFonte.item} responde por ${pct((Number(h.maiorFonte.valor) / totalRec) * 100)} da receita${h.financeiro ? ` · empréstimos somam ${pct((h.financeiro / h.totalSaidas) * 100)} das saídas (${reais(h.financeiro)})` : ""}.`,
    });

  if (h.variacaoEntradas !== null && h.variacaoEntradas > 0 && h.meses.length > 1)
    destaques.push({ titulo: `Entradas +${pct(h.variacaoEntradas, 1)}`, texto: `De ${reais(h.meses[0].entradas, true)} (${nomeMes(h.meses[0].mes)}) para ${reais(h.meses[h.meses.length - 1].entradas, true)} (${nomeMes(h.meses[h.meses.length - 1].mes)}).` });
  if (h.maiorEntrada) destaques.push({ titulo: `${nomeMes(h.maiorEntrada.mes)} em destaque`, texto: `Maior mês de recebimentos: ${reais(h.maiorEntrada.entradas, true)}.` });
  if (h.socios) destaques.push({ titulo: "Distribuição aos sócios", texto: `${reais(h.socios, true)} distribuídos no período.` });
  if (h.investimento) destaques.push({ titulo: "Patrimônio crescendo", texto: `${reais(h.investimento, true)} em investimentos${h.saidasComp.find((c) => c.natureza === "investimento")?.observacao ? `. ${h.saidasComp.find((c) => c.natureza === "investimento")!.observacao}` : "."}` });
  if (h.saldoFinal !== null && h.saldoInicial !== null && h.saldoFinal > h.saldoInicial)
    destaques.push({ titulo: "Saldo maior que no início", texto: `Fechou em ${reais(h.saldoFinal, true)}, ${pct(((h.saldoFinal - h.saldoInicial) / h.saldoInicial) * 100, 1)} acima do saldo inicial.` });
  return { alertas, destaques };
}

/**
 * Painel do histórico de caixa: o mesmo conteúdo de um dashboard
 * financeiro de consultoria, montado a partir dos fechamentos.
 */
export function HistoricoCaixa({
  h,
  fechamentos,
  composicoes,
  organizationId,
  podeEditar,
  demo,
  relatorioHref,
}: {
  h: LeituraHistorico;
  fechamentos: FechamentoFinanceiro[];
  composicoes: ComposicaoFinanceira[];
  organizationId?: string;
  podeEditar: boolean;
  demo: boolean;
  relatorioHref: string;
}) {
  if (!h.meses.length) {
    return (
      <div className="grid gap-5">
        <Vazio titulo="Nenhum fechamento de caixa ainda">
          Lance o fechamento de cada mês (entradas, saídas e saldo) para ver a evolução, os meses de pressão e a geração de caixa do período.
        </Vazio>
        <TabelaFechamentos fechamentos={fechamentos} composicoes={composicoes} organizationId={organizationId} podeEditar={podeEditar} demo={demo} />
      </div>
    );
  }

  const { alertas, destaques } = frasesHistorico(h);
  const rotulos = [...(h.saldoInicial !== null ? ["Inicial"] : []), ...h.meses.map((m) => mesCurto(m.mes))];
  const saldos = [...(h.saldoInicial !== null ? [h.saldoInicial] : []), ...h.meses.map((m) => m.saldo ?? 0)];
  const temEstimado = [...h.receitas, ...h.saidasComp].some((c) => c.estimado);
  const periodo = `${nomeMes(h.meses[0].mes)} a ${nomeMes(h.meses[h.meses.length - 1].mes)} de ${h.meses[h.meses.length - 1].mes.slice(0, 4)}`;
  const naturezas = (["operacional", "socios", "financeiro", "investimento"] as const)
    .map((nat) => ({ nat, valor: h.saidasComp.filter((c) => c.natureza === nat).reduce((s, c) => s + Number(c.valor), 0) }))
    .filter((x) => x.valor > 0);
  const corNat: Record<string, string> = { operacional: SERIES[1], socios: SERIES[3], financeiro: SERIES[2], investimento: SERIES[0] };

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-cinza-suave">
          Período analisado: <strong className="text-cinza-texto">{periodo}</strong> · regime de caixa (o que efetivamente entrou e saiu da conta).
        </p>
        <Link href={relatorioHref} className="inline-flex items-center gap-1.5 rounded-lg bg-azul-medico px-3 py-2 text-sm font-medium text-white shadow-soft hover:bg-azul-profundo">
          <FileDown className="size-4" /> Dashboard em PDF
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Indicador icone={ArrowDownLeft} rotulo="Total recebido" valor={reais(h.totalEntradas, true)} nota={h.variacaoEntradas !== null ? `${h.variacaoEntradas >= 0 ? "▲" : "▼"} ${pct(Math.abs(h.variacaoEntradas), 1)} do 1º ao último mês` : undefined} serie={h.meses.map((m) => m.entradas)} cor={COR.receita} />
        <Indicador icone={ArrowUpRight} rotulo="Total pago" valor={reais(h.totalSaidas, true)} nota={h.variacaoSaidas !== null ? `${h.variacaoSaidas >= 0 ? "▲" : "▼"} ${pct(Math.abs(h.variacaoSaidas), 1)} do 1º ao último mês` : undefined} serie={h.meses.map((m) => m.saidas)} cor={COR.despesa} />
        <Indicador icone={PiggyBank} rotulo="Geração de caixa" valor={sinal(h.geracao)} nota={`${h.positivos.length} meses positivos · ${h.negativos.length} de pressão`} destaque />
        <Indicador icone={Landmark} rotulo="Saldo no fim do período" valor={h.saldoFinal === null ? "—" : reais(h.saldoFinal, true)} nota={h.variacaoSaldo !== null ? `${h.variacaoSaldo >= 0 ? "▲" : "▼"} ${pct(Math.abs(h.variacaoSaldo), 1)} vs saldo inicial` : undefined} serie={saldos} cor={COR.lucro} />
      </div>

      <Painel titulo="Recebimentos × pagamentos" descricao="Mês a mês, com o resultado de cada um.">
        <BarrasAgrupadas
          categorias={h.meses.map((m) => mesCurto(m.mes))}
          barras={[
            { nome: "Recebimentos", cor: COR.receita, valores: h.meses.map((m) => m.entradas) },
            { nome: "Pagamentos", cor: COR.despesa, valores: h.meses.map((m) => m.saidas) },
          ]}
          linhas={[{ nome: "Resultado", cor: COR.lucro, valores: h.meses.map((m) => m.resultado) }]}
          altura={270}
        />
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <div className="rounded-lg bg-[#E9F8EF] px-4 py-3">
            <p className="text-sm font-semibold text-[#15803D]">Meses positivos</p>
            <p className="mt-1 text-xs leading-relaxed text-cinza-texto">
              {h.positivos.length
                ? h.positivos.map((m) => `${nomeMes(m.mes)} (${sinal(m.resultado)})`).join(", ")
                : "Nenhum mês com superávit."}
              {h.maiorEntrada ? `. Maior volume recebido em ${nomeMes(h.maiorEntrada.mes)}: ${reais(h.maiorEntrada.entradas, true)}.` : ""}
            </p>
          </div>
          <div className="rounded-lg bg-[#FDECEC] px-4 py-3">
            <p className="text-sm font-semibold text-[#B91C1C]">Meses de pressão</p>
            <p className="mt-1 text-xs leading-relaxed text-cinza-texto">
              {h.negativos.length ? h.negativos.map((m) => `${nomeMes(m.mes)} (${sinal(m.resultado)})`).join(", ") + "." : "Nenhum mês com déficit."}
            </p>
          </div>
        </div>
      </Painel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Painel titulo="Saldo de caixa ao longo do período" descricao={h.pico && h.vale ? `Pico em ${nomeMes(h.pico.mes)} (${reais(h.pico.saldo ?? 0, true)}) e menor nível em ${nomeMes(h.vale.mes)} (${reais(h.vale.saldo ?? 0, true)}).` : undefined}>
          <LinhaArea rotulos={rotulos} series={[{ nome: "Saldo", cor: COR.lucro, valores: saldos, area: true }]} altura={240} />
        </Painel>
        <Painel titulo="Geração de caixa no período" descricao="Do saldo inicial ao final, o quanto cada mês somou ou tirou.">
          <Cascata
            etapas={[
              ...(h.saldoInicial !== null ? [{ nome: "Inicial", valor: h.saldoInicial, tipo: "total" as const }] : []),
              ...h.meses.map((m) => ({ nome: mesCurto(m.mes).split("/")[0], valor: Math.abs(m.resultado), tipo: (m.resultado >= 0 ? "mais" : "menos") as "mais" | "menos" })),
              { nome: "Final", valor: h.saldoFinal ?? 0, tipo: "total" as const },
            ]}
            altura={260}
          />
        </Painel>
      </div>

      {(h.receitas.length > 0 || h.saidasComp.length > 0) && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Painel titulo="Receitas por fonte" descricao={h.maiorFonte ? `${h.maiorFonte.item} é a maior fonte. Convênios somam ${pct(h.conveniosPct)} da receita.` : undefined}>
            <Rosca itens={h.receitas.map((c) => ({ nome: c.item + (c.estimado ? " *" : ""), valor: Number(c.valor) }))} centro={{ valor: reais(h.receitas.reduce((s, c) => s + Number(c.valor), 0)), rotulo: "no período" }} />
          </Painel>
          <Painel titulo="Para onde foi o dinheiro" descricao="Saídas por categoria no período.">
            <Rosca itens={h.saidasComp.map((c) => ({ nome: c.item + (c.estimado ? " *" : ""), valor: Number(c.valor) }))} centro={{ valor: reais(h.saidasComp.reduce((s, c) => s + Number(c.valor), 0)), rotulo: "pagos" }} />
            {naturezas.length > 1 && (
              <div className="mt-5 border-t border-border pt-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-cinza-suave">Natureza das saídas</p>
                <div className="flex h-3 overflow-hidden rounded-full">
                  {naturezas.map((x) => (
                    <div key={x.nat} className="border-r-2 border-white last:border-0" style={{ width: `${(x.valor / h.totalSaidas) * 100}%`, background: corNat[x.nat] }} />
                  ))}
                </div>
                <ul className="mt-3 grid gap-1.5 text-sm sm:grid-cols-2">
                  {naturezas.map((x) => (
                    <li key={x.nat} className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 text-cinza-texto">
                        <span className="size-2.5 rounded-[3px]" style={{ background: corNat[x.nat] }} />
                        {ROTULO_NATUREZA[x.nat]}
                      </span>
                      <span className="tabular-nums text-cinza-suave">{pct((x.valor / h.totalSaidas) * 100, 1)}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-xs text-cinza-suave">
                  Só “despesa da operação” é custo de funcionar. Sócios, empréstimos e investimentos são escolhas de uso do caixa.
                </p>
              </div>
            )}
          </Painel>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <Painel titulo="Alertas e riscos">
          <ol className="grid gap-4">
            {alertas.map((a, i) => (
              <li key={a.titulo} className="flex gap-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#FEF4E2] font-heading text-sm font-bold text-[#B45309]">{i + 1}</span>
                <span>
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-cinza-texto">
                    <TriangleAlert className="size-3.5 text-[#B45309]" /> {a.titulo}
                  </span>
                  <span className="mt-0.5 block text-sm leading-relaxed text-cinza-suave">{a.texto}</span>
                </span>
              </li>
            ))}
          </ol>
        </Painel>
        <Painel titulo="Pontos positivos">
          <ul className="grid gap-4 sm:grid-cols-2">
            {destaques.map((d) => (
              <li key={d.titulo} className="border-t-2 border-teal pt-2">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-azul-medico">
                  <Sparkles className="size-3.5 text-teal" /> {d.titulo}
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-cinza-suave">{d.texto}</p>
              </li>
            ))}
          </ul>
        </Painel>
      </div>

      <TabelaFechamentos fechamentos={fechamentos} composicoes={composicoes} organizationId={organizationId} podeEditar={podeEditar} demo={demo} />
      {temEstimado && (
        <p className="text-xs text-cinza-suave">
          * Valor calculado a partir do percentual informado no documento de origem (os valores exatos não vieram discriminados).
        </p>
      )}
    </div>
  );
}
