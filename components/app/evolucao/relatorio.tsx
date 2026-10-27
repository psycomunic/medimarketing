import Link from "next/link";
import { calcularKpis, formatarMultiplicador, formatarNumero, formatarPercentual, formatarReais, mesPorExtenso, rotuloMes, variacao } from "@/lib/indicadores";
import { calcularEvolucao } from "@/lib/evolucao";
import type { IndicadorMensal, PlanoCliente } from "@/lib/supabase/types";
import { Logo } from "@/components/logo";
import { BotaoImprimir } from "@/components/app/formularios/botao-imprimir";
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
  meses,
  plano,
  mes,
  hrefMes,
}: {
  clinica: string;
  meses: IndicadorMensal[];
  plano: PlanoCliente | null;
  /** "YYYY-MM-01" */
  mes: string;
  /** Monta o link de outro mês do seletor. */
  hrefMes: (mes: string) => string;
}) {
  const emOrdem = [...meses].sort((a, b) => a.mes.localeCompare(b.mes));
  const ate = emOrdem.filter((m) => m.mes <= mes);
  const atual = ate[ate.length - 1];
  if (!atual || atual.mes !== mes) {
    return <p className="mt-8 text-cinza-suave">Não há números lançados para este mês.</p>;
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

  return (
    <article className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <nav aria-label="Mês do relatório" className="flex flex-wrap gap-1.5">
          {emOrdem
            .slice(-12)
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
        <BotaoImprimir />
      </div>

      <header className="mt-6 rounded-lg border border-border bg-white p-6 shadow-soft print:border-0 print:p-0 print:shadow-none">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Logo href="/" altura={28} />
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-teal">Relatório mensal</span>
        </div>
        <h1 className="mt-5 text-2xl md:text-3xl">{mesPorExtenso(mes)}</h1>
        <p className="mt-1 text-cinza-suave">{clinica}</p>
      </header>

      <section className="mt-6 overflow-hidden rounded-lg border border-border bg-white shadow-soft print:break-inside-avoid">
        <h2 className="border-b border-border px-6 py-4 text-lg font-semibold text-azul-medico">O mês em números</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-cinza-suave">
                <th className="px-6 py-3 font-semibold">Indicador</th>
                <th className="px-4 py-3 text-right font-semibold">{rotuloMes(mes)}</th>
                <th className="px-4 py-3 text-right font-semibold">
                  {anterior ? `vs ${rotuloMes(anterior.mes)}` : "Mês anterior"}
                </th>
                <th className="px-6 py-3 text-right font-semibold">vs marco zero</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {linhas.map((l) => (
                <tr key={l.rotulo}>
                  <td className="px-6 py-3 text-cinza-texto">{l.rotulo}</td>
                  <td className="px-4 py-3 text-right font-semibold text-azul-medico">{l.f(l.atual)}</td>
                  <td className="px-4 py-3 text-right">
                    <Delta atual={l.atual} referencia={l.ant} menorMelhor={l.menorMelhor} />
                  </td>
                  <td className="px-6 py-3 text-right">
                    <Delta atual={l.atual} referencia={l.base} menorMelhor={l.menorMelhor} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="border-t border-border px-6 py-3 text-sm text-cinza-suave">
          De cada 10 leads, {(k.taxaLeadPaciente / 10).toFixed(1).replace(".", ",")} viraram consulta realizada
          {kAnt && ` (no mês anterior, ${(kAnt.taxaLeadPaciente / 10).toFixed(1).replace(".", ",")})`}.
          {estimados.length > 0 && " Alguns números deste mês foram informados como estimativa."}
        </p>
      </section>

      {comentario && (
        <section className="mt-6 rounded-lg border border-teal/30 bg-verde-menta/50 p-6 print:break-inside-avoid">
          <h2 className="text-base font-semibold text-azul-medico">Leitura da MediMarketing</h2>
          <p className="mt-2 whitespace-pre-wrap leading-relaxed text-cinza-texto">{comentario}</p>
        </section>
      )}

      <PainelEvolucao meses={ate} plano={plano} />
    </article>
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
