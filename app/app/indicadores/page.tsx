import Link from "next/link";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Minus,
  Wallet,
  Users,
  CalendarCheck,
  UserRoundCheck,
  Banknote,
  Target,
} from "lucide-react";
import { GraficoFunil, GraficoRetorno } from "@/components/app/indicadores/graficos";
import { FormLancamento } from "@/components/app/indicadores/form-lancamento";
import { exigirModulo } from "@/lib/acesso";
import { getIndicadores } from "@/lib/supabase/indicadores";
import { getPlano } from "@/lib/supabase/evolucao";
import { PainelEvolucao } from "@/components/app/evolucao/painel-evolucao";
import {
  calcularKpis,
  etapasDoMetodo,
  formatarMultiplicador,
  formatarNumero,
  formatarPercentual,
  formatarReais,
  mesPorExtenso,
  variacao,
} from "@/lib/indicadores";
import { cn } from "@/lib/utils";

export const metadata = { title: "Indicadores" };

/** Quais meses lançados olhar. Os cartões e o funil ficam no último deles. */
const PERIODOS = [
  { chave: "3m", rotulo: "3 meses" },
  { chave: "6m", rotulo: "6 meses" },
  { chave: "12m", rotulo: "12 meses" },
  { chave: "24m", rotulo: "24 meses" },
  { chave: "ano", rotulo: "Este ano" },
  { chave: "ano-passado", rotulo: "Ano passado" },
] as const;
type PeriodoIndicadores = (typeof PERIODOS)[number]["chave"];

/** Seta de variação contra o mês anterior. */
function Variacao({ valor, inverter }: { valor: number; inverter?: boolean }) {
  if (!valor || Math.abs(valor) < 0.5) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-cinza-suave">
        <Minus className="size-3" /> estável
      </span>
    );
  }
  // Em custo, cair é bom: `inverter` troca a leitura da cor
  const bom = inverter ? valor < 0 : valor > 0;
  const Icone = valor > 0 ? TrendingUp : TrendingDown;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-semibold",
        bom ? "text-sucesso" : "text-coral"
      )}
    >
      <Icone className="size-3" />
      {formatarPercentual(Math.abs(valor))}
    </span>
  );
}

export default async function IndicadoresPage({ searchParams }: { searchParams: { periodo?: string } }) {
  const { organizacao, role } = await exigirModulo("indicadores");
  // 36 meses para o marco zero continuar no gráfico depois de um ano;
  // os cartões e gráficos de sempre olham só os 12 últimos
  const [historico, plano] = await Promise.all([
    getIndicadores(organizacao?.id ?? null, 36),
    getPlano(organizacao?.id ?? null),
  ]);
  const periodo: PeriodoIndicadores = PERIODOS.find((p) => p.chave === searchParams.periodo)?.chave ?? "12m";
  const ano = new Date().getFullYear();
  const escolhidos =
    periodo === "ano"
      ? historico.filter((m) => m.mes.startsWith(String(ano)))
      : periodo === "ano-passado"
        ? historico.filter((m) => m.mes.startsWith(String(ano - 1)))
        : historico.slice(-Number(periodo.replace("m", "")));
  // Sem nada lançado no período escolhido, mostra os 12 últimos e avisa
  const semDados = escolhidos.length === 0;
  const meses = semDados ? historico.slice(-12) : escolhidos;

  const podeLancar = role === "gestor" || role === "super_admin";

  if (meses.length === 0) {
    return (
      <div className="mx-auto max-w-4xl px-5 py-8 md:px-8 md:py-10">
        <header className="flex items-start gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-verde-menta text-teal">
            <BarChart3 className="size-6" />
          </span>
          <div>
            <h1 className="text-2xl md:text-3xl">Indicadores</h1>
            <p className="mt-1 text-cinza-suave">
              Do investimento ao faturamento: leads, agendamentos,
              comparecimento e retorno.
            </p>
          </div>
        </header>

        <div className="mt-8 rounded-lg border border-dashed border-border bg-white p-10 text-center shadow-soft">
          <Target className="mx-auto size-10 text-teal-claro" />
          <h2 className="mt-3 text-lg font-semibold text-azul-medico">
            Ainda não há números lançados
          </h2>
          <p className="mx-auto mt-2 max-w-md text-cinza-suave">
            {podeLancar
              ? "Lance o primeiro mês para começar a acompanhar a evolução. Quando as integrações de Meta Ads, Google Ads e GA4 entrarem, elas preenchem estes mesmos campos automaticamente."
              : "Assim que o gestor da clínica lançar o primeiro mês, os indicadores aparecem aqui."}
          </p>
          {podeLancar && organizacao && (
            <div className="mt-6 flex justify-center">
              <FormLancamento organizationId={organizacao.id} historico={[]} />
            </div>
          )}
        </div>
      </div>
    );
  }

  const ultimo = meses[meses.length - 1];
  const anterior = meses.length > 1 ? meses[meses.length - 2] : null;

  const kpiMes = calcularKpis([ultimo]);
  const kpiAnterior = anterior ? calcularKpis([anterior]) : null;
  const kpiPeriodo = calcularKpis(meses);
  const etapas = etapasDoMetodo(meses);

  const cards = [
    {
      icone: Wallet,
      label: "Investimento",
      valor: formatarReais(kpiMes.investimento),
      variacao: kpiAnterior ? variacao(kpiMes.investimento, kpiAnterior.investimento) : 0,
      inverter: false,
    },
    {
      icone: Users,
      label: "Leads",
      valor: formatarNumero(kpiMes.leads),
      variacao: kpiAnterior ? variacao(kpiMes.leads, kpiAnterior.leads) : 0,
      inverter: false,
    },
    {
      icone: CalendarCheck,
      label: "Agendamentos",
      valor: formatarNumero(kpiMes.agendamentos),
      variacao: kpiAnterior ? variacao(kpiMes.agendamentos, kpiAnterior.agendamentos) : 0,
      inverter: false,
    },
    {
      icone: UserRoundCheck,
      label: "Compareceram",
      valor: formatarNumero(kpiMes.comparecimentos),
      variacao: kpiAnterior
        ? variacao(kpiMes.comparecimentos, kpiAnterior.comparecimentos)
        : 0,
      inverter: false,
    },
    {
      icone: Banknote,
      label: "Faturamento",
      valor: formatarReais(kpiMes.faturamento),
      variacao: kpiAnterior ? variacao(kpiMes.faturamento, kpiAnterior.faturamento) : 0,
      inverter: false,
    },
    {
      icone: TrendingUp,
      label: "Retorno",
      valor: formatarMultiplicador(kpiMes.roi),
      variacao: kpiAnterior ? variacao(kpiMes.roi, kpiAnterior.roi) : 0,
      inverter: false,
    },
  ];

  const custos = [
    {
      label: "Custo por lead",
      valor: formatarReais(kpiMes.cpl, true),
      variacao: kpiAnterior ? variacao(kpiMes.cpl, kpiAnterior.cpl) : 0,
    },
    {
      label: "Custo por paciente novo",
      valor: formatarReais(kpiMes.custoPorPaciente, true),
      variacao: kpiAnterior
        ? variacao(kpiMes.custoPorPaciente, kpiAnterior.custoPorPaciente)
        : 0,
    },
    {
      label: "Ticket médio",
      valor: formatarReais(kpiMes.ticketMedio, true),
      variacao: kpiAnterior ? variacao(kpiMes.ticketMedio, kpiAnterior.ticketMedio) : 0,
      inverter: false,
    },
  ];

  // Funil do mês, com a largura proporcional ao topo
  const funil = [
    { etapa: "Leads recebidos", valor: kpiMes.leads, taxa: 100 },
    {
      etapa: "Consultas agendadas",
      valor: kpiMes.agendamentos,
      taxa: kpiMes.taxaLeadAgendamento,
    },
    {
      etapa: "Pacientes que compareceram",
      valor: kpiMes.comparecimentos,
      taxa: kpiMes.taxaLeadPaciente,
    },
  ];

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 md:px-8 md:py-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-verde-menta text-teal">
            <BarChart3 className="size-6" />
          </span>
          <div>
            <h1 className="text-2xl md:text-3xl">Indicadores</h1>
            <p className="mt-1 text-cinza-suave">
              {mesPorExtenso(ultimo.mes)}
              {anterior && " · comparado ao mês anterior"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/app/indicadores/relatorio"
            className="inline-flex h-9 items-center gap-2 rounded-full border-2 border-azul-medico/20 bg-white px-4 text-sm font-semibold text-azul-medico hover:border-teal hover:text-teal"
          >
            Relatório do mês
          </Link>
          {podeLancar && organizacao && (
            <FormLancamento organizationId={organizacao.id} historico={historico.slice(-12)} />
          )}
        </div>
      </header>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <nav aria-label="Período" className="flex max-w-full overflow-x-auto rounded-full border border-border bg-white p-1 shadow-soft [scrollbar-width:none]">
          {PERIODOS.map((p) => (
            <Link
              key={p.chave}
              href={p.chave === "12m" ? "/app/indicadores" : `/app/indicadores?periodo=${p.chave}`}
              scroll={false}
              aria-current={p.chave === periodo ? "page" : undefined}
              className={cn(
                "shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-colors sm:text-sm",
                p.chave === periodo ? "bg-azul-medico text-white" : "text-cinza-suave hover:text-azul-medico"
              )}
            >
              {p.rotulo}
            </Link>
          ))}
        </nav>
        <p className="text-xs text-cinza-suave">
          {semDados
            ? "Nenhum mês lançado nesse período: mostrando os 12 últimos."
            : `${meses.length} ${meses.length === 1 ? "mês lançado" : "meses lançados"} · os cartões e o funil mostram ${mesPorExtenso(ultimo.mes)}.`}
        </p>
      </div>

      <PainelEvolucao meses={historico} plano={plano} />

      {/* Cartões do mês */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <div
            key={c.label}
            className="rounded-lg border border-border bg-white p-5 shadow-soft"
          >
            <div className="flex items-center justify-between">
              <span className="grid size-9 place-items-center rounded-lg bg-verde-menta text-teal">
                <c.icone className="size-5" />
              </span>
              {anterior && <Variacao valor={c.variacao} inverter={c.inverter} />}
            </div>
            <p className="mt-3 font-heading text-2xl font-bold text-azul-medico">
              {c.valor}
            </p>
            <p className="text-sm text-cinza-suave">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Funil do mês */}
      <section className="mt-8 rounded-lg border border-border bg-white p-6 shadow-soft">
        <h2 className="text-lg font-semibold text-azul-medico">
          Funil de {mesPorExtenso(ultimo.mes)}
        </h2>
        <p className="mt-1 text-sm text-cinza-suave">
          Onde o paciente entra e onde ele para.
        </p>

        <div className="mt-6 space-y-4">
          {funil.map((f, i) => (
            <div key={f.etapa}>
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-medium text-cinza-texto">{f.etapa}</span>
                <span className="text-cinza-suave">
                  <strong className="text-azul-medico">
                    {formatarNumero(f.valor)}
                  </strong>{" "}
                  · {formatarPercentual(f.taxa)} do topo
                </span>
              </div>
              <div className="mt-2 h-8 overflow-hidden rounded-md bg-verde-menta/60">
                <div
                  className={cn(
                    "h-full rounded-md",
                    i === 0 ? "bg-teal-claro" : i === 1 ? "bg-teal" : "bg-azul-medico"
                  )}
                  style={{ width: `${Math.max(f.taxa, 3)}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 grid gap-4 border-t border-border pt-6 sm:grid-cols-2">
          <p className="text-sm text-cinza-suave">
            De cada 10 leads,{" "}
            <strong className="text-azul-medico">
              {(kpiMes.taxaLeadPaciente / 10).toFixed(1).replace(".", ",")}
            </strong>{" "}
            viram paciente na cadeira.
          </p>
          <p className="text-sm text-cinza-suave">
            Perda maior entre{" "}
            <strong className="text-azul-medico">
              {kpiMes.taxaLeadAgendamento < kpiMes.taxaAgendamentoComparecimento
                ? "lead e agendamento"
                : "agendamento e comparecimento"}
            </strong>
            .
          </p>
        </div>
      </section>

      {/* Custos e ticket */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {custos.map((c) => (
          <div
            key={c.label}
            className="rounded-lg border border-border bg-white p-5 shadow-soft"
          >
            <p className="text-sm text-cinza-suave">{c.label}</p>
            <p className="mt-1 font-heading text-2xl font-bold text-azul-medico">
              {c.valor}
            </p>
            {anterior && (
              <div className="mt-1">
                <Variacao valor={c.variacao} inverter={c.inverter !== false} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Gráficos */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-border bg-white p-6 shadow-soft">
          <h2 className="text-lg font-semibold text-azul-medico">
            Investimento e faturamento
          </h2>
          <p className="mb-4 mt-1 text-sm text-cinza-suave">
            Últimos {meses.length} meses.
          </p>
          <GraficoRetorno meses={meses} />
        </section>

        <section className="rounded-lg border border-border bg-white p-6 shadow-soft">
          <h2 className="text-lg font-semibold text-azul-medico">
            Evolução do funil
          </h2>
          <p className="mb-4 mt-1 text-sm text-cinza-suave">
            Leads, agendamentos e comparecimento.
          </p>
          <GraficoFunil meses={meses} />
        </section>
      </div>

      {/* Etapas do método */}
      <section className="mt-6 rounded-lg border border-border bg-white p-6 shadow-soft">
        <h2 className="text-lg font-semibold text-azul-medico">
          Acompanhamento do método
        </h2>
        <p className="mt-1 text-sm text-cinza-suave">
          Cada janela soma desde o início do acompanhamento.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {etapas.map((e) => (
            <div
              key={e.rotulo}
              className={cn(
                "rounded-lg border p-5",
                e.parcial
                  ? "border-dashed border-border bg-branco-clinico"
                  : "border-border bg-white shadow-soft"
              )}
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-teal">
                {e.rotulo}
              </p>
              {e.parcial ? (
                <p className="mt-3 text-sm text-cinza-suave">
                  Ainda sem histórico completo para esta janela.
                </p>
              ) : (
                <dl className="mt-3 space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-cinza-suave">Faturamento</dt>
                    <dd className="font-semibold text-azul-medico">
                      {formatarReais(e.kpis.faturamento)}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-cinza-suave">Pacientes</dt>
                    <dd className="font-semibold text-azul-medico">
                      {formatarNumero(e.kpis.comparecimentos)}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-cinza-suave">Retorno</dt>
                    <dd className="font-semibold text-teal">
                      {formatarMultiplicador(e.kpis.roi)}
                    </dd>
                  </div>
                </dl>
              )}
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-md border border-dashed border-border bg-branco-clinico px-4 py-3 text-sm text-cinza-suave">
          No acumulado dos {meses.length} meses: {formatarReais(kpiPeriodo.investimento)}{" "}
          investidos geraram {formatarReais(kpiPeriodo.faturamento)}, com{" "}
          {formatarNumero(kpiPeriodo.comparecimentos)} pacientes atendidos a{" "}
          {formatarReais(kpiPeriodo.custoPorPaciente, true)} cada.
        </div>
      </section>
    </div>
  );
}
