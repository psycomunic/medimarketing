import Link from "next/link";
import {
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  TrendingUp,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getSessao, getResumo, getConsultas } from "@/lib/supabase/queries";
import { formatarHora, rotuloStatus } from "@/lib/agenda";

export default async function DashboardPage() {
  const { profile } = await getSessao();
  const resumo = await getResumo();

  // Próximas consultas (de agora até 7 dias)
  const agora = new Date();
  const em7 = new Date(agora);
  em7.setDate(em7.getDate() + 7);
  const proximas = (
    await getConsultas(agora.toISOString(), em7.toISOString())
  ).slice(0, 5);

  const nome = profile?.nome || "Doutor(a)";

  const cards = [
    { label: "Consultas hoje", valor: resumo.hoje, icon: CalendarClock, cor: "text-teal bg-teal/10" },
    { label: "Próximos 7 dias", valor: resumo.proximos7, icon: CalendarDays, cor: "text-azul-medico bg-azul-medico/10" },
    { label: "Taxa de confirmação", valor: `${resumo.taxaConfirmacao}%`, icon: CheckCircle2, cor: "text-sucesso bg-sucesso/10" },
    { label: "Total no mês", valor: resumo.totalMes, icon: TrendingUp, cor: "text-alerta bg-alerta/10" },
  ];

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 md:px-8 md:py-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl">Olá, {nome} 👋</h1>
          <p className="mt-1 text-cinza-suave">
            Aqui está o resumo da sua agenda.
          </p>
        </div>
        <Button asChild variant="marca">
          <Link href="/app/agenda">
            Ver agenda completa <ArrowRight className="size-4" />
          </Link>
        </Button>
      </header>

      {/* Cards de resumo */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div
            key={c.label}
            className="rounded-lg border border-border bg-white p-5 shadow-soft"
          >
            <div className={`mb-3 grid size-10 place-items-center rounded-lg ${c.cor}`}>
              <c.icon className="size-5" />
            </div>
            <p className="font-heading text-3xl font-bold text-azul-medico">
              {c.valor}
            </p>
            <p className="text-sm text-cinza-suave">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Próximas consultas */}
      <section className="mt-8 rounded-lg border border-border bg-white shadow-soft">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold text-azul-medico">
            Próximas consultas
          </h2>
          <Link
            href="/app/agenda"
            className="text-sm font-medium text-teal hover:underline"
          >
            Ver todas
          </Link>
        </div>

        {proximas.length === 0 ? (
          <div className="px-6 py-12 text-center text-cinza-suave">
            <CalendarDays className="mx-auto mb-3 size-10 text-teal-claro" />
            <p>Nenhuma consulta agendada para os próximos dias.</p>
            <p className="text-sm">
              As consultas marcadas pela nossa equipe aparecem aqui.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {proximas.map((c) => (
              <li
                key={c.id}
                className="flex items-center gap-4 px-6 py-4"
              >
                <div className="flex w-16 shrink-0 flex-col items-center rounded-lg bg-verde-menta py-2">
                  <span className="text-sm font-bold text-azul-medico">
                    {formatarHora(c.data_hora)}
                  </span>
                  <span className="text-[11px] text-cinza-suave">
                    {new Date(c.data_hora).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                    })}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-cinza-texto">
                    {c.paciente_nome}
                  </p>
                  <p className="text-sm capitalize text-cinza-suave">{c.tipo}</p>
                </div>
                <Badge variant={c.status}>{rotuloStatus[c.status]}</Badge>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
