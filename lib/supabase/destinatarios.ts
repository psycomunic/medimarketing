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
export type ContatoEquipe = { nome: string; telefone: string };

export type DestinoConsulta = {
  emails: string[];
  /** Quem recebe o aviso por WhatsApp, já sem repetição de número. */
  whatsapps: ContatoEquipe[];
  /** Conexão do Merge da clínica: o número que envia. */
  conexaoId: number | null;
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
    .select("nome,email,telefone,logo_url,merge_connection_id")
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
    .select("id,nome,role,telefone")
    .eq("organization_id", organizationId)
    .eq("ativo", true);

  const alvos = (perfis ?? []).filter(
    (p) => p.role === "gestor" || p.id === medicoId
  );

  // O e-mail de login vive em auth.users, fora do alcance do select acima
  const emailsEquipe: string[] = [];
  for (const p of alvos) {
    const { data } = await admin.auth.admin.getUserById(p.id);
    const e = data?.user?.email;
    // Endereços de teste não devem receber aviso de produção
    if (e && !e.endsWith("@example.invalid")) emailsEquipe.push(e);
  }

  const emails = [...new Set([org.email, ...emailsEquipe].filter(Boolean))] as string[];

  // No WhatsApp o telefone da clínica costuma ser o mesmo número que
  // envia. Mandar aviso para si mesma não faz sentido, então ele entra
  // por último e a deduplicação por dígitos resolve o resto.
  const brutos: ContatoEquipe[] = [
    ...alvos
      .filter((p) => p.telefone)
      .map((p) => ({ nome: p.nome ?? org.nome, telefone: p.telefone as string })),
    ...(org.telefone ? [{ nome: org.nome, telefone: org.telefone }] : []),
  ];

  const vistos = new Set<string>();
  const whatsapps = brutos.filter((c) => {
    const chave = c.telefone.replace(/\D/g, "");
    if (!chave || vistos.has(chave)) return false;
    vistos.add(chave);
    return true;
  });

  return {
    emails,
    whatsapps,
    conexaoId: org.merge_connection_id ?? null,
    marca,
  };
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
