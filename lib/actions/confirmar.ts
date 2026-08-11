"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient, adminDisponivel } from "@/lib/supabase/admin";
import type { StatusConfirmacao } from "@/lib/supabase/types";

export type RespostaPaciente = "confirmado" | "reagendar" | "recusado";

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
    .select("id,consulta_id,status")
    .eq("token", token)
    .maybeSingle();

  if (!conf) return { ok: false, erro: "Link inválido ou expirado." };
  if (conf.status === "cancelado") {
    return { ok: false, erro: "Esta consulta foi cancelada pela clínica." };
  }

  const { data: consulta } = await admin
    .from("consultas")
    .select("data_hora,status")
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

  revalidatePath(`/confirmar/${token}`);
  revalidatePath("/app/confirmacoes");
  revalidatePath("/app/agenda");

  return { ok: true, status: resposta };
}
