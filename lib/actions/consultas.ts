"use server";

import { revalidatePath } from "next/cache";
import { avisarConsultaMarcada } from "@/lib/avisos-consulta";
import { createClient } from "@/lib/supabase/server";
import { emModoDemo } from "@/lib/supabase/queries";
import type { StatusConsulta, TipoConsulta } from "@/lib/supabase/types";

export type ActionResult = { ok: true } | { ok: false; erro: string };

const MSG_DEMO =
  "Modo demonstração: nada é salvo aqui. Numa conta de verdade, esta alteração já estaria valendo.";

async function getUserId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, userId: user?.id };
}

/** Atualiza o status de uma consulta (ex.: marcar como realizada). */
export async function atualizarStatus(
  id: string,
  status: StatusConsulta,
): Promise<ActionResult> {
  if (await emModoDemo()) return { ok: false, erro: MSG_DEMO };
  const { supabase, userId } = await getUserId();
  if (!userId) return { ok: false, erro: "Sessão expirada." };

  const { error } = await supabase
    .from("consultas")
    .update({ status })
    .eq("id", id);

  if (error) return { ok: false, erro: "Não foi possível atualizar o status." };
  revalidatePath("/app/agenda");
  revalidatePath("/app");
  return { ok: true };
}

/** Salva/atualiza a observação de uma consulta. */
export async function salvarObservacao(
  id: string,
  observacao: string,
): Promise<ActionResult> {
  if (await emModoDemo()) return { ok: false, erro: MSG_DEMO };
  const { supabase, userId } = await getUserId();
  if (!userId) return { ok: false, erro: "Sessão expirada." };

  const { error } = await supabase
    .from("consultas")
    .update({ observacao })
    .eq("id", id);

  if (error)
    return { ok: false, erro: "Não foi possível salvar a observação." };
  revalidatePath("/app/agenda");
  return { ok: true };
}

/**
 * Cria uma consulta. No fluxo real isso é feito pela equipe de atendimento,
 * mas deixamos disponível para o médico testar/registrar encaixes.
 */
export async function criarConsulta(input: {
  paciente_nome: string;
  paciente_telefone?: string;
  paciente_email?: string;
  paciente_nascimento?: string;
  convenio?: string;
  data_hora: string; // ISO
  duracao_min?: number;
  tipo: TipoConsulta;
  motivo?: string;
  observacao?: string;
  valor?: number;
  /** Profissional que vai atender. Sem isso, é quem está criando. */
  medico_id?: string;
  /** Clínica da consulta. Obrigatória para quem não pertence a nenhuma. */
  organization_id?: string;
}): Promise<ActionResult> {
  if (await emModoDemo()) return { ok: false, erro: MSG_DEMO };
  const { supabase, userId } = await getUserId();
  if (!userId) return { ok: false, erro: "Sessão expirada." };
  if (!input.paciente_nome?.trim())
    return { ok: false, erro: "Informe o nome do paciente." };

  const { data: perfil } = await supabase
    .from("profiles")
    .select("organization_id,role")
    .eq("id", userId)
    .single();

  const ehSuperAdmin = perfil?.role === "super_admin";

  /*
   * A clínica da consulta é o que a RLS usa para isolar os tenants, e o
   * que liga a consulta a financeiro, indicadores e confirmações.
   *
   * Quem pertence a uma clínica escreve sempre na dela. O super admin
   * não pertence a nenhuma, então precisa dizer qual — sem isso a
   * consulta nasceria órfã e nunca entraria em nenhum desses módulos.
   */
  const organizationId = ehSuperAdmin
    ? (input.organization_id ?? null)
    : (perfil?.organization_id ?? null);

  if (!organizationId) {
    return {
      ok: false,
      erro: ehSuperAdmin
        ? "Escolha a clínica da consulta."
        : "Sua conta não está vinculada a uma clínica.",
    };
  }
  if (
    !ehSuperAdmin &&
    input.organization_id &&
    input.organization_id !== perfil?.organization_id
  ) {
    return { ok: false, erro: "Você só marca consultas na sua clínica." };
  }

  /*
   * O profissional é quem atende, não quem digita: a secretária marca
   * para o médico. Sem escolha explícita mantemos quem está criando,
   * que é o caso do médico registrando o próprio encaixe.
   */
  const medicoId = input.medico_id || userId;

  // A validação vale também para o padrão: o super admin não pertence a
  // clínica nenhuma, então ele nunca pode ficar como o profissional.
  const { data: alvo } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", medicoId)
    .maybeSingle();

  if (!alvo) return { ok: false, erro: "Profissional não encontrado." };
  if (alvo.organization_id !== organizationId) {
    return {
      ok: false,
      erro: input.medico_id
        ? "Esse profissional não é da clínica escolhida."
        : "Escolha o profissional que vai atender: sua conta não atende nesta clínica.",
    };
  }

  const { data: criada, error } = await supabase
    .from("consultas")
    .insert({
      organization_id: organizationId,
      medico_id: medicoId,
      criado_por: userId,
      paciente_nome: input.paciente_nome.trim(),
      paciente_telefone: input.paciente_telefone || null,
      paciente_email: input.paciente_email || null,
      paciente_nascimento: input.paciente_nascimento || null,
      convenio: input.convenio || null,
      data_hora: input.data_hora,
      duracao_min: input.duracao_min ?? 30,
      tipo: input.tipo,
      status: "pendente",
      motivo: input.motivo || null,
      observacao: input.observacao || null,
      valor: input.valor ?? null,
    })
    .select("id")
    .single();

  if (error) return { ok: false, erro: "Não foi possível criar a consulta." };

  // O paciente combinou por telefone ou no balcão e ainda não tem nada
  // por escrito. Este é o comprovante dele — vai pelos dois canais e
  // não derruba o agendamento se falhar.
  if (criada) await avisarConsultaMarcada(criada.id);

  revalidatePath("/app/agenda");
  revalidatePath("/app");
  return { ok: true };
}
