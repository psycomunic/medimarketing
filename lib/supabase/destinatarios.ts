import "server-only";

import { adminDisponivel, createAdminClient } from "@/lib/supabase/admin";
import type { MarcaEmail } from "@/lib/email-modelos";

/**
 * Quem recebe os avisos de uma consulta, do lado da clínica.
 *
 * São três origens, unidas e sem repetição:
 *   - o e-mail cadastrado da clínica (a caixa que a recepção acompanha)
 *   - o médico que vai atender
 *   - os gestores, que respondem pela operação
 *
 * O médico entra porque a consulta é dele; os gestores, porque em
 * clínica pequena é quem resolve na prática quando o paciente pede
 * para remarcar.
 */
export type DestinoConsulta = {
  emails: string[];
  marca: MarcaEmail;
};

export async function destinatariosDaConsulta(
  organizationId: string,
  medicoId?: string | null
): Promise<DestinoConsulta | null> {
  if (!adminDisponivel()) return null;

  const admin = createAdminClient();

  const { data: org } = await admin
    .from("organizations")
    .select("nome,email,telefone,logo_url")
    .eq("id", organizationId)
    .maybeSingle();

  if (!org) return null;

  const marca: MarcaEmail = {
    clinica: org.nome,
    logoUrl: org.logo_url,
    emailClinica: org.email,
    telefoneClinica: org.telefone,
  };

  // Quem, na equipe, deve ser avisado
  const { data: perfis } = await admin
    .from("profiles")
    .select("id,role")
    .eq("organization_id", organizationId)
    .eq("ativo", true);

  const alvos = (perfis ?? [])
    .filter((p) => p.role === "gestor" || p.id === medicoId)
    .map((p) => p.id);

  // O e-mail de login vive em auth.users, fora do alcance do select acima
  const emailsEquipe: string[] = [];
  for (const id of alvos) {
    const { data } = await admin.auth.admin.getUserById(id);
    const e = data?.user?.email;
    // Endereços de teste não devem receber aviso de produção
    if (e && !e.endsWith("@example.invalid")) emailsEquipe.push(e);
  }

  const emails = [...new Set([org.email, ...emailsEquipe].filter(Boolean))] as string[];

  return { emails, marca };
}

/** Só a identidade visual, para mensagens que vão ao paciente. */
export async function marcaDaClinica(
  organizationId: string
): Promise<MarcaEmail | null> {
  if (!adminDisponivel()) return null;

  const admin = createAdminClient();
  const { data: org } = await admin
    .from("organizations")
    .select("nome,email,telefone,logo_url")
    .eq("id", organizationId)
    .maybeSingle();

  if (!org) return null;

  return {
    clinica: org.nome,
    logoUrl: org.logo_url,
    emailClinica: org.email,
    telefoneClinica: org.telefone,
  };
}
