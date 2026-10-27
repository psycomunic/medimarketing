import { Flag, Minus, Target, TrendingDown, TrendingUp } from "lucide-react";
import { calcularEvolucao } from "@/lib/evolucao";
import {
  formatarNumero,
  formatarPercentual,
  formatarReais,
  mesPorExtenso,
  rotuloMes,
} from "@/lib/indicadores";
import type { IndicadorMensal, PlanoCliente } from "@/lib/supabase/types";
import { GraficoMeta } from "@/components/app/evolucao/grafico-meta";
import { cn } from "@/lib/utils";

/**
 * Onde a clínica estava no diagnóstico, onde está hoje e quanto falta
 * para a meta. Aparece no painel da clínica e no detalhe da carteira.
 */
export function PainelEvolucao({
  meses,
  plano,
}: {
  meses: IndicadorMensal[];
  plano: PlanoCliente | null;
}) {
  const ev = calcularEvolucao(meses, plano);
  if (!ev || !plano?.base_inicio || !plano.base_fim) return null;

  const periodoBase =
    ev.base.length > 1
      ? `${rotuloMes(plano.base_inicio)} a ${rotuloMes(plano.base_fim)}`
      : rotuloMes(plano.base_inicio);

  const pontos = [...meses]
    .sort((a, b) => a.mes.localeCompare(b.mes))
    .filter((m) => m.mes >= plano.base_inicio!)
    .map((m) => ({
      mes: m.mes,
      faturamento: Number(m.faturamento),
      estimado: !!m.campos_estimados?.includes("faturamento"),
    }));

  const maiorReceita = Math.max(1, ...ev.receitas.flatMap((r) => [r.base, r.atual ?? 0]));
  const valor = (v: number, moeda: boolean, percentual?: boolean) =>
    percentual ? formatarPercentual(v) : moeda ? formatarReais(v) : formatarNumero(v);

  return (
    <section className="mt-8 grid gap-6" aria-labelledby="evolucao-titulo">
      <div className="rounded-lg border border-border bg-white p-6 shadow-soft">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="evolucao-titulo" className="text-lg font-semibold text-azul-medico">
              Evolução desde o diagnóstico
            </h2>
            <p className="mt-1 text-sm text-cinza-suave">
              Marco zero: média de {periodoBase}
              {ev.atual
                ? ` · comparado a ${mesPorExtenso(ev.atual.mes)}`
                : " · o primeiro mês depois do diagnóstico aparece aqui quando for lançado"}
            </p>
          </div>
          {ev.mesesDepois > 0 && (
            <span className="rounded-full bg-verde-menta px-3 py-1 text-xs font-semibold text-teal">
              {ev.mesesDepois} {ev.mesesDepois === 1 ? "mês" : "meses"} de acompanhamento
            </span>
          )}
        </div>

        {ev.comparacoes.length > 0 ? (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {ev.comparacoes.map((c) => {
              const estavel = Math.abs(c.variacao) < 0.5;
              const Icone = estavel ? Minus : c.variacao > 0 ? TrendingUp : TrendingDown;
              return (
                <div key={c.rotulo} className="rounded-lg border border-border p-4">
                  <p className="text-sm text-cinza-suave">{c.rotulo}</p>
                  <p className="mt-1 font-heading text-xl font-bold text-azul-medico">
                    {valor(c.atual, c.moeda, c.percentual)}
                  </p>
                  <p className="mt-1 text-xs text-cinza-suave">
                    era {valor(c.base, c.moeda, c.percentual)}
                    {c.estimado && <span className="ml-1 text-alerta">· estimado</span>}
                  </p>
                  <p
                    className={cn(
                      "mt-2 inline-flex items-center gap-1 text-xs font-semibold",
                      estavel ? "text-cinza-suave" : c.variacao > 0 ? "text-sucesso" : "text-coral"
                    )}
                  >
                    <Icone className="size-3" />
                    {estavel
                      ? "estável"
                      : c.percentual
                        ? `${c.variacao > 0 ? "+" : ""}${c.variacao.toFixed(1).replace(".", ",")} p.p.`
                        : `${c.variacao > 0 ? "+" : ""}${formatarPercentual(c.variacao)}`}
                  </p>
                </div>
              );
            })}
          </div>
        ) : (
          <dl className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Faturamento médio", formatarReais(ev.mediaBase.faturamento)],
              ["Leads por mês", formatarNumero(ev.mediaBase.leads)],
              ["Consultas realizadas", formatarNumero(ev.mediaBase.comparecimentos)],
              ["Lead que vira consulta", formatarPercentual(ev.mediaBase.taxaLeadPaciente)],
            ].map(([r, v]) => (
              <div key={r} className="rounded-lg border border-dashed border-border p-4">
                <dt className="text-sm text-cinza-suave">{r}</dt>
                <dd className="mt-1 font-heading text-xl font-bold text-azul-medico">{v}</dd>
                <dd className="text-xs text-cinza-suave">marco zero</dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="rounded-lg border border-border bg-white p-6 shadow-soft">
          <h3 className="text-base font-semibold text-azul-medico">Faturamento e meta</h3>
          <p className="mb-4 mt-1 text-sm text-cinza-suave">Do marco zero até o último mês lançado.</p>
          <GraficoMeta
            pontos={pontos}
            meta={ev.meta?.valor ?? null}
            baseInicio={plano.base_inicio}
            baseFim={plano.base_fim}
          />
        </div>

        <div className="rounded-lg border border-border bg-white p-6 shadow-soft">
          <h3 className="flex items-center gap-2 text-base font-semibold text-azul-medico">
            <Target className="size-4 text-teal" /> Caminho até a meta
          </h3>
          {ev.meta ? (
            <>
              <p className="mt-3 font-heading text-3xl font-bold text-azul-medico">
                {formatarPercentual(ev.meta.progresso)}
              </p>
              <p className="text-sm text-cinza-suave">do caminho entre o marco zero e a meta</p>
              <div
                className="mt-4 h-2.5 overflow-hidden rounded-full bg-verde-menta"
                role="progressbar"
                aria-valuenow={Math.round(ev.meta.progresso)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Progresso até a meta de faturamento"
              >
                <div className="h-full rounded-full bg-teal" style={{ width: `${ev.meta.progresso}%` }} />
              </div>
              <dl className="mt-4 grid gap-1.5 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-cinza-suave">Marco zero</dt>
                  <dd>{formatarReais(ev.meta.base)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-cinza-suave">Último mês</dt>
                  <dd className="font-semibold text-azul-medico">{formatarReais(ev.meta.atual)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-cinza-suave">Meta</dt>
                  <dd>{formatarReais(ev.meta.valor)}</dd>
                </div>
                {ev.meta.prazo && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-cinza-suave">Prazo</dt>
                    <dd>{mesPorExtenso(ev.meta.prazo)}</dd>
                  </div>
                )}
              </dl>
            </>
          ) : (
            <p className="mt-3 text-sm text-cinza-suave">
              A meta de faturamento ainda não foi definida com a MediMarketing.
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {ev.receitas.length > 0 && (
          <div className="rounded-lg border border-border bg-white p-6 shadow-soft">
            <h3 className="text-base font-semibold text-azul-medico">Receita por serviço</h3>
            <p className="mt-1 text-sm text-cinza-suave">
              <span className="mr-1 inline-block size-2 rounded-full bg-teal-claro align-middle" />
              Marco zero (média)
              <span className="ml-3 mr-1 inline-block size-2 rounded-full bg-azul-medico align-middle" />
              {ev.atual ? rotuloMes(ev.atual.mes) : "Último mês"}
            </p>
            <ul className="mt-5 grid gap-4">
              {ev.receitas.map((r) => (
                <li key={r.servico}>
                  <p className="text-sm font-medium text-cinza-texto">{r.servico}</p>
                  <div className="mt-1.5 grid gap-1">
                    <Barra valor={r.base} maior={maiorReceita} cor="bg-teal-claro" rotulo="Marco zero" />
                    {r.atual !== null && (
                      <Barra valor={r.atual} maior={maiorReceita} cor="bg-azul-medico" rotulo="Último mês" />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {(plano.obstaculo || plano.prioridades || plano.criterio_financeiro || plano.observacoes) && (
          <div className="rounded-lg border border-border bg-white p-6 shadow-soft">
            <h3 className="flex items-center gap-2 text-base font-semibold text-azul-medico">
              <Flag className="size-4 text-teal" /> O que combinamos
            </h3>
            <dl className="mt-4 grid gap-4 text-sm">
              {[
                ["Principal obstáculo", plano.obstaculo],
                ["Prioridades", plano.prioridades],
                ["Como medimos o faturamento", plano.criterio_financeiro],
                ["Observações", plano.observacoes],
              ]
                .filter(([, v]) => v)
                .map(([r, v]) => (
                  <div key={r}>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-teal">{r}</dt>
                    <dd className="mt-1 whitespace-pre-wrap leading-relaxed text-cinza-texto">{v}</dd>
                  </div>
                ))}
              {(plano.meta_leads || plano.meta_consultas) && (
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-teal">Outras metas</dt>
                  <dd className="mt-1 text-cinza-texto">
                    {[
                      plano.meta_leads && `${formatarNumero(plano.meta_leads)} leads por mês`,
                      plano.meta_consultas && `${formatarNumero(plano.meta_consultas)} consultas por mês`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        )}
      </div>
    </section>
  );
}

function Barra({
  valor,
  maior,
  cor,
  rotulo,
}: {
  valor: number;
  maior: number;
  cor: string;
  rotulo: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-3 min-w-0 flex-1 overflow-hidden rounded-r bg-branco-clinico">
        <div
          className={cn("h-full rounded-r", cor)}
          style={{ width: `${Math.max((valor / maior) * 100, valor > 0 ? 2 : 0)}%` }}
          aria-hidden
        />
      </div>
      <span className="w-24 shrink-0 text-right text-xs tabular-nums text-cinza-texto">
        <span className="sr-only">{rotulo}: </span>
        {formatarReais(valor)}
      </span>
    </div>
  );
}
