import { createClient } from "@/lib/supabase/server";
import { emModoDemo, getSessao } from "@/lib/supabase/queries";
import { demoEquipe, demoLeads } from "@/lib/demo";
import { demoInteracoes } from "@/lib/demo-modulos";
import type {
  EtapaFunil,
  Lead,
  LeadComContexto,
  LeadInteracao,
  Profile,
} from "@/lib/supabase/types";

/** Equipe da clínica, para os seletores de responsável. */
export async function getEquipe(organizationId: string | null): Promise<Profile[]> {
  if (await emModoDemo()) return demoEquipe(organizationId);
  if (!organizationId) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("ativo", true)
    .order("nome", { ascending: true });

  return data ?? [];
}

/**
 * Leads do funil, já com responsável e resumo do histórico.
 *
 * Traz o funil inteiro de uma vez: o volume por clínica é pequeno e a
 * tela precisa de todas as colunas ao mesmo tempo para somar os totais.
 */
export async function getLeads(
  organizationId: string | null
): Promise<LeadComContexto[]> {
  if (await emModoDemo()) {
    const interacoes = demoInteracoes();
    const equipe = demoEquipe(organizationId);
    return demoLeads().map((l) => enriquecer(l, interacoes, equipe));
  }
  if (!organizationId) return [];

  const supabase = await createClient();
  const { data: leads } = await supabase
    .from("leads")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (!leads?.length) return [];

  const [{ data: interacoes }, equipe] = await Promise.all([
    supabase
      .from("lead_interacoes")
      .select("*")
      .in("lead_id", leads.map((l) => l.id)),
    getEquipe(organizationId),
  ]);

  return leads.map((l) => enriquecer(l, interacoes ?? [], equipe));
}

function enriquecer(
  lead: Lead,
  interacoes: LeadInteracao[],
  equipe: Profile[]
): LeadComContexto {
  const doLead = interacoes.filter((i) => i.lead_id === lead.id);
  const ultima = doLead
    .map((i) => i.created_at)
    .sort((a, b) => b.localeCompare(a))[0];

  return {
    ...lead,
    responsavel_nome:
      equipe.find((p) => p.id === lead.responsavel_id)?.nome ?? null,
    interacoes: doLead.length,
    ultima_interacao: ultima ?? null,
    tarefas_abertas: doLead.filter((i) => i.tipo === "tarefa" && !i.concluida).length,
  };
}

/** Um lead com o histórico completo, para a ficha. */
export async function getLead(
  id: string
): Promise<{ lead: LeadComContexto; historico: LeadInteracao[] } | null> {
  const { profile } = await getSessao();
  const leads = await getLeads(profile?.organization_id ?? null);
  const lead = leads.find((l) => l.id === id);
  if (!lead) return null;

  return { lead, historico: await getInteracoes(id) };
}

/** Histórico de toda a carteira, para a tela do funil montar as fichas. */
export async function getTodasInteracoes(
  organizationId: string | null
): Promise<LeadInteracao[]> {
  if (await emModoDemo()) return demoInteracoes();
  if (!organizationId) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("lead_interacoes")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  return data ?? [];
}

export async function getInteracoes(leadId: string): Promise<LeadInteracao[]> {
  if (await emModoDemo()) return demoInteracoes(leadId);

  const supabase = await createClient();
  const { data } = await supabase
    .from("lead_interacoes")
    .select("*")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });

  return data ?? [];
}

/* ------------------------------------------------------------------ */
/* Métricas do funil                                                   */
/* ------------------------------------------------------------------ */

export type ResumoFunil = {
  total: number;
  emAberto: number;
  ganhos: number;
  perdidos: number;
  valorEmAberto: number;
  valorGanho: number;
  /** Leads que entraram nos últimos 30 dias. */
  novos30d: number;
  /** Tarefas com prazo vencido em toda a carteira. */
  tarefasAtrasadas: number;
  /** % dos leads encerrados que viraram tratamento. */
  taxaConversao: number;
  porEtapa: Record<EtapaFunil, { quantidade: number; valor: number }>;
};

export function resumirFunil(leads: LeadComContexto[]): ResumoFunil {
  const trintaDias = new Date(Date.now() - 30 * 86400_000).toISOString();

  const porEtapa = {
    novo: { quantidade: 0, valor: 0 },
    em_contato: { quantidade: 0, valor: 0 },
    agendado: { quantidade: 0, valor: 0 },
    compareceu: { quantidade: 0, valor: 0 },
    em_tratamento: { quantidade: 0, valor: 0 },
    perdido: { quantidade: 0, valor: 0 },
  } as ResumoFunil["porEtapa"];

  for (const l of leads) {
    const alvo = porEtapa[l.etapa_funil];
    alvo.quantidade += 1;
    alvo.valor += Number(l.valor_estimado ?? 0);
  }

  const ganhos = leads.filter((l) => l.status === "ganho").length;
  const perdidos = leads.filter((l) => l.status === "perdido").length;
  const encerrados = ganhos + perdidos;

  return {
    total: leads.length,
    emAberto: leads.filter((l) => l.status === "aberto").length,
    ganhos,
    perdidos,
    valorEmAberto: leads
      .filter((l) => l.status === "aberto")
      .reduce((s, l) => s + Number(l.valor_estimado ?? 0), 0),
    valorGanho: leads
      .filter((l) => l.status === "ganho")
      .reduce((s, l) => s + Number(l.valor_estimado ?? 0), 0),
    novos30d: leads.filter((l) => l.created_at >= trintaDias).length,
    tarefasAtrasadas: leads.reduce((s, l) => s + l.tarefas_abertas, 0),
    taxaConversao: encerrados ? (ganhos / encerrados) * 100 : 0,
    porEtapa,
  };
}
