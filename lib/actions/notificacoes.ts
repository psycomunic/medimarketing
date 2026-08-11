"use server";

import { revalidatePath } from "next/cache";
import {
  bloqueio,
  contexto,
  type ActionResult,
} from "@/lib/actions/contexto";
import { getNotificacoes } from "@/lib/supabase/notificacoes";

function revalidar() {
  revalidatePath("/app/notificacoes");
  revalidatePath("/app", "layout");
}

/** Marca uma notificação como lida para quem está logado. */
export async function marcarLida(notificacaoId: string): Promise<ActionResult> {
  const ctx = await contexto();
  if (ctx.estado !== "ok") return bloqueio(ctx);

  const { error } = await ctx.supabase.from("notificacao_leituras").upsert({
    notificacao_id: notificacaoId,
    user_id: ctx.profile.id,
  });

  if (error) return { ok: false, erro: "Não foi possível marcar como lida." };

  revalidar();
  return { ok: true };
}

/**
 * Marca tudo que está visível como lido.
 *
 * A leitura é por usuário, então gravamos uma linha por notificação —
 * o upsert evita conflito quando alguma já estava lida.
 */
export async function marcarTodasLidas(): Promise<ActionResult> {
  const ctx = await contexto();
  if (ctx.estado !== "ok") return bloqueio(ctx);

  const lista = await getNotificacoes(ctx.profile);
  const pendentes = lista.filter((n) => !n.lida);
  if (!pendentes.length) return { ok: true };

  const { error } = await ctx.supabase.from("notificacao_leituras").upsert(
    pendentes.map((n) => ({
      notificacao_id: n.id,
      user_id: ctx.profile.id,
    }))
  );

  if (error) return { ok: false, erro: "Não foi possível marcar todas." };

  revalidar();
  return { ok: true };
}
