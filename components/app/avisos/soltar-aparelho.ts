"use client";

import { removerInscricaoPush } from "@/lib/actions/push";

/**
 * Ao sair da conta, o aparelho para de receber os avisos dela.
 *
 * Sem isso, quem entra depois no mesmo celular (ou ninguém) continuaria
 * recebendo as notificações da conta anterior. No próximo login, o app
 * instalado inscreve o aparelho de novo, já em nome de quem entrou.
 *
 * Nunca trava a saída: tem prazo curto e engole qualquer erro.
 */
export async function soltarAparelho(): Promise<void> {
  try {
    sessionStorage.removeItem("medi_push_ok");
  } catch {
    /* sem armazenamento: nada a limpar */
  }
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

  const tarefa = (async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager?.getSubscription();
    if (!sub) return;
    // Primeiro no servidor, ainda com a sessão de quem está saindo
    await removerInscricaoPush(sub.endpoint).catch(() => {});
    await sub.unsubscribe().catch(() => {});
  })();

  await Promise.race([tarefa.catch(() => {}), new Promise((r) => setTimeout(r, 2500))]);
}
