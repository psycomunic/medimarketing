"use server";

import { revalidatePath } from "next/cache";
import {
  bloqueio,
  contexto,
  organizacaoAlvo,
  type ActionResult,
} from "@/lib/actions/contexto";
import type { Role } from "@/lib/supabase/types";

/**
 * A logo é a cara que o paciente vê em toda mensagem, e quem responde
 * por ela é o profissional. Num consultório de um médico só, obrigá-lo
 * a pedir para outra pessoa trocar a própria marca seria burocracia
 * sem propósito. A secretária fica de fora: opera a agenda, não decide
 * a marca. Mesma régua de `salvarNomeClinica`.
 */
const PODE_EDITAR: readonly Role[] = ["super_admin", "gestor", "medico"];

const BUCKET = "logos";
const MAX_BYTES = 2 * 1024 * 1024;
const TIPOS = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];

function revalidar() {
  revalidatePath("/app/configuracoes");
  revalidatePath("/app/perfil");
  revalidatePath("/app/clinicas");
  // A logo aparece na barra lateral de todas as telas
  revalidatePath("/app", "layout");
}

/**
 * Sobe a logo da clínica.
 *
 * Vai para um bucket público de propósito: a página de confirmação é
 * aberta por quem não tem conta, muitas vezes dentro do WhatsApp, onde
 * não existe sessão para assinar uma URL. É material de marca, feito
 * para ser visto — diferente do bucket `anexos`, que guarda documento
 * clínico e é privado.
 */
export async function salvarLogo(formData: FormData): Promise<ActionResult> {
  const ctx = await contexto(PODE_EDITAR);
  if (ctx.estado !== "ok") return bloqueio(ctx);

  const orgId = organizacaoAlvo(
    ctx.profile,
    (formData.get("organizationId") as string) || undefined
  );
  if (!orgId) return { ok: false, erro: "Clínica inválida." };

  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, erro: "Escolha um arquivo de imagem." };
  }
  if (!TIPOS.includes(file.type)) {
    return { ok: false, erro: "Use PNG, JPG, WEBP ou SVG." };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, erro: "A imagem precisa ter no máximo 2 MB." };
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
  // O timestamp no nome quebra o cache do navegador e da CDN quando a
  // clínica troca a logo — sem ele, a antiga continuaria aparecendo.
  const caminho = `${orgId}/logo-${Date.now()}.${ext}`;

  const { error: erroUpload } = await ctx.supabase.storage
    .from(BUCKET)
    .upload(caminho, file, { contentType: file.type, upsert: true });

  if (erroUpload) {
    console.error("[logo] Falha no upload:", erroUpload.message);
    if (/bucket/i.test(erroUpload.message)) {
      return {
        ok: false,
        erro: "O bucket de logos não existe. Rode o bloco de logo em supabase/atualizacoes.sql.",
      };
    }
    return { ok: false, erro: "Não foi possível enviar a imagem." };
  }

  const { data: publica } = ctx.supabase.storage.from(BUCKET).getPublicUrl(caminho);

  // Guarda a anterior para apagar depois de trocar a referência
  const { data: antes } = await ctx.supabase
    .from("organizations")
    .select("logo_url")
    .eq("id", orgId)
    .maybeSingle();

  const { error } = await ctx.supabase
    .from("organizations")
    .update({ logo_url: publica.publicUrl })
    .eq("id", orgId);

  if (error) {
    await ctx.supabase.storage.from(BUCKET).remove([caminho]);
    return { ok: false, erro: "Não foi possível salvar a logo." };
  }

  await removerArquivo(ctx.supabase, antes?.logo_url ?? null, orgId);

  revalidar();
  return { ok: true };
}

/** Remove a logo e volta ao símbolo padrão. */
export async function removerLogo(organizationId?: string): Promise<ActionResult> {
  const ctx = await contexto(PODE_EDITAR);
  if (ctx.estado !== "ok") return bloqueio(ctx);

  const orgId = organizacaoAlvo(ctx.profile, organizationId);
  if (!orgId) return { ok: false, erro: "Clínica inválida." };

  const { data: antes } = await ctx.supabase
    .from("organizations")
    .select("logo_url")
    .eq("id", orgId)
    .maybeSingle();

  const { error } = await ctx.supabase
    .from("organizations")
    .update({ logo_url: null })
    .eq("id", orgId);

  if (error) return { ok: false, erro: "Não foi possível remover a logo." };

  await removerArquivo(ctx.supabase, antes?.logo_url ?? null, orgId);

  revalidar();
  return { ok: true };
}

/**
 * Apaga o arquivo antigo do storage.
 *
 * Falhar aqui não é motivo para desfazer nada: o pior caso é um arquivo
 * órfão de alguns kilobytes, e a referência no banco já está correta.
 */
async function removerArquivo(
  supabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>,
  url: string | null,
  orgId: string
): Promise<void> {
  if (!url) return;

  const marca = `/${BUCKET}/`;
  const i = url.indexOf(marca);
  if (i < 0) return;

  const caminho = url.slice(i + marca.length);
  // Só apaga dentro da pasta da própria clínica
  if (!caminho.startsWith(`${orgId}/`)) return;

  await supabase.storage.from(BUCKET).remove([caminho]);
}
