"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  bloqueio,
  contexto,
  organizacaoAlvo,
  OPERACIONAL,
  type ActionResult,
} from "@/lib/actions/contexto";
import type { EtapaFunil, StatusLead } from "@/lib/supabase/types";

const ETAPAS = [
  "novo",
  "em_contato",
  "agendado",
  "compareceu",
  "em_tratamento",
  "perdido",
] as const;

function revalidar() {
  revalidatePath("/app/crm");
  revalidatePath("/app/atendimento");
  revalidatePath("/app");
}

/* ------------------------------------------------------------------ */
/* Lead                                                                */
/* ------------------------------------------------------------------ */

const leadSchema = z.object({
  id: z.string().optional(),
  organizationId: z.string().optional(),
  nome: z.string().trim().min(2, "Informe o nome do lead."),
  whatsapp: z.string().trim().min(8, "Informe um WhatsApp válido."),
  email: z.string().trim().email("E-mail inválido.").optional().or(z.literal("")),
  cidade: z.string().trim().max(120).optional().or(z.literal("")),
  origem: z.string().trim().max(60).optional().or(z.literal("")),
  etapa: z.enum(ETAPAS),
  responsavelId: z.string().optional().or(z.literal("")),
  valorEstimado: z.number().min(0).max(1_000_000).optional(),
  tags: z.array(z.string().trim().min(1).max(30)).max(8).optional(),
  proximoContato: z.string().optional().or(z.literal("")),
  mensagem: z.string().trim().max(2000).optional().or(z.literal("")),
  motivoPerda: z.string().trim().max(500).optional().or(z.literal("")),
});

export type LeadInput = z.input<typeof leadSchema>;

/** Cria ou atualiza um lead do funil. */
export async function salvarLead(input: LeadInput): Promise<ActionResult> {
  const parsed = leadSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.errors[0]?.message ?? "Dados inválidos" };
  }

  const ctx = await contexto(OPERACIONAL);
  if (ctx.estado !== "ok") return bloqueio(ctx);

  const d = parsed.data;
  const orgId = organizacaoAlvo(ctx.profile, d.organizationId);
  if (!orgId) return { ok: false, erro: "Selecione a clínica do lead." };

  // Perder um lead encerra o card; voltar para o funil o reabre.
  const perdido = d.etapa === "perdido";
  const status: StatusLead = perdido
    ? "perdido"
    : d.etapa === "em_tratamento"
      ? "ganho"
      : "aberto";

  const registro = {
    organization_id: orgId,
    nome: d.nome,
    whatsapp: d.whatsapp,
    email: d.email || null,
    cidade: d.cidade || null,
    origem: d.origem || "manual",
    etapa_funil: d.etapa as EtapaFunil,
    status,
    responsavel_id: d.responsavelId || null,
    valor_estimado: d.valorEstimado ?? null,
    tags: d.tags ?? [],
    proximo_contato: d.proximoContato ? new Date(d.proximoContato).toISOString() : null,
    mensagem: d.mensagem || null,
    motivo_perda: perdido ? d.motivoPerda || null : null,
  };

  const { error } = d.id
    ? await ctx.supabase.from("leads").update(registro).eq("id", d.id)
    : await ctx.supabase.from("leads").insert({
        ...registro,
        especialidade: null,
        faturamento_medio: null,
        tem_equipe_comercial: null,
        // Cadastro manual: quem digita já teve o contato autorizado
        consentimento_lgpd: true,
      });

  if (error) {
    console.error("[crm] Erro ao salvar lead:", error.message);
    return { ok: false, erro: "Não foi possível salvar o lead." };
  }

  revalidar();
  return { ok: true };
}

/**
 * Move o lead de etapa.
 *
 * Chegar em "em tratamento" marca o lead como ganho e cair em "perdido"
 * o encerra — é o que mantém o painel de conversão coerente sem exigir
 * que a secretária lembre de mudar dois campos.
 */
export async function moverEtapa(
  id: string,
  etapa: EtapaFunil,
  motivoPerda?: string
): Promise<ActionResult> {
  if (!ETAPAS.includes(etapa)) return { ok: false, erro: "Etapa inválida." };

  const ctx = await contexto(OPERACIONAL);
  if (ctx.estado !== "ok") return bloqueio(ctx);

  const status: StatusLead =
    etapa === "perdido" ? "perdido" : etapa === "em_tratamento" ? "ganho" : "aberto";

  const { error } = await ctx.supabase
    .from("leads")
    .update({
      etapa_funil: etapa,
      status,
      motivo_perda: etapa === "perdido" ? motivoPerda?.trim() || null : null,
      ultimo_contato: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { ok: false, erro: "Não foi possível mover o lead." };

  revalidar();
  return { ok: true };
}

export async function excluirLead(id: string): Promise<ActionResult> {
  const ctx = await contexto(OPERACIONAL);
  if (ctx.estado !== "ok") return bloqueio(ctx);

  const { error } = await ctx.supabase.from("leads").delete().eq("id", id);
  if (error) return { ok: false, erro: "Não foi possível excluir o lead." };

  revalidar();
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Histórico e tarefas                                                 */
/* ------------------------------------------------------------------ */

const interacaoSchema = z.object({
  leadId: z.string().min(1),
  tipo: z.enum(["nota", "mensagem", "ligacao", "tarefa"]),
  canal: z
    .enum(["whatsapp", "instagram", "facebook", "telefone", "email", "presencial"])
    .optional()
    .or(z.literal("")),
  conteudo: z.string().trim().min(2, "Escreva o que aconteceu.").max(2000),
  venceEm: z.string().optional().or(z.literal("")),
});

export type InteracaoInput = z.input<typeof interacaoSchema>;

/** Registra uma nota, um contato feito ou agenda uma tarefa. */
export async function registrarInteracao(
  input: InteracaoInput
): Promise<ActionResult> {
  const parsed = interacaoSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.errors[0]?.message ?? "Dados inválidos" };
  }

  const ctx = await contexto(OPERACIONAL);
  if (ctx.estado !== "ok") return bloqueio(ctx);

  const d = parsed.data;
  if (d.tipo === "tarefa" && !d.venceEm) {
    return { ok: false, erro: "Informe o prazo da tarefa." };
  }

  // A interação herda a clínica do lead: é o que garante o isolamento
  // quando o super admin registra algo dentro do ambiente do cliente.
  const { data: lead } = await ctx.supabase
    .from("leads")
    .select("organization_id")
    .eq("id", d.leadId)
    .maybeSingle();

  if (!lead?.organization_id) {
    return { ok: false, erro: "Lead não encontrado." };
  }

  const { error } = await ctx.supabase.from("lead_interacoes").insert({
    lead_id: d.leadId,
    organization_id: lead.organization_id,
    autor_id: ctx.profile.id,
    tipo: d.tipo,
    canal: d.canal || null,
    conteudo: d.conteudo,
    vence_em: d.venceEm ? new Date(d.venceEm).toISOString() : null,
  });

  if (error) {
    console.error("[crm] Erro ao registrar interação:", error.message);
    return { ok: false, erro: "Não foi possível registrar." };
  }

  // Nota não é contato; mensagem e ligação são.
  if (d.tipo === "mensagem" || d.tipo === "ligacao") {
    await ctx.supabase
      .from("leads")
      .update({ ultimo_contato: new Date().toISOString() })
      .eq("id", d.leadId);
  }

  revalidar();
  return { ok: true };
}

export async function concluirTarefa(
  id: string,
  concluida: boolean
): Promise<ActionResult> {
  const ctx = await contexto(OPERACIONAL);
  if (ctx.estado !== "ok") return bloqueio(ctx);

  const { error } = await ctx.supabase
    .from("lead_interacoes")
    .update({ concluida })
    .eq("id", id);

  if (error) return { ok: false, erro: "Não foi possível atualizar a tarefa." };

  revalidar();
  return { ok: true };
}
