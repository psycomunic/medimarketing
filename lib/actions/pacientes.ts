"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { bloqueio, contexto, GESTAO, MSG_DEMO, organizacaoAlvo, type ActionResult } from "@/lib/actions/contexto";
import type { Paciente } from "@/lib/supabase/types";

/** A mesma chave do banco (`chave_telefone`): DDD + 8 últimos dígitos. */
function chaveTelefone(t: string | null | undefined): string | null {
  let d = (t ?? "").replace(/\D/g, "");
  if (d.length >= 12 && d.startsWith("55")) d = d.slice(2);
  if (d.length < 10) return null;
  return d.slice(0, 2) + d.slice(-8);
}

const MSG_SEM_SQL = "O banco de pacientes ainda não foi ativado. Rode o SQL da atualização no Supabase.";

const vazio = z.literal("");
const pacienteSchema = z.object({
  id: z.string().uuid().optional(),
  organizationId: z.string().optional(),
  nome: z.string().trim().min(2, "Informe o nome do paciente.").max(160),
  telefone: z.string().trim().max(30).optional().or(vazio),
  email: z.string().trim().email("E-mail inválido.").optional().or(vazio),
  nascimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data de nascimento inválida.").optional().or(vazio),
  cpf: z.string().trim().max(20).optional().or(vazio),
  sexo: z.enum(["feminino", "masculino", "outro"]).optional().or(vazio),
  cidade: z.string().trim().max(120).optional().or(vazio),
  convenio: z.string().trim().max(80).optional().or(vazio),
  carteirinha: z.string().trim().max(60).optional().or(vazio),
  origem: z.string().trim().max(60).optional().or(vazio),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  observacoes: z.string().trim().max(2000).optional().or(vazio),
  consentimentoMarketing: z.boolean().default(false),
  consentimentoCanal: z.string().trim().max(40).optional().or(vazio),
});

export type PacienteInput = z.input<typeof pacienteSchema>;

/** Cria ou atualiza a ficha. O telefone não pode repetir dentro da clínica. */
export async function salvarPaciente(input: PacienteInput): Promise<{ ok: true; id: string } | { ok: false; erro: string }> {
  const parsed = pacienteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const ctx = await contexto();
  if (ctx.estado !== "ok") return { ok: false, erro: ctx.estado === "demo" ? MSG_DEMO : ctx.erro };
  const d = parsed.data;

  let orgId: string | null;
  let anterior: Pick<Paciente, "organization_id" | "consentimento_marketing" | "consentimento_em"> | null = null;
  if (d.id) {
    const { data, error } = await ctx.supabase
      .from("pacientes")
      .select("organization_id,consentimento_marketing,consentimento_em")
      .eq("id", d.id)
      .maybeSingle();
    if (error) return { ok: false, erro: MSG_SEM_SQL };
    if (!data) return { ok: false, erro: "Paciente não encontrado." };
    anterior = data;
    orgId = data.organization_id;
  } else {
    orgId = organizacaoAlvo(ctx.profile, d.organizationId);
    if (!orgId) return { ok: false, erro: "Escolha a clínica do paciente." };
  }

  const chave = chaveTelefone(d.telefone);
  if (chave) {
    let q = ctx.supabase.from("pacientes").select("id,nome").eq("organization_id", orgId).eq("telefone_chave", chave);
    if (d.id) q = q.neq("id", d.id);
    const { data: outro } = await q.maybeSingle();
    if (outro) return { ok: false, erro: `Esse telefone já é de ${outro.nome}. Abra a ficha dele em vez de criar outra.` };
  }

  // O consentimento guarda quando e por onde foi dado; desmarcar apaga o registro
  const consentiu = d.consentimentoMarketing;
  const jaTinha = anterior?.consentimento_marketing ?? false;
  const dados = {
    nome: d.nome,
    telefone: d.telefone || null,
    email: d.email || null,
    nascimento: d.nascimento || null,
    cpf: d.cpf || null,
    sexo: d.sexo || null,
    cidade: d.cidade || null,
    convenio: d.convenio || null,
    carteirinha: d.carteirinha || null,
    origem: d.origem || null,
    tags: [...new Set(d.tags)],
    observacoes: d.observacoes || null,
    consentimento_marketing: consentiu,
    consentimento_em: consentiu ? (jaTinha ? anterior?.consentimento_em ?? new Date().toISOString() : new Date().toISOString()) : null,
    consentimento_canal: consentiu ? d.consentimentoCanal || "presencial" : null,
    ...(consentiu ? { descadastrado_em: null } : {}),
  };

  if (d.id) {
    const { error } = await ctx.supabase.from("pacientes").update(dados).eq("id", d.id);
    if (error) return { ok: false, erro: "Não foi possível salvar a ficha." };
    revalidar(d.id);
    return { ok: true, id: d.id };
  }

  const { data: criado, error } = await ctx.supabase
    .from("pacientes")
    .insert({ ...dados, organization_id: orgId, criado_por: ctx.profile.id })
    .select("id")
    .single();
  if (error || !criado) return { ok: false, erro: error?.code === "42P01" ? MSG_SEM_SQL : "Não foi possível cadastrar o paciente." };
  revalidar();
  return { ok: true, id: criado.id };
}

/** Arquivar tira da lista principal sem apagar o histórico. */
export async function arquivarPaciente(id: string, ativo: boolean): Promise<ActionResult> {
  const ctx = await contexto();
  if (ctx.estado !== "ok") return bloqueio(ctx);
  const { error } = await ctx.supabase.from("pacientes").update({ ativo }).eq("id", id);
  if (error) return { ok: false, erro: "Não foi possível atualizar a ficha." };
  revalidar(id);
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Importação                                                          */
/* ------------------------------------------------------------------ */

const linhaSchema = z.object({
  nome: z.string().trim().min(2).max(160),
  telefone: z.string().trim().max(30).optional(),
  email: z.string().trim().max(160).optional(),
  nascimento: z.string().trim().optional(),
  cpf: z.string().trim().max(20).optional(),
  cidade: z.string().trim().max(120).optional(),
  convenio: z.string().trim().max(80).optional(),
  origem: z.string().trim().max(60).optional(),
  observacoes: z.string().trim().max(2000).optional(),
});

export type LinhaImportacao = z.input<typeof linhaSchema>;
export type ResultadoImportacao =
  | { ok: true; criados: number; repetidos: number; invalidos: number }
  | { ok: false; erro: string };

/** "31/12/1990", "1990-12-31" ou "31-12-1990" viram "1990-12-31". */
function dataIso(t?: string): string | null {
  if (!t) return null;
  const s = t.trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
}

/**
 * Importa uma planilha já lida no navegador. Telefone que já existe na
 * clínica (ou repetido na própria planilha) não cria ficha nova.
 * Quem vem da planilha entra sem consentimento de marketing.
 */
export async function importarPacientes(linhas: LinhaImportacao[], organizationId?: string): Promise<ResultadoImportacao> {
  if (!Array.isArray(linhas) || !linhas.length) return { ok: false, erro: "A planilha está vazia." };
  if (linhas.length > 5000) return { ok: false, erro: "Importe no máximo 5.000 pacientes por vez." };
  const ctx = await contexto();
  if (ctx.estado !== "ok") return { ok: false, erro: ctx.estado === "demo" ? MSG_DEMO : ctx.erro };
  if (ctx.profile.role === "medico") return { ok: false, erro: "Peça ao dono ou ao atendimento para importar a planilha." };
  const orgId = organizacaoAlvo(ctx.profile, organizationId);
  if (!orgId) return { ok: false, erro: "Escolha a clínica dos pacientes." };

  const { data: existentes, error } = await ctx.supabase
    .from("pacientes")
    .select("telefone_chave,nome")
    .eq("organization_id", orgId)
    .limit(50000);
  if (error) return { ok: false, erro: MSG_SEM_SQL };
  const chaves = new Set((existentes ?? []).map((p) => p.telefone_chave).filter(Boolean) as string[]);
  // Sem telefone, só o nome identifica: evita duplicar quem já está lá
  const nomesSemTel = new Set((existentes ?? []).filter((p) => !p.telefone_chave).map((p) => p.nome.trim().toLowerCase()));

  let invalidos = 0;
  let repetidos = 0;
  const novos: Record<string, unknown>[] = [];
  for (const bruta of linhas) {
    const r = linhaSchema.safeParse(bruta);
    if (!r.success) {
      invalidos++;
      continue;
    }
    const l = r.data;
    const chave = chaveTelefone(l.telefone);
    const nomeChave = l.nome.trim().toLowerCase();
    if (chave ? chaves.has(chave) : nomesSemTel.has(nomeChave)) {
      repetidos++;
      continue;
    }
    if (chave) chaves.add(chave);
    else nomesSemTel.add(nomeChave);
    const email = l.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(l.email) ? l.email : null;
    novos.push({
      organization_id: orgId,
      nome: l.nome,
      telefone: l.telefone || null,
      email,
      nascimento: dataIso(l.nascimento),
      cpf: l.cpf || null,
      cidade: l.cidade || null,
      convenio: l.convenio || null,
      origem: l.origem || "importacao",
      observacoes: l.observacoes || null,
      criado_por: ctx.profile.id,
    });
  }

  for (let i = 0; i < novos.length; i += 500) {
    const { error: e } = await ctx.supabase.from("pacientes").insert(novos.slice(i, i + 500) as never);
    if (e) return { ok: false, erro: `Parou na linha ${i + 1}: ${e.message}` };
  }
  revalidar();
  return { ok: true, criados: novos.length, repetidos, invalidos };
}

/* ------------------------------------------------------------------ */
/* Duplicados                                                          */
/* ------------------------------------------------------------------ */

/**
 * Junta fichas da mesma pessoa: as consultas passam para a ficha que
 * fica, os campos vazios dela são completados e as etiquetas somadas.
 * Só o dono faz, porque apagar ficha não tem volta.
 */
export async function juntarPacientes(manterId: string, removerIds: string[]): Promise<ActionResult> {
  const ids = [...new Set(removerIds)].filter((i) => i && i !== manterId);
  if (!ids.length) return { ok: false, erro: "Escolha as fichas para juntar." };
  const ctx = await contexto(GESTAO);
  if (ctx.estado !== "ok") return bloqueio(ctx);

  const { data: fichas } = await ctx.supabase.from("pacientes").select("*").in("id", [manterId, ...ids]);
  const manter = fichas?.find((f) => f.id === manterId);
  const remover = (fichas ?? []).filter((f) => f.id !== manterId);
  if (!manter || remover.length !== ids.length) return { ok: false, erro: "Fichas não encontradas." };
  if (remover.some((f) => f.organization_id !== manter.organization_id)) return { ok: false, erro: "As fichas são de clínicas diferentes." };

  const { error: eMover } = await ctx.supabase.from("consultas").update({ paciente_id: manterId }).in("paciente_id", ids);
  if (eMover) return { ok: false, erro: "Não foi possível mover as consultas." };

  const campos = ["telefone", "email", "nascimento", "cpf", "sexo", "cidade", "convenio", "carteirinha", "origem", "lead_id", "observacoes"] as const;
  const completar: Partial<Paciente> = {};
  for (const c of campos) {
    if (manter[c]) continue;
    const de = remover.find((f) => f[c]);
    if (de) (completar as Record<string, unknown>)[c] = de[c];
  }
  const tags = [...new Set([...(manter.tags ?? []), ...remover.flatMap((f) => f.tags ?? [])])];
  const consentiu = manter.consentimento_marketing || remover.some((f) => f.consentimento_marketing && !f.descadastrado_em);

  // Apaga antes de completar: o telefone que vem da ficha removida não pode colidir com ela
  const { error: eApagar } = await ctx.supabase.from("pacientes").delete().in("id", ids);
  if (eApagar) return { ok: false, erro: "Não foi possível apagar as fichas repetidas." };
  await ctx.supabase
    .from("pacientes")
    .update({
      ...completar,
      tags,
      consentimento_marketing: consentiu && !manter.descadastrado_em,
      consentimento_em: manter.consentimento_em ?? remover.find((f) => f.consentimento_em)?.consentimento_em ?? null,
    })
    .eq("id", manterId);

  revalidar(manterId);
  revalidatePath("/app/pacientes/duplicados");
  return { ok: true };
}

function revalidar(id?: string) {
  revalidatePath("/app/pacientes");
  if (id) revalidatePath(`/app/pacientes/${id}`);
}
