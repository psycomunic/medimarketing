import { exigirSessao } from "@/lib/acesso";
import { podeAcessar } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { getCliente } from "@/lib/supabase/indicadores";
import { getHistorico } from "@/lib/supabase/financeiro-dados";
import { lerHistorico, ROTULO_NATUREZA } from "@/lib/financeiro/historico";
import { mesCurto, mesLongo } from "@/lib/financeiro/calculos";
import { frasesHistorico } from "@/components/app/financeiro/historico";
import { BarrasAgrupadas, Cascata, LinhaArea } from "@/components/graficos/graficos";
import { COR, pct, reais } from "@/components/graficos/formato";
import { Documento, KpisDoc, NotaDoc, SecaoDoc, TabelaDoc } from "@/components/relatorio/documento";

export const metadata = { title: "Dashboard financeiro do período" };

const nomeMes = (m: string) => {
  const t = mesLongo(m).split(" de ")[0];
  return t.charAt(0).toUpperCase() + t.slice(1);
};
const sinal = (v: number) => `${v >= 0 ? "+" : "−"}${reais(Math.abs(v), true)}`;

export default async function RelatorioHistorico({ searchParams }: { searchParams: { clinica?: string } }) {
  const { organizacao, role } = await exigirSessao();
  // A equipe Medi abre de qualquer cliente; a clínica, só o dela
  let org: { id: string; nome: string; logo_url: string | null; responsavel: string | null } | null = null;
  if (role === "super_admin" && searchParams.clinica) {
    const c = await getCliente(searchParams.clinica);
    if (c) org = { id: c.id, nome: c.nome, logo_url: c.logo_url, responsavel: c.responsavel };
  } else if (podeAcessar(role, "financeiro") && organizacao) {
    org = { id: organizacao.id, nome: organizacao.nome, logo_url: organizacao.logo_url, responsavel: organizacao.responsavel };
  }
  if (!org) redirect("/app");

  const { fechamentos, composicoes } = await getHistorico(org.id);
  const h = lerHistorico(fechamentos, composicoes);
  const { alertas, destaques } = frasesHistorico(h);
  const voltar = role === "super_admin" ? `/app/clinicas/${org.id}/historico` : "/app/financeiro/historico";
  const periodo = h.meses.length
    ? `${nomeMes(h.meses[0].mes)} a ${nomeMes(h.meses[h.meses.length - 1].mes)} de ${h.meses[h.meses.length - 1].mes.slice(0, 4)}`
    : "Sem fechamentos";
  const rotulos = [...(h.saldoInicial !== null ? ["Inicial"] : []), ...h.meses.map((m) => mesCurto(m.mes))];
  const saldos = [...(h.saldoInicial !== null ? [h.saldoInicial] : []), ...h.meses.map((m) => m.saldo ?? 0)];
  const totalRec = h.receitas.reduce((s, c) => s + Number(c.valor), 0);
  const ultimoOp = [...h.meses].reverse().find((m) => m.receitaOperacional !== null);

  return (
    <Documento
      titulo="Dashboard financeiro do período"
      subtitulo={periodo}
      emitidoPara={org.responsavel ? `Preparado para ${org.responsavel}` : "Preparado pela equipe Medi Marketing"}
      marca={{ nome: org.nome, logoUrl: org.logo_url }}
      voltar={{ href: voltar, rotulo: "Voltar ao histórico" }}
      nomeArquivo={`Dashboard financeiro ${org.nome} ${periodo}`}
    >
      {!h.meses.length ? (
        <p className="text-sm text-cinza-suave">Nenhum fechamento lançado ainda.</p>
      ) : (
        <>
          <KpisDoc
            itens={[
              { rotulo: "Total recebido", valor: reais(h.totalEntradas, true), nota: h.variacaoEntradas !== null ? `${h.variacaoEntradas >= 0 ? "▲" : "▼"} ${pct(Math.abs(h.variacaoEntradas), 1)} no período` : undefined, tom: (h.variacaoEntradas ?? 0) >= 0 ? "bom" : "ruim" },
              { rotulo: "Total pago", valor: reais(h.totalSaidas, true), nota: h.variacaoSaidas !== null ? `${h.variacaoSaidas >= 0 ? "▲" : "▼"} ${pct(Math.abs(h.variacaoSaidas), 1)} no período` : undefined },
              { rotulo: "Geração de caixa", valor: sinal(h.geracao), nota: `${h.positivos.length} meses positivos`, destaque: true },
              { rotulo: "Saldo final", valor: h.saldoFinal === null ? "—" : reais(h.saldoFinal, true), nota: h.variacaoSaldo !== null ? `${h.variacaoSaldo >= 0 ? "▲" : "▼"} ${pct(Math.abs(h.variacaoSaldo), 1)} vs inicial` : undefined, tom: (h.variacaoSaldo ?? 0) >= 0 ? "bom" : "ruim" },
            ]}
          />
          <NotaDoc titulo="Leitura do período" tom={h.geracao >= 0 ? "bom" : "alerta"}>
            A geração de caixa foi {h.geracao >= 0 ? "positiva" : "negativa"} em {sinal(h.geracao)}. {h.pico && h.vale ? `O saldo teve o pico em ${nomeMes(h.pico.mes)} (${reais(h.pico.saldo ?? 0, true)}) e o menor nível em ${nomeMes(h.vale.mes)} (${reais(h.vale.saldo ?? 0, true)}).` : ""}
          </NotaDoc>

          <SecaoDoc titulo="Recebimentos × pagamentos">
            <BarrasAgrupadas
              categorias={h.meses.map((m) => mesCurto(m.mes))}
              barras={[
                { nome: "Recebimentos", cor: COR.receita, valores: h.meses.map((m) => m.entradas) },
                { nome: "Pagamentos", cor: COR.despesa, valores: h.meses.map((m) => m.saidas) },
              ]}
              linhas={[{ nome: "Resultado", cor: COR.lucro, valores: h.meses.map((m) => m.resultado) }]}
              altura={230}
            />
            <p className="mt-2 text-xs leading-relaxed text-cinza-suave">
              <strong className="text-[#15803D]">Positivos:</strong> {h.positivos.map((m) => `${nomeMes(m.mes)} (${sinal(m.resultado)})`).join(", ") || "nenhum"}.{" "}
              <strong className="text-[#B91C1C]">Pressão:</strong> {h.negativos.map((m) => `${nomeMes(m.mes)} (${sinal(m.resultado)})`).join(", ") || "nenhum"}.
            </p>
          </SecaoDoc>

          <SecaoDoc titulo="Saldo de caixa">
            <LinhaArea rotulos={rotulos} series={[{ nome: "Saldo", cor: COR.lucro, valores: saldos, area: true }]} altura={200} />
          </SecaoDoc>

          <SecaoDoc titulo="Geração de caixa mês a mês">
            <Cascata
              etapas={[
                ...(h.saldoInicial !== null ? [{ nome: "Inicial", valor: h.saldoInicial, tipo: "total" as const }] : []),
                ...h.meses.map((m) => ({ nome: mesCurto(m.mes).split("/")[0], valor: Math.abs(m.resultado), tipo: (m.resultado >= 0 ? "mais" : "menos") as "mais" | "menos" })),
                { nome: "Final", valor: h.saldoFinal ?? 0, tipo: "total" as const },
              ]}
              altura={240}
            />
          </SecaoDoc>

          <SecaoDoc titulo="Fechamentos do período">
            <TabelaDoc
              colunas={[{ titulo: "Mês" }, { titulo: "Recebido", alinhar: "dir" }, { titulo: "Pago", alinhar: "dir" }, { titulo: "Resultado", alinhar: "dir" }, { titulo: "Saldo", alinhar: "dir" }]}
              linhas={h.meses.map((m) => [
                nomeMes(m.mes),
                reais(m.entradas, true),
                reais(m.saidas, true),
                <span key={m.mes} className={m.resultado >= 0 ? "text-[#15803D]" : "text-[#B91C1C]"}>
                  {sinal(m.resultado)}
                </span>,
                m.saldo === null ? "—" : reais(m.saldo, true),
              ])}
              total={["Total", reais(h.totalEntradas, true), reais(h.totalSaidas, true), sinal(h.geracao), h.saldoFinal === null ? "—" : reais(h.saldoFinal, true)]}
            />
          </SecaoDoc>

          {h.receitas.length > 0 && (
            <SecaoDoc titulo="Receitas por fonte" descricao={`Convênios somam ${pct(h.conveniosPct)} da receita do período.`}>
              <TabelaDoc
                colunas={[{ titulo: "Fonte" }, { titulo: "Tipo" }, { titulo: "Valor", alinhar: "dir" }, { titulo: "Participação", alinhar: "dir" }]}
                linhas={h.receitas.map((c) => [c.item + (c.estimado ? " *" : ""), ROTULO_NATUREZA[c.natureza], reais(Number(c.valor), true), pct(totalRec ? (Number(c.valor) / totalRec) * 100 : 0, 1)])}
                total={["Total", "", reais(totalRec, true), "100%"]}
              />
            </SecaoDoc>
          )}

          {h.saidasComp.length > 0 && (
            <SecaoDoc titulo="Saídas por categoria" descricao="Sócios, empréstimos e investimentos são usos do caixa, não custo de funcionar.">
              <TabelaDoc
                colunas={[{ titulo: "Categoria" }, { titulo: "Natureza" }, { titulo: "Valor", alinhar: "dir" }, { titulo: "Participação", alinhar: "dir" }]}
                linhas={h.saidasComp.map((c) => [c.item + (c.estimado ? " *" : ""), ROTULO_NATUREZA[c.natureza], reais(Number(c.valor), true), pct(h.totalSaidas ? (Number(c.valor) / h.totalSaidas) * 100 : 0, 1)])}
                total={["Total", "", reais(h.saidasComp.reduce((s, c) => s + Number(c.valor), 0), true), "100%"]}
              />
            </SecaoDoc>
          )}

          <SecaoDoc titulo="Alertas e riscos">
            <ol className="grid gap-3">
              {alertas.map((a, i) => (
                <li key={a.titulo} className="flex gap-3 text-xs">
                  <span className="grid size-6 shrink-0 place-items-center rounded-md bg-[#FEF4E2] font-bold text-[#B45309]">{i + 1}</span>
                  <span>
                    <strong className="text-cinza-texto">{a.titulo}.</strong> <span className="text-cinza-suave">{a.texto}</span>
                  </span>
                </li>
              ))}
            </ol>
          </SecaoDoc>

          <SecaoDoc titulo="Pontos positivos">
            <ul className="grid grid-cols-2 gap-3">
              {destaques.map((d) => (
                <li key={d.titulo} className="border-t-2 border-teal pt-1.5 text-xs">
                  <strong className="block text-azul-medico">{d.titulo}</strong>
                  <span className="text-cinza-suave">{d.texto}</span>
                </li>
              ))}
            </ul>
          </SecaoDoc>

          <SecaoDoc titulo="Conclusão">
            <TabelaDoc
              colunas={[{ titulo: "Indicador" }, { titulo: "Valor", alinhar: "dir" }]}
              linhas={[
                ["Total recebido no período", reais(h.totalEntradas, true)],
                ...(ultimoOp ? [[`Receita operacional de ${nomeMes(ultimoOp.mes)}`, reais(ultimoOp.receitaOperacional ?? 0, true)]] : []),
                ["Geração de caixa do período", sinal(h.geracao)],
                ...(h.socios ? [["Distribuído aos sócios", reais(h.socios, true)]] : []),
                ...(h.investimento ? [["Investido", reais(h.investimento, true)]] : []),
                ["Saldo no fim do período", h.saldoFinal === null ? "—" : reais(h.saldoFinal, true)],
              ]}
            />
            {[...h.receitas, ...h.saidasComp].some((c) => c.estimado) && (
              <p className="mt-2 text-[10px] text-cinza-suave">* Valor calculado a partir do percentual informado no documento de origem.</p>
            )}
          </SecaoDoc>
        </>
      )}
    </Documento>
  );
}
