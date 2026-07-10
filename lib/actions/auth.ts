"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AuthResult = { ok: false; erro: string } | { ok: true };

/** Login por e-mail + senha. Em sucesso, redireciona para a área do médico. */
export async function login(formData: {
  email: string;
  senha: string;
  redirectTo?: string;
}): Promise<AuthResult> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: formData.email,
    password: formData.senha,
  });

  if (error) {
    return { ok: false, erro: traduzErro(error.message) };
  }

  revalidatePath("/", "layout");
  redirect(formData.redirectTo || "/app");
}

/** Encerra a sessão e volta para o login. */
export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}

/** Envia e-mail de redefinição de senha. */
export async function solicitarReset(email: string): Promise<AuthResult> {
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) return { ok: false, erro: traduzErro(error.message) };
  return { ok: true };
}

// Mensagens de erro amigáveis em português
function traduzErro(msg: string): string {
  if (/invalid login credentials/i.test(msg)) return "E-mail ou senha incorretos.";
  if (/email not confirmed/i.test(msg)) return "Confirme seu e-mail antes de entrar.";
  if (/rate limit/i.test(msg)) return "Muitas tentativas. Aguarde um instante.";
  return "Não foi possível entrar. Tente novamente.";
}
