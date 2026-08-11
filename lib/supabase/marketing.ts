import { createClient } from "@/lib/supabase/server";
import { emModoDemo } from "@/lib/supabase/queries";
import { demoCampanhas } from "@/lib/demo-modulos";
import type { Campanha, PlataformaAds } from "@/lib/supabase/types";

export async function getCampanhas(
  organizationId: string | null
): Promise<Campanha[]> {
  if (await emModoDemo()) return demoCampanhas();
  if (!organizationId) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("campanhas")
    .select("*")
    .eq("organization_id", organizationId)
    .order("inicio", { ascending: false });

  return data ?? [];
}

export type MetricasCampanha = {
  investimento: number;
  impressoes: number;
  cliques: number;
  leads: number;
  agendamentos: number;
  /** Custo por clique. */
  cpc: number;
  /** Custo por lead. */
  cpl: number;
  /** Custo por consulta agendada. */
  cpa: number;
  /** Taxa de clique sobre impressões. */
  ctr: number;
  /** Cliques que viraram lead. */
  taxaConversao: number;
  /** Leads que viraram agendamento. */
  taxaAgendamento: number;
};

const div = (a: number, b: number) => (b > 0 ? a / b : 0);

export function calcularMetricas(campanhas: Campanha[]): MetricasCampanha {
  const soma = campanhas.reduce(
    (acc, c) => ({
      investimento: acc.investimento + Number(c.investimento),
      impressoes: acc.impressoes + Number(c.impressoes),
      cliques: acc.cliques + c.cliques,
      leads: acc.leads + c.leads,
      agendamentos: acc.agendamentos + c.agendamentos,
    }),
    { investimento: 0, impressoes: 0, cliques: 0, leads: 0, agendamentos: 0 }
  );

  return {
    ...soma,
    cpc: div(soma.investimento, soma.cliques),
    cpl: div(soma.investimento, soma.leads),
    cpa: div(soma.investimento, soma.agendamentos),
    ctr: div(soma.cliques, soma.impressoes) * 100,
    taxaConversao: div(soma.leads, soma.cliques) * 100,
    taxaAgendamento: div(soma.agendamentos, soma.leads) * 100,
  };
}

/** Métricas quebradas por plataforma, para comparar Meta e Google. */
export function porPlataforma(
  campanhas: Campanha[]
): { plataforma: PlataformaAds; metricas: MetricasCampanha; quantidade: number }[] {
  const plataformas = [...new Set(campanhas.map((c) => c.plataforma))];
  return plataformas
    .map((p) => {
      const daPlataforma = campanhas.filter((c) => c.plataforma === p);
      return {
        plataforma: p,
        metricas: calcularMetricas(daPlataforma),
        quantidade: daPlataforma.length,
      };
    })
    .sort((a, b) => b.metricas.investimento - a.metricas.investimento);
}
