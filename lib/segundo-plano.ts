import "server-only";

import { waitUntil } from "@vercel/functions";

/**
 * Roda depois de responder a quem clicou.
 *
 * Avisos por e-mail, WhatsApp e painel dependem de serviços de fora e
 * levam segundos; quem salvou a consulta não precisa esperar por eles. Na
 * Vercel, `waitUntil` mantém a função viva até o trabalho terminar; fora
 * dela (no computador), a promessa simplesmente segue sozinha.
 *
 * Nunca lança: o que importa (a consulta salva) já aconteceu.
 */
export function emSegundoPlano(rotulo: string, trabalho: () => Promise<unknown>): void {
  const p = trabalho().catch((e) => {
    console.error(`[segundo-plano/${rotulo}]`, e instanceof Error ? e.message : e);
  });
  try {
    waitUntil(p);
  } catch {
    /* sem contexto da Vercel: a promessa já está rodando */
  }
}
