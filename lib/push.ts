import "server-only";

import webpush from "web-push";
import { createAdminClient, adminDisponivel } from "@/lib/supabase/admin";

/**
 * NOTIFICAÇÃO NO APARELHO (web push)
 *
 * Cada aparelho em que a pessoa ativou as notificações do app é uma
 * inscrição (push_inscricoes). Mandar para alguém é mandar para todos os
 * aparelhos dela; o que o navegador diz que não existe mais (404/410) sai
 * da lista, para não tentar de novo para sempre.
 */

export function pushConfigurado(): boolean {
  return !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && !!process.env.VAPID_PRIVATE_KEY;
}

let configurado = false;
function configurar() {
  if (configurado) return;
  webpush.setVapidDetails(
    `mailto:${process.env.NEXT_PUBLIC_EMAIL_CONTATO ?? "contato@medimarketing.com.br"}`,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );
  configurado = true;
}

export type MensagemPush = {
  titulo: string;
  corpo?: string | null;
  /** Para onde o toque leva, dentro do painel. */
  url?: string | null;
  /** Mesma tag substitui a anterior em vez de empilhar. */
  tag?: string | null;
};

/** Quem, entre estas pessoas, tem ao menos um aparelho com notificação ativa. */
export async function comAparelho(usuarioIds: string[]): Promise<Set<string>> {
  if (!pushConfigurado() || !adminDisponivel() || !usuarioIds.length) return new Set();
  const { data } = await createAdminClient().from("push_inscricoes").select("usuario_id").in("usuario_id", usuarioIds);
  return new Set((data ?? []).map((d) => d.usuario_id));
}

export async function enviarPush(
  usuarioId: string,
  m: MensagemPush
): Promise<{ enviados: number; erro?: string }> {
  if (!pushConfigurado()) return { enviados: 0, erro: "notificações no aparelho não configuradas" };
  configurar();
  const admin = createAdminClient();
  const { data: inscricoes } = await admin.from("push_inscricoes").select("*").eq("usuario_id", usuarioId);
  if (!inscricoes?.length) return { enviados: 0, erro: "nenhum aparelho com notificação ativa" };

  const corpo = JSON.stringify({ titulo: m.titulo, corpo: m.corpo ?? "", url: m.url ?? "/app", tag: m.tag ?? undefined });
  let enviados = 0;
  let ultimoErro: string | undefined;

  await Promise.all(
    inscricoes.map(async (i) => {
      try {
        await webpush.sendNotification({ endpoint: i.endpoint, keys: { p256dh: i.p256dh, auth: i.auth } }, corpo, {
          TTL: 60 * 60 * 24,
          urgency: "high",
        });
        enviados++;
        await admin.from("push_inscricoes").update({ ultimo_envio: new Date().toISOString() }).eq("id", i.id);
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        // Aparelho desinstalou o app ou tirou a permissão: sai da lista
        if (status === 404 || status === 410) await admin.from("push_inscricoes").delete().eq("id", i.id);
        else ultimoErro = e instanceof Error ? e.message : String(e);
      }
    })
  );

  return { enviados, erro: enviados ? undefined : ultimoErro ?? "nenhum aparelho respondeu" };
}
