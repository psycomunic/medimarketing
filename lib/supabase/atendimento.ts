import { createClient } from "@/lib/supabase/server";
import { emModoDemo } from "@/lib/supabase/queries";
import { demoLeads } from "@/lib/demo";
import { demoConversas, demoMensagens } from "@/lib/demo-modulos";
import { getEquipe } from "@/lib/supabase/crm";
import type { ConversaComContexto, Mensagem } from "@/lib/supabase/types";

/**
 * Caixa de entrada da clínica, da conversa mais recente para a mais antiga.
 *
 * Traz junto o responsável e a etapa do lead: é o que permite responder
 * sabendo em que pé está a negociação sem sair da tela.
 */
export async function getConversas(
  organizationId: string | null
): Promise<ConversaComContexto[]> {
  const equipe = await getEquipe(organizationId);
  const nome = (id: string | null) => equipe.find((p) => p.id === id)?.nome ?? null;

  if (await emModoDemo()) {
    const leads = demoLeads();
    return demoConversas().map((c) => ({
      ...c,
      atribuido_nome: nome(c.atribuido_a),
      etapa_funil: leads.find((l) => l.id === c.lead_id)?.etapa_funil ?? null,
    }));
  }
  if (!organizationId) return [];

  const supabase = await createClient();
  const { data: conversas } = await supabase
    .from("conversas")
    .select("*")
    .eq("organization_id", organizationId)
    .order("ultima_mensagem_em", { ascending: false });

  if (!conversas?.length) return [];

  const leadIds = conversas.map((c) => c.lead_id).filter(Boolean) as string[];
  const { data: leads } = leadIds.length
    ? await supabase.from("leads").select("id,etapa_funil").in("id", leadIds)
    : { data: [] };

  return conversas.map((c) => ({
    ...c,
    atribuido_nome: nome(c.atribuido_a),
    etapa_funil: (leads ?? []).find((l) => l.id === c.lead_id)?.etapa_funil ?? null,
  }));
}

/** Mensagens de uma conversa, da mais antiga para a mais recente. */
export async function getMensagens(conversaId: string): Promise<Mensagem[]> {
  if (await emModoDemo()) return demoMensagens(conversaId);

  const supabase = await createClient();
  const { data } = await supabase
    .from("mensagens")
    .select("*")
    .eq("conversa_id", conversaId)
    .order("created_at", { ascending: true });

  return data ?? [];
}

/** Todas as mensagens da caixa, para a tela montar o painel sem ida e volta. */
export async function getTodasMensagens(
  conversas: { id: string }[]
): Promise<Record<string, Mensagem[]>> {
  if (!conversas.length) return {};

  if (await emModoDemo()) {
    return Object.fromEntries(conversas.map((c) => [c.id, demoMensagens(c.id)]));
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("mensagens")
    .select("*")
    .in("conversa_id", conversas.map((c) => c.id))
    .order("created_at", { ascending: true });

  const mapa: Record<string, Mensagem[]> = {};
  for (const m of data ?? []) {
    (mapa[m.conversa_id] ??= []).push(m);
  }
  return mapa;
}

export type ResumoAtendimento = {
  abertas: number;
  semResponsavel: number;
  naoLidas: number;
  resolvidas: number;
  /** Minutos entre a última mensagem do paciente e a resposta da clínica. */
  tempoMedioRespostaMin: number;
};

export function resumirAtendimento(
  conversas: ConversaComContexto[],
  mensagens: Record<string, Mensagem[]>
): ResumoAtendimento {
  // Tempo de resposta: para cada resposta da clínica, quanto tempo passou
  // desde a mensagem do paciente que veio logo antes.
  const esperas: number[] = [];
  for (const lista of Object.values(mensagens)) {
    for (let i = 1; i < lista.length; i++) {
      if (lista[i].direcao === "saida" && lista[i - 1].direcao === "entrada") {
        const minutos =
          (new Date(lista[i].created_at).getTime() -
            new Date(lista[i - 1].created_at).getTime()) /
          60_000;
        if (minutos >= 0) esperas.push(minutos);
      }
    }
  }

  return {
    abertas: conversas.filter((c) => c.status === "aberta").length,
    semResponsavel: conversas.filter((c) => c.status === "pendente" || !c.atribuido_a)
      .length,
    naoLidas: conversas.reduce((s, c) => s + c.nao_lidas, 0),
    resolvidas: conversas.filter((c) => c.status === "resolvida").length,
    tempoMedioRespostaMin: esperas.length
      ? Math.round(esperas.reduce((a, b) => a + b, 0) / esperas.length)
      : 0,
  };
}
