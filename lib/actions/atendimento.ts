"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  bloqueio,
  contexto,
  OPERACIONAL,
  type ActionResult,
} from "@/lib/actions/contexto";
import type { StatusConversa } from "@/lib/supabase/types";

function revalidar() {
  revalidatePath("/app/atendimento");
  revalidatePath("/app/crm");
}

const envioSchema = z.object({
  conversaId: z.string().min(1),
  conteudo: z.string().trim().min(1, "Escreva a mensagem.").max(4000),
});

/**
 * Envia uma resposta na conversa.
 *
 * Grava a mensagem e atualiza o resumo da conversa na mesma ação: a lista
 * da caixa de entrada lê só a conversa, então ela precisa carregar o
 * último texto e o horário para ordenar direito.
 */
export async function enviarMensagem(input: {
  conversaId: string;
  conteudo: string;
}): Promise<ActionResult> {
  const parsed = envioSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.errors[0]?.message ?? "Dados inválidos" };
  }

  const ctx = await contexto(OPERACIONAL);
  if (ctx.estado !== "ok") return bloqueio(ctx);

  const agora = new Date().toISOString();
  const { conversaId, conteudo } = parsed.data;

  const { error } = await ctx.supabase.from("mensagens").insert({
    conversa_id: conversaId,
    direcao: "saida",
    autor_id: ctx.profile.id,
    autor_nome: ctx.profile.nome,
    conteudo,
  });

  if (error) {
    console.error("[atendimento] Erro ao enviar:", error.message);
    return { ok: false, erro: "Não foi possível enviar a mensagem." };
  }

  // Responder assume a conversa e zera o contador de não lidas
  await ctx.supabase
    .from("conversas")
    .update({
      ultima_mensagem: conteudo.slice(0, 160),
      ultima_mensagem_em: agora,
      nao_lidas: 0,
      status: "aberta" as StatusConversa,
      atribuido_a: ctx.profile.id,
    })
    .eq("id", conversaId);

  revalidar();
  return { ok: true };
}

/** Assume a conversa (ou passa para outra pessoa da equipe). */
export async function atribuirConversa(
  conversaId: string,
  profileId: string | null
): Promise<ActionResult> {
  const ctx = await contexto(OPERACIONAL);
  if (ctx.estado !== "ok") return bloqueio(ctx);

  const { error } = await ctx.supabase
    .from("conversas")
    .update({
      atribuido_a: profileId,
      status: profileId ? "aberta" : "pendente",
    })
    .eq("id", conversaId);

  if (error) return { ok: false, erro: "Não foi possível atribuir a conversa." };

  revalidar();
  return { ok: true };
}

export async function mudarStatusConversa(
  conversaId: string,
  status: StatusConversa
): Promise<ActionResult> {
  if (!["aberta", "pendente", "resolvida"].includes(status)) {
    return { ok: false, erro: "Status inválido." };
  }

  const ctx = await contexto(OPERACIONAL);
  if (ctx.estado !== "ok") return bloqueio(ctx);

  const { error } = await ctx.supabase
    .from("conversas")
    .update({ status, ...(status === "resolvida" ? { nao_lidas: 0 } : {}) })
    .eq("id", conversaId);

  if (error) return { ok: false, erro: "Não foi possível atualizar a conversa." };

  revalidar();
  return { ok: true };
}

/** Zera o contador de não lidas ao abrir a conversa. */
export async function marcarLida(conversaId: string): Promise<ActionResult> {
  const ctx = await contexto(OPERACIONAL);
  if (ctx.estado !== "ok") return bloqueio(ctx);

  const { error } = await ctx.supabase
    .from("conversas")
    .update({ nao_lidas: 0 })
    .eq("id", conversaId);

  if (error) return { ok: false, erro: "Não foi possível marcar como lida." };

  revalidar();
  return { ok: true };
}
