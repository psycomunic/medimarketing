import "server-only";

/**
 * ENVIO DE E-MAIL PELO RESEND
 *
 * Usa a API HTTP em vez de SMTP: devolve um id por mensagem, o que
 * permite rastrear entrega depois, e falha rápido em vez de pendurar
 * uma conexão.
 *
 * O domínio verificado é o da plataforma, mas quem aparece na caixa de
 * entrada é a clínica: o nome do remetente é o dela. A caixa não recebe
 * resposta — cada mensagem carrega um botão que leva à ação certa, no
 * link do paciente ou no painel da clínica.
 */

/** Endereço verificado no Resend. Só ele pode figurar como remetente. */
const REMETENTE = "contato@medimarketing.com.br";

export function emailConfigurado(): boolean {
  return !!process.env.RESEND_API_KEY;
}

export type Envio = {
  para: string | string[];
  assunto: string;
  html: string;
  /** Alternativa em texto puro, para clientes que não renderizam HTML. */
  texto?: string;
  /** Nome exibido na caixa de entrada. Sem isso, a plataforma. */
  remetenteNome?: string | null;

};

export type ResultadoEmail =
  | { enviado: true; id: string }
  | { enviado: false; motivo: string };

/**
 * Envia uma mensagem.
 *
 * Nunca lança: e-mail é efeito colateral de uma ação do usuário, e
 * falhar em avisar não pode derrubar a confirmação que o paciente
 * acabou de fazer. Quem chama decide se o silêncio importa.
 */
export async function enviarEmail(e: Envio): Promise<ResultadoEmail> {
  if (!emailConfigurado()) {
    return { enviado: false, motivo: "RESEND_API_KEY ausente" };
  }

  const destinatarios = (Array.isArray(e.para) ? e.para : [e.para])
    .map((d) => d.trim())
    .filter((d) => d.includes("@"));

  if (!destinatarios.length) {
    return { enviado: false, motivo: "sem destinatário válido" };
  }

  const nome = (e.remetenteNome ?? "Medi Marketing").replace(/["<>]/g, "").trim();

  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${nome} <${REMETENTE}>`,
        to: destinatarios,
        subject: e.assunto,
        html: e.html,
        ...(e.texto ? { text: e.texto } : {}),
        // Sem reply_to de propósito: o remetente é o endereço da
        // plataforma, que ninguém acompanha. Toda ação do destinatário
        // acontece por botão, não por resposta.
        reply_to: "nao-responda@medimarketing.com.br",
      }),
    });

    const corpo = await resp.json().catch(() => ({}));

    if (!resp.ok) {
      const motivo = corpo?.message ?? `HTTP ${resp.status}`;
      console.error("[email] Recusado pelo Resend:", motivo);
      return { enviado: false, motivo };
    }

    return { enviado: true, id: corpo.id };
  } catch (erro) {
    const motivo = erro instanceof Error ? erro.message : "falha de rede";
    console.error("[email] Erro ao enviar:", motivo);
    return { enviado: false, motivo };
  }
}

/**
 * Dispara vários e-mails sem deixar um erro derrubar os outros.
 *
 * O caso típico é avisar paciente e clínica ao mesmo tempo: se o
 * endereço do paciente estiver errado, a clínica ainda precisa saber
 * que houve confirmação.
 */
export async function enviarVarios(envios: Envio[]): Promise<{
  enviados: number;
  falhas: number;
}> {
  const resultados = await Promise.all(envios.map((e) => enviarEmail(e)));
  return {
    enviados: resultados.filter((r) => r.enviado).length,
    falhas: resultados.filter((r) => !r.enviado).length,
  };
}
