import "server-only";

/**
 * META ADS (Marketing API)
 *
 * Uma conexão só, da Medi Marketing: o token de um usuário do sistema da
 * BM principal, com acesso de leitura às contas de anúncio dos clientes.
 * Cada conta é ligada a uma clínica no painel administrativo; as clínicas
 * não fazem nada.
 *
 * Variáveis de ambiente:
 * - META_SYSTEM_USER_TOKEN: token do usuário do sistema (ads_read)
 * - META_API_VERSION: versão da Graph API (padrão abaixo)
 */

const VERSAO = process.env.META_API_VERSION?.trim() || "v23.0";
const BASE = `https://graph.facebook.com/${VERSAO}`;

export function metaConfigurado(): boolean {
  return !!process.env.META_SYSTEM_USER_TOKEN?.trim();
}

export type ContaMeta = {
  id: string; // act_...
  nome: string;
  status: number;
  moeda: string | null;
  bm: string | null;
};

export type DiaCampanhaMeta = {
  campanhaId: string;
  campanhaNome: string;
  data: string;
  investimento: number;
  impressoes: number;
  alcance: number;
  cliques: number;
  leads: number;
  conversas: number;
};

type Resposta<T> = { data?: T[]; paging?: { next?: string }; error?: { message?: string; code?: number } };

/** GET paginado na Graph API, juntando todas as páginas. */
async function todas<T>(url: string, limitePaginas = 50): Promise<T[]> {
  const lista: T[] = [];
  let proxima: string | undefined = url;
  for (let i = 0; proxima && i < limitePaginas; i++) {
    const r = await fetch(proxima, {
      headers: { Authorization: `Bearer ${process.env.META_SYSTEM_USER_TOKEN}` },
      cache: "no-store",
    });
    const j = (await r.json().catch(() => ({}))) as Resposta<T>;
    if (!r.ok || j.error) throw new Error(traduzirErro(j.error?.message, j.error?.code));
    lista.push(...(j.data ?? []));
    proxima = j.paging?.next;
  }
  return lista;
}

function traduzirErro(msg?: string, codigo?: number): string {
  if (codigo === 190) return "O token do Meta expirou ou foi revogado. Gere um novo no usuário do sistema da BM.";
  if (codigo === 200 || codigo === 10) return "O usuário do sistema não tem permissão nesta conta de anúncio (ads_read).";
  if (codigo === 17 || codigo === 4 || codigo === 80004) return "O Meta limitou as consultas por agora. A próxima sincronização tenta de novo.";
  return msg ? `Meta: ${msg}` : "Não foi possível falar com o Meta.";
}

/** Contas de anúncio que o usuário do sistema enxerga. */
export async function listarContasMeta(): Promise<ContaMeta[]> {
  const url = `${BASE}/me/adaccounts?fields=id,name,account_status,currency,business{name}&limit=200`;
  const brutas = await todas<{ id: string; name: string; account_status: number; currency?: string; business?: { name?: string } }>(url);
  return brutas
    .map((c) => ({ id: c.id, nome: c.name, status: c.account_status, moeda: c.currency ?? null, bm: c.business?.name ?? null }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

/** Ações que contam como lead de formulário e como conversa iniciada. */
const ACOES_LEAD = ["lead", "onsite_conversion.lead_grouped", "offsite_conversion.fb_pixel_lead", "leadgen_grouped"];
const ACOES_CONVERSA = ["onsite_conversion.messaging_conversation_started_7d"];

/** Números de cada campanha, dia a dia, entre duas datas (YYYY-MM-DD). */
export async function buscarInsightsMeta(contaId: string, desde: string, ate: string): Promise<DiaCampanhaMeta[]> {
  const params = new URLSearchParams({
    level: "campaign",
    time_increment: "1",
    time_range: JSON.stringify({ since: desde, until: ate }),
    fields: "campaign_id,campaign_name,spend,impressions,reach,inline_link_clicks,actions,date_start",
    limit: "500",
  });
  const brutas = await todas<{
    campaign_id: string;
    campaign_name: string;
    spend?: string;
    impressions?: string;
    reach?: string;
    inline_link_clicks?: string;
    actions?: { action_type: string; value: string }[];
    date_start: string;
  }>(`${BASE}/${contaId}/insights?${params}`);

  return brutas.map((l) => {
    const acao = (tipos: string[]) => {
      // A mesma conversão aparece em mais de um tipo: vale o maior, não a soma
      const valores = (l.actions ?? []).filter((a) => tipos.includes(a.action_type)).map((a) => Number(a.value) || 0);
      return valores.length ? Math.max(...valores) : 0;
    };
    return {
      campanhaId: l.campaign_id,
      campanhaNome: l.campaign_name,
      data: l.date_start,
      investimento: Number(l.spend ?? 0) || 0,
      impressoes: Number(l.impressions ?? 0) || 0,
      alcance: Number(l.reach ?? 0) || 0,
      cliques: Number(l.inline_link_clicks ?? 0) || 0,
      leads: acao(ACOES_LEAD),
      conversas: acao(ACOES_CONVERSA),
    };
  });
}
