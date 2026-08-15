"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DEMO_COOKIE, papelDemoValido } from "@/lib/demo";
import { modulosDoPapel } from "@/lib/rbac";
import type { Role } from "@/lib/supabase/types";

/**
 * DEMONSTRAÇÃO COMERCIAL
 * ----------------------------------------------------------------------
 * Entrar, trocar de papel e sair — três ações que só mexem num cookie.
 *
 * Tudo o que a visita enxerga vem de `lib/demo`, e toda action que
 * escreve para em `contexto()` enquanto o cookie existir. Por isso a
 * demonstração pode rodar em produção sem chegar perto do banco.
 *
 * Oito horas de validade: dura uma reunião com folga e não deixa o
 * navegador de quem já é cliente preso na demonstração para sempre.
 */
const VALIDADE = 60 * 60 * 8;

async function gravarPapel(papel: Role) {
  const cookieStore = await cookies();
  cookieStore.set(DEMO_COOKIE, papel, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: VALIDADE,
  });
  revalidatePath("/", "layout");
}

/** Abre a demonstração no papel escolhido. */
export async function entrarNaDemo(papel: string) {
  const valido = papelDemoValido(papel);
  if (!valido) redirect("/demonstracao");

  await gravarPapel(valido);
  redirect("/app");
}

/**
 * Troca o papel sem sair da tela, quando o novo papel também alcança
 * aquela tela.
 *
 * É o ponto da demonstração: mostrar a MESMA agenda pelos olhos do
 * médico e da atendente. Voltar para o início a cada troca desfaria a
 * comparação. Quando a tela não existe para o papel novo (o financeiro
 * para a atendente, por exemplo), cai no início em vez de bater na
 * porta fechada do RBAC.
 */
export async function verComoPapel(papel: string, caminho: string) {
  const valido = papelDemoValido(papel);
  if (!valido) redirect("/app");

  await gravarPapel(valido);
  redirect(destinoPara(valido, caminho));
}

function destinoPara(role: Role, caminho: string): string {
  if (!caminho.startsWith("/app")) return "/app";
  if (caminho === "/app" || caminho.startsWith("/app/notificacoes")) {
    return caminho;
  }

  const alcanca = modulosDoPapel(role).some(
    (m) => m.href !== "/app" && caminho.startsWith(m.href)
  );
  return alcanca ? caminho : "/app";
}

/** Encerra a demonstração e devolve a sessão real, se houver. */
export async function sairDaDemo() {
  const cookieStore = await cookies();
  cookieStore.delete(DEMO_COOKIE);
  revalidatePath("/", "layout");
  redirect("/");
}
