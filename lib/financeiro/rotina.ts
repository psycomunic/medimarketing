import "server-only";
import { adminDisponivel, createAdminClient } from "@/lib/supabase/admin";
import { vencimentoDe } from "@/lib/financeiro/agencia";
import type { Contrato } from "@/lib/supabase/types";

/**
 * Gera a mensalidade do mês corrente de cada contrato ativo, uma vez só
 * (índice único por contrato e competência). Roda junto da rotina de
 * comunicação; se as tabelas ainda não existem, não faz nada.
 */
export async function gerarMensalidades(): Promise<number> {
  if (!adminDisponivel()) return 0;
  const admin = createAdminClient();
  const agora = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
  const mes = agora.slice(0, 7);
  const { data, error } = await admin.from("contratos").select("*").eq("status", "ativo");
  if (error || !data?.length) return 0;
  const linhas = (data as Contrato[])
    .filter((c) => c.inicio.slice(0, 7) <= mes && Number(c.mensalidade) > 0)
    .map((c) => ({
      organization_id: c.organization_id,
      contrato_id: c.id,
      competencia: `${mes}-01`,
      descricao: "Mensalidade",
      valor: Number(c.mensalidade),
      vencimento: vencimentoDe(c, mes),
      status: "aberta" as const,
      tipo: "mensalidade" as const,
    }));
  if (!linhas.length) return 0;
  const { data: criadas } = await admin
    .from("faturas")
    .upsert(linhas, { onConflict: "contrato_id,competencia", ignoreDuplicates: true })
    .select("id");
  return criadas?.length ?? 0;
}
