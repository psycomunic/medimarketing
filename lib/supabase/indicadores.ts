import { createClient } from "@/lib/supabase/server";
import { emModoDemo } from "@/lib/supabase/queries";
import { demoIndicadores, demoClientes, type ClienteResumo } from "@/lib/demo-dados";
import type { IndicadorMensal, Organization } from "@/lib/supabase/types";

/**
 * Lançamentos mensais da clínica, do mais antigo para o mais recente.
 * A RLS já limita à organização do usuário; o filtro explícito serve para
 * o super admin, que enxerga todas.
 */
export async function getIndicadores(
  organizationId: string | null,
  limiteMeses = 12
): Promise<IndicadorMensal[]> {
  if (await emModoDemo()) {
    return demoIndicadores().slice(-limiteMeses);
  }
  if (!organizationId) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("indicadores_mensais")
    .select("*")
    .eq("organization_id", organizationId)
    .order("mes", { ascending: false })
    .limit(limiteMeses);

  return (data ?? []).reverse();
}

/* ------------------------------------------------------------------ */
/* Painel administrativo: carteira de clientes                         */
/* ------------------------------------------------------------------ */

export type { ClienteResumo };

/**
 * Todas as clínicas com um resumo de uso. As contagens vêm de consultas
 * agregadas em memória: a carteira é pequena o suficiente para isso e
 * evita criar views só para o painel interno.
 */
export async function getClientes(): Promise<ClienteResumo[]> {
  if (await emModoDemo()) return demoClientes();

  const supabase = await createClient();
  const { data: orgs } = await supabase
    .from("organizations")
    .select("*")
    .order("nome", { ascending: true });

  if (!orgs?.length) return [];

  const inicioMes = new Date();
  inicioMes.setDate(1);
  inicioMes.setHours(0, 0, 0, 0);

  const [{ data: perfis }, { data: consultas }, { data: leads }, { data: indicadores }] =
    await Promise.all([
      supabase.from("profiles").select("organization_id"),
      supabase
        .from("consultas")
        .select("organization_id")
        .gte("data_hora", inicioMes.toISOString()),
      supabase
        .from("leads")
        .select("organization_id")
        .gte("created_at", inicioMes.toISOString()),
      supabase
        .from("indicadores_mensais")
        .select("organization_id,faturamento,mes")
        .gte("mes", inicioMes.toISOString().slice(0, 10)),
    ]);

  const conta = (lista: { organization_id: string | null }[] | null, orgId: string) =>
    (lista ?? []).filter((r) => r.organization_id === orgId).length;

  return orgs.map((org: Organization) => ({
    ...org,
    usuarios: conta(perfis, org.id),
    consultas_mes: conta(consultas, org.id),
    leads_mes: conta(leads, org.id),
    faturamento_mes: (indicadores ?? [])
      .filter((i) => i.organization_id === org.id)
      .reduce((s, i) => s + Number(i.faturamento), 0),
  }));
}

/** Uma clínica pelo id (detalhe no painel administrativo). */
export async function getCliente(id: string): Promise<ClienteResumo | null> {
  const todos = await getClientes();
  return todos.find((c) => c.id === id) ?? null;
}
