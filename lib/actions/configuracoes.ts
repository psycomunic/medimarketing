"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  bloqueio,
  contexto,
  organizacaoAlvo,
  GESTAO,
  type ActionResult,
} from "@/lib/actions/contexto";
import type { ProvedorIntegracao, Role } from "@/lib/supabase/types";

const PROVEDORES = [
  "meta_ads",
  "google_ads",
  "ga4",
  "whatsapp",
  "instagram",
] as const;

function revalidar() {
  revalidatePath("/app/configuracoes");
  revalidatePath("/app", "layout");
}

/* ------------------------------------------------------------------ */
/* Dados da clínica                                                    */
/* ------------------------------------------------------------------ */

const clinicaSchema = z.object({
  organizationId: z.string().min(1),
  nome: z.string().trim().min(2, "Informe o nome da clínica."),
  especialidade: z.string().trim().max(80).optional().or(z.literal("")),
  cnpj: z.string().trim().max(20).optional().or(z.literal("")),
  telefone: z.string().trim().max(30).optional().or(z.literal("")),
  email: z.string().trim().email("E-mail inválido.").optional().or(z.literal("")),
  cidade: z.string().trim().max(120).optional().or(z.literal("")),
  endereco: z.string().trim().max(200).optional().or(z.literal("")),
  responsavel: z.string().trim().max(120).optional().or(z.literal("")),
  site: z.string().trim().url("Endereço de site inválido.").optional().or(z.literal("")),
  instagram: z.string().trim().max(60).optional().or(z.literal("")),
  mensagemLembrete: z.string().trim().max(600).optional().or(z.literal("")),
  lembreteAtivo: z.boolean(),
  lembreteDiasUteis: z.number().int().min(1).max(10),
  lembreteHora: z.number().int().min(0).max(23),
});

export type ClinicaInput = z.input<typeof clinicaSchema>;

/** Salva os dados cadastrais e as preferências de lembrete da clínica. */
export async function salvarClinica(input: ClinicaInput): Promise<ActionResult> {
  const parsed = clinicaSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.errors[0]?.message ?? "Dados inválidos" };
  }

  const ctx = await contexto(GESTAO);
  if (ctx.estado !== "ok") return bloqueio(ctx);

  const d = parsed.data;
  const orgId = organizacaoAlvo(ctx.profile, d.organizationId);
  if (!orgId) return { ok: false, erro: "Clínica inválida." };

  const { error } = await ctx.supabase
    .from("organizations")
    .update({
      nome: d.nome,
      especialidade: d.especialidade || null,
      cnpj: d.cnpj || null,
      telefone: d.telefone || null,
      email: d.email || null,
      cidade: d.cidade || null,
      endereco: d.endereco || null,
      responsavel: d.responsavel || null,
      site: d.site || null,
      instagram: d.instagram || null,
      mensagem_lembrete: d.mensagemLembrete || null,
      lembrete_ativo: d.lembreteAtivo,
      lembrete_dias_uteis: d.lembreteDiasUteis,
      lembrete_hora: d.lembreteHora,
    })
    .eq("id", orgId);

  if (error) {
    console.error("[configuracoes] Erro ao salvar clínica:", error.message);
    return { ok: false, erro: "Não foi possível salvar os dados da clínica." };
  }

  revalidar();
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Integrações                                                         */
/* ------------------------------------------------------------------ */

const integracaoSchema = z.object({
  organizationId: z.string().min(1),
  provedor: z.enum(PROVEDORES),
  conectado: z.boolean(),
  identificador: z.string().trim().max(120).optional().or(z.literal("")),
});

export type IntegracaoInput = z.input<typeof integracaoSchema>;

/**
 * Grava o estado de uma integração.
 *
 * Por enquanto é registro manual: quem faz a conexão de fato é a equipe
 * da Medi Marketing, do lado das plataformas. O OAuth de cada provedor
 * entra na Fase 4 e substitui esta tela sem mudar a tabela.
 */
export async function salvarIntegracao(
  input: IntegracaoInput
): Promise<ActionResult> {
  const parsed = integracaoSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.errors[0]?.message ?? "Dados inválidos" };
  }

  const ctx = await contexto(GESTAO);
  if (ctx.estado !== "ok") return bloqueio(ctx);

  const d = parsed.data;
  const orgId = organizacaoAlvo(ctx.profile, d.organizationId);
  if (!orgId) return { ok: false, erro: "Clínica inválida." };

  if (d.conectado && !d.identificador) {
    return {
      ok: false,
      erro: "Informe a conta ou o número antes de marcar como conectado.",
    };
  }

  const { error } = await ctx.supabase.from("integracoes").upsert(
    {
      organization_id: orgId,
      provedor: d.provedor as ProvedorIntegracao,
      conectado: d.conectado,
      identificador: d.identificador || null,
      atualizado_em: new Date().toISOString(),
    },
    { onConflict: "organization_id,provedor" }
  );

  if (error) {
    console.error("[configuracoes] Erro na integração:", error.message);
    return { ok: false, erro: "Não foi possível salvar a integração." };
  }

  revalidatePath("/app/configuracoes");
  revalidatePath("/app/marketing");
  revalidatePath("/app/atendimento");
  return { ok: true };
}
