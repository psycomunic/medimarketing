"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { bloqueio, contexto, MSG_DEMO, OPERACIONAL, type ActionResult } from "@/lib/actions/contexto";
import { createAdminClient, adminDisponivel } from "@/lib/supabase/admin";
import { emModoDemo } from "@/lib/supabase/queries";
import { clinicaParaEnvio } from "@/lib/comunicacao/equipe";
import { mergeConfigurado } from "@/lib/merge";
import { emailConfigurado } from "@/lib/email";
import { calcularHorarios, MAX_DESTINATARIOS, montarPublico, processarDisparos } from "@/lib/disparos";
import type { FiltrosPacientes, Situacao } from "@/lib/supabase/pacientes";

const MSG_SEM_SQL = "Os disparos ainda não foram ativados. Rode o SQL da atualização no Supabase.";

const filtrosSchema = z
  .object({
    busca: z.string().max(120).optional(),
    situacao: z.string().max(40).optional(),
    convenio: z.string().max(120).optional(),
    profissional: z.string().max(60).optional(),
    tag: z.string().max(60).optional(),
  })
  .strip();

const publicoSchema = z.object({
  filtros: filtrosSchema,
  canal: z.enum(["whatsapp", "email"]),
  finalidade: z.enum(["marketing", "cuidado"]),
  evitarRecentes: z.boolean().default(true),
});

const paraFiltros = (f: z.infer<typeof filtrosSchema>): FiltrosPacientes => ({
  ...f,
  situacao: (f.situacao || "ativos") as Situacao,
  // Arquivado nunca recebe campanha
  ...(f.situacao === "arquivados" || f.situacao === "todos" ? { situacao: "ativos" as Situacao } : {}),
});

/** Canais que a clínica tem para disparar. */
async function canaisDisponiveis(orgId: string | null) {
  const clinica = orgId ? await clinicaParaEnvio(orgId) : null;
  return {
    whatsapp: mergeConfigurado() && !!clinica?.merge_connection_id,
    email: emailConfigurado(),
  };
}

export type Previa = {
  ok: true;
  total: number;
  elegiveis: number;
  excluidos: { semContato: number; semConsentimento: number; descadastrados: number; recentes: number };
  amostra: string[];
  terminaEm: string | null;
  canais: { whatsapp: boolean; email: boolean };
};

/** Quantos recebem, quantos ficam de fora e quando o envio termina. */
export async function previaDisparo(input: z.input<typeof publicoSchema>): Promise<Previa | { ok: false; erro: string }> {
  const parsed = publicoSchema.safeParse(input);
  if (!parsed.success) return { ok: false, erro: "Escolha o público." };
  const demo = await emModoDemo();
  const ctx = demo ? null : await contexto(OPERACIONAL);
  if (ctx && ctx.estado !== "ok") return { ok: false, erro: ctx.estado === "demo" ? MSG_DEMO : ctx.erro };
  const d = parsed.data;

  const publico = await montarPublico(paraFiltros(d.filtros), d.canal, d.finalidade, d.evitarRecentes);
  if (!publico) return { ok: false, erro: "O banco de pacientes ainda não foi ativado." };
  const n = Math.min(publico.elegiveis.length, MAX_DESTINATARIOS);
  const horarios = n ? calcularHorarios(n, new Date(), d.canal) : [];
  return {
    ok: true,
    total: publico.total,
    elegiveis: publico.elegiveis.length,
    excluidos: publico.excluidos,
    amostra: publico.elegiveis.slice(0, 6).map((p) => p.nome),
    terminaEm: horarios.length ? horarios[horarios.length - 1].toISOString() : null,
    canais: demo ? { whatsapp: true, email: true } : await canaisDisponiveis(ctx && ctx.estado === "ok" ? ctx.profile.organization_id : null),
  };
}

const disparoSchema = publicoSchema.extend({
  nome: z.string().trim().min(3, "Dê um nome ao disparo.").max(120),
  assunto: z.string().trim().max(150).optional(),
  mensagem: z.string().trim().min(10, "Escreva a mensagem.").max(2000, "Mensagem longa demais (até 2.000 caracteres)."),
  segmentoNome: z.string().trim().max(120).optional(),
  inicio: z.string().datetime({ offset: true }).optional().or(z.literal("")),
  confirmo: z.literal(true, { errorMap: () => ({ message: "Confirme que a mensagem respeita a LGPD." }) }),
});

/**
 * Cria o disparo: grava o público com o horário de cada mensagem e já
 * programa o primeiro lote. O resto a rotina programa aos poucos.
 */
export async function criarDisparo(input: z.input<typeof disparoSchema>): Promise<{ ok: true; id: string } | { ok: false; erro: string }> {
  const parsed = disparoSchema.safeParse(input);
  if (!parsed.success) return { ok: false, erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  if (await emModoDemo()) return { ok: false, erro: MSG_DEMO };
  const ctx = await contexto(OPERACIONAL);
  if (ctx.estado !== "ok") return { ok: false, erro: ctx.estado === "demo" ? MSG_DEMO : ctx.erro };
  const orgId = ctx.profile.organization_id;
  if (!orgId) return { ok: false, erro: "Disparos são feitos de dentro da conta da clínica." };
  const d = parsed.data;
  if (d.canal === "email" && !d.assunto) return { ok: false, erro: "Escreva o assunto do e-mail." };
  if (d.finalidade === "cuidado" && /promo|desconto|oferta|condi[cç][aã]o especial|black friday|%/i.test(d.mensagem)) {
    return { ok: false, erro: "Mensagem de cuidado não pode ter oferta ou promoção. Mude a finalidade para “Novidades e promoções”." };
  }

  const canais = await canaisDisponiveis(orgId);
  if (d.canal === "whatsapp" && !canais.whatsapp) {
    return { ok: false, erro: "Conecte o WhatsApp da clínica em Configurações › Mensagens para disparar por WhatsApp." };
  }
  if (d.canal === "email" && !canais.email) return { ok: false, erro: "O envio de e-mail não está configurado." };

  const publico = await montarPublico(paraFiltros(d.filtros), d.canal, d.finalidade, d.evitarRecentes);
  if (!publico) return { ok: false, erro: "O banco de pacientes ainda não foi ativado." };
  if (!publico.elegiveis.length) return { ok: false, erro: "Ninguém deste público pode receber a mensagem." };
  if (publico.elegiveis.length > MAX_DESTINATARIOS) {
    return { ok: false, erro: `O público tem ${publico.elegiveis.length} pacientes. Divida em disparos de até ${MAX_DESTINATARIOS}.` };
  }

  const inicio = d.inicio ? new Date(d.inicio) : new Date();
  const horarios = calcularHorarios(publico.elegiveis.length, inicio, d.canal);
  const { data: disparo, error } = await ctx.supabase
    .from("disparos")
    .insert({
      organization_id: orgId,
      nome: d.nome,
      canal: d.canal,
      finalidade: d.finalidade,
      assunto: d.canal === "email" ? d.assunto ?? null : null,
      mensagem: d.mensagem,
      filtros: Object.fromEntries(Object.entries(d.filtros).filter(([, v]) => v)) as Record<string, string>,
      segmento_nome: d.segmentoNome || null,
      inicio: horarios[0].toISOString(),
      total: publico.elegiveis.length,
      criado_por: ctx.profile.id,
    })
    .select("id")
    .single();
  if (error || !disparo) return { ok: false, erro: error?.code === "42P01" ? MSG_SEM_SQL : "Não foi possível criar o disparo." };

  const linhas = publico.elegiveis.map((p, i) => ({
    disparo_id: disparo.id,
    organization_id: orgId,
    paciente_id: p.id,
    nome: p.nome,
    destino: d.canal === "email" ? p.email!.trim() : p.telefone!,
    token: randomBytes(18).toString("base64url"),
    previsto_para: horarios[i].toISOString(),
  }));
  for (let i = 0; i < linhas.length; i += 500) {
    const { error: e } = await ctx.supabase.from("disparo_destinatarios").insert(linhas.slice(i, i + 500));
    if (e) {
      // Sem público completo, o disparo não sai pela metade
      await ctx.supabase.from("disparos").update({ status: "cancelado", cancelado_em: new Date().toISOString() }).eq("id", disparo.id);
      return { ok: false, erro: "Não foi possível montar a lista de destinatários." };
    }
  }

  // O primeiro lote sai já; o resto, a rotina de 10 em 10 minutos
  await processarDisparos();
  revalidatePath("/app/disparos");
  return { ok: true, id: disparo.id };
}

/** Para o que ainda não saiu. O que já foi programado nos últimos minutos ainda chega. */
export async function cancelarDisparo(id: string): Promise<ActionResult> {
  const ctx = await contexto(OPERACIONAL);
  if (ctx.estado !== "ok") return bloqueio(ctx);
  const { data, error } = await ctx.supabase
    .from("disparos")
    .update({ status: "cancelado", cancelado_em: new Date().toISOString() })
    .eq("id", id)
    .in("status", ["agendado", "enviando"])
    .select("id");
  if (error || !data?.length) return { ok: false, erro: "Este disparo já terminou ou não foi encontrado." };
  await ctx.supabase.from("disparo_destinatarios").update({ status: "cancelado" }).eq("disparo_id", id).eq("status", "pendente");
  revalidatePath("/app/disparos");
  revalidatePath(`/app/disparos/${id}`);
  return { ok: true };
}

/**
 * O paciente pede para não receber mais, pelo link da mensagem. Sem
 * login: o token é a credencial. Vale para todos os disparos da clínica.
 */
export async function descadastrar(token: string): Promise<ActionResult> {
  if (!/^[\w-]{16,64}$/.test(token) || !adminDisponivel()) return { ok: false, erro: "Link inválido." };
  const admin = createAdminClient();
  const { data: dest } = await admin.from("disparo_destinatarios").select("paciente_id").eq("token", token).maybeSingle();
  if (!dest) return { ok: false, erro: "Link inválido ou expirado." };
  await admin
    .from("pacientes")
    .update({ descadastrado_em: new Date().toISOString(), consentimento_marketing: false })
    .eq("id", dest.paciente_id)
    .is("descadastrado_em", null);
  await admin.from("disparo_destinatarios").update({ status: "cancelado" }).eq("paciente_id", dest.paciente_id).eq("status", "pendente");
  return { ok: true };
}
