import { AgendaCalendar } from "@/components/app/agenda-calendar";
import { getAgenda, emModoDemo } from "@/lib/supabase/queries";
import { exigirModulo } from "@/lib/acesso";
import { getClinicasDisponiveis, getUsuarios } from "@/lib/supabase/usuarios";

export const metadata = { title: "Agenda" };

export default async function AgendaPage() {
  const { profile, organizacao, role } = await exigirModulo("agenda");
  const ehSuperAdmin = role === "super_admin";
  const escopo = {
    organizationId: organizacao?.id ?? null,
    ehSuperAdmin,
  };

  // Busca uma janela ampla (mês anterior até 2 meses à frente) para permitir
  // navegação e filtragem no cliente sem novas requisições.
  const hoje = new Date();
  const inicio = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
  const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 3, 0, 23, 59, 59);

  const [{ consultas, opcoes }, equipe, clinicas, demo] = await Promise.all([
    getAgenda(inicio.toISOString(), fim.toISOString()),
    getUsuarios(escopo),
    getClinicasDisponiveis(escopo),
    emModoDemo(),
  ]);

  // Quem pode atender: médicos e gestores. A secretária marca para eles,
  // e não para si — é o que evita a consulta nascer no nome de quem
  // apenas digitou.
  const profissionais = equipe
    .filter((u) => u.ativo && (u.role === "medico" || u.role === "gestor"))
    .map((u) => ({
      id: u.id,
      nome: u.nome ?? "Profissional",
      organization_id: u.organization_id,
    }));

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 md:px-8 md:py-10">
      <AgendaCalendar
        consultasIniciais={consultas}
        opcoes={opcoes}
        profissionais={profissionais}
        clinicas={clinicas}
        usuarioId={profile.id}
        organizationId={organizacao?.id ?? null}
        demo={demo}
      />
    </div>
  );
}
