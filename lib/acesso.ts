import { redirect } from "next/navigation";
import { getSessao } from "@/lib/supabase/queries";
import { podeAcessar, type ModuloId } from "@/lib/rbac";
import type { Organization, Profile, Role } from "@/lib/supabase/types";

export type Contexto = {
  profile: Profile;
  organizacao: Organization | null;
  role: Role;
};

/**
 * Guard das páginas do painel (reforço além do middleware).
 *
 * Sem sessão → login. Sem permissão no módulo → volta para o início do
 * painel, para o usuário nunca cair numa tela em branco.
 */
export async function exigirModulo(id: ModuloId): Promise<Contexto> {
  const { profile, organizacao } = await getSessao();
  if (!profile) redirect("/login");

  const role = profile.role;
  if (!podeAcessar(role, id)) redirect("/app");

  return { profile, organizacao, role };
}

/** Apenas exige sessão, sem checar módulo específico. */
export async function exigirSessao(): Promise<Contexto> {
  const { profile, organizacao } = await getSessao();
  if (!profile) redirect("/login");
  return { profile, organizacao, role: profile.role };
}
