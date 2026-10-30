"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { bloqueio, contexto, GESTAO } from "@/lib/actions/contexto";

const loteSchema = z.object({
  itens: z
    .array(
      z.object({
        servicoId: z.string().min(1),
        consultaIds: z.array(z.string()).max(5000),
        receitaIds: z.array(z.string()).max(5000),
      })
    )
    .min(1, "Marque ao menos um grupo.")
    .max(500),
});

/** Em pedaços: a URL do filtro "in" tem limite de tamanho. */
const pedacos = <T,>(lista: T[], n = 150) => Array.from({ length: Math.ceil(lista.length / n) }, (_, i) => lista.slice(i * n, i * n + n));

/**
 * Dá serviço, em lote, a consultas e receitas antigas. Só preenche o que
 * está sem serviço: nunca troca uma classificação já feita. Valores,
 * custos e descrições das receitas ficam como estão (o resultado dos meses
 * passados não muda).
 */
export async function classificarEmLote(
  input: z.input<typeof loteSchema>
): Promise<{ ok: true; consultas: number; receitas: number } | { ok: false; erro: string }> {
  const p = loteSchema.safeParse(input);
  if (!p.success) return { ok: false, erro: p.error.errors[0]?.message ?? "Dados inválidos." };
  const ctx = await contexto(GESTAO);
  if (ctx.estado !== "ok") return bloqueio(ctx) as { ok: false; erro: string };
  const orgId = ctx.profile.organization_id;
  if (!orgId) return { ok: false, erro: "Abra a clínica para classificar os atendimentos dela." };

  const ids = [...new Set(p.data.itens.map((i) => i.servicoId))];
  const { data: servicos } = await ctx.supabase.from("tabela_precos").select("id,procedimento").eq("organization_id", orgId).in("id", ids);
  const nomes = new Map((servicos ?? []).map((s) => [s.id, s.procedimento as string]));
  if (nomes.size !== ids.length) return { ok: false, erro: "Algum serviço escolhido não está mais na tabela. Recarregue a página." };

  let consultas = 0;
  let receitas = 0;
  for (const item of p.data.itens) {
    const nome = nomes.get(item.servicoId)!;
    for (const lote of pedacos(item.consultaIds)) {
      const { data, error } = await ctx.supabase
        .from("consultas")
        .update({ servico_id: item.servicoId, servico_nome: nome })
        .eq("organization_id", orgId)
        .is("servico_id", null)
        .in("id", lote)
        .select("id");
      if (error && /servico_/.test(error.message)) return { ok: false, erro: "Rode antes o SQL dos serviços (Fase 1)." };
      if (error) return { ok: false, erro: "Não foi possível classificar as consultas." };
      consultas += data?.length ?? 0;
      // A receita de cada consulta acompanha
      await ctx.supabase.from("lancamentos").update({ servico_id: item.servicoId }).eq("organization_id", orgId).is("servico_id", null).in("consulta_id", lote);
    }
    for (const lote of pedacos(item.receitaIds)) {
      const { data, error } = await ctx.supabase
        .from("lancamentos")
        .update({ servico_id: item.servicoId })
        .eq("organization_id", orgId)
        .is("servico_id", null)
        .in("id", lote)
        .select("id");
      if (error) return { ok: false, erro: "Não foi possível classificar as receitas." };
      receitas += data?.length ?? 0;
    }
  }

  revalidatePath("/app/financeiro", "layout");
  revalidatePath("/app/agenda");
  revalidatePath("/app");
  return { ok: true, consultas, receitas };
}
