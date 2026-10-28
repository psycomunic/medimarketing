import "server-only";

import { createAdminClient, adminDisponivel } from "@/lib/supabase/admin";
import { enviarEmail } from "@/lib/email";
import { enviarWhatsApp } from "@/lib/envio";
import type { CanalAviso, Envio, TipoNotificacao } from "@/lib/supabase/types";

/**
 * FILA DE ENVIOS
 *
 * Toda mensagem — WhatsApp, e-mail ou aviso no painel — entra aqui antes
 * de sair. A fila é o que faltava para a comunicação ser confiável:
 *
 *   - registra o que saiu, para quem, por onde e se deu certo;
 *   - a `chave` impede o mesmo aviso de sair duas vezes (a rotina roda a
 *     cada 10 minutos e pode passar pelo mesmo lembrete de novo);
 *   - o que falha volta para a fila e é tentado de novo, até 3 vezes;
 *   - o que tem hora marcada (`agendadoPara`) espera a passada certa.
 *
 * Quem enfileira não espera: o que vence agora é processado na mesma
 * chamada, e o resto fica para a rotina.
 */

export const MAX_TENTATIVAS = 3;

/** Espera entre tentativas: 10, 20 e 40 minutos. */
const ESPERA_MIN = [10, 20, 40];

export type ItemFila = {
  organizationId: string | null;
  evento: string;
  canal: CanalAviso;
  publico: "paciente" | "equipe" | "clinica";
  usuarioId?: string | null;
  destino?: string | null;
  destinoNome?: string | null;
  consultaId?: string | null;
  confirmacaoId?: string | null;
  /** E-mail: assunto. Painel: título. */
  assunto?: string | null;
  /** WhatsApp: o texto. E-mail: texto puro. Painel: descrição. */
  conteudo?: string | null;
  payload?: {
    html?: string;
    remetenteNome?: string | null;
    conexaoId?: number | null;
    /** Painel */
    tipo?: TipoNotificacao;
    href?: string | null;
    prioridade?: "alta" | "normal";
  };
  chave?: string | null;
  agendadoPara?: Date;
};

/**
 * Coloca mensagens na fila e já dispara as que vencem agora.
 *
 * Nunca lança: avisar é consequência de uma ação (marcar consulta,
 * responder o link), e uma falha aqui não pode desfazer a ação.
 */
export async function enfileirar(itens: ItemFila[]): Promise<void> {
  if (!itens.length || !adminDisponivel()) return;

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("envios")
      .upsert(
        itens.map((i) => ({
          organization_id: i.organizationId,
          evento: i.evento,
          canal: i.canal,
          publico: i.publico,
          usuario_id: i.usuarioId ?? null,
          destino: i.destino ?? null,
          destino_nome: i.destinoNome ?? null,
          consulta_id: i.consultaId ?? null,
          confirmacao_id: i.confirmacaoId ?? null,
          assunto: i.assunto ?? null,
          conteudo: i.conteudo ?? null,
          payload: i.payload ?? {},
          chave: i.chave ?? null,
          agendado_para: (i.agendadoPara ?? new Date()).toISOString(),
        })),
        // Já enfileirado antes: fica como está
        { onConflict: "chave", ignoreDuplicates: true }
      )
      .select("id,agendado_para");

    if (error) {
      console.error("[fila] Não enfileirou:", error.message);
      return;
    }

    const agora = Date.now() + 1000;
    const vencidos = (data ?? []).filter((d) => new Date(d.agendado_para).getTime() <= agora);
    if (vencidos.length) await processarFila({ ids: vencidos.map((d) => d.id) });
  } catch (e) {
    console.error("[fila] Falha ao enfileirar:", e instanceof Error ? e.message : e);
  }
}

/** Cancela o que ainda não saiu de uma consulta (ex.: lembrete de consulta cancelada). */
export async function cancelarPendentes(consultaId: string, eventos?: string[]): Promise<void> {
  if (!adminDisponivel()) return;
  let q = createAdminClient()
    .from("envios")
    .update({ status: "cancelado", erro: "Consulta mudou antes do envio." })
    .eq("consulta_id", consultaId)
    .eq("status", "pendente");
  if (eventos?.length) q = q.in("evento", eventos);
  await q;
}

export type RelatorioFila = { enviados: number; falhas: number; ignorados: number };

/**
 * Processa o que venceu. Sem `ids`, pega a fila inteira (a rotina);
 * com `ids`, só aqueles (o envio imediato de quem acabou de enfileirar).
 */
export async function processarFila(
  opcoes: { ids?: string[]; limite?: number } = {}
): Promise<RelatorioFila> {
  const relatorio: RelatorioFila = { enviados: 0, falhas: 0, ignorados: 0 };
  if (!adminDisponivel()) return relatorio;

  const admin = createAdminClient();

  // Quem ficou "enviando" por mais de 15 minutos caiu no meio: volta
  if (!opcoes.ids) {
    await admin
      .from("envios")
      .update({ status: "pendente" })
      .eq("status", "enviando")
      .lt("agendado_para", new Date(Date.now() - 15 * 60_000).toISOString());
  }

  let q = admin
    .from("envios")
    .select("*")
    .eq("status", "pendente")
    .lte("agendado_para", new Date().toISOString())
    .order("agendado_para", { ascending: true })
    .limit(opcoes.limite ?? 150);
  if (opcoes.ids) q = q.in("id", opcoes.ids);

  const { data: itens } = await q;

  for (const item of itens ?? []) {
    // Reserva o item: se outra passada pegou primeiro, este não sai duas vezes
    const { data: reservado } = await admin
      .from("envios")
      .update({ status: "enviando" })
      .eq("id", item.id)
      .eq("status", "pendente")
      .select("id")
      .maybeSingle();
    if (!reservado) continue;

    const r = await entregar(item as Envio);
    const tentativas = item.tentativas + 1;

    if (r.ok) {
      relatorio.enviados++;
      await admin
        .from("envios")
        .update({
          status: "enviado",
          enviado_em: new Date().toISOString(),
          tentativas,
          referencia: r.referencia ?? null,
          erro: null,
        })
        .eq("id", item.id);
      await depoisDeEnviar(item as Envio, r.canalReal);
      continue;
    }

    if (r.definitivo) {
      relatorio.ignorados++;
      await admin
        .from("envios")
        .update({ status: "ignorado", tentativas, erro: r.erro })
        .eq("id", item.id);
      continue;
    }

    const esgotou = tentativas >= MAX_TENTATIVAS;
    relatorio.falhas++;
    await admin
      .from("envios")
      .update({
        status: esgotou ? "falhou" : "pendente",
        tentativas,
        erro: r.erro,
        agendado_para: new Date(
          Date.now() + (ESPERA_MIN[tentativas - 1] ?? 60) * 60_000
        ).toISOString(),
      })
      .eq("id", item.id);

    if (esgotou) await avisarFalha(item as Envio, r.erro);
  }

  return relatorio;
}

type Entrega =
  | { ok: true; referencia?: string; canalReal: string }
  | { ok: false; erro: string; definitivo: boolean };

async function entregar(item: Envio): Promise<Entrega> {
  const p = item.payload as NonNullable<ItemFila["payload"]>;

  if (item.canal === "painel") {
    if (!item.usuario_id) return { ok: false, erro: "sem destinatário", definitivo: true };
    const { error } = await createAdminClient().from("notificacoes").insert({
      organization_id: item.organization_id,
      usuario_id: item.usuario_id,
      papeis: [],
      tipo: p.tipo ?? "sistema",
      prioridade: p.prioridade ?? "normal",
      titulo: item.assunto ?? "Aviso",
      descricao: item.conteudo,
      href: p.href ?? null,
      entidade_id: item.consulta_id,
    });
    return error ? { ok: false, erro: error.message, definitivo: false } : { ok: true, canalReal: "painel" };
  }

  if (!item.destino) return { ok: false, erro: "sem endereço", definitivo: true };

  if (item.canal === "email") {
    const r = await enviarEmail({
      para: item.destino,
      assunto: item.assunto ?? "",
      html: p.html ?? `<p>${item.conteudo ?? ""}</p>`,
      texto: item.conteudo ?? undefined,
      remetenteNome: p.remetenteNome,
    });
    if (r.enviado) return { ok: true, referencia: r.id, canalReal: "email" };
    return {
      ok: false,
      erro: r.motivo,
      definitivo: /RESEND_API_KEY|destinatário/i.test(r.motivo),
    };
  }

  const r = await enviarWhatsApp(
    { nome: item.destino_nome ?? "Contato", telefone: item.destino, conexaoId: p.conexaoId ?? null },
    item.conteudo ?? ""
  );
  if (r.enviado) return { ok: true, referencia: r.referencia, canalReal: r.canal };
  return {
    ok: false,
    erro: r.detalhe ? `${r.motivo}: ${r.detalhe}` : r.motivo,
    // Sem número ou sem WhatsApp conectado não melhora tentando de novo
    definitivo: r.motivo !== "erro",
  };
}

/**
 * Efeitos de um envio que deu certo. Hoje, um só: o lembrete do
 * paciente marca a confirmação como enviada.
 *
 * O e-mail só marca quando não há WhatsApp na fila para o mesmo
 * lembrete: o paciente com celular precisa do lembrete onde ele lê, e
 * a confirmação segue pendente na tela para a recepção, se o WhatsApp
 * não sair.
 */
async function depoisDeEnviar(item: Envio, canalReal: string): Promise<void> {
  if (item.evento !== "lembrete_paciente" || !item.confirmacao_id) return;
  const admin = createAdminClient();

  if (item.canal === "email") {
    const { count } = await admin
      .from("envios")
      .select("id", { count: "exact", head: true })
      .eq("confirmacao_id", item.confirmacao_id)
      .eq("evento", "lembrete_paciente")
      .eq("canal", "whatsapp")
      .in("status", ["pendente", "enviando", "enviado"]);
    if (count) return;
  }

  await admin
    .from("confirmacoes")
    .update({
      status: "enviado",
      enviado_em: new Date().toISOString(),
      canal: canalReal === "merge" || canalReal === "whatsapp" || canalReal === "email" ? canalReal : "email",
    })
    .eq("id", item.confirmacao_id)
    .eq("status", "pendente");
}

/** Mensagem ao paciente que não saiu: a recepção precisa saber para agir. */
async function avisarFalha(item: Envio, erro: string): Promise<void> {
  if (item.publico !== "paciente" || !item.organization_id) return;

  const admin = createAdminClient();

  if (item.confirmacao_id) {
    await admin
      .from("confirmacoes")
      .update({ observacao: `O ${item.canal === "email" ? "e-mail" : "WhatsApp"} automático falhou ${MAX_TENTATIVAS}x. Envie pelo painel.` })
      .eq("id", item.confirmacao_id);
  }

  // Import tardio: equipe.ts importa esta fila
  const { avisarEquipe } = await import("@/lib/comunicacao/equipe");
  await avisarEquipe({
    organizationId: item.organization_id,
    evento: "envio_falhou",
    consultaId: item.consulta_id,
    chave: `falha:${item.id}`,
    titulo: `Mensagem não chegou a ${item.destino_nome ?? "um paciente"}`,
    descricao: `${item.canal === "email" ? "E-mail" : "WhatsApp"} (${rotuloEvento(item.evento)}) falhou ${MAX_TENTATIVAS} vezes: ${erro}. Vale contato manual.`,
    href: item.confirmacao_id ? "/app/confirmacoes" : "/app/agenda",
    tipoPainel: "envio_falhou",
    prioridade: "alta",
  });
}

export function rotuloEvento(evento: string): string {
  const r: Record<string, string> = {
    lembrete_paciente: "lembrete",
    consulta_nova: "consulta marcada",
    consulta_cancelada: "cancelamento",
    consulta_remarcada: "remarcação",
    paciente_confirmou: "confirmação",
    agenda_do_dia: "agenda do dia",
    teste: "teste",
  };
  return r[evento] ?? evento.replace(/_/g, " ");
}
