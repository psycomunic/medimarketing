"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true } | { ok: false; erro: string };

async function getUserId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, userId: user?.id };
}

export type DisponibilidadeItem = {
  dia_semana: number;
  hora_inicio: string; // "HH:MM"
  hora_fim: string;
};

/**
 * Substitui toda a disponibilidade semanal do médico pelos itens informados
 * (estratégia simples de "apagar e reinserir").
 */
export async function salvarDisponibilidade(
  itens: DisponibilidadeItem[]
): Promise<ActionResult> {
  const { supabase, userId } = await getUserId();
  if (!userId) return { ok: false, erro: "Sessão expirada." };

  // Valida intervalos
  for (const i of itens) {
    if (i.hora_inicio >= i.hora_fim) {
      return { ok: false, erro: "O horário de início deve ser antes do fim." };
    }
  }

  const del = await supabase
    .from("disponibilidade")
    .delete()
    .eq("medico_id", userId);
  if (del.error) return { ok: false, erro: "Não foi possível salvar." };

  if (itens.length > 0) {
    const { error } = await supabase.from("disponibilidade").insert(
      itens.map((i) => ({
        medico_id: userId,
        dia_semana: i.dia_semana,
        hora_inicio: i.hora_inicio,
        hora_fim: i.hora_fim,
      }))
    );
    if (error) return { ok: false, erro: "Não foi possível salvar." };
  }

  revalidatePath("/app/disponibilidade");
  return { ok: true };
}

/** Adiciona um bloqueio de período (férias, folga). */
export async function adicionarBloqueio(input: {
  data_inicio: string;
  data_fim: string;
  motivo?: string;
}): Promise<ActionResult> {
  const { supabase, userId } = await getUserId();
  if (!userId) return { ok: false, erro: "Sessão expirada." };
  if (input.data_inicio > input.data_fim) {
    return { ok: false, erro: "A data inicial deve ser antes da final." };
  }

  const { error } = await supabase.from("bloqueios").insert({
    medico_id: userId,
    data_inicio: input.data_inicio,
    data_fim: input.data_fim,
    motivo: input.motivo || null,
  });
  if (error) return { ok: false, erro: "Não foi possível adicionar o bloqueio." };

  revalidatePath("/app/disponibilidade");
  return { ok: true };
}

/** Remove um bloqueio. */
export async function removerBloqueio(id: string): Promise<ActionResult> {
  const { supabase, userId } = await getUserId();
  if (!userId) return { ok: false, erro: "Sessão expirada." };

  const { error } = await supabase.from("bloqueios").delete().eq("id", id);
  if (error) return { ok: false, erro: "Não foi possível remover." };

  revalidatePath("/app/disponibilidade");
  return { ok: true };
}
