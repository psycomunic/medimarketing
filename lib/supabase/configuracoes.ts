import { createClient } from "@/lib/supabase/server";
import { emModoDemo } from "@/lib/supabase/queries";
import { demoIntegracoes } from "@/lib/demo-modulos";
import type { Integracao, ProvedorIntegracao } from "@/lib/supabase/types";

/** Provedores oferecidos na tela, na ordem em que aparecem. */
export const PROVEDORES: readonly ProvedorIntegracao[] = [
  "meta_ads",
  "google_ads",
  "ga4",
  "whatsapp",
  "instagram",
] as const;

/**
 * Estado das integrações da clínica.
 *
 * Sempre devolve a lista completa de provedores: o que ainda não foi
 * conectado aparece como desconectado, e não some da tela.
 */
export async function getIntegracoes(
  organizationId: string | null
): Promise<Integracao[]> {
  const gravadas = await carregar(organizationId);

  return PROVEDORES.map(
    (provedor) =>
      gravadas.find((i) => i.provedor === provedor) ?? {
        id: `novo-${provedor}`,
        organization_id: organizationId ?? "",
        provedor,
        conectado: false,
        identificador: null,
        atualizado_em: new Date(0).toISOString(),
      }
  );
}

async function carregar(organizationId: string | null): Promise<Integracao[]> {
  if (await emModoDemo()) return demoIntegracoes();
  if (!organizationId) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("integracoes")
    .select("*")
    .eq("organization_id", organizationId);

  return data ?? [];
}
