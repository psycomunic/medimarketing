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
 * Sem sessão → login. Conta desativada → login com aviso. Sem permissão
 * no módulo → volta para o início do painel, para o usuário nunca cair
 * numa tela em branco.
 */
export async function exigirModulo(id: ModuloId): Promise<Contexto> {
  const ctx = await exigirSessao();
  if (!podeAcessar(ctx.role, id)) redirect("/app");
  return ctx;
}

/**
 * Apenas exige sessão válida e conta ativa.
 *
 * O `ativo` é checado aqui, e não só na interface: desativar alguém
 * precisa cortar o acesso de verdade, inclusive de quem já estava com a
 * sessão aberta quando o gestor apertou o botão.
 */
export async function exigirSessao(): Promise<Contexto> {
  const { profile, organizacao } = await getSessao();
  if (!profile) redirect("/login");

  // Os dois estão barrados, mas por motivos opostos: um nunca foi
  // liberado, o outro teve o acesso retirado. A mensagem muda.
  if (profile.aguardando_liberacao) redirect("/login?erro=pendente");
  if (!profile.ativo) redirect("/login?erro=inativo");

  return { profile, organizacao, role: profile.role };
}
