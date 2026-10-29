import Link from "next/link";
import { calcularKpis, formatarMultiplicador, formatarNumero, formatarPercentual, formatarReais, mesPorExtenso, rotuloMes, variacao } from "@/lib/indicadores";
import { calcularEvolucao } from "@/lib/evolucao";
import type { IndicadorMensal, PlanoCliente } from "@/lib/supabase/types";
import { Documento, KpisDoc, NotaDoc, SecaoDoc, TabelaDoc } from "@/components/relatorio/documento";
import { BarrasAgrupadas } from "@/components/graficos/graficos";
import { COR } from "@/components/graficos/formato";
import { PainelEvolucao } from "@/components/app/evolucao/painel-evolucao";
import { cn } from "@/lib/utils";

/** Textos que a importação grava sozinha: não são comentário de ninguém. */
const AUTOMATICOS = [
  "Informado pela clínica no diagnóstico inicial.",
  "Informado pela clínica no check-in mensal.",
];

/**
 * Relatório de um mês: o material da reunião mensal com a clínica.
 *
 * O mês escolhido contra o anterior e contra o marco zero, o comentário
 * da equipe e a evolução até ali. Feito para imprimir ou salvar em PDF.
 */
export function RelatorioMensal({
  clinica,
  logoUrl = null,
  meses,
  plano,
  mes,
  hrefMes,
  voltar,
}: {
  clinica: string;
  logoUrl?: string | null;
  meses: IndicadorMensal[];
  plano: PlanoCliente | null;
  /** "YYYY-MM-01" */
  mes: string;
  /** Monta o link de outro mês do seletor. */
  hrefMes: (mes: string) => string;
  voltar: { href: string; rotulo: string };
}) {
  const emOrdem = [...meses].sort((a, b) => a.mes.localeCompare(b.mes));
  const ate = emOrdem.filter((m) => m.mes <= mes);
  const atual = ate[ate.length - 1];

  const seletor = (
    <nav aria-label="Mês do relatório" className="flex max-w-full flex-wrap gap-1.5">
      {emOrdem
        .slice(-6)
        .reverse()
        .map((m) => (
          <Link
            key={m.mes}
            href={hrefMes(m.mes)}
            aria-current={m.mes === mes ? "page" : undefined}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-semibold",
              m.mes === mes ? "bg-azul-medico text-white" : "bg-white text-cinza-suave hover:text-azul-medico"
            )}
          >
            {rotuloMes(m.mes)}
          </Link>
        ))}
    </nav>
  );

  if (!atual || atual.mes !== mes) {
    return (
      <Documento
        titulo="Relatório mensal de resultados"
        subtitulo={mesPorExtenso(mes)}
        marca={{ nome: clinica, logoUrl }}
        voltar={voltar}
        nomeArquivo={`Relatorio mensal ${clinica}`}
        acoes={seletor}
      >
        <p className="text-sm text-cinza-suave">Não há números lançados para este mês.</p>
      </Documento>
    );
  }

  const anterior = ate[ate.length - 2] ?? null;
  const k = calcularKpis([atual]);
  const kAnt = anterior ? calcularKpis([anterior]) : null;
  const ev = calcularEvolucao(ate, plano);
  const base = ev && atual.mes > (plano?.base_fim ?? "") ? ev.mediaBase : null;

  const linhas = [
    { rotulo: "Faturamento", atual: k.faturamento, ant: kAnt?.faturamento, base: base?.faturamento, f: (v: number) => formatarReais(v) },
    { rotulo: "Investimento em anúncios", atual: k.investimento, ant: kAnt?.investimento, base: base?.investimento, f: (v: number) => formatarReais(v) },
    { rotulo: "Leads", atual: k.leads, ant: kAnt?.leads, base: base?.leads, f: formatarNumero },
    { rotulo: "Consultas agendadas", atual: k.agendamentos, ant: kAnt?.agendamentos, base: base?.agendamentos, f: formatarNumero },
    { rotulo: "Consultas realizadas", atual: k.comparecimentos, ant: kAnt?.comparecimentos, base: base?.comparecimentos, f: formatarNumero },
    { rotulo: "Retorno sobre o investimento", atual: k.roi, ant: kAnt?.roi, base: base?.roi, f: formatarMultiplicador },
    { rotulo: "Custo por lead", atual: k.cpl, ant: kAnt?.cpl, base: base?.cpl, f: (v: number) => formatarReais(v, true), menorMelhor: true },
  ];

  const comentario = atual.observacao && !AUTOMATICOS.includes(atual.observacao) ? atual.observacao : null;
  const estimados = atual.campos_estimados ?? [];
  const doze = ate.slice(-12);
  const tom = (a: number, b?: number, menor?: boolean): "bom" | "ruim" | "neutro" =>
    !b ? "neutro" : (menor ? a <= b : a >= b) ? "bom" : "ruim";
  const nota = (a: number, b?: number) => {
    if (!b) return "sem mês anterior";
    const v = variacao(a, b);
    return `${v >= 0 ? "▲" : "▼"} ${formatarPercentual(Math.abs(v))} no mês`;
  };

  return (
    <Documento
      titulo="Relatório mensal de resultados"
      subtitulo={mesPorExtenso(mes)}
      emitidoPara="Preparado pela equipe Medi Marketing"
      marca={{ nome: clinica, logoUrl }}
      voltar={voltar}
      nomeArquivo={`Relatorio mensal ${clinica} ${mes.slice(0, 7)}`}
      acoes={seletor}
    >
      <KpisDoc
        itens={[
          { rotulo: "Faturamento", valor: formatarReais(k.faturamento), nota: nota(k.faturamento, kAnt?.faturamento), tom: tom(k.faturamento, kAnt?.faturamento), destaque: true },
          { rotulo: "Retorno (ROI)", valor: formatarMultiplicador(k.roi), nota: nota(k.roi, kAnt?.roi), tom: tom(k.roi, kAnt?.roi) },
          { rotulo: "Leads", valor: formatarNumero(k.leads), nota: nota(k.leads, kAnt?.leads), tom: tom(k.leads, kAnt?.leads) },
          { rotulo: "Consultas realizadas", valor: formatarNumero(k.comparecimentos), nota: nota(k.comparecimentos, kAnt?.comparecimentos), tom: tom(k.comparecimentos, kAnt?.comparecimentos) },
        ]}
      />

      <SecaoDoc titulo="O mês em números" descricao="Comparado com o mês anterior e com o marco zero (antes do acompanhamento).">
        <TabelaDoc
          colunas={[
            { titulo: "Indicador" },
            { titulo: rotuloMes(mes), alinhar: "dir" },
            { titulo: anterior ? `vs ${rotuloMes(anterior.mes)}` : "Mês anterior", alinhar: "dir" },
            { titulo: "vs marco zero", alinhar: "dir" },
          ]}
          linhas={linhas.map((l) => [
            l.rotulo,
            <strong key="v" className="text-azul-medico">
              {l.f(l.atual)}
            </strong>,
            <Delta key="a" atual={l.atual} referencia={l.ant} menorMelhor={l.menorMelhor} />,
            <Delta key="b" atual={l.atual} referencia={l.base} menorMelhor={l.menorMelhor} />,
          ])}
        />
        <p className="mt-2 text-xs text-cinza-suave">
          De cada 10 leads, {(k.taxaLeadPaciente / 10).toFixed(1).replace(".", ",")} viraram consulta realizada
          {kAnt && ` (no mês anterior, ${(kAnt.taxaLeadPaciente / 10).toFixed(1).replace(".", ",")})`}.
          {estimados.length > 0 && " Alguns números deste mês foram informados como estimativa."}
        </p>
      </SecaoDoc>

      {comentario && (
        <NotaDoc titulo="Leitura da Medi Marketing">
          <p className="whitespace-pre-wrap">{comentario}</p>
        </NotaDoc>
      )}

      {doze.length > 1 && (
        <SecaoDoc titulo="Investimento e faturamento" descricao={`Últimos ${doze.length} meses.`}>
          <BarrasAgrupadas
            categorias={doze.map((m) => rotuloMes(m.mes))}
            barras={[
              { nome: "Investimento", cor: COR.despesa, valores: doze.map((m) => Number(m.investimento)) },
              { nome: "Faturamento", cor: COR.receita, valores: doze.map((m) => Number(m.faturamento)) },
            ]}
            destaque={doze.length - 1}
            altura={220}
          />
        </SecaoDoc>
      )}

      <div className="doc-bloco">
        <PainelEvolucao meses={ate} plano={plano} />
      </div>
    </Documento>
  );
}

function Delta({
  atual,
  referencia,
  menorMelhor,
}: {
  atual: number;
  referencia: number | undefined;
  menorMelhor?: boolean;
}) {
  if (!referencia) return <span className="text-cinza-suave/70">—</span>;
  const v = variacao(atual, referencia);
  if (Math.abs(v) < 0.5) return <span className="text-cinza-suave">estável</span>;
  const bom = menorMelhor ? v < 0 : v > 0;
  return (
    <span className={cn("font-semibold", bom ? "text-sucesso" : "text-coral")}>
      {v > 0 ? "+" : "−"}
      {formatarPercentual(Math.abs(v))}
    </span>
  );
}
