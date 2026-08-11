import { createClient } from "@/lib/supabase/server";
import { emModoDemo } from "@/lib/supabase/queries";
import { demoReguas } from "@/lib/demo-modulos";
import type { ReguaComDesempenho } from "@/lib/supabase/types";

/** Janela de desempenho mostrada na tela. */
export const JANELA_DIAS = 90;

/**
 * Réguas da clínica com os passos e o desempenho da janela.
 *
 * O desempenho vem de `regua_execucoes` agregado em memória: o volume de
 * uma clínica em 90 dias é da ordem de centenas de linhas, o que não
 * justifica criar uma view só para isso.
 */
export async function getReguas(
  organizationId: string | null
): Promise<ReguaComDesempenho[]> {
  if (await emModoDemo()) return demoReguas();
  if (!organizationId) return [];

  const supabase = await createClient();
  const { data: reguas } = await supabase
    .from("reguas")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true });

  if (!reguas?.length) return [];

  const desde = new Date(Date.now() - JANELA_DIAS * 86400_000).toISOString();
  const ids = reguas.map((r) => r.id);

  const [{ data: passos }, { data: execucoes }] = await Promise.all([
    supabase.from("regua_passos").select("*").in("regua_id", ids).order("ordem"),
    supabase
      .from("regua_execucoes")
      .select("regua_id,status")
      .in("regua_id", ids)
      .gte("executado_em", desde),
  ]);

  return reguas.map((r) => {
    const daRegua = (execucoes ?? []).filter((e) => e.regua_id === r.id);
    return {
      ...r,
      passos: (passos ?? []).filter((p) => p.regua_id === r.id),
      // "enviado" é o total disparado; respondido e convertido são subconjuntos
      enviados: daRegua.length,
      respondidos: daRegua.filter(
        (e) => e.status === "respondido" || e.status === "convertido"
      ).length,
      convertidos: daRegua.filter((e) => e.status === "convertido").length,
    };
  });
}

export type ResumoRetencao = {
  ativas: number;
  total: number;
  enviados: number;
  respondidos: number;
  recuperados: number;
  taxaResposta: number;
  taxaRecuperacao: number;
};

export function resumirRetencao(reguas: ReguaComDesempenho[]): ResumoRetencao {
  const soma = reguas.reduce(
    (acc, r) => ({
      enviados: acc.enviados + r.enviados,
      respondidos: acc.respondidos + r.respondidos,
      recuperados: acc.recuperados + r.convertidos,
    }),
    { enviados: 0, respondidos: 0, recuperados: 0 }
  );

  return {
    ativas: reguas.filter((r) => r.ativa).length,
    total: reguas.length,
    ...soma,
    taxaResposta: soma.enviados ? (soma.respondidos / soma.enviados) * 100 : 0,
    taxaRecuperacao: soma.enviados ? (soma.recuperados / soma.enviados) * 100 : 0,
  };
}
