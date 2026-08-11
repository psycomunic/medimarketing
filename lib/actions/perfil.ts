"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { emModoDemo, getSessao, supabaseConfigurado } from "@/lib/supabase/queries";
import { MSG_DEMO, type ActionResult } from "@/lib/actions/contexto";

const perfilSchema = z.object({
  nome: z.string().trim().min(2, "Informe seu nome."),
  especialidade: z.string().trim().max(80).optional().or(z.literal("")),
  crm: z.string().trim().max(40).optional().or(z.literal("")),
  telefone: z.string().trim().max(30).optional().or(z.literal("")),
  fotoUrl: z
    .string()
    .trim()
    .url("Informe um endereço de imagem válido.")
    .optional()
    .or(z.literal("")),
});

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
  const { error } = await supabase
    .from("profiles")
    .update({
      nome: d.nome,
      especialidade: d.especialidade || null,
      crm: d.crm || null,
      telefone: d.telefone || null,
      foto_url: d.fotoUrl || null,
    })
    .eq("id", profile.id);

  if (error) {
    console.error("[perfil] Erro ao salvar:", error.message);
    return { ok: false, erro: "Não foi possível salvar seu perfil." };
  }

  revalidatePath("/app/perfil");
  revalidatePath("/app", "layout");
  return { ok: true };
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

  if (!supabaseConfigurado()) return { ok: false, erro: MSG_DEMO };

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
