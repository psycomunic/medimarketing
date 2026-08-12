"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigurado } from "@/lib/supabase/queries";
import { urlBase } from "@/lib/lembretes";
import { DEMO_COOKIE, checarCredenciaisDemo } from "@/lib/demo";

export type AuthResult = { ok: false; erro: string } | { ok: true };

/** Login por e-mail + senha. Em sucesso, redireciona para a área do médico. */
export async function login(formData: {
  email: string;
  senha: string;
  redirectTo?: string;
}): Promise<AuthResult> {
  // MODO DEMONSTRAÇÃO: sem Supabase, valida a credencial de teste.
  // O papel da conta escolhida fica gravado no cookie e define o que o
  // usuário enxerga no painel.
  if (!supabaseConfigurado()) {
    const papel = checarCredenciaisDemo(formData.email, formData.senha);
    if (!papel) {
      return { ok: false, erro: "E-mail ou senha incorretos (modo demonstração)." };
    }
    const cookieStore = await cookies();
    cookieStore.set(DEMO_COOKIE, papel, {
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

/**
 * Envia e-mail de redefinição de senha.
 *
 * O `redirectTo` é o que faz o link do e-mail chegar a algum lugar
 * útil: sem ele o Supabase manda a pessoa para a raiz do site, com o
 * token no fragmento e nenhuma tela para digitar a senha nova.
 */
export async function solicitarReset(email: string): Promise<AuthResult> {
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${urlBase()}/nova-senha`,
  });
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
