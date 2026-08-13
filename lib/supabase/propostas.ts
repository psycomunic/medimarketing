import "server-only";

import { createAdminClient, adminDisponivel } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Proposta } from "@/lib/supabase/types";

/**
 * Leitura da proposta pela página pública.
 *
 * Usa a service role porque quem abre o link não tem sessão — a
 * autorização é o próprio token, 18 bytes aleatórios que só chegaram a
 * quem recebeu o link. Por isso a busca é sempre pelo token exato, e
 * nunca pelo id: com o id, qualquer um leria a proposta do vizinho.
 */
export async function getPropostaPorToken(
  token: string
): Promise<Proposta | null> {
  if (!adminDisponivel() || !token || token.length < 12) return null;

  const admin = createAdminClient();
  const { data } = await admin
    .from("propostas")
    .select("*")
    .eq("token", token)
    .maybeSingle();

  return data ?? null;
}

/** A lista do painel. A RLS já limita à equipe Medi Marketing. */
export async function getPropostas(): Promise<Proposta[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("propostas")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  return data ?? [];
}
