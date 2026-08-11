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
  antecedenciaLembreteH: z.number().int().min(1).max(168),
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
      antecedencia_lembrete_h: d.antecedenciaLembreteH,
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
/* Equipe                                                              */
/* ------------------------------------------------------------------ */

const PAPEIS_ATRIBUIVEIS: readonly Role[] = ["gestor", "secretaria", "medico"];

/**
 * Muda o papel de alguém da equipe.
 *
 * Não é possível criar `super_admin` por aqui: esse papel é da equipe da
 * Medi Marketing e só existe via convite direto no Supabase.
 */
export async function alterarPapel(
  profileId: string,
  papel: Role
): Promise<ActionResult> {
  if (!PAPEIS_ATRIBUIVEIS.includes(papel)) {
    return { ok: false, erro: "Papel inválido." };
  }

  const ctx = await contexto(GESTAO);
  if (ctx.estado !== "ok") return bloqueio(ctx);

  if (profileId === ctx.profile.id) {
    return { ok: false, erro: "Você não pode mudar o seu próprio papel." };
  }

  // O gestor só mexe em quem é da própria clínica
  const { data: alvo } = await ctx.supabase
    .from("profiles")
    .select("organization_id,role")
    .eq("id", profileId)
    .maybeSingle();

  if (!alvo) return { ok: false, erro: "Usuário não encontrado." };
  if (
    ctx.profile.role !== "super_admin" &&
    alvo.organization_id !== ctx.profile.organization_id
  ) {
    return { ok: false, erro: "Esse usuário não é da sua clínica." };
  }
  if (alvo.role === "super_admin") {
    return { ok: false, erro: "Não é possível alterar a equipe Medi Marketing." };
  }

  const { error } = await ctx.supabase
    .from("profiles")
    .update({ role: papel })
    .eq("id", profileId);

  if (error) return { ok: false, erro: "Não foi possível alterar o papel." };

  revalidar();
  return { ok: true };
}

/** Desliga (ou reativa) alguém sem apagar o histórico do que essa pessoa fez. */
export async function alternarAtivo(
  profileId: string,
  ativo: boolean
): Promise<ActionResult> {
  const ctx = await contexto(GESTAO);
  if (ctx.estado !== "ok") return bloqueio(ctx);

  if (profileId === ctx.profile.id) {
    return { ok: false, erro: "Você não pode desativar a si mesmo." };
  }

  const { error } = await ctx.supabase
    .from("profiles")
    .update({ ativo })
    .eq("id", profileId);

  if (error) return { ok: false, erro: "Não foi possível atualizar o acesso." };

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
