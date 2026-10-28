import { Clock, FileWarning, HandCoins, ShieldCheck } from "lucide-react";
import { exigirModulo } from "@/lib/acesso";
import { emModoDemo } from "@/lib/supabase/queries";
import { getConfigFinanceira, getReceitas } from "@/lib/supabase/financeiro-dados";
import { mesCurto, porConvenio, ultimosMeses, validos } from "@/lib/financeiro/calculos";
import { BarrasAgrupadas, Ranking } from "@/components/graficos/graficos";
import { COR, SERIES, pct, reais } from "@/components/graficos/formato";
import { Indicador, Painel, Situacao, Vazio, limites, mesDaUrl } from "@/components/app/financeiro/ui";
import { PendentesConvenio } from "@/components/app/financeiro/convenios-ui";

export const metadata = { title: "Convênios · Financeiro" };

export default async function ConveniosPage({ searchParams }: { searchParams: { mes?: string } }) {
  const { organizacao } = await exigirModulo("financeiro");
  const orgId = organizacao?.id ?? null;
  const mes = mesDaUrl(searchParams.mes);
  const meses = ultimosMeses(mes, 6);
  const { ate } = limites(mes);
  const [receitas, config, demo] = await Promise.all([getReceitas(orgId, `${meses[0]}-01`, ate), getConfigFinanceira(orgId), emModoDemo()]);

  const conv = validos(receitas).filter((l) => l.forma_pagamento === "convenio");
  const doMes = porConvenio(conv.filter((l) => l.data_competencia.startsWith(mes)));
  const seisMeses = porConvenio(conv);
  const reserva = Number(config?.reserva_glosa ?? 7);
  const soma = (k: "faturado" | "glosado" | "recebido" | "pendente") => doMes.reduce((s, c) => s + c[k], 0);
  const taxaGlosa = soma("faturado") ? (soma("glosado") / soma("faturado")) * 100 : 0;
  const prazos = seisMeses.filter((c) => c.prazoMedio !== null);
  const prazoMedio = prazos.length ? Math.round(prazos.reduce((s, c) => s + (c.prazoMedio ?? 0) * c.atendimentos, 0) / prazos.reduce((s, c) => s + c.atendimentos, 0)) : null;
  const pendentes = conv.filter((l) => l.status !== "recebido");

  if (!conv.length) {
    return (
      <Vazio titulo="Nenhum atendimento por convênio nos últimos 6 meses">
        Quando uma consulta for marcada com convênio, ela aparece aqui com o que foi faturado, glosado e recebido.
      </Vazio>
    );
  }

  return (
    <div className="grid gap-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Indicador icone={HandCoins} rotulo="Faturado aos convênios" valor={reais(soma("faturado"))} nota={`${doMes.reduce((s, c) => s + c.atendimentos, 0)} atendimentos no mês`} />
        <Indicador icone={ShieldCheck} rotulo="Recebido" valor={reais(soma("recebido"))} nota={`${reais(soma("pendente"))} pendente`} />
        <Indicador
          icone={FileWarning}
          rotulo="Taxa de glosa"
          valor={pct(taxaGlosa, 1)}
          nota={taxaGlosa > reserva ? `Acima da reserva de ${pct(reserva)}` : `Dentro da reserva de ${pct(reserva)}`}
          destaque={taxaGlosa > reserva}
        />
        <Indicador icone={Clock} rotulo="Prazo médio de pagamento" valor={prazoMedio === null ? "—" : `${prazoMedio} dias`} nota="Do atendimento ao dinheiro, 6 meses" />
      </div>

      <div className="grid gap-5 lg:grid-cols-5">
        <Painel className="lg:col-span-3" titulo="Faturado e glosado por mês" descricao="Últimos 6 meses, todos os convênios.">
          <BarrasAgrupadas
            categorias={meses.map(mesCurto)}
            barras={[
              { nome: "Faturado", cor: SERIES[2], valores: meses.map((m) => porConvenio(conv.filter((l) => l.data_competencia.startsWith(m))).reduce((s, c) => s + c.faturado, 0)) },
              { nome: "Glosado", cor: COR.critico, valores: meses.map((m) => porConvenio(conv.filter((l) => l.data_competencia.startsWith(m))).reduce((s, c) => s + c.glosado, 0)) },
            ]}
            destaque={meses.length - 1}
            altura={250}
          />
        </Painel>
        <Painel className="lg:col-span-2" titulo="Quanto cada convênio paga" descricao="Valor líquido por atendimento, 6 meses.">
          <Ranking itens={seisMeses.map((c) => ({ nome: c.convenio, valor: c.liquidoPorAtendimento, detalhe: `${c.atendimentos} atend.` }))} cor={SERIES[2]} />
        </Painel>
      </div>

      <Painel titulo="Convênios no mês" corpo="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-cinza-suave">
                <th className="px-5 py-2.5 font-semibold">Convênio</th>
                <th className="px-2 py-2.5 text-right font-semibold">Atend.</th>
                <th className="px-2 py-2.5 text-right font-semibold">Faturado</th>
                <th className="px-2 py-2.5 text-right font-semibold">Glosado</th>
                <th className="px-2 py-2.5 text-right font-semibold">Recebido</th>
                <th className="px-2 py-2.5 text-right font-semibold">Pendente</th>
                <th className="px-2 py-2.5 text-right font-semibold">Prazo</th>
                <th className="px-5 py-2.5 text-right font-semibold">Glosa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {doMes.map((c) => (
                <tr key={c.convenio}>
                  <td className="px-5 py-3 font-medium text-cinza-texto">{c.convenio}</td>
                  <td className="px-2 py-3 text-right tabular-nums">{c.atendimentos}</td>
                  <td className="px-2 py-3 text-right tabular-nums">{reais(c.faturado)}</td>
                  <td className="px-2 py-3 text-right tabular-nums text-[#B91C1C]">{c.glosado ? reais(c.glosado) : "—"}</td>
                  <td className="px-2 py-3 text-right tabular-nums text-[#15803D]">{reais(c.recebido)}</td>
                  <td className="px-2 py-3 text-right tabular-nums">{reais(c.pendente)}</td>
                  <td className="px-2 py-3 text-right tabular-nums text-cinza-suave">{c.prazoMedio === null ? "—" : `${c.prazoMedio} d`}</td>
                  <td className="px-5 py-3 text-right">
                    <Situacao tom={c.taxaGlosa > reserva ? "critico" : c.taxaGlosa > 0 ? "atencao" : "bom"}>{pct(c.taxaGlosa, 1)}</Situacao>
                  </td>
                </tr>
              ))}
              {!doMes.length && (
                <tr>
                  <td colSpan={8} className="px-5 py-8 text-center text-cinza-suave">
                    Nenhum atendimento por convênio neste mês.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Painel>

      <PendentesConvenio lancamentos={pendentes} demo={demo} />
    </div>
  );
}
