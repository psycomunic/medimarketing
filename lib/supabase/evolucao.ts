import "server-only";

import { createClient } from "@/lib/supabase/server";
import { emModoDemo } from "@/lib/supabase/queries";
import { demoIndicadores } from "@/lib/demo-dados";
import type { PlanoCliente } from "@/lib/supabase/types";

/**
 * Plano da clínica: marco zero e metas.
 *
 * A RLS só entrega o plano à equipe e a quem responde pela clínica
 * (gestor e médico). Para a secretária, volta nulo e o painel segue sem
 * a seção de evolução.
 */
export async function getPlano(organizationId: string | null): Promise<PlanoCliente | null> {
  if (await emModoDemo()) return demoPlano();
  if (!organizationId) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("planos_cliente")
    .select("*")
    .eq("organization_id", organizationId)
    .maybeSingle();
  return data ?? null;
}

/** Os três primeiros meses da série fictícia como marco zero. */
function demoPlano(): PlanoCliente {
  const meses = demoIndicadores();
  return {
    organization_id: meses[0]?.organization_id ?? "demo",
    resposta_id: "demo-diagnostico-1",
    base_inicio: meses[0]?.mes ?? null,
    base_fim: meses[2]?.mes ?? null,
    meta_faturamento: 100000,
    meta_leads: 120,
    meta_consultas: 70,
    prazo: meses[meses.length - 1]?.mes.replace(/^(\d{4})/, (a) => String(Number(a) + 1)) ?? null,
    criterio_financeiro: "Dinheiro recebido no mês, pelo extrato do sistema da clínica.",
    prioridades: "Procedimentos com toxina e dermatologia clínica, pela margem.",
    obstaculo: "Contatos do Instagram que não viram consulta: a resposta demora.",
    observacoes: null,
    importado_em: meses[2]?.mes ?? null,
    atualizado_em: meses[2]?.mes ?? new Date().toISOString(),
    atualizado_por: null,
  };
}
