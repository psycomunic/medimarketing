"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { emModoDemo, getSessao } from "@/lib/supabase/queries";

export type ActionResult = { ok: true } | { ok: false; erro: string };

const MSG_DEMO =
  "Modo demonstração: as alterações não são salvas. Conecte o Supabase para persistir.";

const schema = z.object({
  organizationId: z.string().min(1),
  mes: z.string().regex(/^\d{4}-\d{2}-01$/, "Mês inválido."),
  investimento: z.number().min(0),
  leads: z.number().int().min(0),
  agendamentos: z.number().int().min(0),
  comparecimentos: z.number().int().min(0),
  faturamento: z.number().min(0),
  observacao: z.string().trim().max(500).optional().or(z.literal("")),
});

export type IndicadorInput = z.input<typeof schema>;

/**
 * Lança (ou atualiza) os números de um mês.
 *
 * É o fallback manual do briefing: enquanto Meta Ads, Google Ads e GA4 não
 * estão conectados, gestor e equipe alimentam a mesma tabela que as APIs
 * vão preencher na Fase 4.
 */
export async function salvarIndicador(
  input: IndicadorInput
): Promise<ActionResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.errors[0]?.message ?? "Dados inválidos" };
  }

  const d = parsed.data;

  // Coerência do funil: cada etapa não pode ser maior que a anterior
  if (d.agendamentos > d.leads) {
    return { ok: false, erro: "Agendamentos não podem passar do número de leads." };
  }
  if (d.comparecimentos > d.agendamentos) {
    return {
      ok: false,
      erro: "Comparecimentos não podem passar do número de agendamentos.",
    };
  }

  if (await emModoDemo()) return { ok: false, erro: MSG_DEMO };

  const { profile } = await getSessao();
  if (!profile) return { ok: false, erro: "Sessão expirada." };
  if (profile.role !== "gestor" && profile.role !== "super_admin") {
    return { ok: false, erro: "Só o gestor da clínica pode lançar indicadores." };
  }
  if (
    profile.role === "gestor" &&
    profile.organization_id !== d.organizationId
  ) {
    return { ok: false, erro: "Clínica inválida." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("indicadores_mensais").upsert(
    {
      organization_id: d.organizationId,
      mes: d.mes,
      investimento: d.investimento,
      leads: d.leads,
      agendamentos: d.agendamentos,
      comparecimentos: d.comparecimentos,
      faturamento: d.faturamento,
      observacao: d.observacao || null,
      atualizado_em: new Date().toISOString(),
    },
    { onConflict: "organization_id,mes" }
  );

  if (error) {
    console.error("[indicadores] Erro ao salvar:", error.message);
    return { ok: false, erro: "Não foi possível salvar os números." };
  }

  revalidatePath("/app/indicadores");
  revalidatePath("/app");
  return { ok: true };
}
