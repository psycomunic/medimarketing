"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient, adminDisponivel } from "@/lib/supabase/admin";
import { emModoDemo } from "@/lib/supabase/queries";
import { enviarPush, pushConfigurado } from "@/lib/push";

type Resultado = { ok: true } | { ok: false; erro: string };

/** Guarda o aparelho que acabou de aceitar as notificações. */
export async function salvarInscricaoPush(inscricao: {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  aparelho?: string;
}): Promise<Resultado> {
  if (await emModoDemo()) return { ok: true };
  if (!pushConfigurado()) return { ok: false, erro: "Notificações no aparelho ainda não configuradas no servidor." };
  if (!inscricao?.endpoint?.startsWith("https://") || !inscricao.keys?.p256dh || !inscricao.keys?.auth) {
    return { ok: false, erro: "Inscrição inválida." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, erro: "Sessão expirada." };
  const { data: perfil } = await supabase.from("profiles").select("organization_id").eq("id", user.id).maybeSingle();

  // O mesmo aparelho pode trocar de conta: o endpoint passa para quem está logado
  // agora. Só o próprio aparelho conhece o endpoint, então apagar por ele é seguro.
  const db = adminDisponivel() ? createAdminClient() : supabase;
  await db.from("push_inscricoes").delete().eq("endpoint", inscricao.endpoint);
  const { error } = await supabase.from("push_inscricoes").insert({
    usuario_id: user.id,
    organization_id: perfil?.organization_id ?? null,
    endpoint: inscricao.endpoint,
    p256dh: inscricao.keys.p256dh,
    auth: inscricao.keys.auth,
    aparelho: inscricao.aparelho?.slice(0, 120) ?? null,
  });
  if (error) {
    console.error("[push]", error.message);
    return { ok: false, erro: "Não foi possível ativar. Rode antes o SQL do app instalável." };
  }
  return { ok: true };
}

export async function removerInscricaoPush(endpoint: string): Promise<Resultado> {
  if (await emModoDemo()) return { ok: true };
  const supabase = await createClient();
  await supabase.from("push_inscricoes").delete().eq("endpoint", endpoint);
  return { ok: true };
}

/** Manda uma notificação de teste para os aparelhos de quem está logado. */
export async function testarPush(): Promise<Resultado> {
  if (await emModoDemo()) return { ok: false, erro: "Na demonstração as notificações não saem." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, erro: "Sessão expirada." };
  const r = await enviarPush(user.id, {
    titulo: "Notificações ativadas ✅",
    corpo: "É assim que os avisos da clínica vão chegar neste aparelho.",
    url: "/app/notificacoes",
    tag: "teste",
  });
  return r.enviados ? { ok: true } : { ok: false, erro: r.erro ?? "Não foi possível enviar." };
}
