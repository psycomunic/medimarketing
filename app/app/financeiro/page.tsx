import { Suspense } from "react";
import {
  Wallet,
  Banknote,
  TrendingUp,
  Users,
  Clock,
  AlertCircle,
} from "lucide-react";
import { Lancamentos } from "@/components/app/financeiro/lancamentos";
import { exigirModulo } from "@/lib/acesso";
import { emModoDemo } from "@/lib/supabase/queries";
import {
  getLancamentos,
  getMesesDisponiveis,
  limitesDoMes,
  mesCorrente,
  porFormaPagamento,
  porPaciente,
  porProcedimento,
  resumirFinanceiro,
} from "@/lib/supabase/financeiro";
import { rotuloFormaPagamento } from "@/lib/rotulos";
import { formatarNumero, formatarPercentual, formatarReais } from "@/lib/indicadores";

export const metadata = { title: "Financeiro" };

export default async function FinanceiroPage({
  searchParams,
}: {
  searchParams: { mes?: string };
}) {
  const { organizacao, role } = await exigirModulo("financeiro");
  const orgId = organizacao?.id ?? null;
  const podeEditar = role === "gestor" || role === "super_admin";

  const meses = await getMesesDisponiveis(orgId);
  // Mês pedido na URL, se existir de fato; senão o mais recente
  const mes =
    searchParams.mes && meses.includes(searchParams.mes)
      ? searchParams.mes
      : meses[0] ?? mesCorrente();

  const { de, ate } = limitesDoMes(mes);
  const [lancamentos, demo] = await Promise.all([
    getLancamentos(orgId, de, ate),
    emModoDemo(),
  ]);

  const r = resumirFinanceiro(lancamentos);
  const procedimentos = porProcedimento(lancamentos);
  const formas = porFormaPagamento(lancamentos);
  const pacientes = porPaciente(lancamentos);
  const recorrentes = pacientes.filter((p) => p.atendimentos > 1);

  const cards = [
    { icone: Banknote, label: "faturamento bruto", valor: formatarReais(r.bruto) },
    {
      icone: TrendingUp,
      label: "líquido depois dos custos",
      valor: formatarReais(r.liquido),
      nota: `${formatarPercentual(r.margem)} de margem`,
    },
    {
      icone: Wallet,
      label: "ticket médio",
      valor: formatarReais(r.ticketMedio, true),
      nota: `${formatarNumero(r.atendimentos)} atendimentos`,
    },
    {
      icone: Users,
      label: "pacientes atendidos",
      valor: formatarNumero(r.pacientes),
      nota: `${recorrentes.length} voltaram mais de uma vez`,
    },
  ];

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 md:px-8 md:py-10">
      <header className="flex items-start gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-verde-menta text-teal">
          <Wallet className="size-6" />
        </span>
        <div>
          <h1 className="text-2xl md:text-3xl">Financeiro</h1>
          <p className="mt-1 max-w-2xl text-cinza-suave">
            Faturamento por procedimento, ticket médio e o que cada paciente
            representa. De propósito enxuto: acompanha o dinheiro sem virar
            um ERP.
          </p>
        </div>
      </header>

      {lancamentos.length > 0 && (
        <>
          <dl className="mt-8 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
            {cards.map((c) => (
              <div key={c.label} className="bg-white px-6 py-5">
                <span className="grid size-9 place-items-center rounded-lg bg-verde-menta text-teal">
                  <c.icone className="size-5" />
                </span>
                <dd className="mt-3 font-heading text-2xl font-bold text-azul-medico">
                  {c.valor}
                </dd>
                <dt className="text-sm text-cinza-suave">{c.label}</dt>
                {c.nota && (
                  <p className="mt-1 text-xs text-cinza-suave/80">{c.nota}</p>
                )}
              </div>
            ))}
          </dl>

          {/* Situação do recebimento */}
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {[
              {
                icone: Banknote,
                label: "já recebido",
                valor: formatarReais(r.recebido),
                cor: "text-sucesso",
              },
              {
                icone: Clock,
                label: "a receber",
                valor: formatarReais(r.aReceber),
                cor: "text-alerta",
              },
              {
                icone: AlertCircle,
                label: "atrasado",
                valor: formatarReais(r.atrasado),
                cor: "text-coral",
              },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-lg border border-border bg-white p-5 shadow-soft"
              >
                <div className="flex items-center gap-2">
                  <s.icone className={`size-4 ${s.cor}`} />
                  <p className="text-sm text-cinza-suave">{s.label}</p>
                </div>
                <p className={`mt-1 font-heading text-xl font-bold ${s.cor}`}>
                  {s.valor}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            {/* Faturamento por procedimento */}
            <section className="rounded-lg border border-border bg-white p-6 shadow-soft">
              <h2 className="text-lg font-semibold text-azul-medico">
                Faturamento por procedimento
              </h2>
              <p className="mt-1 text-sm text-cinza-suave">
                O que sustenta o mês, e com que margem.
              </p>

              <ul className="mt-5 space-y-3">
                {procedimentos.slice(0, 8).map((p) => {
                  const fatia = r.bruto ? (p.bruto / r.bruto) * 100 : 0;
                  const margem = p.bruto ? (p.liquido / p.bruto) * 100 : 0;
                  return (
                    <li key={p.procedimento}>
                      <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                        <span className="font-medium text-cinza-texto">
                          {p.procedimento}
                        </span>
                        <span className="text-cinza-suave">
                          <strong className="text-azul-medico">
                            {formatarReais(p.bruto)}
                          </strong>{" "}
                          · {p.quantidade}x
                          {p.custo > 0 && ` · ${formatarPercentual(margem)} de margem`}
                        </span>
                      </div>
                      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-verde-menta">
                        <div
                          className="h-full rounded-full bg-teal"
                          style={{ width: `${Math.max(fatia, 1)}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>

            {/* Formas de pagamento e recorrência */}
            <div className="space-y-6">
              <section className="rounded-lg border border-border bg-white p-6 shadow-soft">
                <h2 className="text-lg font-semibold text-azul-medico">
                  Como o dinheiro entra
                </h2>
                <p className="mt-1 text-sm text-cinza-suave">
                  Convênio e boleto demoram a cair — é o que aperta o caixa.
                </p>

                <ul className="mt-5 space-y-2.5">
                  {formas.map((f) => {
                    const fatia = r.bruto ? (f.total / r.bruto) * 100 : 0;
                    return (
                      <li
                        key={f.forma}
                        className="flex items-center justify-between gap-3 text-sm"
                      >
                        <span className="text-cinza-texto">
                          {rotuloFormaPagamento[f.forma]}
                        </span>
                        <span className="flex items-center gap-3">
                          <span className="hidden h-2 w-24 overflow-hidden rounded-full bg-verde-menta sm:block">
                            <span
                              className="block h-full rounded-full bg-azul-medico"
                              style={{ width: `${Math.max(fatia, 2)}%` }}
                            />
                          </span>
                          <span className="w-24 text-right font-semibold text-azul-medico">
                            {formatarReais(f.total)}
                          </span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>

              <section className="rounded-lg border border-border bg-white p-6 shadow-soft">
                <h2 className="text-lg font-semibold text-azul-medico">
                  Valor por paciente
                </h2>
                <p className="mt-1 text-sm text-cinza-suave">
                  Quem mais deixou na clínica neste período.
                </p>

                <ul className="mt-4 divide-y divide-border">
                  {pacientes.slice(0, 6).map((p) => (
                    <li
                      key={p.paciente}
                      className="flex items-center justify-between gap-3 py-2.5 text-sm"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-cinza-texto">
                          {p.paciente}
                        </span>
                        <span className="text-xs text-cinza-suave">
                          {p.atendimentos} atendimento{p.atendimentos === 1 ? "" : "s"}
                        </span>
                      </span>
                      <span className="shrink-0 font-semibold text-azul-medico">
                        {formatarReais(p.total)}
                      </span>
                    </li>
                  ))}
                </ul>

                <p className="mt-4 rounded-md border border-dashed border-border bg-branco-clinico px-4 py-2.5 text-xs text-cinza-suave">
                  {recorrentes.length > 0
                    ? `${recorrentes.length} de ${pacientes.length} pacientes voltaram mais de uma vez neste mês.`
                    : "Nenhum paciente voltou mais de uma vez neste mês."}
                </p>
              </section>
            </div>
          </div>
        </>
      )}

      <div className="mt-8">
        <Suspense fallback={null}>
          <Lancamentos
            lancamentos={lancamentos}
            meses={meses}
            mesAtual={mes}
            organizationId={orgId}
            podeEditar={podeEditar}
            demo={demo}
          />
        </Suspense>
      </div>
    </div>
  );
}
