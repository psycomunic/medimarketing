import { exigirModulo } from "@/lib/acesso";
import { getConfigFinanceira, getDespesas, getReceitas, getRegrasRepasse } from "@/lib/supabase/financeiro-dados";
import {
  calcularRepasses,
  dre,
  mesAnterior,
  mesCurto,
  mesLongo,
  pontoEquilibrio,
  resumoMes,
  ultimosMeses,
} from "@/lib/financeiro/calculos";
import { Cascata, LinhaArea } from "@/components/graficos/graficos";
import { COR, pct, reais } from "@/components/graficos/formato";
import { Painel, Situacao, limites, mesDaUrl } from "@/components/app/financeiro/ui";
import { cn } from "@/lib/utils";

export const metadata = { title: "Resultado · Financeiro" };

export default async function ResultadoPage({ searchParams }: { searchParams: { mes?: string } }) {
  const { organizacao } = await exigirModulo("financeiro");
  const orgId = organizacao?.id ?? null;
  const mes = mesDaUrl(searchParams.mes);
  const meses = ultimosMeses(mes, 12);
  const { ate } = limites(mes);
  const [receitas, despesas, config, regras] = await Promise.all([
    getReceitas(orgId, `${meses[0]}-01`, ate),
    getDespesas(orgId, `${meses[0]}-01`, ate),
    getConfigFinanceira(orgId),
    getRegrasRepasse(orgId),
  ]);

  const resumoDe = (ms: string[]) => {
    const r = receitas.filter((l) => ms.some((m) => l.data_competencia.startsWith(m)));
    const d = despesas.filter((x) => ms.some((m) => x.vencimento.startsWith(m)));
    const rep = ms.reduce((s, m) => s + calcularRepasses(r.filter((l) => l.data_competencia.startsWith(m)), regras).reduce((a, x) => a + x.valor, 0), 0);
    return resumoMes(r, d, config, rep);
  };
  const atual = resumoDe([mes]);
  const anterior = resumoDe([mesAnterior(mes)]);
  const ano = resumoDe(meses);
  const linhas = dre(atual);
  const linhasAnt = dre(anterior);
  const linhasAno = dre(ano);
  const pe = pontoEquilibrio(atual);
  const margens = meses.map((m) => resumoDe([m]).margem);

  return (
    <div className="grid gap-5">
      <div className="grid gap-5 lg:grid-cols-5">
        <Painel
          className="self-start lg:col-span-3"
          titulo={`Do faturamento ao lucro · ${mesLongo(mes)}`}
          descricao="Cada barra tira (ou soma) uma parte do caminho."
        >
          <Cascata
            etapas={[
              { nome: "Receita bruta", valor: atual.receitaBruta, tipo: "total" },
              { nome: "Impostos e glosas", valor: atual.impostos + atual.glosas, tipo: "menos" },
              { nome: "Custos e taxas", valor: atual.custosDiretos + atual.taxas, tipo: "menos" },
              { nome: "Repasses", valor: atual.repasse, tipo: "menos" },
              { nome: "Despesas fixas", valor: atual.despesasFixas, tipo: "menos" },
              { nome: "Outras despesas", valor: atual.despesas - atual.despesasFixas, tipo: "menos" },
              { nome: "Lucro", valor: atual.lucro, tipo: "total" },
            ]}
            altura={300}
          />
        </Painel>
        <div className="grid content-start gap-5 lg:col-span-2">
          <Painel titulo="Margem de lucro" descricao="Lucro sobre o faturamento, 12 meses.">
            <LinhaArea
              rotulos={meses.map(mesCurto)}
              series={[{ nome: "Margem", cor: COR.lucro, valores: margens, area: true }]}
              formato="pct"
              altura={180}
            />
          </Painel>
          <Painel titulo="Ponto de equilíbrio">
            {pe.receitaNecessaria === null ? (
              <p className="text-sm text-cinza-suave">A margem de contribuição está negativa: cada atendimento custa mais do que rende.</p>
            ) : (
              <div className="grid gap-2 text-sm">
                <p className="text-cinza-suave">
                  Faturar <strong className="text-azul-medico">{reais(pe.receitaNecessaria)}</strong>
                  {pe.consultas ? <> (≈ {pe.consultas} atendimentos)</> : null} paga todas as despesas do mês.
                </p>
                <p className="text-cinza-suave">
                  Cada R$ 100 faturados deixam <strong className="text-azul-medico">{reais(pe.indice * 100, true)}</strong> para pagar as despesas.
                </p>
                <div>{pe.falta && pe.falta > 0 ? <Situacao tom="atencao">Faltam {reais(pe.falta)}</Situacao> : <Situacao tom="bom">Equilíbrio atingido</Situacao>}</div>
              </div>
            )}
          </Painel>
        </div>
      </div>

      <Painel titulo="Demonstrativo de resultado (DRE gerencial)" descricao="Visão simplificada para decisão. A contabilidade oficial continua com o contador." corpo="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b-2 border-azul-medico/70 text-[11px] uppercase tracking-wide text-cinza-suave">
                <th className="px-5 py-3 text-left font-semibold">Conta</th>
                <th className="px-3 py-3 text-right font-semibold">{mesCurto(mes)}</th>
                <th className="px-3 py-3 text-right font-semibold">% receita</th>
                <th className="px-3 py-3 text-right font-semibold">{mesCurto(mesAnterior(mes))}</th>
                <th className="px-5 py-3 text-right font-semibold">12 meses</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l, i) => {
                const total = l.tipo === "total";
                const sinal = l.tipo === "menos" ? -1 : 1;
                const fmt = (v: number) => (v === 0 ? "—" : `${sinal < 0 ? "− " : ""}${reais(Math.abs(v))}`);
                return (
                  <tr
                    key={l.chave}
                    className={cn(
                      "border-b border-border",
                      total && "bg-branco-clinico font-semibold text-azul-medico",
                      l.chave === "lucro" && "border-t-2 border-t-azul-medico/70 bg-verde-menta/50"
                    )}
                  >
                    <td className={cn("px-5 py-2.5", l.nivel === 1 && "pl-9 text-cinza-texto")}>{l.rotulo}</td>
                    <td className={cn("px-3 py-2.5 text-right tabular-nums", l.chave === "lucro" && l.valor < 0 && "text-[#B91C1C]")}>
                      {total ? reais(l.valor) : fmt(l.valor)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-cinza-suave">
                      {atual.receitaBruta ? pct((l.valor / atual.receitaBruta) * 100 * (total ? 1 : 1), 1) : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-cinza-suave">
                      {total ? reais(linhasAnt[i].valor) : fmt(linhasAnt[i].valor)}
                    </td>
                    <td className="px-5 py-2.5 text-right tabular-nums">{total ? reais(linhasAno[i].valor) : fmt(linhasAno[i].valor)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="border-t border-border px-5 py-3 text-xs text-cinza-suave">
          Impostos estimados em {pct(Number(config?.imposto ?? 6), 1)} da receita (ajuste em Preços e taxas). Despesas entram no mês do vencimento.
        </p>
      </Painel>
    </div>
  );
}
