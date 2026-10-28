"use server";

import { revalidatePath } from "next/cache";
import {
  bloqueio,
  contexto,
  organizacaoAlvo,
  MARCA,
  type ActionResult,
} from "@/lib/actions/contexto";


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
  const ctx = await contexto(MARCA);
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
  const ctx = await contexto(MARCA);
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

/* ------------------------------- Banner -------------------------------- */

const TIPOS_BANNER = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const MAX_BANNER = 4 * 1024 * 1024;

/** Link do banner: rota interna do painel ou endereço https. */
function linkValido(bruto: string): string | null | false {
  const link = bruto.trim();
  if (!link) return null;
  if (link.startsWith("/")) return link;
  try {
    const u = new URL(link.includes("://") ? link : `https://${link}`);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : false;
  } catch {
    return false;
  }
}

/**
 * Banner do topo da visão geral da clínica.
 *
 * Mesmo bucket da logo (é material de marca, feito para ser visto). A
 * imagem é opcional na chamada: sem arquivo, só o link é atualizado.
 */
export async function salvarBanner(formData: FormData): Promise<ActionResult> {
  const ctx = await contexto(MARCA);
  if (ctx.estado !== "ok") return bloqueio(ctx);

  const orgId = organizacaoAlvo(
    ctx.profile,
    (formData.get("organizationId") as string) || undefined
  );
  if (!orgId) return { ok: false, erro: "Clínica inválida." };

  const link = linkValido(String(formData.get("link") ?? ""));
  if (link === false) return { ok: false, erro: "O link precisa ser um endereço válido." };

  const file = formData.get("banner");
  const temArquivo = file instanceof File && file.size > 0;
  const mudancas: { banner_link: string | null; banner_url?: string } = { banner_link: link };

  const { data: antes } = await ctx.supabase
    .from("organizations")
    .select("banner_url")
    .eq("id", orgId)
    .maybeSingle();

  let caminho: string | null = null;
  if (temArquivo) {
    if (!TIPOS_BANNER.includes(file.type)) {
      return { ok: false, erro: "Use PNG, JPG, WEBP ou GIF." };
    }
    if (file.size > MAX_BANNER) {
      return { ok: false, erro: "O banner precisa ter no máximo 4 MB." };
    }
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
    caminho = `${orgId}/banner-${Date.now()}.${ext}`;
    const { error: erroUpload } = await ctx.supabase.storage
      .from(BUCKET)
      .upload(caminho, file, { contentType: file.type, upsert: true });
    if (erroUpload) {
      console.error("[banner] Falha no upload:", erroUpload.message);
      return { ok: false, erro: "Não foi possível enviar a imagem." };
    }
    mudancas.banner_url = ctx.supabase.storage.from(BUCKET).getPublicUrl(caminho).data.publicUrl;
  }

  const { error } = await ctx.supabase.from("organizations").update(mudancas).eq("id", orgId);

  if (error) {
    if (caminho) await ctx.supabase.storage.from(BUCKET).remove([caminho]);
    console.error("[banner] Erro ao salvar:", error.message);
    return { ok: false, erro: "Não foi possível salvar o banner. O SQL do banner já foi rodado?" };
  }

  if (caminho) await removerArquivo(ctx.supabase, antes?.banner_url ?? null, orgId);

  revalidar();
  return { ok: true };
}

/** Tira o banner do painel. */
export async function removerBanner(organizationId?: string): Promise<ActionResult> {
  const ctx = await contexto(MARCA);
  if (ctx.estado !== "ok") return bloqueio(ctx);

  const orgId = organizacaoAlvo(ctx.profile, organizationId);
  if (!orgId) return { ok: false, erro: "Clínica inválida." };

  const { data: antes } = await ctx.supabase
    .from("organizations")
    .select("banner_url")
    .eq("id", orgId)
    .maybeSingle();

  const { error } = await ctx.supabase
    .from("organizations")
    .update({ banner_url: null, banner_link: null })
    .eq("id", orgId);

  if (error) return { ok: false, erro: "Não foi possível remover o banner." };

  await removerArquivo(ctx.supabase, antes?.banner_url ?? null, orgId);

  revalidar();
  return { ok: true };
}
