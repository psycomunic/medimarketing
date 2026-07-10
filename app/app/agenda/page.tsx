import { AgendaCalendar } from "@/components/app/agenda-calendar";
import { getConsultas, emModoDemo } from "@/lib/supabase/queries";

export const metadata = { title: "Agenda" };

export default async function AgendaPage() {
  // Busca uma janela ampla (mês anterior até 2 meses à frente) para permitir
  // navegação no cliente sem novas requisições.
  const hoje = new Date();
  const inicio = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
  const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 3, 0, 23, 59, 59);

  const [consultas, demo] = await Promise.all([
    getConsultas(inicio.toISOString(), fim.toISOString()),
    emModoDemo(),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 md:px-8 md:py-10">
      <AgendaCalendar consultasIniciais={consultas} demo={demo} />
    </div>
  );
}
