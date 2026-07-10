"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { emModoDemo } from "@/lib/supabase/queries";
import type { StatusConsulta, TipoConsulta } from "@/lib/supabase/types";

export type ActionResult = { ok: true } | { ok: false; erro: string };

const MSG_DEMO =
  "Modo demonstração: as alterações não são salvas. Conecte o Supabase para persistir.";

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
  status: StatusConsulta
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
  observacao: string
): Promise<ActionResult> {
  if (await emModoDemo()) return { ok: false, erro: MSG_DEMO };
  const { supabase, userId } = await getUserId();
  if (!userId) return { ok: false, erro: "Sessão expirada." };

  const { error } = await supabase
    .from("consultas")
    .update({ observacao })
    .eq("id", id);

  if (error) return { ok: false, erro: "Não foi possível salvar a observação." };
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
}): Promise<ActionResult> {
  if (await emModoDemo()) return { ok: false, erro: MSG_DEMO };
  const { supabase, userId } = await getUserId();
  if (!userId) return { ok: false, erro: "Sessão expirada." };
  if (!input.paciente_nome?.trim()) return { ok: false, erro: "Informe o nome do paciente." };

  const { error } = await supabase.from("consultas").insert({
    medico_id: userId,
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
  });

  if (error) return { ok: false, erro: "Não foi possível criar a consulta." };
  revalidatePath("/app/agenda");
  revalidatePath("/app");
  return { ok: true };
}
