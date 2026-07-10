import { BarChart3, TrendingUp, MousePointerClick, DollarSign } from "lucide-react";

export const metadata = { title: "Relatórios" };

// FASE 2: layout pronto para relatórios de Google/Meta Ads.
// Os dados serão integrados via API das plataformas de anúncios.
export default function RelatoriosPage() {
  const kpis = [
    { label: "Investimento no mês", valor: "—", icon: DollarSign },
    { label: "Cliques", valor: "—", icon: MousePointerClick },
    { label: "Leads gerados", valor: "—", icon: TrendingUp },
    { label: "Custo por lead", valor: "—", icon: BarChart3 },
  ];

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 md:px-8 md:py-10">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl">Relatórios de marketing</h1>
          <p className="mt-1 text-cinza-suave">
            Acompanhe o retorno das suas campanhas de Google e Meta Ads.
          </p>
        </div>
        <span className="rounded-full bg-alerta/12 px-3 py-1 text-xs font-semibold text-alerta">
          Em breve
        </span>
      </header>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <div
            key={k.label}
            className="rounded-lg border border-border bg-white p-5 shadow-soft"
          >
            <div className="mb-3 grid size-10 place-items-center rounded-lg bg-verde-menta text-teal">
              <k.icon className="size-5" />
            </div>
            <p className="font-heading text-3xl font-bold text-azul-medico/40">
              {k.valor}
            </p>
            <p className="text-sm text-cinza-suave">{k.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid place-items-center rounded-lg border border-dashed border-border bg-white p-16 text-center shadow-soft">
        <BarChart3 className="mb-3 size-12 text-teal-claro" />
        <h2 className="text-lg font-semibold text-azul-medico">
          Integração em desenvolvimento
        </h2>
        <p className="mt-1 max-w-md text-cinza-suave">
          Em breve você verá aqui os gráficos de desempenho das suas campanhas,
          com dados de Google Ads e Meta Ads em tempo real.
        </p>
      </div>
    </div>
  );
}
