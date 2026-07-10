"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigurado } from "@/lib/supabase/queries";
import { DEMO_COOKIE, checarCredenciaisDemo } from "@/lib/demo";

export type AuthResult = { ok: false; erro: string } | { ok: true };

/** Login por e-mail + senha. Em sucesso, redireciona para a área do médico. */
export async function login(formData: {
  email: string;
  senha: string;
  redirectTo?: string;
}): Promise<AuthResult> {
  // MODO DEMONSTRAÇÃO: sem Supabase, valida a credencial de teste
  if (!supabaseConfigurado()) {
    if (!checarCredenciaisDemo(formData.email, formData.senha)) {
      return { ok: false, erro: "E-mail ou senha incorretos (modo demonstração)." };
    }
    const cookieStore = await cookies();
    cookieStore.set(DEMO_COOKIE, "1", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 8, // 8h
    });
    revalidatePath("/", "layout");
    redirect(formData.redirectTo || "/app");
  }

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
  // Limpa a sessão de demonstração, se houver
  const cookieStore = await cookies();
  cookieStore.delete(DEMO_COOKIE);

  if (supabaseConfigurado()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
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
