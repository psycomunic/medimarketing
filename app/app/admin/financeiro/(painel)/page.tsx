import Link from "next/link";
import { ArrowRight, CalendarRange, Gauge, Repeat, TrendingDown, TrendingUp, Users, Wallet } from "lucide-react";
import { getAgencia } from "@/lib/supabase/financeiro-dados";
import { ROTULO_EVENTO, ROTULO_PLANO, indicadoresAgencia, ponteDoMes, resumoFaturas, serieMrr } from "@/lib/financeiro/agencia";
import { mesAnterior, mesCurto, mesLongo, ultimosMeses, variacao } from "@/lib/financeiro/calculos";
import { BarrasAgrupadas, Cascata, LinhaArea, Rosca } from "@/components/graficos/graficos";
import { COR, SERIES, pct, reais } from "@/components/graficos/formato";
import { Indicador, Painel, Situacao, mesDaUrl } from "@/components/app/financeiro/ui";

export const metadata = { title: "Financeiro da agência" };

export default async function FinanceiroAgencia({ searchParams }: { searchParams: { mes?: string } }) {
  const mes = mesDaUrl(searchParams.mes);
  const meses = ultimosMeses(mes, 12);
  const { contratos, eventos, faturas, custos, clientes } = await getAgencia();
  const nome = (id: string) => clientes.find((c) => c.id === id)?.nome ?? "Clínica";

  const ind = indicadoresAgencia(contratos, eventos, mes);
  const serie = serieMrr(eventos, meses);
  const atual = serie[serie.length - 1];
  const anterior = serie[serie.length - 2];
  const ponte = ponteDoMes(eventos, mes);
  const fat = resumoFaturas(faturas, mes);
  const custosMes = (m: string) => custos.filter((c) => c.competencia.startsWith(m)).reduce((s, c) => s + Number(c.valor), 0);
  const recebidoMes = (m: string) =>
    faturas.filter((f) => f.status === "paga" && (f.pago_em ?? "").startsWith(m)).reduce((s, f) => s + Number(f.valor), 0);
  const resultado = recebidoMes(mes) - custosMes(mes);
  const ativos = contratos.filter((c) => c.status === "ativo");
  const porPlano = ["essencial", "performance", "full"].map((p) => ({
    nome: ROTULO_PLANO[p],
    valor: ativos.filter((c) => c.plano === p).reduce((s, c) => s + Number(c.mensalidade), 0),
  }));
  const recentes = [...eventos].sort((a, b) => b.data.localeCompare(a.data) || b.created_at.localeCompare(a.created_at)).slice(0, 8);
  const contratoDe = (id: string) => contratos.find((c) => c.id === id);

  return (
    <div className="grid gap-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Indicador
          icone={Repeat}
          rotulo="MRR"
          valor={reais(ind.mrr)}
          variacao={variacao(atual?.mrr ?? 0, anterior?.mrr ?? 0)}
          nota={`ARR de ${reais(ind.arr)}`}
          serie={serie.map((p) => p.mrr)}
          destaque
        />
        <Indicador icone={Users} rotulo="Clientes ativos" valor={String(ind.clientes)} nota={`Ticket médio ${reais(ind.arpa)}`} serie={serie.map((p) => p.clientes)} cor={SERIES[1]} />
        <Indicador
          icone={TrendingDown}
          rotulo="Churn médio · 6 meses"
          valor={pct(ind.churnMedio, 1)}
          nota={`Este mês: ${pct(atual?.churnLogo ?? 0, 1)} dos clientes`}
          serie={serie.slice(-6).map((p) => p.churnLogo)}
          cor={COR.despesa}
        />
        <Indicador icone={Gauge} rotulo="Retenção de receita · 12 meses" valor={ind.nrr === null ? "—" : pct(ind.nrr)} nota="Acima de 100% = a base cresce sozinha" />
        <Indicador icone={Wallet} rotulo="Recebido no mês" valor={reais(recebidoMes(mes))} variacao={variacao(recebidoMes(mes), recebidoMes(mesAnterior(mes)))} nota={`${reais(fat.faturado)} faturado`} />
        <Indicador
          icone={TrendingDown}
          rotulo="Inadimplência"
          valor={reais(fat.vencido)}
          nota={fat.clientesInadimplentes ? `${fat.clientesInadimplentes} cliente${fat.clientesInadimplentes > 1 ? "s" : ""} com fatura vencida` : "Ninguém em atraso"}
        />
        <Indicador icone={TrendingUp} rotulo="Valor do cliente (LTV)" valor={ind.ltv === null ? "—" : reais(ind.ltv)} nota={ind.ltv === null ? "Sem cancelamentos para estimar" : "Ticket ÷ churn médio"} />
        <Indicador icone={CalendarRange} rotulo="Garantido por contrato" valor={reais(ind.contratado12)} nota="Mensalidades até o fim das fidelidades (12 m)" />
      </div>

      <div className="grid gap-5 lg:grid-cols-5">
        <Painel className="lg:col-span-3" titulo="MRR nos últimos 12 meses" descricao="Receita recorrente no fim de cada mês, pelos contratos em vigor.">
          <LinhaArea rotulos={meses.map(mesCurto)} series={[{ nome: "MRR", cor: COR.lucro, valores: serie.map((p) => p.mrr), area: true }]} altura={260} />
        </Painel>
        <Painel className="lg:col-span-2" titulo={`Ponte do MRR · ${mesCurto(mes)}`} descricao="O que entrou e saiu da receita recorrente no mês.">
          <Cascata
            etapas={[
              { nome: "Início", valor: ponte.inicio, tipo: "total" },
              { nome: "Novos", valor: ponte.novo, tipo: "mais" },
              { nome: "Upgrades", valor: ponte.expansao, tipo: "mais" },
              { nome: "Reduções", valor: ponte.contracao, tipo: "menos" },
              { nome: "Saídas", valor: ponte.cancelado, tipo: "menos" },
              { nome: "Fim", valor: ponte.fim, tipo: "total" },
            ]}
            altura={260}
          />
        </Painel>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Painel className="lg:col-span-2" titulo="Recebido x custos da agência" descricao={`Resultado de ${mesLongo(mes)}: ${reais(resultado)}.`}>
          <BarrasAgrupadas
            categorias={meses.map(mesCurto)}
            barras={[
              { nome: "Recebido", cor: COR.receita, valores: meses.map(recebidoMes) },
              { nome: "Custos", cor: COR.despesa, valores: meses.map(custosMes) },
            ]}
            linhas={[{ nome: "Resultado", cor: COR.lucro, valores: meses.map((m) => recebidoMes(m) - custosMes(m)) }]}
            destaque={meses.length - 1}
            altura={250}
          />
        </Painel>
        <Painel titulo="MRR por plano">
          <Rosca itens={porPlano.map((p, i) => ({ ...p, cor: [SERIES[0], SERIES[1], SERIES[3]][i] }))} centro={{ valor: reais(ind.mrr), rotulo: "por mês" }} tamanho={150} />
        </Painel>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Painel
          titulo="Inadimplência por atraso"
          acao={
            <Link href="/app/admin/financeiro/faturas" className="inline-flex items-center gap-1 text-sm font-medium text-teal hover:underline">
              Cobrar <ArrowRight className="size-4" />
            </Link>
          }
        >
          <ul className="grid gap-3">
            {fat.faixas.map((f, i) => (
              <li key={f.rotulo}>
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="text-cinza-texto">{f.rotulo}</span>
                  <span className="font-semibold tabular-nums text-azul-medico">
                    {reais(f.valor)} <span className="text-xs font-normal text-cinza-suave">· {f.quantidade}</span>
                  </span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#EEF3F5]">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${fat.vencido ? Math.max((f.valor / fat.vencido) * 100, f.valor ? 2 : 0) : 0}%`, background: ["#F5B25B", "#EB8A34", "#E0602A", "#B91C1C"][i] }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </Painel>
        <Painel titulo="Movimentos recentes" corpo="p-0">
          {recentes.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-cinza-suave">Nenhum movimento ainda.</p>
          ) : (
            <ul className="divide-y divide-border">
              {recentes.map((e) => {
                const c = contratoDe(e.contrato_id);
                const delta = Number(e.mrr_depois) - Number(e.mrr_antes);
                return (
                  <li key={e.id} className="flex items-center gap-3 px-5 py-2.5">
                    <span className="w-12 shrink-0 text-xs tabular-nums text-cinza-suave">
                      {new Date(`${e.data}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-cinza-texto">{c ? nome(c.organization_id) : "Contrato"}</span>
                      <span className="block text-[11px] text-cinza-suave">{ROTULO_EVENTO[e.tipo]}</span>
                    </span>
                    <Situacao tom={delta > 0 ? "bom" : delta < 0 ? "critico" : "neutro"}>
                      {delta > 0 ? "+" : delta < 0 ? "−" : ""}
                      {reais(Math.abs(delta))}
                    </Situacao>
                  </li>
                );
              })}
            </ul>
          )}
        </Painel>
      </div>
    </div>
  );
}
