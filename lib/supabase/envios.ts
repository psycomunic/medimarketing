import "server-only";

import { createClient } from "@/lib/supabase/server";
import { emModoDemo } from "@/lib/supabase/queries";
import type { Envio, PreferenciaAviso } from "@/lib/supabase/types";

/** O que saiu (ou tentou sair) de uma clínica, dos mais novos para os antigos. */
export async function getEnvios(organizationId: string, limite = 150): Promise<Envio[]> {
  if (await emModoDemo()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("envios")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(limite);
  // Tabela ainda não criada: a tela mostra o aviso, não quebra
  if (error) return [];
  return data ?? [];
}

/** Preferências de aviso de uma pessoa (a RLS decide se quem pede pode ver). */
export async function getPreferencia(usuarioId: string): Promise<PreferenciaAviso | null> {
  if (await emModoDemo()) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("preferencias_aviso")
    .select("*")
    .eq("usuario_id", usuarioId)
    .maybeSingle();
  return data ?? null;
}

/** Preferências de toda a equipe da clínica (para o gestor). */
export async function getPreferenciasDaClinica(organizationId: string): Promise<PreferenciaAviso[]> {
  if (await emModoDemo()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("preferencias_aviso")
    .select("*")
    .eq("organization_id", organizationId);
  return data ?? [];
}
