"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { bloqueio, contexto } from "@/lib/actions/contexto";
import { adminDisponivel, createAdminClient } from "@/lib/supabase/admin";
import { caminhoPublico, criarCheckin, mesAnterior } from "@/lib/formularios/periodico";
import { urlBase } from "@/lib/lembretes";

export type ResultadoGerarCheckin =
  | { ok: true; url: string; criado: boolean }
  | { ok: false; erro: string };

/**
 * Gera o check-in de um mês na hora, sem esperar a rotina diária.
 * Se o mês já tem check-in, devolve o mesmo link.
 */
export async function gerarCheckin(
  organizationId: string,
  referencia?: string
): Promise<ResultadoGerarCheckin> {
  const ctx = await contexto(["super_admin"]);
  if (ctx.estado !== "ok") {
    const b = bloqueio(ctx);
    return { ok: false, erro: b.ok ? "Sem permissão." : b.erro };
  }
  if (!adminDisponivel()) return { ok: false, erro: "Falta a chave de serviço do Supabase." };
  if (!z.string().uuid().safeParse(organizationId).success) {
    return { ok: false, erro: "Clínica inválida." };
  }
  const mes = referencia ?? mesAnterior();
  if (!/^\d{4}-\d{2}$/.test(mes)) return { ok: false, erro: "Mês inválido." };

  const res = await criarCheckin(createAdminClient(), organizationId, mes, ctx.profile.id);
  if (!res.ok) return res;

  revalidatePath(`/app/clinicas/${organizationId}`);
  return {
    ok: true,
    criado: res.criado,
    url: `${urlBase()}${caminhoPublico({ token: res.token, referencia: mes })}`,
  };
}
