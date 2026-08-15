/**
 * Contexto comum das server actions do painel.
 *
 * Toda action precisa da mesma sequência: barrar o modo demonstração,
 * conferir a sessão e, quase sempre, checar papel e clínica. Em vez de
 * repetir isso em sete arquivos, centralizamos aqui.
 *
 * A união é discriminada por `estado` (e não por presença de campo) para
 * o TypeScript estreitar de verdade depois do guard.
 */
import { createClient } from "@/lib/supabase/server";
import { emModoDemo, getSessao } from "@/lib/supabase/queries";
import type { Profile, Role } from "@/lib/supabase/types";

export type ActionResult = { ok: true } | { ok: false; erro: string };

export const MSG_DEMO =
  "Modo demonstração: nada é salvo aqui. Numa conta de verdade, esta alteração já estaria valendo.";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type Contexto =
  | { estado: "demo" }
  | { estado: "erro"; erro: string }
  | { estado: "ok"; supabase: Supabase; profile: Profile };

/** Papéis que operam o dia a dia da clínica. */
export const OPERACIONAL: readonly Role[] = ["super_admin", "gestor", "secretaria"];
/** Papéis com poder de configurar e mexer em dinheiro. */
export const GESTAO: readonly Role[] = ["super_admin", "gestor"];

/**
 * Quem responde pela cara da clínica: nome, logo e número de WhatsApp.
 *
 * O médico entra porque, em consultório de um profissional só — a maior
 * parte da carteira —, ele é o dono; pedir para outra pessoa trocar a
 * própria logo seria burocracia sem propósito. A secretária fica de
 * fora: opera a agenda, não decide a marca.
 */
export const MARCA: readonly Role[] = ["super_admin", "gestor", "medico"];

/**
 * Sessão pronta para escrever no banco.
 *
 * `papeis` restringe quem pode executar a action; sem ele, basta estar
 * logado. Em modo demonstração devolve sempre `demo`, o que as actions
 * traduzem na mensagem padrão.
 */
export async function contexto(papeis?: readonly Role[]): Promise<Contexto> {
  if (await emModoDemo()) return { estado: "demo" };

  const { profile } = await getSessao();
  if (!profile) return { estado: "erro", erro: "Sessão expirada." };
  if (papeis && !papeis.includes(profile.role)) {
    return { estado: "erro", erro: "Você não tem permissão para esta ação." };
  }

  const supabase = await createClient();
  return { estado: "ok", supabase, profile };
}

/** Converte os estados de bloqueio no retorno padrão das actions. */
export function bloqueio(ctx: Exclude<Contexto, { estado: "ok" }>): ActionResult {
  return ctx.estado === "demo"
    ? { ok: false, erro: MSG_DEMO }
    : { ok: false, erro: ctx.erro };
}

/**
 * Clínica em que a action vai gravar.
 *
 * O gestor só escreve na própria; o super admin pode escrever em qualquer
 * uma, desde que diga qual. Devolve `null` quando não dá para decidir.
 */
export function organizacaoAlvo(
  profile: Profile,
  informada?: string | null
): string | null {
  if (profile.role === "super_admin") return informada ?? null;
  if (!profile.organization_id) return null;
  if (informada && informada !== profile.organization_id) return null;
  return profile.organization_id;
}
