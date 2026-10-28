import { exigirModulo } from "@/lib/acesso";
import {
  getConfigFinanceira,
  getContasAbertas,
  getDespesas,
  getProfissionais,
  getReceitas,
  getRecebiveis,
  getRegrasRepasse,
} from "@/lib/supabase/financeiro-dados";
import {
  calcularRepasses,
  dre,
  hojeIso,
  mesAnterior,
  mesCurto,
  mesLongo,
  pontoEquilibrio,
  porCategoria,
  porConvenio,
  porForma,
  porProcedimento,
  projecaoCaixa,
  resumoMes,
  rotuloCategoria,
  serieMensal,
  somarDias,
  ultimosMeses,
  variacao,
} from "@/lib/financeiro/calculos";
import { rotuloFormaPagamento } from "@/lib/rotulos";
import { BarrasAgrupadas, LinhaArea } from "@/components/graficos/graficos";
import { COR, pct, reais } from "@/components/graficos/formato";
import { Documento, KpisDoc, NotaDoc, SecaoDoc, TabelaDoc } from "@/components/relatorio/documento";
import { limites, mesDaUrl } from "@/components/app/financeiro/ui";

export const metadata = { title: "Relatório financeiro" };

function frase(rotulo: string, atual: number, anterior: number, subirBom = true, plural = false) {
  const v = variacao(atual, anterior);
  if (v === null) return `${rotulo}: ${reais(atual)}.`;
  const subiu = v >= 0;
  const bom = subirBom ? subiu : !subiu;
  const verbo = subiu ? (plural ? "subiram" : "subiu") : plural ? "caíram" : "caiu";
  return `${rotulo} ${verbo} ${pct(Math.abs(v), 1)} em relação ao mês anterior (${reais(atual)})${bom ? "" : " — vale olhar de perto"}.`;
}

export default async function RelatorioFinanceiro({ searchParams }: { searchParams: { mes?: string } }) {
  const { organizacao } = await exigirModulo("financeiro");
  const orgId = organizacao?.id ?? null;
  const mes = mesDaUrl(searchParams.mes);
  const meses = ultimosMeses(mes, 12);
  const { ate } = limites(mes);

  const [receitas, despesas, config, recebiveis, contas, regras, profissionais] = await Promise.all([
    getReceitas(orgId, `${meses[0]}-01`, ate),
    getDespesas(orgId, `${meses[0]}-01`, ate),
    getConfigFinanceira(orgId),
    getRecebiveis(orgId),
    getContasAbertas(orgId),
    getRegrasRepasse(orgId),
    getProfissionais(orgId),
  ]);

  const doMes = (m: string) => ({
    r: receitas.filter((l) => l.data_competencia.startsWith(m)),
    d: despesas.filter((x) => x.vencimento.startsWith(m)),
  });
  const atual = doMes(mes);
  const ant = doMes(mesAnterior(mes));
  const repasses = calcularRepasses(atual.r, regras);
  const r = resumoMes(atual.r, atual.d, config, repasses.reduce((s, x) => s + x.valor, 0));
  const ra = resumoMes(ant.r, ant.d, config, calcularRepasses(ant.r, regras).reduce((s, x) => s + x.valor, 0));
  const serie = serieMensal(meses, receitas, despesas, config);
  const linhasDre = dre(r);
  const pe = pontoEquilibrio(r);
  const caixa = projecaoCaixa(recebiveis, contas, Number(config?.saldo_inicial ?? 0), 30);
  const nomes = Object.fromEntries(profissionais.map((p) => [p.id, p.nome]));
  const hoje = hojeIso();
  const proximas = contas.filter((c) => c.vencimento <= somarDias(hoje, 30)).sort((a, b) => a.vencimento.localeCompare(b.vencimento));
  const convenios = porConvenio(atual.r);
  const saidas = (x: typeof r) => x.despesas + x.custosDiretos + x.taxas + x.impostos + x.repasse + x.glosas;
  const dataBr = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR");

  return (
    <Documento
      titulo="Relatório financeiro"
      subtitulo={mesLongo(mes).replace(/^./, (c) => c.toUpperCase())}
      emitidoPara={organizacao?.responsavel ? `Preparado para ${organizacao.responsavel}` : undefined}
      marca={{ nome: organizacao?.nome ?? "Clínica", logoUrl: organizacao?.logo_url ?? null }}
      voltar={{ href: `/app/financeiro?mes=${mes}`, rotulo: "Voltar ao financeiro" }}
      nomeArquivo={`Relatorio financeiro ${organizacao?.nome ?? ""} ${mes}`.trim()}
    >
      <KpisDoc
        itens={[
          { rotulo: "Faturamento", valor: reais(r.receitaBruta), nota: variacaoTexto(r.receitaBruta, ra.receitaBruta), tom: tom(r.receitaBruta, ra.receitaBruta) },
          { rotulo: "Recebido", valor: reais(r.recebido), nota: `${reais(r.aReceber + r.atrasado)} a receber` },
          { rotulo: "Saídas", valor: reais(saidas(r)), nota: variacaoTexto(saidas(r), saidas(ra)), tom: tom(saidas(ra), saidas(r)) },
          { rotulo: "Lucro", valor: reais(r.lucro), nota: `Margem de ${pct(r.margem, 1)}`, destaque: true },
          { rotulo: "Atendimentos", valor: String(r.atendimentos), nota: `${r.pacientes} pacientes` },
          { rotulo: "Ticket médio", valor: reais(r.ticketMedio), nota: variacaoTexto(r.ticketMedio, ra.ticketMedio), tom: tom(r.ticketMedio, ra.ticketMedio) },
          { rotulo: "Convênio", valor: reais(r.convenio), nota: `${pct(r.receitaBruta ? (r.convenio / r.receitaBruta) * 100 : 0)} da receita` },
          { rotulo: "Ponto de equilíbrio", valor: pe.receitaNecessaria ? reais(pe.receitaNecessaria) : "—", nota: pe.falta ? `Faltam ${reais(pe.falta)}` : "Atingido", tom: pe.falta ? "ruim" : "bom" },
        ]}
      />

      <NotaDoc titulo="Leitura do mês">
        <ul className="list-disc space-y-1 pl-4">
          <li>{frase("O faturamento", r.receitaBruta, ra.receitaBruta)}</li>
          <li>{frase("O lucro", r.lucro, ra.lucro)}</li>
          <li>{frase("As saídas", saidas(r), saidas(ra), false, true)}</li>
          {r.glosas > 0 && <li>Os convênios glosaram {reais(r.glosas)} ({pct(r.convenio ? (r.glosas / r.convenio) * 100 : 0, 1)} do faturado).</li>}
        </ul>
      </NotaDoc>

      <SecaoDoc titulo="Receita, saídas e lucro · 12 meses">
        <BarrasAgrupadas
          categorias={serie.map((p) => mesCurto(p.mes))}
          barras={[
            { nome: "Receita", cor: COR.receita, valores: serie.map((p) => p.receita) },
            { nome: "Saídas", cor: COR.despesa, valores: serie.map((p) => p.despesas) },
          ]}
          linhas={[{ nome: "Lucro", cor: COR.lucro, valores: serie.map((p) => p.lucro) }]}
          destaque={serie.length - 1}
          altura={240}
        />
      </SecaoDoc>

      <SecaoDoc titulo="Demonstrativo de resultado" descricao="Visão gerencial simplificada. Impostos estimados pela alíquota configurada.">
        <TabelaDoc
          colunas={[
            { titulo: "Conta" },
            { titulo: mesCurto(mes), alinhar: "dir", largura: "22%" },
            { titulo: "% receita", alinhar: "dir", largura: "14%" },
            { titulo: mesCurto(mesAnterior(mes)), alinhar: "dir", largura: "22%" },
          ]}
          linhas={linhasDre.map((l, i) => {
            const fmt = (v: number) => (l.tipo === "menos" ? (v ? `− ${reais(v)}` : "—") : reais(v));
            const nome = l.tipo === "total" ? <strong className="text-azul-medico">{l.rotulo}</strong> : <span className="pl-3">{l.rotulo}</span>;
            return [
              nome,
              l.tipo === "total" ? <strong>{fmt(l.valor)}</strong> : fmt(l.valor),
              r.receitaBruta ? pct((l.valor / r.receitaBruta) * 100, 1) : "—",
              fmt(dre(ra)[i].valor),
            ];
          })}
        />
      </SecaoDoc>

      <SecaoDoc titulo="Como os pacientes pagaram">
        <TabelaDoc
          colunas={[{ titulo: "Forma de pagamento" }, { titulo: "Valor", alinhar: "dir" }, { titulo: "Participação", alinhar: "dir" }]}
          linhas={porForma(atual.r).map((f) => [
            rotuloFormaPagamento[f.forma],
            reais(f.valor),
            <BarraPct key={f.forma} valor={r.receitaBruta ? (f.valor / r.receitaBruta) * 100 : 0} />,
          ])}
          total={["Total", reais(r.receitaBruta), "100%"]}
        />
      </SecaoDoc>

      <SecaoDoc titulo="Procedimentos que mais faturaram">
        <TabelaDoc
          colunas={[{ titulo: "Procedimento" }, { titulo: "Qtd.", alinhar: "dir", largura: "10%" }, { titulo: "Faturado", alinhar: "dir", largura: "20%" }, { titulo: "Margem", alinhar: "dir", largura: "14%" }]}
          linhas={porProcedimento(atual.r)
            .slice(0, 10)
            .map((p) => [p.nome, String(p.quantidade), reais(p.valor), p.valor ? pct(((p.valor - p.custo) / p.valor) * 100) : "—"])}
        />
      </SecaoDoc>

      <SecaoDoc titulo="Despesas por categoria">
        <TabelaDoc
          colunas={[{ titulo: "Categoria" }, { titulo: "Valor", alinhar: "dir" }, { titulo: "Participação", alinhar: "dir" }]}
          linhas={porCategoria(atual.d).map((c) => [c.nome, reais(c.valor), <BarraPct key={c.categoria} valor={r.despesas ? (c.valor / r.despesas) * 100 : 0} cor={COR.despesa} />])}
          total={["Total", reais(r.despesas), "100%"]}
          vazio="Nenhuma despesa lançada no mês."
        />
      </SecaoDoc>

      {convenios.length > 0 && (
        <SecaoDoc titulo="Convênios">
          <TabelaDoc
            colunas={[
              { titulo: "Convênio" },
              { titulo: "Atend.", alinhar: "dir" },
              { titulo: "Faturado", alinhar: "dir" },
              { titulo: "Glosado", alinhar: "dir" },
              { titulo: "Recebido", alinhar: "dir" },
              { titulo: "Glosa", alinhar: "dir" },
            ]}
            linhas={convenios.map((c) => [c.convenio, String(c.atendimentos), reais(c.faturado), c.glosado ? reais(c.glosado) : "—", reais(c.recebido), pct(c.taxaGlosa, 1)])}
          />
        </SecaoDoc>
      )}

      {repasses.length > 0 && (
        <SecaoDoc titulo="Repasse aos profissionais">
          <TabelaDoc
            colunas={[{ titulo: "Profissional" }, { titulo: "Atendimentos", alinhar: "dir" }, { titulo: "Base", alinhar: "dir" }, { titulo: "Repasse", alinhar: "dir" }]}
            linhas={repasses.map((x) => [nomes[x.medicoId] ?? "Profissional", String(x.atendimentos), reais(x.base), reais(x.valor, true)])}
            total={["Total", "", "", reais(repasses.reduce((s, x) => s + x.valor, 0), true)]}
          />
        </SecaoDoc>
      )}

      <SecaoDoc titulo="Caixa previsto · próximos 30 dias" descricao={`A partir de ${reais(Number(config?.saldo_inicial ?? 0))} em caixa informados.`}>
        <LinhaArea
          rotulos={caixa.map((d) => new Date(`${d.dia}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }))}
          series={[{ nome: "Saldo previsto", cor: COR.lucro, valores: caixa.map((d) => d.saldo), area: true }]}
          altura={200}
        />
      </SecaoDoc>

      <SecaoDoc titulo="Contas a pagar · próximos 30 dias" inteira={false}>
        <TabelaDoc
          colunas={[{ titulo: "Vencimento", largura: "16%" }, { titulo: "Descrição" }, { titulo: "Categoria" }, { titulo: "Valor", alinhar: "dir" }]}
          linhas={proximas.map((c) => [
            c.vencimento < hoje ? <span className="font-semibold text-[#B91C1C]">{dataBr(c.vencimento)}</span> : dataBr(c.vencimento),
            c.descricao,
            rotuloCategoria(c.categoria),
            reais(Number(c.valor), true),
          ])}
          total={["", "Total", "", reais(proximas.reduce((s, c) => s + Number(c.valor), 0), true)]}
          vazio="Nenhuma conta a vencer nos próximos 30 dias."
        />
      </SecaoDoc>
    </Documento>
  );
}

function variacaoTexto(atual: number, anterior: number) {
  const v = variacao(atual, anterior);
  if (v === null) return "sem mês anterior";
  return `${v >= 0 ? "▲" : "▼"} ${pct(Math.abs(v), 1)} no mês`;
}
function tom(bomSeMaior: number, referencia: number): "bom" | "ruim" | "neutro" {
  if (!referencia) return "neutro";
  return bomSeMaior >= referencia ? "bom" : "ruim";
}

function BarraPct({ valor, cor = COR.receita }: { valor: number; cor?: string }) {
  return (
    <span className="inline-flex items-center justify-end gap-2">
      <span className="inline-block h-1.5 w-20 overflow-hidden rounded-full bg-[#EEF3F5]">
        <span className="block h-full rounded-full" style={{ width: `${Math.min(valor, 100)}%`, background: cor }} />
      </span>
      <span className="w-11 text-right">{pct(valor, 1)}</span>
    </span>
  );
}
