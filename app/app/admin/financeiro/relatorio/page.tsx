import { exigirModulo } from "@/lib/acesso";
import { getAgencia } from "@/lib/supabase/financeiro-dados";
import {
  ROTULO_EVENTO,
  ROTULO_PLANO,
  fimFidelidade,
  indicadoresAgencia,
  margemPorCliente,
  ponteDoMes,
  resumoFaturas,
  rotuloCusto,
  serieMrr,
  vencida,
} from "@/lib/financeiro/agencia";
import { hojeIso, mesCurto, mesLongo, ultimosMeses, variacao } from "@/lib/financeiro/calculos";
import { BarrasAgrupadas, LinhaArea } from "@/components/graficos/graficos";
import { COR, pct, reais } from "@/components/graficos/formato";
import { Documento, KpisDoc, NotaDoc, SecaoDoc, TabelaDoc } from "@/components/relatorio/documento";
import { mesDaUrl } from "@/components/app/financeiro/ui";

export const metadata = { title: "Relatório da agência" };

const dataBr = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR");

export default async function RelatorioAgencia({ searchParams }: { searchParams: { mes?: string } }) {
  await exigirModulo("admin-financeiro");
  const mes = mesDaUrl(searchParams.mes);
  const meses = ultimosMeses(mes, 12);
  const { contratos, eventos, faturas, custos, clientes } = await getAgencia();
  const nome = (id: string) => clientes.find((c) => c.id === id)?.nome ?? "Clínica";
  const hoje = hojeIso();

  const ind = indicadoresAgencia(contratos, eventos, mes);
  const serie = serieMrr(eventos, meses);
  const ponte = ponteDoMes(eventos, mes);
  const fat = resumoFaturas(faturas, mes);
  const recebido = (m: string) => faturas.filter((f) => f.status === "paga" && (f.pago_em ?? "").startsWith(m)).reduce((s, f) => s + Number(f.valor), 0);
  const custo = (m: string) => custos.filter((c) => c.competencia.startsWith(m)).reduce((s, c) => s + Number(c.valor), 0);
  const ativos = contratos.filter((c) => c.status === "ativo").sort((a, b) => Number(b.mensalidade) - Number(a.mensalidade));
  const margens = margemPorCliente(contratos, custos, mes);
  const vencidas = faturas.filter((f) => vencida(f, hoje)).sort((a, b) => a.vencimento.localeCompare(b.vencimento));
  const doMesEventos = eventos.filter((e) => e.data.startsWith(mes));
  const porCat = new Map<string, number>();
  for (const c of custos.filter((x) => x.competencia.startsWith(mes))) porCat.set(c.categoria, (porCat.get(c.categoria) ?? 0) + Number(c.valor));
  const vMrr = variacao(serie[serie.length - 1]?.mrr ?? 0, serie[serie.length - 2]?.mrr ?? 0);
  const resultado = recebido(mes) - custo(mes);

  return (
    <Documento
      titulo="Relatório financeiro da agência"
      subtitulo={mesLongo(mes).replace(/^./, (c) => c.toUpperCase())}
      emitidoPara="Uso interno · Medi Marketing"
      marca={{ nome: "Medi Marketing", sistema: true }}
      voltar={{ href: `/app/admin/financeiro?mes=${mes}`, rotulo: "Voltar ao financeiro da agência" }}
      nomeArquivo={`Relatorio agencia ${mes}`}
    >
      <KpisDoc
        itens={[
          { rotulo: "MRR", valor: reais(ind.mrr), nota: vMrr === null ? "—" : `${vMrr >= 0 ? "▲" : "▼"} ${pct(Math.abs(vMrr), 1)} no mês`, tom: vMrr === null ? "neutro" : vMrr >= 0 ? "bom" : "ruim", destaque: true },
          { rotulo: "ARR", valor: reais(ind.arr) },
          { rotulo: "Clientes ativos", valor: String(ind.clientes), nota: `Ticket ${reais(ind.arpa)}` },
          { rotulo: "Churn médio 6m", valor: pct(ind.churnMedio, 1), tom: ind.churnMedio > 3 ? "ruim" : "bom", nota: ind.churnMedio > 3 ? "Acima de 3% ao mês" : "Sob controle" },
          { rotulo: "Recebido no mês", valor: reais(recebido(mes)), nota: `${reais(fat.faturado)} faturado` },
          { rotulo: "Custos do mês", valor: reais(custo(mes)) },
          { rotulo: "Resultado", valor: reais(resultado), tom: resultado >= 0 ? "bom" : "ruim", nota: recebido(mes) ? `Margem ${pct((resultado / recebido(mes)) * 100, 1)}` : undefined },
          { rotulo: "Inadimplência", valor: reais(fat.vencido), tom: fat.vencido ? "ruim" : "bom", nota: `${fat.clientesInadimplentes} cliente(s)` },
        ]}
      />

      <NotaDoc titulo="Ponte do MRR no mês">
        Começou em <strong>{reais(ponte.inicio)}</strong>, entraram <strong>{reais(ponte.novo)}</strong> de clientes novos e{" "}
        <strong>{reais(ponte.expansao)}</strong> de upgrades; saíram <strong>{reais(ponte.contracao)}</strong> em downgrades e pausas e{" "}
        <strong>{reais(ponte.cancelado)}</strong> em cancelamentos. Fechou em <strong>{reais(ponte.fim)}</strong>.
      </NotaDoc>

      <SecaoDoc titulo="MRR · 12 meses">
        <LinhaArea rotulos={meses.map(mesCurto)} series={[{ nome: "MRR", cor: COR.lucro, valores: serie.map((p) => p.mrr), area: true }]} altura={210} />
      </SecaoDoc>

      <SecaoDoc titulo="Recebido x custos · 12 meses">
        <BarrasAgrupadas
          categorias={meses.map(mesCurto)}
          barras={[
            { nome: "Recebido", cor: COR.receita, valores: meses.map(recebido) },
            { nome: "Custos", cor: COR.despesa, valores: meses.map(custo) },
          ]}
          destaque={meses.length - 1}
          altura={210}
        />
      </SecaoDoc>

      <SecaoDoc titulo="Carteira de clientes" inteira={false}>
        <TabelaDoc
          colunas={[{ titulo: "Clínica" }, { titulo: "Plano" }, { titulo: "Início" }, { titulo: "Fidelidade até" }, { titulo: "Mensalidade", alinhar: "dir" }]}
          linhas={ativos.map((c) => [nome(c.organization_id), ROTULO_PLANO[c.plano] ?? c.plano, dataBr(c.inicio), c.fidelidade_meses ? dataBr(fimFidelidade(c)) : "—", reais(Number(c.mensalidade))])}
          total={["Total", "", "", "", reais(ind.mrr)]}
          vazio="Nenhum contrato ativo."
        />
      </SecaoDoc>

      {doMesEventos.length > 0 && (
        <SecaoDoc titulo="Movimentos do mês">
          <TabelaDoc
            colunas={[{ titulo: "Data" }, { titulo: "Clínica" }, { titulo: "Movimento" }, { titulo: "Antes", alinhar: "dir" }, { titulo: "Depois", alinhar: "dir" }]}
            linhas={doMesEventos.map((e) => {
              const c = contratos.find((x) => x.id === e.contrato_id);
              return [dataBr(e.data), c ? nome(c.organization_id) : "—", ROTULO_EVENTO[e.tipo], reais(Number(e.mrr_antes)), reais(Number(e.mrr_depois))];
            })}
          />
        </SecaoDoc>
      )}

      <SecaoDoc titulo="Margem por cliente" descricao="Mensalidade menos custo dedicado e rateio dos custos gerais.">
        <TabelaDoc
          colunas={[{ titulo: "Clínica" }, { titulo: "Mensalidade", alinhar: "dir" }, { titulo: "Custo", alinhar: "dir" }, { titulo: "Margem", alinhar: "dir" }, { titulo: "%", alinhar: "dir" }]}
          linhas={margens.map((m) => [
            nome(m.organizationId),
            reais(m.receita),
            reais(m.custoDireto + m.rateio),
            <span key={m.organizationId} className={m.margem < 0 ? "font-semibold text-[#B91C1C]" : "font-semibold"}>
              {reais(m.margem)}
            </span>,
            pct(m.margemPct),
          ])}
        />
      </SecaoDoc>

      <SecaoDoc titulo="Custos do mês por categoria">
        <TabelaDoc
          colunas={[{ titulo: "Categoria" }, { titulo: "Valor", alinhar: "dir" }, { titulo: "Participação", alinhar: "dir" }]}
          linhas={[...porCat.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => [rotuloCusto(k), reais(v), pct(custo(mes) ? (v / custo(mes)) * 100 : 0, 1)])}
          total={["Total", reais(custo(mes)), "100%"]}
          vazio="Nenhum custo lançado no mês."
        />
      </SecaoDoc>

      <SecaoDoc titulo="Faturas vencidas" inteira={false}>
        <TabelaDoc
          colunas={[{ titulo: "Clínica" }, { titulo: "Descrição" }, { titulo: "Vencimento" }, { titulo: "Atraso", alinhar: "dir" }, { titulo: "Valor", alinhar: "dir" }]}
          linhas={vencidas.map((f) => [
            nome(f.organization_id),
            f.descricao,
            dataBr(f.vencimento),
            `${Math.round((Date.parse(hoje) - Date.parse(f.vencimento)) / 86400000)} dias`,
            reais(Number(f.valor)),
          ])}
          total={vencidas.length ? ["Total", "", "", "", reais(fat.vencido)] : undefined}
          vazio="Nenhuma fatura vencida."
        />
      </SecaoDoc>
    </Documento>
  );
}
