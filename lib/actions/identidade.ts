"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  bloqueio,
  contexto,
  organizacaoAlvo,
  MARCA,
  type ActionResult,
} from "@/lib/actions/contexto";

/**
 * IDENTIDADE DA CLÍNICA — nome e logo
 *
 * Estão separados do resto das configurações de propósito. Endereço,
 * CNPJ e horário de lembrete são administração; nome e logo são a cara
 * que o paciente vê em toda mensagem, e quem responde por ela é o
 * profissional, não só quem cuida do cadastro.
 *
 * Quem pode editar está em `MARCA`, junto dos demais papéis.
 */

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

  const ctx = await contexto(MARCA);
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

/* ------------------------------------------------------------------ */
/* Ativação da clínica                                                 */
/* ------------------------------------------------------------------ */

/**
 * Liga ou desliga uma clínica.
 *
 * Só a equipe Medi Marketing: é decisão comercial, não configuração.
 * Enquanto inativa, a clínica não entra na rotina de lembretes — é o
 * que separa um cadastro declarado de um cliente.
 *
 * Antes disto não havia caminho nenhum na interface, e ativar um
 * cliente novo exigia mexer no banco à mão.
 */
export async function ativarClinica(
  organizationId: string,
  ativo: boolean
): Promise<ActionResult> {
  const ctx = await contexto(["super_admin"]);
  if (ctx.estado !== "ok") return bloqueio(ctx);

  const { error } = await ctx.supabase
    .from("organizations")
    .update({ ativo })
    .eq("id", organizationId);

  if (error) {
    console.error("[identidade] Erro ao ativar:", error.message);
    return { ok: false, erro: "Não foi possível mudar o status da clínica." };
  }

  revalidatePath("/app/clinicas");
  revalidatePath("/app", "layout");
  return { ok: true };
}
