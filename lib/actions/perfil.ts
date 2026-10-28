"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { adminDisponivel, createAdminClient } from "@/lib/supabase/admin";
import { emModoDemo, getSessao } from "@/lib/supabase/queries";
import { MSG_DEMO, type ActionResult } from "@/lib/actions/contexto";

const perfilSchema = z.object({
  nome: z.string().trim().min(2, "Informe seu nome."),
  especialidade: z.string().trim().max(80).optional().or(z.literal("")),
  crm: z.string().trim().max(40).optional().or(z.literal("")),
  telefone: z.string().trim().max(30).optional().or(z.literal("")),
  tratamento: z.enum(["", "Dr.", "Dra."]).optional(),
  rqe: z.string().trim().max(40).optional().or(z.literal("")),
  bio: z
    .string()
    .trim()
    .max(400, "A apresentação pode ter até 400 caracteres.")
    .optional()
    .or(z.literal("")),
  instagram: z.string().trim().max(80).optional().or(z.literal("")),
});

/** "@perfil" a partir de "@perfil", "perfil" ou o link do Instagram. */
function arroba(bruto?: string): string | null {
  if (!bruto) return null;
  const limpo = bruto
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
    .replace(/[/?#].*$/, "")
    .replace(/^@+/, "");
  return limpo ? `@${limpo}` : null;
}

export type PerfilInput = z.input<typeof perfilSchema>;

/** Atualiza os próprios dados profissionais. */
export async function salvarPerfil(input: PerfilInput): Promise<ActionResult> {
  const parsed = perfilSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.errors[0]?.message ?? "Dados inválidos" };
  }

  if (await emModoDemo()) return { ok: false, erro: MSG_DEMO };

  const { profile } = await getSessao();
  if (!profile) return { ok: false, erro: "Sessão expirada." };

  const d = parsed.data;
  const supabase = await createClient();
  const basicos = {
    nome: d.nome,
    especialidade: d.especialidade || null,
    crm: d.crm || null,
    telefone: d.telefone || null,
  };
  const { error } = await supabase
    .from("profiles")
    .update({
      ...basicos,
      tratamento: d.tratamento || null,
      rqe: d.rqe || null,
      bio: d.bio || null,
      instagram: arroba(d.instagram),
    })
    .eq("id", profile.id);

  // Colunas novas ainda não criadas: salva o básico e avisa do SQL
  if (error && /column|schema cache/i.test(error.message)) {
    await supabase.from("profiles").update(basicos).eq("id", profile.id);
    revalidatePath("/app/perfil");
    revalidatePath("/app", "layout");
    return {
      ok: false,
      erro: "Nome, especialidade, CRM e telefone foram salvos. Tratamento, RQE, Instagram e apresentação dependem do SQL do perfil.",
    };
  }

  if (error) {
    console.error("[perfil] Erro ao salvar:", error.message);
    return { ok: false, erro: "Não foi possível salvar seu perfil." };
  }

  revalidatePath("/app/perfil");
  revalidatePath("/app", "layout");
  return { ok: true };
}

/* ------------------------------- Foto ------------------------------- */

const BUCKET_FOTOS = "avatares";
const TIPOS_FOTO = ["image/png", "image/jpeg", "image/webp"];

/**
 * Sobe a foto de perfil. Vai pela service role, numa pasta com o id da
 * pessoa: cada um só troca a própria foto, sem depender de política de
 * storage. O bucket é público porque a foto aparece no painel todo.
 */
export async function salvarFoto(formData: FormData): Promise<ActionResult> {
  if (await emModoDemo()) return { ok: false, erro: MSG_DEMO };
  const { profile } = await getSessao();
  if (!profile) return { ok: false, erro: "Sessão expirada." };
  if (!adminDisponivel()) {
    return { ok: false, erro: "Falta a SUPABASE_SERVICE_ROLE_KEY nas variáveis de ambiente." };
  }

  const file = formData.get("foto");
  if (!(file instanceof File) || file.size === 0) return { ok: false, erro: "Escolha uma imagem." };
  if (!TIPOS_FOTO.includes(file.type)) return { ok: false, erro: "Use PNG, JPG ou WEBP." };
  if (file.size > 3 * 1024 * 1024) return { ok: false, erro: "A foto precisa ter no máximo 3 MB." };

  const admin = createAdminClient();
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const caminho = `${profile.id}/foto-${Date.now()}.${ext}`;

  let envio = await admin.storage
    .from(BUCKET_FOTOS)
    .upload(caminho, file, { contentType: file.type, upsert: true });
  if (envio.error && /bucket/i.test(envio.error.message)) {
    // Primeira foto da plataforma: cria o bucket na hora
    await admin.storage.createBucket(BUCKET_FOTOS, { public: true });
    envio = await admin.storage
      .from(BUCKET_FOTOS)
      .upload(caminho, file, { contentType: file.type, upsert: true });
  }
  if (envio.error) {
    console.error("[perfil] Falha no upload da foto:", envio.error.message);
    return { ok: false, erro: "Não foi possível enviar a foto." };
  }

  const url = admin.storage.from(BUCKET_FOTOS).getPublicUrl(caminho).data.publicUrl;
  const { error } = await admin.from("profiles").update({ foto_url: url }).eq("id", profile.id);
  if (error) {
    await admin.storage.from(BUCKET_FOTOS).remove([caminho]);
    return { ok: false, erro: "Não foi possível salvar a foto." };
  }

  await apagarFotoAntiga(admin, profile.foto_url, profile.id);
  revalidatePath("/app/perfil");
  revalidatePath("/app", "layout");
  return { ok: true };
}

/** Tira a foto e volta às iniciais. */
export async function removerFoto(): Promise<ActionResult> {
  if (await emModoDemo()) return { ok: false, erro: MSG_DEMO };
  const { profile } = await getSessao();
  if (!profile) return { ok: false, erro: "Sessão expirada." };

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ foto_url: null }).eq("id", profile.id);
  if (error) return { ok: false, erro: "Não foi possível remover a foto." };

  if (adminDisponivel()) await apagarFotoAntiga(createAdminClient(), profile.foto_url, profile.id);
  revalidatePath("/app/perfil");
  revalidatePath("/app", "layout");
  return { ok: true };
}

async function apagarFotoAntiga(
  admin: ReturnType<typeof createAdminClient>,
  url: string | null,
  userId: string
): Promise<void> {
  const marca = `/${BUCKET_FOTOS}/`;
  const i = url ? url.indexOf(marca) : -1;
  if (!url || i < 0) return;
  const caminho = url.slice(i + marca.length);
  // Só dentro da pasta da própria pessoa
  if (caminho.startsWith(`${userId}/`)) await admin.storage.from(BUCKET_FOTOS).remove([caminho]);
}

const senhaSchema = z
  .object({
    senhaAtual: z.string().min(1, "Informe sua senha atual."),
    novaSenha: z
      .string()
      .min(8, "A nova senha precisa de pelo menos 8 caracteres.")
      .max(72, "Senha muito longa."),
    confirmacao: z.string(),
  })
  .refine((d) => d.novaSenha === d.confirmacao, {
    message: "A confirmação não confere com a nova senha.",
    path: ["confirmacao"],
  })
  .refine((d) => d.novaSenha !== d.senhaAtual, {
    message: "A nova senha precisa ser diferente da atual.",
    path: ["novaSenha"],
  });

export type SenhaInput = z.input<typeof senhaSchema>;

/**
 * Troca a senha da conta.
 *
 * O Supabase permite atualizar a senha só com a sessão válida, sem pedir a
 * atual. Aqui reautenticamos com a senha antiga antes de trocar: sessão
 * esquecida aberta numa recepção não deve virar sequestro de conta.
 */
export async function alterarSenha(input: SenhaInput): Promise<ActionResult> {
  const parsed = senhaSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.errors[0]?.message ?? "Dados inválidos" };
  }

  // Pelo modo demo, e não pela ausência de Supabase: a demonstração
  // comercial roda com o banco conectado, e trocar senha ali não faz
  // sentido nenhum.
  if (await emModoDemo()) return { ok: false, erro: MSG_DEMO };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) return { ok: false, erro: "Sessão expirada." };

  const { error: erroLogin } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: parsed.data.senhaAtual,
  });
  if (erroLogin) return { ok: false, erro: "A senha atual está incorreta." };

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.novaSenha,
  });

  if (error) {
    if (/should be different|same as/i.test(error.message)) {
      return { ok: false, erro: "A nova senha precisa ser diferente da atual." };
    }
    console.error("[perfil] Erro ao trocar senha:", error.message);
    return { ok: false, erro: "Não foi possível alterar a senha." };
  }

  return { ok: true };
}
