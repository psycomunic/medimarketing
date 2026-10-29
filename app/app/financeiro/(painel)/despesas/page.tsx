import { AlertTriangle, CalendarCheck2, CircleDollarSign, Receipt } from "lucide-react";
import { exigirModulo } from "@/lib/acesso";
import { emModoDemo } from "@/lib/supabase/queries";
import { getDespesas } from "@/lib/supabase/financeiro-dados";
import { hojeIso, mesAnterior, mesCurto, porCategoria, ultimosMeses, variacao } from "@/lib/financeiro/calculos";
import { BarrasAgrupadas, Ranking } from "@/components/graficos/graficos";
import { SERIES, reais } from "@/components/graficos/formato";
import { Indicador, Painel, limites, mesDaUrl } from "@/components/app/financeiro/ui";
import { ListaDespesas } from "@/components/app/financeiro/despesas-ui";
import { FabNovaDespesa } from "@/components/app/botoes-flutuantes";

export const metadata = { title: "Despesas · Financeiro" };

export default async function DespesasPage({ searchParams }: { searchParams: { mes?: string } }) {
  const { organizacao } = await exigirModulo("financeiro");
  const orgId = organizacao?.id ?? null;
  const mes = mesDaUrl(searchParams.mes);
  const meses = ultimosMeses(mes, 12);
  const { ate } = limites(mes);
  const [todas, demo] = await Promise.all([getDespesas(orgId, `${meses[0]}-01`, ate), emModoDemo()]);

  const ativas = todas.filter((d) => d.status !== "cancelada");
  const doMes = ativas.filter((d) => d.vencimento.startsWith(mes));
  const anterior = ativas.filter((d) => d.vencimento.startsWith(mesAnterior(mes)));
  const soma = (l: typeof ativas) => l.reduce((s, d) => s + Number(d.valor), 0);
  const hoje = hojeIso();
  const vencidas = doMes.filter((d) => d.status === "aberta" && d.vencimento < hoje);
  const fixas = soma(doMes.filter((d) => d.fixa));

  return (
    <div className="grid gap-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Indicador
          icone={Receipt}
          rotulo="Despesas do mês"
          valor={reais(soma(doMes))}
          variacao={variacao(soma(doMes), soma(anterior))}
          inverter
          nota={`${reais(fixas)} são fixas`}
          serie={meses.map((m) => soma(ativas.filter((d) => d.vencimento.startsWith(m))))}
          cor={SERIES[2]}
        />
        <Indicador icone={CalendarCheck2} rotulo="Já pagas" valor={reais(soma(doMes.filter((d) => d.status === "paga")))} nota={`${doMes.filter((d) => d.status === "paga").length} contas`} />
        <Indicador icone={CircleDollarSign} rotulo="A pagar" valor={reais(soma(doMes.filter((d) => d.status === "aberta")))} nota={`${doMes.filter((d) => d.status === "aberta").length} contas em aberto`} />
        <Indicador
          icone={AlertTriangle}
          rotulo="Vencidas"
          valor={reais(soma(vencidas))}
          nota={vencidas.length ? `${vencidas.length} conta${vencidas.length > 1 ? "s" : ""} em atraso` : "Nenhuma em atraso"}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Painel className="lg:col-span-2" titulo="Fixas e variáveis" descricao="Últimos 12 meses. Fixa é o que existe com ou sem paciente.">
          <BarrasAgrupadas
            categorias={meses.map(mesCurto)}
            barras={[
              { nome: "Fixas", cor: SERIES[1], valores: meses.map((m) => soma(ativas.filter((d) => d.fixa && d.vencimento.startsWith(m)))) },
              { nome: "Variáveis", cor: SERIES[2], valores: meses.map((m) => soma(ativas.filter((d) => !d.fixa && d.vencimento.startsWith(m)))) },
            ]}
            destaque={meses.length - 1}
            altura={250}
          />
        </Painel>
        <Painel titulo="Maiores categorias" descricao="No mês.">
          <Ranking itens={porCategoria(doMes).map((c) => ({ nome: c.nome, valor: c.valor }))} cor={SERIES[2]} limite={7} />
        </Painel>
      </div>

      <ListaDespesas despesas={doMes} demo={demo} />
      <FabNovaDespesa />
    </div>
  );
}
