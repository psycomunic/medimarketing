"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { bloqueio, contexto, type ActionResult } from "@/lib/actions/contexto";
import { notificar } from "@/lib/supabase/notificacoes";
import { progresso, type Respostas } from "@/lib/formularios/tipos";
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

/** Teto do JSON de respostas. Texto de questionário não chega perto disso. */
const MAX_BYTES = 400_000;

const rascunho = z.object({
  respondenteNome: z.string().max(160),
  respondenteCargo: z.string().max(160),
  dataReferencia: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .or(z.literal("")),
  respostas: z.record(z.unknown()),
});

export type RascunhoInput = z.input<typeof rascunho>;

export type ResultadoRascunho =
  | { ok: true; versao: string; progresso: number }
  | { ok: false; erro: string; conflito?: boolean; travado?: boolean };

/**
 * Autosave do rascunho.
 *
 * `versao` é o `updated_at` que a tela conhece. Se o banco tiver um mais
 * novo, outra pessoa salvou nesse meio-tempo, e gravar por cima apagaria
 * o que ela escreveu sem ninguém perceber. Nesse caso nada é gravado e a
 * tela avisa.
 */
export async function salvarRascunho(
  id: string,
  versao: string,
  input: RascunhoInput
): Promise<ResultadoRascunho> {
  const parsed = rascunho.safeParse(input);
  if (!parsed.success) return { ok: false, erro: "Dados inválidos." };

  const ctx = await contexto(RESPONDE);
  if (ctx.estado !== "ok") {
    const b = bloqueio(ctx);
    return { ok: false, erro: b.ok ? "Sem permissão." : b.erro };
  }

  const d = parsed.data;
  if (JSON.stringify(d.respostas).length > MAX_BYTES) {
    return { ok: false, erro: "As respostas passaram do tamanho máximo. Resuma os textos mais longos." };
  }

  const { data: atual } = await ctx.supabase
    .from("formularios_respostas")
    .select("modelo_id,status,updated_at")
    .eq("id", id)
    .maybeSingle();
  if (!atual) return { ok: false, erro: "Diagnóstico não encontrado." };
  if (atual.status !== "rascunho") {
    return { ok: false, travado: true, erro: "Este diagnóstico já foi enviado e não aceita alterações." };
  }
  if (atual.updated_at !== versao) {
    return { ok: false, conflito: true, erro: "Outra pessoa alterou este diagnóstico." };
  }

  const { data: modelo } = await ctx.supabase
    .from("formularios_modelos")
    .select("schema")
    .eq("id", atual.modelo_id)
    .single();
  const pct = modelo ? progresso(modelo.schema, d.respostas as Respostas) : 0;

  const { data: gravado, error } = await ctx.supabase
    .from("formularios_respostas")
    .update({
      respondente_nome: d.respondenteNome.trim() || null,
      respondente_cargo: d.respondenteCargo.trim() || null,
      data_referencia: d.dataReferencia || null,
      respostas: d.respostas as Respostas,
      progresso: pct,
      atualizado_por: ctx.profile.id,
    })
    .eq("id", id)
    // A trava otimista vai junto no próprio update: entre a leitura acima
    // e esta linha, outra aba pode ter salvo.
    .eq("updated_at", versao)
    .select("updated_at")
    .maybeSingle();

  if (error) {
    console.error("[formularios] Erro ao salvar:", error.message);
    return { ok: false, erro: "Não foi possível salvar." };
  }
  if (!gravado) {
    return { ok: false, conflito: true, erro: "Outra pessoa alterou este diagnóstico." };
  }

  return { ok: true, versao: gravado.updated_at, progresso: pct };
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
    .select("organization_id")
    .eq("id", id)
    .maybeSingle();
  const { data: org } = r
    ? await ctx.supabase.from("organizations").select("nome").eq("id", r.organization_id).maybeSingle()
    : { data: null };

  // Sem organização = aviso da plataforma, que só a equipe enxerga
  await notificar({
    organizationId: null,
    tipo: "sistema",
    prioridade: "alta",
    titulo: `${org?.nome ?? "Uma clínica"} enviou o diagnóstico`,
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
