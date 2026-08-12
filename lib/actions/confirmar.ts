"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient, adminDisponivel } from "@/lib/supabase/admin";
import { notificar } from "@/lib/supabase/notificacoes";
import {
  destinatariosDaConsulta,
  type DestinoConsulta,
} from "@/lib/supabase/destinatarios";
import { emailConfigurado, enviarVarios } from "@/lib/email";
import {
  emailClinicaCancelou,
  emailClinicaConfirmou,
  emailClinicaReagendar,
  emailPacienteConfirmou,
} from "@/lib/email-modelos";
import { enviarWhatsApp } from "@/lib/envio";
import { mergeConfigurado } from "@/lib/merge";
import {
  msgEquipeCancelou,
  msgEquipeConfirmou,
  msgEquipeReagendar,
  type AvisoEquipe,
} from "@/lib/mensagens";
import {
  diaDaSemana,
  formatarData,
  formatarHora,
  urlConfirmacao,
  urlPainel,
} from "@/lib/lembretes";
import type { StatusConfirmacao } from "@/lib/supabase/types";

export type RespostaPaciente = "confirmado" | "reagendar" | "recusado";

/**
 * Avisa paciente e clínica por e-mail sobre a resposta.
 *
 * O paciente só recebe quando confirma: é o recibo dele. Pedido de
 * remarcação e cancelamento ele já sabe que fez — quem precisa saber é
 * a clínica, e para ela todos os três chegam.
 */
async function avisarPorEmail(args: {
  resposta: RespostaPaciente;
  destino: DestinoConsulta;
  dados: AvisoEquipe;
  token: string;
  emailPaciente: string | null;
}): Promise<void> {
  if (!emailConfigurado()) return;

  const { resposta, destino, dados, token, emailPaciente } = args;

  const envios: Parameters<typeof enviarVarios>[0] = [];

  // Recibo do paciente. Vai com o mesmo link que ele acabou de usar: se
  // depois precisar remarcar, é por ali — a caixa não recebe resposta.
  if (resposta === "confirmado" && emailPaciente) {
    const modelo = emailPacienteConfirmou(destino.marca, {
      ...dados,
      link: urlConfirmacao(token),
    });
    envios.push({
      para: emailPaciente,
      assunto: modelo.assunto,
      html: modelo.html,
      texto: modelo.texto,
      remetenteNome: destino.marca.clinica,
    });
  }

  // Aviso da clínica. Todo botão aponta para o painel: é lá que estão a
  // agenda e as configurações, e é de lá que sai qualquer contato.
  if (destino.emails.length) {
    const painel = urlPainel("/app/confirmacoes");
    const comPainel = { ...dados, painel };
    const modelo =
      resposta === "confirmado"
        ? emailClinicaConfirmou(destino.marca, comPainel)
        : resposta === "reagendar"
          ? emailClinicaReagendar(destino.marca, comPainel)
          : emailClinicaCancelou(destino.marca, comPainel);

    envios.push({
      para: destino.emails,
      assunto: modelo.assunto,
      html: modelo.html,
      texto: modelo.texto,
      remetenteNome: destino.marca.clinica,
    });
  }

  if (envios.length) await enviarVarios(envios);
}

/**
 * O mesmo aviso da clínica, pelo WhatsApp.
 *
 * Vale mais que o e-mail no caso urgente: o pedido de remarcação chega
 * no celular que o médico já tem na mão, e a vaga só se salva se
 * alguém ligar rápido. O paciente não entra aqui — ele acabou de
 * responder, já sabe o que fez.
 *
 * Sai do número da própria clínica, então nada é enviado se ela ainda
 * não escolheu a conexão: melhor não avisar do que avisar pelo número
 * de outra clínica.
 */
async function avisarPorWhatsApp(args: {
  resposta: RespostaPaciente;
  destino: DestinoConsulta;
  dados: AvisoEquipe;
}): Promise<void> {
  const { resposta, destino, dados } = args;

  if (!mergeConfigurado() || !destino.conexaoId || !destino.whatsapps.length) return;

  const texto =
    resposta === "confirmado"
      ? msgEquipeConfirmou(dados)
      : resposta === "reagendar"
        ? msgEquipeReagendar(dados)
        : msgEquipeCancelou(dados);

  await Promise.all(
    destino.whatsapps.map((c) =>
      enviarWhatsApp({ nome: c.nome, telefone: c.telefone, conexaoId: destino.conexaoId }, texto)
    )
  );
}

/**
 * Apura os destinatários uma vez e avisa pelos dois canais.
 *
 * E-mail e WhatsApp dizem a mesma coisa para as mesmas pessoas; o que
 * muda é o formato. Buscar a lista duas vezes só multiplicaria consulta
 * ao banco e abriria espaço para os dois canais discordarem.
 */
async function avisar(args: {
  resposta: RespostaPaciente;
  organizationId: string;
  token: string;
  consulta: {
    paciente_nome: string;
    paciente_email: string | null;
    paciente_telefone: string | null;
    data_hora: string;
    medico_id: string;
  };
}): Promise<void> {
  const { resposta, organizationId, token, consulta } = args;

  const destino = await destinatariosDaConsulta(organizationId, consulta.medico_id);
  if (!destino) return;

  const admin = createAdminClient();
  const { data: medico } = await admin
    .from("profiles")
    .select("nome")
    .eq("id", consulta.medico_id)
    .maybeSingle();

  const dados: AvisoEquipe = {
    paciente: consulta.paciente_nome,
    data: formatarData(consulta.data_hora),
    hora: formatarHora(consulta.data_hora),
    diaSemana: diaDaSemana(consulta.data_hora),
    medico: medico?.nome ?? null,
    telefone: consulta.paciente_telefone,
    painel: urlPainel("/app/confirmacoes"),
  };

  // Em paralelo e sem propagar erro: um canal fora do ar não pode
  // calar o outro nem desfazer a resposta que o paciente já deu.
  await Promise.allSettled([
    avisarPorEmail({
      resposta,
      destino,
      dados,
      token,
      emailPaciente: consulta.paciente_email,
    }),
    avisarPorWhatsApp({ resposta, destino, dados }),
  ]);
}

export type ResultadoResposta =
  | { ok: true; status: StatusConfirmacao }
  | { ok: false; erro: string };

/**
 * Resposta do paciente na página pública.
 *
 * Não há sessão aqui: a autorização é o próprio token, 32 bytes
 * aleatórios que só chegaram a quem recebeu a mensagem. Por isso o
 * cuidado de sempre buscar pelo token exato e nunca aceitar o id da
 * consulta como parâmetro — com o id, qualquer um responderia pela
 * consulta de outra pessoa.
 */
export async function responderConfirmacao(
  token: string,
  resposta: RespostaPaciente
): Promise<ResultadoResposta> {
  if (!token || token.length < 20) {
    return { ok: false, erro: "Link inválido." };
  }
  if (!["confirmado", "reagendar", "recusado"].includes(resposta)) {
    return { ok: false, erro: "Resposta inválida." };
  }
  if (!adminDisponivel()) {
    return { ok: false, erro: "Não foi possível registrar agora. Tente mais tarde." };
  }

  const admin = createAdminClient();

  const { data: conf } = await admin
    .from("confirmacoes")
    .select("id,consulta_id,status,organization_id")
    .eq("token", token)
    .maybeSingle();

  if (!conf) return { ok: false, erro: "Link inválido ou expirado." };
  if (conf.status === "cancelado") {
    return { ok: false, erro: "Esta consulta foi cancelada pela clínica." };
  }

  const { data: consulta } = await admin
    .from("consultas")
    .select("data_hora,status,paciente_nome,paciente_telefone,paciente_email,medico_id")
    .eq("id", conf.consulta_id)
    .maybeSingle();

  if (!consulta) return { ok: false, erro: "Consulta não encontrada." };
  if (consulta.status === "cancelada") {
    return { ok: false, erro: "Esta consulta foi cancelada pela clínica." };
  }
  if (new Date(consulta.data_hora).getTime() < Date.now()) {
    return { ok: false, erro: "O horário desta consulta já passou." };
  }

  const agora = new Date().toISOString();

  const { error } = await admin
    .from("confirmacoes")
    .update({ status: resposta, respondido_em: agora })
    .eq("id", conf.id);

  if (error) {
    console.error("[confirmar] Erro ao registrar resposta:", error.message);
    return { ok: false, erro: "Não foi possível registrar. Tente novamente." };
  }

  // A agenda reflete a resposta na hora: é o que a recepção olha de manhã.
  // "Reagendar" não cancela nada — quem decide o novo horário é a clínica,
  // então a consulta segue de pé e só entra na fila de contato.
  if (resposta === "confirmado") {
    await admin
      .from("consultas")
      .update({ status: "confirmada" })
      .eq("id", conf.consulta_id);
  } else if (resposta === "recusado") {
    await admin
      .from("consultas")
      .update({ status: "cancelada" })
      .eq("id", conf.consulta_id);
  }

  // Avisa a equipe. O pedido de reagendamento entra como prioridade
  // alta: é o único caso em que alguém precisa ligar de volta, e quanto
  // mais cedo, maior a chance de salvar o horário.
  const quando = new Date(consulta.data_hora).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const contato = consulta.paciente_telefone
    ? ` · ${consulta.paciente_telefone}`
    : "";

  const avisos = {
    reagendar: {
      tipo: "reagendamento" as const,
      prioridade: "alta" as const,
      titulo: `${consulta.paciente_nome} pediu para reagendar`,
      descricao: `Consulta de ${quando}${contato}. O horário segue reservado — combine o novo o quanto antes.`,
    },
    recusado: {
      tipo: "cancelamento" as const,
      prioridade: "alta" as const,
      titulo: `${consulta.paciente_nome} não vai comparecer`,
      descricao: `A consulta de ${quando} foi cancelada${contato}. O horário está livre para encaixe.`,
    },
    confirmado: {
      tipo: "confirmacao" as const,
      prioridade: "normal" as const,
      titulo: `${consulta.paciente_nome} confirmou a presença`,
      descricao: `Consulta de ${quando}.`,
    },
  };

  const aviso = avisos[resposta];
  await notificar({
    organizationId: conf.organization_id,
    entidadeId: conf.consulta_id,
    href: "/app/confirmacoes",
    ...aviso,
  });

  // E-mail e WhatsApp para os dois lados. Falhar aqui não desfaz a
  // resposta que o paciente deu — o aviso no painel já está registrado.
  await avisar({
    resposta,
    organizationId: conf.organization_id,
    token,
    consulta,
  });

  revalidatePath(`/confirmar/${token}`);
  revalidatePath("/app/confirmacoes");
  revalidatePath("/app/agenda");
  revalidatePath("/app/notificacoes");
  revalidatePath("/app", "layout");

  return { ok: true, status: resposta };
}
