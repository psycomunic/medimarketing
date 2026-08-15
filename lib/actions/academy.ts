"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { emModoDemo, getSessao } from "@/lib/supabase/queries";
import type { NivelTrilha, Profile, Role } from "@/lib/supabase/types";

export type ActionResult = { ok: true } | { ok: false; erro: string };

const MSG_DEMO =
  "Modo demonstração: nada é salvo aqui. Numa conta de verdade, esta alteração já estaria valendo.";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Sessão + bloqueio do modo demo, usado por todas as ações daqui.
 * União discriminada por `estado` para o TypeScript estreitar direito.
 */
type Contexto =
  | { estado: "demo" }
  | { estado: "erro"; erro: string }
  | { estado: "ok"; supabase: Supabase; profile: Profile };

async function contexto(): Promise<Contexto> {
  if (await emModoDemo()) return { estado: "demo" };
  const { profile } = await getSessao();
  if (!profile) return { estado: "erro", erro: "Sessão expirada." };
  const supabase = await createClient();
  return { estado: "ok", supabase, profile };
}

/** Converte os estados de bloqueio no retorno padrão das actions. */
function bloqueio(ctx: Exclude<Contexto, { estado: "ok" }>): ActionResult {
  return ctx.estado === "demo"
    ? { ok: false, erro: MSG_DEMO }
    : { ok: false, erro: ctx.erro };
}

/* ------------------------------------------------------------------ */
/* Aluno                                                               */
/* ------------------------------------------------------------------ */

/** Marca ou desmarca uma aula como concluída para quem está logado. */
export async function marcarAula(
  lessonId: string,
  concluida: boolean
): Promise<ActionResult> {
  const ctx = await contexto();
  if (ctx.estado !== "ok") return bloqueio(ctx);
  const { supabase, profile } = ctx;

  if (concluida) {
    const { error } = await supabase.from("lesson_progress").upsert(
      {
        lesson_id: lessonId,
        user_id: profile.id,
        concluida: true,
        concluida_em: new Date().toISOString(),
      },
      { onConflict: "lesson_id,user_id" }
    );
    if (error) return { ok: false, erro: "Não foi possível salvar o progresso." };
  } else {
    const { error } = await supabase
      .from("lesson_progress")
      .delete()
      .eq("lesson_id", lessonId)
      .eq("user_id", profile.id);
    if (error) return { ok: false, erro: "Não foi possível salvar o progresso." };
  }

  revalidatePath("/app/academy", "layout");
  return { ok: true };
}

const comentarioSchema = z.object({
  lessonId: z.string().min(1),
  conteudo: z
    .string()
    .trim()
    .min(3, "Escreva sua dúvida com um pouco mais de detalhe.")
    .max(2000, "Mensagem muito longa."),
  parentId: z.string().optional(),
});

/**
 * Publica uma dúvida na aula ou responde a uma existente.
 *
 * A resposta herda a `organization_id` do comentário original: é assim que
 * a equipe da Medi Marketing consegue responder dentro do ambiente isolado
 * da clínica que perguntou.
 */
export async function comentar(input: {
  lessonId: string;
  conteudo: string;
  parentId?: string;
}): Promise<ActionResult> {
  const parsed = comentarioSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.errors[0]?.message ?? "Dados inválidos" };
  }

  const ctx = await contexto();
  if (ctx.estado !== "ok") return bloqueio(ctx);
  const { supabase, profile } = ctx;

  let organizationId = profile.organization_id;

  if (parsed.data.parentId) {
    const { data: original } = await supabase
      .from("lesson_comments")
      .select("organization_id")
      .eq("id", parsed.data.parentId)
      .maybeSingle();
    if (!original) return { ok: false, erro: "Comentário original não encontrado." };
    organizationId = original.organization_id;
  }

  if (!organizationId) {
    return {
      ok: false,
      erro: "Sua conta não está vinculada a uma clínica.",
    };
  }

  const { error } = await supabase.from("lesson_comments").insert({
    lesson_id: parsed.data.lessonId,
    user_id: profile.id,
    organization_id: organizationId,
    parent_id: parsed.data.parentId ?? null,
    conteudo: parsed.data.conteudo,
  });

  if (error) return { ok: false, erro: "Não foi possível enviar agora." };

  revalidatePath("/app/academy", "layout");
  revalidatePath("/app/admin/comentarios");
  return { ok: true };
}

/** Remove o próprio comentário (ou qualquer um, se for super admin). */
export async function excluirComentario(id: string): Promise<ActionResult> {
  const ctx = await contexto();
  if (ctx.estado !== "ok") return bloqueio(ctx);

  const { error } = await ctx.supabase.from("lesson_comments").delete().eq("id", id);
  if (error) return { ok: false, erro: "Não foi possível excluir." };

  revalidatePath("/app/academy", "layout");
  revalidatePath("/app/admin/comentarios");
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Administração do conteúdo (só super admin)                          */
/* ------------------------------------------------------------------ */

async function contextoAdmin(): Promise<Contexto> {
  const ctx = await contexto();
  if (ctx.estado !== "ok") return ctx;
  if (ctx.profile.role !== "super_admin") {
    return { estado: "erro", erro: "Você não tem permissão para editar o conteúdo." };
  }
  return ctx;
}

const trilhaSchema = z.object({
  id: z.string().optional(),
  titulo: z.string().trim().min(3, "Informe o título da trilha."),
  slug: z
    .string()
    .trim()
    .min(3, "Informe o endereço (slug) da trilha.")
    .regex(/^[a-z0-9-]+$/, "Use apenas letras minúsculas, números e hífen."),
  resumo: z.string().trim().max(200).optional().or(z.literal("")),
  descricao: z.string().trim().max(2000).optional().or(z.literal("")),
  nivel: z.enum(["essencial", "intermediario", "avancado"]),
  papeis: z.array(z.enum(["gestor", "secretaria", "medico"])).min(1, "Escolha ao menos um papel."),
  ordem: z.number().int().min(0),
  publicado: z.boolean(),
});

export type TrilhaInput = {
  id?: string;
  titulo: string;
  slug: string;
  resumo?: string;
  descricao?: string;
  nivel: NivelTrilha;
  papeis: Role[];
  ordem: number;
  publicado: boolean;
};

/** Cria ou atualiza uma trilha. */
export async function salvarTrilha(input: TrilhaInput): Promise<ActionResult> {
  const parsed = trilhaSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.errors[0]?.message ?? "Dados inválidos" };
  }

  const ctx = await contextoAdmin();
  if (ctx.estado !== "ok") return bloqueio(ctx);

  const d = parsed.data;
  const registro = {
    titulo: d.titulo,
    slug: d.slug,
    resumo: d.resumo || null,
    descricao: d.descricao || null,
    nivel: d.nivel,
    papeis: d.papeis as Role[],
    ordem: d.ordem,
    publicado: d.publicado,
  };

  const { error } = d.id
    ? await ctx.supabase.from("courses").update(registro).eq("id", d.id)
    : await ctx.supabase.from("courses").insert(registro);

  if (error) {
    return {
      ok: false,
      erro: /duplicate|unique/i.test(error.message)
        ? "Já existe uma trilha com esse endereço (slug)."
        : "Não foi possível salvar a trilha.",
    };
  }

  revalidatePath("/app/admin/academy");
  revalidatePath("/app/academy", "layout");
  return { ok: true };
}

export async function excluirTrilha(id: string): Promise<ActionResult> {
  const ctx = await contextoAdmin();
  if (ctx.estado !== "ok") return bloqueio(ctx);

  const { error } = await ctx.supabase.from("courses").delete().eq("id", id);
  if (error) return { ok: false, erro: "Não foi possível excluir a trilha." };

  revalidatePath("/app/admin/academy");
  revalidatePath("/app/academy", "layout");
  return { ok: true };
}

const aulaSchema = z.object({
  id: z.string().optional(),
  courseId: z.string().min(1),
  titulo: z.string().trim().min(3, "Informe o título da aula."),
  slug: z
    .string()
    .trim()
    .min(1, "Informe o endereço (slug) da aula.")
    .regex(/^[a-z0-9-]+$/, "Use apenas letras minúsculas, números e hífen."),
  descricao: z.string().trim().max(2000).optional().or(z.literal("")),
  videoUrl: z
    .string()
    .trim()
    .url("Informe um link de vídeo válido.")
    .optional()
    .or(z.literal("")),
  materialUrl: z
    .string()
    .trim()
    .url("Informe um link de material válido.")
    .optional()
    .or(z.literal("")),
  duracaoMin: z.number().int().min(0).max(600).optional(),
  ordem: z.number().int().min(0),
  publicado: z.boolean(),
});

export type AulaInput = z.input<typeof aulaSchema>;

/** Cria ou atualiza uma aula, incluindo o link do vídeo. */
export async function salvarAula(input: AulaInput): Promise<ActionResult> {
  const parsed = aulaSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.errors[0]?.message ?? "Dados inválidos" };
  }

  const ctx = await contextoAdmin();
  if (ctx.estado !== "ok") return bloqueio(ctx);

  const d = parsed.data;
  const registro = {
    course_id: d.courseId,
    titulo: d.titulo,
    slug: d.slug,
    descricao: d.descricao || null,
    video_url: d.videoUrl || null,
    material_url: d.materialUrl || null,
    duracao_min: d.duracaoMin ?? null,
    ordem: d.ordem,
    publicado: d.publicado,
  };

  const { error } = d.id
    ? await ctx.supabase.from("lessons").update(registro).eq("id", d.id)
    : await ctx.supabase.from("lessons").insert(registro);

  if (error) {
    return {
      ok: false,
      erro: /duplicate|unique/i.test(error.message)
        ? "Já existe uma aula com esse endereço nesta trilha."
        : "Não foi possível salvar a aula.",
    };
  }

  revalidatePath("/app/admin/academy", "layout");
  revalidatePath("/app/academy", "layout");
  return { ok: true };
}

export async function excluirAula(id: string): Promise<ActionResult> {
  const ctx = await contextoAdmin();
  if (ctx.estado !== "ok") return bloqueio(ctx);

  const { error } = await ctx.supabase.from("lessons").delete().eq("id", id);
  if (error) return { ok: false, erro: "Não foi possível excluir a aula." };

  revalidatePath("/app/admin/academy", "layout");
  revalidatePath("/app/academy", "layout");
  return { ok: true };
}
