import "server-only";

import { createClient } from "@/lib/supabase/server";
import { adminDisponivel, createAdminClient } from "@/lib/supabase/admin";
import { emModoDemo } from "@/lib/supabase/queries";
import { demoNotificacoes } from "@/lib/demo-modulos";
import type {
  NotificacaoComLeitura,
  Profile,
  Role,
  TipoNotificacao,
} from "@/lib/supabase/types";

/** Quantas notificações a aba carrega de uma vez. */
const LIMITE = 100;

/* ------------------------------------------------------------------ */
/* Criação                                                             */
/* ------------------------------------------------------------------ */

export type NovaNotificacao = {
  organizationId: string | null;
  tipo: TipoNotificacao;
  titulo: string;
  descricao?: string | null;
  href?: string | null;
  entidadeId?: string | null;
  prioridade?: "alta" | "normal";
  /** Quem deve ver. Sem isso, gestão e atendimento. */
  papeis?: Role[];
};

/**
 * Registra um aviso para a equipe.
 *
 * Usa a service role porque quase sempre é disparada por um caminho sem
 * sessão de usuário da clínica — o paciente respondendo o link, o cron,
 * o formulário público. Nunca lança: falhar em notificar não pode
 * derrubar a ação que a originou.
 */
export async function notificar(n: NovaNotificacao): Promise<void> {
  if (!adminDisponivel()) return;

  try {
    const admin = createAdminClient();
    const { error } = await admin.from("notificacoes").insert({
      organization_id: n.organizationId,
      tipo: n.tipo,
      titulo: n.titulo,
      descricao: n.descricao ?? null,
      href: n.href ?? null,
      entidade_id: n.entidadeId ?? null,
      prioridade: n.prioridade ?? "normal",
      papeis: n.papeis ?? ["gestor", "secretaria"],
    });

    if (error) console.error("[notificacoes] Não gravou:", error.message);
  } catch (e) {
    console.error("[notificacoes] Falha:", e instanceof Error ? e.message : e);
  }
}

/* ------------------------------------------------------------------ */
/* Leitura                                                             */
/* ------------------------------------------------------------------ */

/**
 * Notificações que este perfil enxerga, das mais novas para as antigas.
 *
 * A RLS já filtra por clínica e papel; o `lida` é resolvido aqui porque
 * depende de quem está olhando.
 */
export async function getNotificacoes(
  profile: Profile
): Promise<NotificacaoComLeitura[]> {
  if (await emModoDemo()) return demoNotificacoes(profile.role);

  const supabase = await createClient();

  const { data: notificacoes, error } = await supabase
    .from("notificacoes")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(LIMITE);

  // Tabela ainda não criada no banco: a aba mostra o aviso, não quebra
  if (error || !notificacoes?.length) return [];

  const { data: leituras } = await supabase
    .from("notificacao_leituras")
    .select("notificacao_id")
    .eq("user_id", profile.id)
    .in("notificacao_id", notificacoes.map((n) => n.id));

  const lidas = new Set((leituras ?? []).map((l) => l.notificacao_id));

  return notificacoes.map((n) => ({ ...n, lida: lidas.has(n.id) }));
}

/** Só o número, para o contador da navegação. */
export async function contarNaoLidas(profile: Profile): Promise<number> {
  const lista = await getNotificacoes(profile);
  return lista.filter((n) => !n.lida).length;
}

export type ResumoNotificacoes = {
  total: number;
  naoLidas: number;
  urgentes: number;
};

export function resumirNotificacoes(
  lista: NotificacaoComLeitura[]
): ResumoNotificacoes {
  return {
    total: lista.length,
    naoLidas: lista.filter((n) => !n.lida).length,
    urgentes: lista.filter((n) => !n.lida && n.prioridade === "alta").length,
  };
}
