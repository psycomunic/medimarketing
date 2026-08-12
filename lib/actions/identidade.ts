"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  bloqueio,
  contexto,
  organizacaoAlvo,
  type ActionResult,
} from "@/lib/actions/contexto";
import type { Role } from "@/lib/supabase/types";

/**
 * IDENTIDADE DA CLÍNICA — nome e logo
 *
 * Estão separados do resto das configurações de propósito. Endereço,
 * CNPJ e horário de lembrete são administração; nome e logo são a cara
 * que o paciente vê em toda mensagem, e quem responde por ela é o
 * profissional, não só quem cuida do cadastro.
 *
 * Por isso o médico entra na lista. Em consultório de um profissional
 * só — que é a maior parte da carteira — ele é o dono, e obrigá-lo a
 * pedir para outra pessoa trocar a própria logo seria burocracia sem
 * propósito. A secretária fica de fora: ela opera a agenda, não decide
 * a marca.
 */
const PODE_EDITAR: readonly Role[] = ["super_admin", "gestor", "medico"];

const schema = z.object({
  organizationId: z.string().min(1),
  nome: z
    .string()
    .trim()
    .min(2, "O nome precisa ter pelo menos 2 caracteres.")
    .max(120, "O nome ficou longo demais para caber nas mensagens."),
});

export type IdentidadeInput = z.input<typeof schema>;

/**
 * Renomeia a clínica.
 *
 * O nome viaja longe: é o remetente dos e-mails, a assinatura das
 * mensagens de WhatsApp e o cabeçalho da página que o paciente abre
 * para confirmar. Trocar aqui muda todos de uma vez.
 */
export async function salvarNomeClinica(
  input: IdentidadeInput
): Promise<ActionResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.errors[0]?.message ?? "Dados inválidos" };
  }

  const ctx = await contexto(PODE_EDITAR);
  if (ctx.estado !== "ok") return bloqueio(ctx);

  // Fora do super admin, `organizacaoAlvo` recusa qualquer id que não
  // seja o da própria clínica — é o que impede renomear a do vizinho.
  const orgId = organizacaoAlvo(ctx.profile, parsed.data.organizationId);
  if (!orgId) return { ok: false, erro: "Clínica inválida." };

  const { error } = await ctx.supabase
    .from("organizations")
    .update({ nome: parsed.data.nome })
    .eq("id", orgId);

  if (error) {
    console.error("[identidade] Erro ao renomear:", error.message);
    return { ok: false, erro: "Não foi possível salvar o nome." };
  }

  // O nome aparece na barra lateral, nas configurações e na carteira
  revalidatePath("/app", "layout");
  revalidatePath("/app/perfil");
  revalidatePath("/app/configuracoes");
  revalidatePath("/app/clinicas");
  return { ok: true };
}
