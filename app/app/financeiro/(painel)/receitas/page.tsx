import { AlertTriangle, Banknote, Percent, Wallet } from "lucide-react";
import { exigirModulo } from "@/lib/acesso";
import { emModoDemo } from "@/lib/supabase/queries";
import { getConfigFinanceira, getPrecos, getProfissionais, getReceitas, getRecebiveis } from "@/lib/supabase/financeiro-dados";
import {
  bruto,
  faixasAtraso,
  mesAnterior,
  resumoMes,
  validos,
  variacao,
} from "@/lib/financeiro/calculos";
import { BarrasAgrupadas, Ranking } from "@/components/graficos/graficos";
import { COR, SERIES, reais } from "@/components/graficos/formato";
import { Indicador, Painel, limites, mesDaUrl } from "@/components/app/financeiro/ui";
import { ListaReceitas } from "@/components/app/financeiro/receitas-ui";

export const metadata = { title: "Receitas · Financeiro" };

export default async function ReceitasPage({ searchParams }: { searchParams: { mes?: string } }) {
  const { organizacao } = await exigirModulo("financeiro");
  const orgId = organizacao?.id ?? null;
  const mes = mesDaUrl(searchParams.mes);
  const { de, ate } = limites(mes);
  const ant = limites(mesAnterior(mes));
  const [receitas, anteriores, recebiveis, config, precos, profissionais, demo] = await Promise.all([
    getReceitas(orgId, de, ate),
    getReceitas(orgId, ant.de, ant.ate),
    getRecebiveis(orgId),
    getConfigFinanceira(orgId),
    getPrecos(orgId),
    getProfissionais(orgId),
    emModoDemo(),
  ]);

  const r = resumoMes(receitas, [], config);
  const ra = resumoMes(anteriores, [], config);
  const faixas = faixasAtraso(recebiveis);
  const totalAtraso = faixas.reduce((s, f) => s + f.valor, 0);
  const nomes = Object.fromEntries(profissionais.map((p) => [p.id, p.nome]));

  // Faturamento por dia do mês
  const [a, m] = mes.split("-").map(Number);
  const dias = Array.from({ length: new Date(a, m, 0).getDate() }, (_, i) => i + 1);
  const porDia = (d: number, recebido: boolean) =>
    validos(receitas)
      .filter((l) => Number(l.data_competencia.slice(8, 10)) === d && (l.status === "recebido") === recebido)
      .reduce((s, l) => s + bruto(l), 0);

  const porProfissional = new Map<string, number>();
  for (const l of validos(receitas)) {
    const k = l.medico_id ? nomes[l.medico_id] ?? "Outro profissional" : "Sem profissional";
    porProfissional.set(k, (porProfissional.get(k) ?? 0) + bruto(l));
  }
  const convenios = [...new Set([...precos.map((p) => p.convenio), ...receitas.map((l) => l.convenio)].filter(Boolean) as string[])];

  return (
    <div className="grid gap-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Indicador icone={Banknote} rotulo="Faturamento" valor={reais(r.receitaBruta)} variacao={variacao(r.receitaBruta, ra.receitaBruta)} nota={`${r.atendimentos} lançamentos · ${r.pacientes} pacientes`} />
        <Indicador icone={Wallet} rotulo="Recebido" valor={reais(r.recebido)} variacao={variacao(r.recebido, ra.recebido)} nota={`Ticket médio ${reais(r.ticketMedio)}`} />
        <Indicador icone={AlertTriangle} rotulo="Em atraso (todos os meses)" valor={reais(totalAtraso)} nota={`${faixas.reduce((s, f) => s + f.quantidade, 0)} lançamentos`} />
        <Indicador icone={Percent} rotulo="Taxas e descontos" valor={reais(r.taxas + r.descontos)} inverter variacao={variacao(r.taxas + r.descontos, ra.taxas + ra.descontos)} nota={`${reais(r.taxas)} de taxa · ${reais(r.descontos)} de desconto`} />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Painel className="lg:col-span-2" titulo="Faturamento por dia" descricao="O que já entrou e o que ainda vai entrar, pela data do atendimento.">
          <BarrasAgrupadas
            categorias={dias.map(String)}
            barras={[
              { nome: "Recebido", cor: COR.receita, valores: dias.map((d) => porDia(d, true)) },
              { nome: "A receber", cor: COR.previsto, valores: dias.map((d) => porDia(d, false)) },
            ]}
            altura={240}
          />
        </Painel>
        <Painel titulo="Recebíveis em atraso" descricao="Por tempo de atraso, de todos os meses.">
          <ul className="grid gap-3">
            {faixas.map((f, i) => (
              <li key={f.rotulo}>
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="text-cinza-texto">{f.rotulo}</span>
                  <span className="font-semibold tabular-nums text-azul-medico">{reais(f.valor)}</span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#EEF3F5]">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${totalAtraso ? Math.max((f.valor / totalAtraso) * 100, f.valor ? 2 : 0) : 0}%`,
                      background: ["#F5B25B", "#EB8A34", "#E0602A", "#B91C1C"][i],
                    }}
                  />
                </div>
                <p className="mt-0.5 text-[11px] text-cinza-suave">{f.quantidade} lançamento{f.quantidade === 1 ? "" : "s"}</p>
              </li>
            ))}
          </ul>
        </Painel>
      </div>

      <Painel titulo="Por profissional" descricao="Faturamento do mês de cada um.">
        <Ranking itens={[...porProfissional.entries()].map(([nome, valor]) => ({ nome, valor }))} cor={SERIES[1]} />
      </Painel>

      <ListaReceitas receitas={receitas} opcoes={{ profissionais, precos, convenios }} nomes={nomes} demo={demo} />
      <p className="text-xs text-cinza-suave">
        Consultas marcadas na agenda viram receita sozinhas (ícone de estetoscópio). O pagamento é registrado aqui ou na
        ficha da consulta.
      </p>
    </div>
  );
}
