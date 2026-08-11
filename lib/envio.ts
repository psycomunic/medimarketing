import "server-only";

import { normalizarTelefone } from "@/lib/lembretes";

/**
 * Envio de mensagem ao paciente.
 *
 * Hoje existe um canal só, o WhatsApp Cloud API oficial. Ele só entra em
 * ação quando as credenciais estão no ambiente; sem elas, a mensagem não
 * é "perdida": ela fica na fila do painel para a recepção disparar pelo
 * wa.me em um clique. É o comportamento que faz a funcionalidade servir
 * desde o primeiro dia, antes de qualquer homologação com a Meta.
 */

export type ResultadoEnvio =
  | { enviado: true; canal: "whatsapp" }
  | { enviado: false; motivo: "sem_credenciais" | "sem_telefone" | "erro"; detalhe?: string };

export function whatsappConfigurado(): boolean {
  return !!process.env.WHATSAPP_TOKEN && !!process.env.WHATSAPP_PHONE_ID;
}

export async function enviarWhatsApp(
  telefone: string | null,
  texto: string
): Promise<ResultadoEnvio> {
  if (!telefone) return { enviado: false, motivo: "sem_telefone" };
  if (!whatsappConfigurado()) return { enviado: false, motivo: "sem_credenciais" };

  const numero = normalizarTelefone(telefone);
  const versao = process.env.WHATSAPP_API_VERSION ?? "v21.0";

  try {
    const resp = await fetch(
      `https://graph.facebook.com/${versao}/${process.env.WHATSAPP_PHONE_ID}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: numero,
          type: "text",
          // A prévia do link atrapalha numa mensagem já longa
          text: { preview_url: false, body: texto },
        }),
      }
    );

    if (!resp.ok) {
      const detalhe = await resp.text();
      console.error("[envio] WhatsApp recusou:", resp.status, detalhe.slice(0, 300));
      return { enviado: false, motivo: "erro", detalhe: `HTTP ${resp.status}` };
    }

    return { enviado: true, canal: "whatsapp" };
  } catch (e) {
    const detalhe = e instanceof Error ? e.message : "falha de rede";
    console.error("[envio] Erro ao chamar a API:", detalhe);
    return { enviado: false, motivo: "erro", detalhe };
  }
}
