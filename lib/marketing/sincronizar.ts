import "server-only";
import { adminDisponivel, createAdminClient } from "@/lib/supabase/admin";
import { buscarInsightsMeta, metaConfigurado } from "@/lib/marketing/meta-api";
import type { ContaAnuncio } from "@/lib/supabase/types";

/**
 * SINCRONIZAÇÃO DE MÍDIA
 *
 * Cada conta de anúncio ligada a uma clínica traz os números por campanha
 * e por dia para `anuncios_diarios`. A primeira vez busca 90 dias; depois,
 * os últimos 7 (o Meta ainda ajusta conversões dos dias recentes). Roda
 * pela rotina de 10 em 10 minutos, no máximo a cada 6 horas por conta.
 */


const INTERVALO_H = 6;
const POR_RODADA = 4;
const hojeSP = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
const somarDias = (s: string, n: number) => {
  const d = new Date(`${s}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** Busca e grava uma conta. Devolve quantas linhas (campanha × dia) vieram. */
export async function sincronizarConta(conta: ContaAnuncio, dias?: number): Promise<{ ok: true; linhas: number } | { ok: false; erro: string }> {
  if (!adminDisponivel()) return { ok: false, erro: "Service role do Supabase não configurada." };
  if (!conta.organization_id) return { ok: false, erro: "Escolha a clínica desta conta antes de sincronizar." };
  if (conta.plataforma !== "meta") return { ok: false, erro: "Google Ads entra na próxima etapa." };
  if (!metaConfigurado()) return { ok: false, erro: "Falta o token do Meta (META_SYSTEM_USER_TOKEN) nas variáveis do Vercel." };
  const admin = createAdminClient();
  const ate = hojeSP();
  const desde = somarDias(ate, -((dias ?? (conta.ultima_sincronizacao ? 7 : 90)) - 1));
  try {
    const linhas = await buscarInsightsMeta(conta.conta_id, desde, ate);
    const agora = new Date().toISOString();
    const registros = linhas.map((l) => ({
      organization_id: conta.organization_id!,
      plataforma: "meta" as const,
      conta_id: conta.conta_id,
      campanha_id: l.campanhaId,
      campanha_nome: l.campanhaNome,
      data: l.data,
      investimento: Math.round(l.investimento * 100) / 100,
      impressoes: l.impressoes,
      alcance: l.alcance,
      cliques: l.cliques,
      leads: l.leads,
      conversas: l.conversas,
      conversoes: 0,
      origem: "api" as const,
      atualizado_em: agora,
    }));
    for (let i = 0; i < registros.length; i += 500) {
      const { error } = await admin
        .from("anuncios_diarios")
        .upsert(registros.slice(i, i + 500), { onConflict: "organization_id,plataforma,campanha_id,data" });
      if (error) throw new Error("Não foi possível gravar os números no banco.");
    }
    await admin.from("contas_anuncio").update({ ultima_sincronizacao: agora, ultimo_erro: null }).eq("id", conta.id);
    return { ok: true, linhas: registros.length };
  } catch (e) {
    const erro = e instanceof Error ? e.message : "Falha na sincronização.";
    await admin.from("contas_anuncio").update({ ultimo_erro: erro.slice(0, 500) }).eq("id", conta.id);
    return { ok: false, erro };
  }
}

/** Etapa da rotina: as contas ligadas que estão há mais de 6 horas sem atualizar. */
export async function sincronizarMidia(): Promise<number> {
  if (!adminDisponivel() || !metaConfigurado()) return 0;
  const admin = createAdminClient();
  const corte = new Date(Date.now() - INTERVALO_H * 3600_000).toISOString();
  const { data, error } = await admin
    .from("contas_anuncio")
    .select("*")
    .eq("ativo", true)
    .eq("plataforma", "meta")
    .not("organization_id", "is", null)
    .or(`ultima_sincronizacao.is.null,ultima_sincronizacao.lt.${corte}`)
    .order("ultima_sincronizacao", { ascending: true, nullsFirst: true })
    .limit(POR_RODADA);
  if (error) return 0;
  let linhas = 0;
  for (const conta of (data ?? []) as ContaAnuncio[]) {
    const r = await sincronizarConta(conta);
    if (r.ok) linhas += r.linhas;
  }
  return linhas;
}
