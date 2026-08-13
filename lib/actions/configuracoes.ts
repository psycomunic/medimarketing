"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  bloqueio,
  contexto,
  organizacaoAlvo,
  GESTAO,
  MARCA,
  type ActionResult,
} from "@/lib/actions/contexto";
import { listarConexoes, mergeConfigurado } from "@/lib/merge";
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
/* WhatsApp pelo Merge                                                 */
/* ------------------------------------------------------------------ */

export type ConexaoDisponivel = {
  id: number;
  nome: string;
  numero: string;
  conectada: boolean;
  /** "meta" avisa a tela sobre a janela de 24h da Cloud API. */
  provedor: string;
};

/**
 * Números de WhatsApp que a conta tem no Merge.
 *
 * Buscados na hora, e não guardados no banco, porque o que interessa é
 * o estado agora: um celular que caiu da conexão continuaria aparecendo
 * como bom se a lista fosse uma cópia.
 */
export async function listarConexoesMerge(): Promise<{
  disponivel: boolean;
  conexoes: ConexaoDisponivel[];
}> {
  const ctx = await contexto(MARCA);
  if (ctx.estado !== "ok") return { disponivel: false, conexoes: [] };
  if (!mergeConfigurado()) return { disponivel: false, conexoes: [] };

  const conexoes = await listarConexoes();
  return {
    disponivel: true,
    conexoes: conexoes.map((c) => ({
      id: c.id,
      nome: c.nome,
      numero: c.numero,
      conectada: c.conectada,
      provedor: c.provedor,
    })),
  };
}

const conexaoSchema = z.object({
  organizationId: z.string().min(1),
  /** Nulo desliga o envio automático e devolve a fila para a recepção. */
  conexaoId: z.number().int().positive().nullable(),
});

/** Define de qual número saem as mensagens desta clínica. */
export async function salvarConexaoMerge(
  input: z.input<typeof conexaoSchema>
): Promise<ActionResult> {
  const parsed = conexaoSchema.safeParse(input);
  if (!parsed.success) return { ok: false, erro: "Conexão inválida." };

  // Mesma régua do nome e da logo: o número é a identidade da clínica
  // no WhatsApp, e quem responde por ela é o profissional.
  const ctx = await contexto(MARCA);
  if (ctx.estado !== "ok") return bloqueio(ctx);

  const orgId = organizacaoAlvo(ctx.profile, parsed.data.organizationId);
  if (!orgId) return { ok: false, erro: "Clínica inválida." };

  // O id vem de uma lista renderizada no cliente: confere se pertence
  // mesmo à conta antes de gravar, senão bastaria adulterar o valor
  // para passar a enviar pelo número de outra empresa.
  if (parsed.data.conexaoId !== null) {
    const conexoes = await listarConexoes();
    if (!conexoes.some((c) => c.id === parsed.data.conexaoId)) {
      return { ok: false, erro: "Esse número não está na conta do Merge." };
    }
  }

  const { error } = await ctx.supabase
    .from("organizations")
    .update({ merge_connection_id: parsed.data.conexaoId })
    .eq("id", orgId);

  if (error) {
    console.error("[configuracoes] Erro ao salvar conexão:", error.message);
    return { ok: false, erro: "Não foi possível salvar o número." };
  }

  revalidar();
  revalidatePath("/app/confirmacoes");
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
