"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { bloqueio, contexto, type ActionResult } from "@/lib/actions/contexto";
import { notificar } from "@/lib/supabase/notificacoes";
import {
  gravarRascunho,
  type RascunhoInput,
  type ResultadoRascunho,
} from "@/lib/formularios/servidor";
import type { Role } from "@/lib/supabase/types";

/**
 * FORMULÁRIOS (diagnóstico da clínica)
 *
 * A clínica salva rascunho e envia; a equipe libera, revisa, reabre e
 * anota. As permissões de verdade estão na RLS e nas funções do banco —
 * os papéis daqui só poupam uma ida ao banco para quem nem deveria
 * estar tentando.
 */
const RESPONDE: readonly Role[] = ["super_admin", "gestor", "medico"];
const SOMENTE_EQUIPE: readonly Role[] = ["super_admin"];

export type { RascunhoInput, ResultadoRascunho };

/** Autosave do rascunho pelo painel, com a sessão de quem está logado. */
export async function salvarRascunho(
  id: string,
  versao: string,
  input: RascunhoInput
): Promise<ResultadoRascunho> {
  const ctx = await contexto(RESPONDE);
  if (ctx.estado !== "ok") {
    const b = bloqueio(ctx);
    return { ok: false, erro: b.ok ? "Sem permissão." : b.erro };
  }
  return gravarRascunho(ctx.supabase, { coluna: "id", valor: id }, versao, input, ctx.profile.id);
}

export async function enviarFormulario(id: string): Promise<ActionResult> {
  const ctx = await contexto(RESPONDE);
  if (ctx.estado !== "ok") return bloqueio(ctx);

  const { error } = await ctx.supabase.rpc("enviar_formulario", { p_id: id });
  if (error) {
    console.error("[formularios] Erro ao enviar:", error.message);
    return { ok: false, erro: "Não foi possível enviar. Tente de novo em instantes." };
  }

  const { data: r } = await ctx.supabase
    .from("formularios_respostas")
    .select("organization_id,modelo_id")
    .eq("id", id)
    .maybeSingle();
  const { data: modelo } = r
    ? await ctx.supabase.from("formularios_modelos").select("titulo").eq("id", r.modelo_id).maybeSingle()
    : { data: null };
  const { data: org } = r
    ? await ctx.supabase.from("organizations").select("nome").eq("id", r.organization_id).maybeSingle()
    : { data: null };

  // Sem organização = aviso da plataforma, que só a equipe enxerga
  await notificar({
    organizationId: null,
    tipo: "sistema",
    prioridade: "alta",
    titulo: `${org?.nome ?? "Uma clínica"} enviou o ${(modelo?.titulo ?? "diagnóstico").toLowerCase()}`,
    descricao: "As respostas estão prontas para revisão.",
    href: `/app/admin/diagnosticos/${id}`,
    entidadeId: id,
    papeis: ["super_admin"],
  });

  revalidatePath("/app/diagnostico");
  revalidatePath("/app/admin/diagnosticos");
  return { ok: true };
}

async function transicaoEquipe(
  funcao: "reabrir_formulario" | "marcar_formulario_revisado",
  id: string
): Promise<ActionResult> {
  const ctx = await contexto(SOMENTE_EQUIPE);
  if (ctx.estado !== "ok") return bloqueio(ctx);

  const { error } = await ctx.supabase.rpc(funcao, { p_id: id });
  if (error) {
    console.error(`[formularios] ${funcao}:`, error.message);
    return { ok: false, erro: "Não foi possível mudar o status." };
  }

  revalidatePath("/app/admin/diagnosticos");
  revalidatePath(`/app/admin/diagnosticos/${id}`);
  revalidatePath("/app/diagnostico");
  return { ok: true };
}

export async function reabrirFormulario(id: string): Promise<ActionResult> {
  return transicaoEquipe("reabrir_formulario", id);
}

export async function marcarRevisado(id: string): Promise<ActionResult> {
  return transicaoEquipe("marcar_formulario_revisado", id);
}

export type ResultadoLiberar = { ok: true; id: string } | { ok: false; erro: string };

/** Abre o diagnóstico no painel da clínica. Não duplica se já existir. */
export async function liberarFormulario(
  organizationId: string,
  slug: string
): Promise<ResultadoLiberar> {
  const ctx = await contexto(SOMENTE_EQUIPE);
  if (ctx.estado !== "ok") {
    const b = bloqueio(ctx);
    return { ok: false, erro: b.ok ? "Sem permissão." : b.erro };
  }
  if (!z.string().uuid().safeParse(organizationId).success) {
    return { ok: false, erro: "Escolha uma clínica." };
  }

  const { data, error } = await ctx.supabase.rpc("liberar_formulario", {
    p_org: organizationId,
    p_slug: slug,
  });
  if (error || !data) {
    console.error("[formularios] Erro ao liberar:", error?.message);
    return { ok: false, erro: "Não foi possível liberar o diagnóstico." };
  }

  await notificar({
    organizationId,
    tipo: "sistema",
    titulo: "Diagnóstico inicial liberado",
    descricao: "A Medi Marketing liberou o questionário de diagnóstico da clínica.",
    href: "/app/diagnostico",
    entidadeId: data,
    papeis: ["gestor", "medico"],
  });

  revalidatePath("/app/admin/diagnosticos");
  return { ok: true, id: data };
}

export async function adicionarNota(id: string, texto: string): Promise<ActionResult> {
  const limpo = texto.trim();
  if (!limpo) return { ok: false, erro: "Escreva a nota." };
  if (limpo.length > 4000) return { ok: false, erro: "Nota longa demais." };

  const ctx = await contexto(SOMENTE_EQUIPE);
  if (ctx.estado !== "ok") return bloqueio(ctx);

  const { error } = await ctx.supabase.from("formularios_notas").insert({
    resposta_id: id,
    autor_id: ctx.profile.id,
    texto: limpo,
  });
  if (error) {
    console.error("[formularios] Erro na nota:", error.message);
    return { ok: false, erro: "Não foi possível salvar a nota." };
  }

  revalidatePath(`/app/admin/diagnosticos/${id}`);
  return { ok: true };
}
