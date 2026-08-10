"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigurado } from "@/lib/supabase/queries";

// Validação server-side do lead (espelha o schema do formulário)
const leadSchema = z.object({
  nome: z.string().min(2, "Informe seu nome"),
  especialidade: z.string().optional().default(""),
  whatsapp: z.string().min(8, "Informe um WhatsApp válido"),
  email: z.string().email("E-mail inválido").optional().or(z.literal("")),
  cidade: z.string().optional().default(""),
  faturamento_medio: z.string().optional().default(""),
  tem_equipe_comercial: z.boolean().optional(),
  mensagem: z.string().max(1000).optional().default(""),
  origem: z.string().optional().default("landing"),
  // LGPD: o consentimento é obrigatório e fica registrado com o lead
  consentimento: z.boolean().refine((v) => v === true, {
    message: "É preciso concordar com o contato para enviar.",
  }),
});

export type LeadInput = z.input<typeof leadSchema>;

export type LeadResult = { ok: true } | { ok: false; erro: string };

/**
 * Grava um lead vindo dos formulários da landing na tabela `leads`.
 *
 * O lead entra sem `organization_id` — é um lead comercial da própria
 * Medi Marketing, visível apenas para o super admin (ver RLS em
 * supabase/schema.sql). Já nasce na etapa "novo" do funil, pronto para o
 * CRM da Fase 2.
 *
 * TODO (Fase 2): disparar notificação por e-mail/WhatsApp após inserir.
 */
export async function enviarLead(input: LeadInput): Promise<LeadResult> {
  const parsed = leadSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.errors[0]?.message ?? "Dados inválidos" };
  }

  const dados = parsed.data;

  // Sem Supabase configurado ainda: não quebra a UX em dev/preview
  if (!supabaseConfigurado()) {
    console.warn("[leads] Supabase não configurado — lead não persistido:", dados);
    return { ok: true };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("leads").insert({
    organization_id: null,
    nome: dados.nome.trim(),
    especialidade: dados.especialidade || null,
    whatsapp: dados.whatsapp,
    email: dados.email || null,
    cidade: dados.cidade || null,
    faturamento_medio: dados.faturamento_medio || null,
    tem_equipe_comercial: dados.tem_equipe_comercial ?? null,
    mensagem: dados.mensagem || null,
    origem: dados.origem || "landing",
    consentimento_lgpd: dados.consentimento,
    etapa_funil: "novo",
    status: "aberto",
  });

  if (error) {
    console.error("[leads] Erro ao inserir:", error.message);
    return { ok: false, erro: "Não foi possível enviar agora. Tente pelo WhatsApp." };
  }

  return { ok: true };
}
