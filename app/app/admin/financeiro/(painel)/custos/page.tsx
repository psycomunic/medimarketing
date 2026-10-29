import { PiggyBank, Receipt, TrendingUp } from "lucide-react";
import { emModoDemo } from "@/lib/supabase/queries";
import { getAgencia } from "@/lib/supabase/financeiro-dados";
import { margemPorCliente, rotuloCusto } from "@/lib/financeiro/agencia";
import { Indicador, Painel, Situacao, mesDaUrl } from "@/components/app/financeiro/ui";
import { Rosca } from "@/components/graficos/graficos";
import { pct, reais } from "@/components/graficos/formato";
import { ListaCustos } from "@/components/app/agencia/custos-ui";
import { FabNovoCusto } from "@/components/app/botoes-flutuantes";

export const metadata = { title: "Custos e margem · Financeiro da agência" };

export default async function CustosPage({ searchParams }: { searchParams: { mes?: string } }) {
  const mes = mesDaUrl(searchParams.mes);
  const [{ contratos, custos, clientes, faturas }, demo] = await Promise.all([getAgencia(), emModoDemo()]);
  const doMes = custos.filter((c) => c.competencia.startsWith(mes));
  const total = doMes.reduce((s, c) => s + Number(c.valor), 0);
  const recebido = faturas.filter((f) => f.status === "paga" && (f.pago_em ?? "").startsWith(mes)).reduce((s, f) => s + Number(f.valor), 0);
  const margens = margemPorCliente(contratos, custos, mes);
  const nome = (id: string) => clientes.find((c) => c.id === id)?.nome ?? "Clínica";
  const porCat = new Map<string, number>();
  for (const c of doMes) porCat.set(c.categoria, (porCat.get(c.categoria) ?? 0) + Number(c.valor));

  return (
    <div className="grid gap-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Indicador icone={Receipt} rotulo="Custos do mês" valor={reais(total)} />
        <Indicador icone={PiggyBank} rotulo="Resultado do mês" valor={reais(recebido - total)} nota={`Recebido ${reais(recebido)}`} destaque />
        <Indicador icone={TrendingUp} rotulo="Margem da agência" valor={recebido ? pct(((recebido - total) / recebido) * 100, 1) : "—"} nota="Sobre o recebido no mês" />
      </div>
      <div className="grid gap-5 lg:grid-cols-5">
        <Painel className="lg:col-span-3" titulo="Margem por cliente" descricao="Mensalidade menos o custo dedicado e a parte de cada um nos custos gerais." corpo="p-0">
          {margens.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-cinza-suave">Sem contratos ativos.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-cinza-suave">
                    <th className="px-5 py-2.5 font-semibold">Clínica</th>
                    <th className="px-2 py-2.5 text-right font-semibold">Mensalidade</th>
                    <th className="px-2 py-2.5 text-right font-semibold">Custo</th>
                    <th className="px-2 py-2.5 text-right font-semibold">Margem</th>
                    <th className="px-5 py-2.5 text-right font-semibold">%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {margens.map((m) => (
                    <tr key={m.organizationId}>
                      <td className="px-5 py-2.5 font-medium text-cinza-texto">{nome(m.organizationId)}</td>
                      <td className="px-2 py-2.5 text-right tabular-nums">{reais(m.receita)}</td>
                      <td className="px-2 py-2.5 text-right tabular-nums text-cinza-suave">{reais(m.custoDireto + m.rateio)}</td>
                      <td className={m.margem < 0 ? "px-2 py-2.5 text-right font-semibold tabular-nums text-[#B91C1C]" : "px-2 py-2.5 text-right font-semibold tabular-nums text-azul-medico"}>
                        {reais(m.margem)}
                      </td>
                      <td className="px-5 py-2.5 text-right">
                        <Situacao tom={m.margemPct < 0 ? "critico" : m.margemPct < 30 ? "atencao" : "bom"}>{pct(m.margemPct)}</Situacao>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Painel>
        <Painel className="lg:col-span-2" titulo="Para onde vai o custo">
          <Rosca itens={[...porCat.entries()].map(([k, v]) => ({ nome: rotuloCusto(k), valor: v }))} centro={{ valor: reais(total), rotulo: "no mês" }} tamanho={150} />
        </Painel>
      </div>
      <ListaCustos custos={doMes} clientes={clientes} mes={mes} demo={demo} />
      <FabNovoCusto />
    </div>
  );
}
