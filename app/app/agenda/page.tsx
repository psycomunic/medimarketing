import { AgendaCalendar } from "@/components/app/agenda-calendar";
import {
  getAgenda,
  emModoDemo,
  getBloqueios,
  getDisponibilidade,
  getFechamentos,
  getServicosDosProfissionais,
} from "@/lib/supabase/queries";
import { exigirModulo } from "@/lib/acesso";
import { getClinicasDisponiveis, getEquipe } from "@/lib/supabase/usuarios";
import { getConfirmacoesDaAgenda } from "@/lib/supabase/confirmacoes";
import { whatsappConfigurado } from "@/lib/envio";
import { getPacientesBasicos } from "@/lib/supabase/pacientes";
import { getPrecos } from "@/lib/supabase/financeiro-dados";
import { createAdminClient, adminDisponivel } from "@/lib/supabase/admin";
import { DEMO_SLUGS_AGENDA } from "@/lib/demo";
import type { LinkDaAgenda } from "@/components/app/agenda-links";

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

  const [
    { consultas, opcoes },
    equipe,
    clinicas,
    demo,
    disponibilidade,
    bloqueios,
    pacientes,
    servicos,
    fechamentos,
    vinculos,
  ] = await Promise.all([
    getAgenda(inicio.toISOString(), fim.toISOString()),
    getEquipe(escopo),
    getClinicasDisponiveis(escopo),
    emModoDemo(),
    getDisponibilidade(),
    getBloqueios(),
    getPacientesBasicos(),
    // Serviços da tabela de preços (sem o financeiro instalado, a lista vem vazia)
    getPrecos(organizacao?.id ?? null).catch(() => []),
    getFechamentos(),
    getServicosDosProfissionais(organizacao?.id ?? null),
  ]);

  // Estado da confirmação de cada consulta, para a ficha já abrir com ele
  const confirmacoes = await getConfirmacoesDaAgenda(consultas);

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

  // Links de agendamento: o médico vê o dele; recepção e gestor, os da clínica
  const linksDe = role === "medico" ? profissionais.filter((p) => p.id === profile.id) : profissionais;
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.medimarketing.com.br").replace(/\/$/, "");
  let linksAgenda: LinkDaAgenda[] = [];
  if (organizacao?.slug && linksDe.length) {
    let perfis: { id: string; slug_agenda?: string | null; agenda_publica?: boolean }[] = [];
    if (demo) {
      perfis = linksDe.map((p) => ({ id: p.id, slug_agenda: DEMO_SLUGS_AGENDA[p.id] ?? null, agenda_publica: !!DEMO_SLUGS_AGENDA[p.id] }));
    } else if (adminDisponivel()) {
      const { data } = await createAdminClient().from("profiles").select("*").in("id", linksDe.map((p) => p.id));
      perfis = (data ?? []) as typeof perfis;
    }
    linksAgenda = linksDe.map((p) => {
      const perfil = perfis.find((x) => x.id === p.id);
      return {
        medicoId: p.id,
        nome: p.nome,
        url: perfil?.slug_agenda ? `${base}/agendar/${organizacao.slug}/${perfil.slug_agenda}` : null,
        ativo: !!perfil?.agenda_publica,
      };
    });
  }

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 md:px-8 md:py-10">
      <AgendaCalendar
        consultasIniciais={consultas}
        pacientes={pacientes}
        opcoes={opcoes}
        profissionais={profissionais}
        clinicas={clinicas}
        confirmacoes={confirmacoes}
        envioAutomatico={whatsappConfigurado()}
        usuarioId={profile.id}
        organizationId={organizacao?.id ?? null}
        disponibilidade={disponibilidade}
        bloqueios={bloqueios}
        lembrete={
          organizacao
            ? {
                ativo: organizacao.lembrete_ativo,
                diasUteis: organizacao.lembrete_dias_uteis,
                hora: organizacao.lembrete_hora,
              }
            : null
        }
        demo={demo}
        servicos={servicos}
        limite={organizacao?.max_consultas_horario ?? null}
        podeApagar={ehSuperAdmin || role === "gestor"}
        fechamentos={fechamentos}
        vinculos={vinculos}
        linksAgenda={linksAgenda}
      />
    </div>
  );
}
