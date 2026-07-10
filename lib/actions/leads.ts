"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

// Validação server-side do lead (espelha o schema do formulário)
const leadSchema = z.object({
  nome: z.string().min(2, "Informe seu nome"),
  especialidade: z.string().optional().default(""),
  whatsapp: z.string().min(8, "Informe um WhatsApp válido"),
  cidade: z.string().optional().default(""),
  origem: z.string().optional().default("landing"),
});

export type LeadInput = z.infer<typeof leadSchema>;

export type LeadResult =
  | { ok: true }
  | { ok: false; erro: string };

/**
 * Grava um lead vindo dos formulários da landing na tabela `leads`.
 * A tabela permite INSERT público (ver RLS em supabase/schema.sql).
 * TODO (Fase 2): disparar notificação por e-mail/WhatsApp após inserir.
 */
export async function enviarLead(input: LeadInput): Promise<LeadResult> {
  const parsed = leadSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.errors[0]?.message ?? "Dados inválidos" };
  }

  // Sem Supabase configurado ainda: não quebra a UX em dev/preview
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    console.warn("[leads] Supabase não configurado — lead não persistido:", parsed.data);
    return { ok: true };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("leads").insert({
    nome: parsed.data.nome,
    especialidade: parsed.data.especialidade || null,
    whatsapp: parsed.data.whatsapp,
    cidade: parsed.data.cidade || null,
    origem: parsed.data.origem || "landing",
  });

  if (error) {
    console.error("[leads] Erro ao inserir:", error.message);
    return { ok: false, erro: "Não foi possível enviar agora. Tente pelo WhatsApp." };
  }

  return { ok: true };
}
