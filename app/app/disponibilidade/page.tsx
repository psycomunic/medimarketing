import Link from "next/link";
import { DisponibilidadeManager } from "@/components/app/disponibilidade-manager";
import { Fechamentos, LinkAgenda, ServicosDoProfissional } from "@/components/app/agenda-profissional";
import {
  emModoDemo,
  getBloqueios,
  getDisponibilidade,
  getFechamentos,
  getServicosDosProfissionais,
} from "@/lib/supabase/queries";
import { exigirModulo } from "@/lib/acesso";
import { getEquipe } from "@/lib/supabase/usuarios";
import { getPrecos } from "@/lib/supabase/financeiro-dados";
import { catalogoServicos } from "@/lib/servicos";
import { createAdminClient, adminDisponivel } from "@/lib/supabase/admin";
import { DEMO_SLUGS_AGENDA } from "@/lib/demo";
import { cn } from "@/lib/utils";

export const metadata = { title: "Disponibilidade" };

/**
 * A agenda de um profissional: expediente, bloqueios, fechamentos por
 * serviço e o link de agendamento. O médico vê a dele; a recepção e o
 * gestor escolhem de quem, no topo.
 */
export default async function DisponibilidadePage({
  searchParams,
}: {
  searchParams: { profissional?: string };
}) {
  const { profile, organizacao, role } = await exigirModulo("disponibilidade");
  const demo = await emModoDemo();
  const operacional = role === "gestor" || role === "secretaria" || role === "super_admin";
  const orgId = organizacao?.id ?? null;

  const equipe = operacional
    ? (await getEquipe({ organizationId: orgId, ehSuperAdmin: role === "super_admin" })).filter(
        (u) => u.ativo && (u.role === "medico" || u.role === "gestor") && (!orgId || u.organization_id === orgId)
      )
    : [];
  const profissionais = equipe.map((u) => ({ id: u.id, nome: u.nome ?? "Profissional" }));

  // Quem está na tela: o escolhido (se a pessoa pode escolher) ou ela mesma
  const atende = profile.role === "medico" || profile.role === "gestor";
  const pedido = searchParams.profissional;
  const medicoId =
    operacional && pedido && profissionais.some((p) => p.id === pedido)
      ? pedido
      : atende
        ? profile.id
        : profissionais[0]?.id ?? profile.id;
  const nome = medicoId === profile.id ? profile.nome ?? "Você" : profissionais.find((p) => p.id === medicoId)?.nome ?? "Profissional";

  const [disponibilidade, bloqueios, fechamentos, precos, vinculos] = await Promise.all([
    getDisponibilidade(),
    getBloqueios(),
    getFechamentos(medicoId),
    getPrecos(orgId),
    getServicosDosProfissionais(orgId),
  ]);

  const catalogo = catalogoServicos(precos);
  const marcados = vinculos.filter((v) => v.medico_id === medicoId).map((v) => v.servico_id);
  // Os serviços dele, ou todos os da clínica quando ninguém definiu
  const seus = marcados.length ? catalogo.filter((s) => marcados.includes(s.id)) : catalogo;
  const doMedico = disponibilidade.filter((d) => d.medico_id === medicoId);

  // Link: o endereço do perfil e da clínica
  let slug: string | null = null;
  let ativo = false;
  if (demo) {
    slug = DEMO_SLUGS_AGENDA[medicoId] ?? null;
    ativo = !!slug;
  } else if (adminDisponivel()) {
    const { data } = await createAdminClient().from("profiles").select("*").eq("id", medicoId).maybeSingle();
    const p = data as { slug_agenda?: string | null; agenda_publica?: boolean } | null;
    slug = p?.slug_agenda ?? null;
    ativo = !!p?.agenda_publica;
  }
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.medimarketing.com.br").replace(/\/$/, "");

  return (
    <div className="mx-auto max-w-4xl px-5 py-8 md:px-8 md:py-10">
      <header>
        <h1 className="text-2xl md:text-3xl">Disponibilidade</h1>
        <p className="mt-1 text-cinza-suave">
          Horários de atendimento, folgas, horários fechados por serviço e o link para o paciente agendar.
        </p>
      </header>

      {operacional && profissionais.length > 1 && (
        <nav aria-label="Profissional" className="mt-6 flex flex-wrap gap-2">
          {profissionais.map((p) => (
            <Link
              key={p.id}
              href={`/app/disponibilidade?profissional=${p.id}`}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
                p.id === medicoId
                  ? "border-azul-medico bg-azul-medico text-white"
                  : "border-border bg-white text-cinza-texto hover:border-teal hover:text-teal"
              )}
            >
              {p.nome}
            </Link>
          ))}
        </nav>
      )}

      <div key={medicoId}>
        <DisponibilidadeManager
          disponibilidadeInicial={doMedico}
          bloqueiosIniciais={bloqueios.filter((b) => b.medico_id === medicoId)}
          medicoId={medicoId}
          proprio={medicoId === profile.id}
        />

        <div className="mt-8 space-y-8">
          <ServicosDoProfissional
            medicoId={medicoId}
            nome={nome}
            catalogo={catalogo}
            marcados={marcados}
            podeEditar={role === "gestor" || role === "super_admin"}
            demo={demo}
          />
          <Fechamentos medicoId={medicoId} servicos={seus} fechamentos={fechamentos} demo={demo} />
          <LinkAgenda
            medicoId={medicoId}
            nome={nome}
            base={base}
            slugClinica={organizacao?.slug ?? null}
            slug={slug}
            ativo={ativo}
            servicos={seus}
            semExpediente={doMedico.length === 0}
            demo={demo}
          />
        </div>
      </div>
    </div>
  );
}
