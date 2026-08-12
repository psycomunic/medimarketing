import "server-only";

import { normalizarTelefone } from "@/lib/lembretes";
import {
  agendarTexto,
  enviarTexto,
  mergeConfigurado,
} from "@/lib/merge";

/**
 * Envio de mensagem por WhatsApp.
 *
 * Há dois caminhos, nesta ordem:
 *
 *   1. Merge — a plataforma onde cada clínica conecta o próprio número
 *      por QR code. É o caminho preferido: a mensagem sai do número que
 *      o paciente já conhece, e a conversa fica no mesmo lugar onde a
 *      secretária atende, o que também permite à agência acompanhar.
 *      Exige que a clínica tenha uma conexão escolhida.
 *
 *   2. Cloud API da Meta — número único da plataforma, sem vínculo com
 *      a clínica. Fica como reserva para quem não usa o Merge.
 *
 * Sem nenhum dos dois, a mensagem não se perde: continua na fila do
 * painel para a recepção disparar pelo wa.me em um clique. É o que faz
 * a funcionalidade servir desde o primeiro dia.
 */

export type ResultadoEnvio =
  | { enviado: true; canal: "merge" | "whatsapp"; referencia?: string }
  | {
      enviado: false;
      motivo: "sem_credenciais" | "sem_telefone" | "sem_conexao" | "erro";
      detalhe?: string;
    };

export type Destino = {
  /** Nome de quem recebe. O Merge cadastra o contato com ele. */
  nome: string;
  telefone: string | null;
  /**
   * Conexão do Merge que envia — o número da clínica.
   * Sem ela, o Merge não entra em ação nem por engano: mandar pelo
   * número de outra clínica seria pior do que não mandar.
   */
  conexaoId?: number | null;
};

export function whatsappConfigurado(): boolean {
  return !!process.env.WHATSAPP_TOKEN && !!process.env.WHATSAPP_PHONE_ID;
}

/** Algum canal automático disponível para esta clínica. */
export function envioAutomatico(conexaoId?: number | null): boolean {
  return (mergeConfigurado() && !!conexaoId) || whatsappConfigurado();
}

/**
 * Manda agora.
 *
 * Quando `quando` vem preenchido e o canal é o Merge, a mensagem é
 * programada em vez de disparada — ver `agendar` abaixo.
 */
export async function enviarWhatsApp(
  destino: Destino,
  texto: string
): Promise<ResultadoEnvio> {
  if (!destino.telefone) return { enviado: false, motivo: "sem_telefone" };

  if (mergeConfigurado() && destino.conexaoId) {
    const r = await enviarTexto({
      conexaoId: destino.conexaoId,
      nome: destino.nome,
      telefone: destino.telefone,
      texto,
    });
    if (r.enviado) return { enviado: true, canal: "merge", referencia: r.messageUuid };
    return { enviado: false, motivo: "erro", detalhe: r.motivo };
  }

  if (mergeConfigurado() && !whatsappConfigurado()) {
    return { enviado: false, motivo: "sem_conexao" };
  }

  return enviarPelaMeta(destino.telefone, texto);
}

/**
 * Programa a mensagem para a hora certa.
 *
 * O cron da Vercel passa uma vez por dia; sem agendamento, o lembrete
 * sairia na hora da passada da manhã, não na hora que a clínica
 * escolheu. O Merge segura e dispara no minuto certo. A Cloud API não
 * tem esse recurso, então lá o envio é imediato — a mensagem chega
 * mais cedo, nunca mais tarde.
 */
export async function agendarWhatsApp(
  destino: Destino,
  texto: string,
  quando: Date
): Promise<ResultadoEnvio> {
  if (!destino.telefone) return { enviado: false, motivo: "sem_telefone" };

  if (mergeConfigurado() && destino.conexaoId && quando.getTime() > Date.now()) {
    const r = await agendarTexto({
      conexaoId: destino.conexaoId,
      nome: destino.nome,
      telefone: destino.telefone,
      texto,
      quando,
    });
    if (r.enviado) return { enviado: true, canal: "merge", referencia: r.messageUuid };
    // Agendamento recusado não pode custar a mensagem: manda agora
    console.warn("[envio] Agendamento recusado, enviando agora:", r.motivo);
  }

  return enviarWhatsApp(destino, texto);
}

async function enviarPelaMeta(
  telefone: string,
  texto: string
): Promise<ResultadoEnvio> {
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
