import { AgendaCalendar } from "@/components/app/agenda-calendar";
import { getAgenda, emModoDemo } from "@/lib/supabase/queries";
import { exigirModulo } from "@/lib/acesso";

export const metadata = { title: "Agenda" };

export default async function AgendaPage() {
  await exigirModulo("agenda");

  // Busca uma janela ampla (mês anterior até 2 meses à frente) para permitir
  // navegação e filtragem no cliente sem novas requisições.
  const hoje = new Date();
  const inicio = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
  const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 3, 0, 23, 59, 59);

  const [{ consultas, opcoes }, demo] = await Promise.all([
    getAgenda(inicio.toISOString(), fim.toISOString()),
    emModoDemo(),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 md:px-8 md:py-10">
      <AgendaCalendar consultasIniciais={consultas} opcoes={opcoes} demo={demo} />
    </div>
  );
}
