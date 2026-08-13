"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { bloqueio, contexto, type ActionResult } from "@/lib/actions/contexto";
import { createAdminClient, adminDisponivel } from "@/lib/supabase/admin";
import { urlBase } from "@/lib/lembretes";
import { emailConfigurado, enviarEmail } from "@/lib/email";
import type { PlanoProposta } from "@/lib/supabase/types";

/**
 * PROPOSTAS COMERCIAIS
 *
 * Cada proposta vira uma página com a marca do cliente e os preços
 * daquela conversa. O link é a proposta: nada de PDF que envelhece na
 * caixa de entrada e não conta quem abriu.
 *
 * Só a equipe Medi Marketing opera isto — é material comercial, não
 * função de cliente.
 */
const SOMENTE_EQUIPE = ["super_admin"] as const;

const schema = z.object({
  clienteNome: z.string().trim().min(2, "Informe o nome da clínica ou do médico."),
  clienteLogoUrl: z.string().trim().url("Endereço de logo inválido.").or(z.literal("")),
  especialidade: z.string().trim().max(80).or(z.literal("")),
  cidade: z.string().trim().max(120).or(z.literal("")),
  responsavel: z.string().trim().max(120).or(z.literal("")),
  precoEssencial: z.number().nonnegative().nullable(),
  precoPerformance: z.number().nonnegative().nullable(),
  precoFull: z.number().nonnegative().nullable(),
  planoDestaque: z.enum(["essencial", "performance", "full"]),
  mensagem: z.string().trim().max(600).or(z.literal("")),
  validaAte: z.string().trim().or(z.literal("")),
});

export type PropostaInput = z.input<typeof schema>;

export type ResultadoProposta =
  | { ok: true; url: string; token: string }
  | { ok: false; erro: string };

/** 24 bytes: link curto de digitar e impossível de adivinhar. */
function gerarToken(): string {
  return randomBytes(18).toString("base64url");
}

export async function criarProposta(
  input: PropostaInput
): Promise<ResultadoProposta> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.errors[0]?.message ?? "Dados inválidos" };
  }

  const ctx = await contexto(SOMENTE_EQUIPE);
  if (ctx.estado !== "ok") {
    const b = bloqueio(ctx);
    return { ok: false, erro: b.ok ? "Sem permissão." : b.erro };
  }

  const d = parsed.data;
  const token = gerarToken();

  const { error } = await ctx.supabase.from("propostas").insert({
    token,
    cliente_nome: d.clienteNome,
    cliente_logo_url: d.clienteLogoUrl || null,
    especialidade: d.especialidade || null,
    cidade: d.cidade || null,
    responsavel: d.responsavel || null,
    preco_essencial: d.precoEssencial,
    preco_performance: d.precoPerformance,
    preco_full: d.precoFull,
    plano_destaque: d.planoDestaque,
    mensagem: d.mensagem || null,
    valida_ate: d.validaAte || null,
    vista_em: null,
    respondida_em: null,
    criado_por: ctx.profile.id,
  });

  if (error) {
    console.error("[propostas] Erro ao criar:", error.message);
    return { ok: false, erro: "Não foi possível criar a proposta." };
  }

  revalidatePath("/app/admin/propostas");
  return { ok: true, token, url: `${urlBase()}/proposta/${token}` };
}

export async function removerProposta(id: string): Promise<ActionResult> {
  const ctx = await contexto(SOMENTE_EQUIPE);
  if (ctx.estado !== "ok") return bloqueio(ctx);

  const { error } = await ctx.supabase.from("propostas").delete().eq("id", id);
  if (error) return { ok: false, erro: "Não foi possível remover a proposta." };

  revalidatePath("/app/admin/propostas");
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Ações de quem recebe a proposta                                     */
/* ------------------------------------------------------------------ */

/**
 * Registra que a proposta foi aberta.
 *
 * Chamada pela página pública, sem sessão: a autorização é o token.
 * Só conta a primeira vez em `vista_em` — as reaberturas somam no
 * contador, e é a diferença entre "abriu" e "está estudando" que
 * interessa a quem vende.
 */
export async function registrarVisualizacao(token: string): Promise<void> {
  if (!adminDisponivel() || !token) return;

  const admin = createAdminClient();
  const { data: p } = await admin
    .from("propostas")
    .select("id,status,visualizacoes,vista_em")
    .eq("token", token)
    .maybeSingle();

  if (!p) return;

  await admin
    .from("propostas")
    .update({
      visualizacoes: (p.visualizacoes ?? 0) + 1,
      vista_em: p.vista_em ?? new Date().toISOString(),
      // Quem já respondeu não volta a ser "vista"
      status: p.status === "enviada" ? "vista" : p.status,
    })
    .eq("id", p.id);
}

export type RespostaProposta = "aceita" | "recusada";

/**
 * O cliente responde pela própria página.
 *
 * Aceitar não fecha contrato: sinaliza intenção e avisa a equipe na
 * hora, que é quando a conversa vale mais. Por isso o e-mail sai
 * imediatamente, com o plano escolhido no assunto.
 */
export async function responderProposta(
  token: string,
  resposta: RespostaProposta,
  plano?: PlanoProposta
): Promise<ActionResult> {
  if (!adminDisponivel()) {
    return { ok: false, erro: "Não foi possível registrar agora." };
  }
  if (!["aceita", "recusada"].includes(resposta)) {
    return { ok: false, erro: "Resposta inválida." };
  }

  const admin = createAdminClient();
  const { data: p } = await admin
    .from("propostas")
    .select("id,cliente_nome,responsavel,status")
    .eq("token", token)
    .maybeSingle();

  if (!p) return { ok: false, erro: "Proposta não encontrada." };

  const { error } = await admin
    .from("propostas")
    .update({
      status: resposta,
      respondida_em: new Date().toISOString(),
      ...(plano ? { plano_destaque: plano } : {}),
    })
    .eq("id", p.id);

  if (error) return { ok: false, erro: "Não foi possível registrar sua resposta." };

  await avisarEquipe(p.cliente_nome, p.responsavel, resposta, plano);

  revalidatePath(`/proposta/${token}`);
  revalidatePath("/app/admin/propostas");
  return { ok: true };
}

/** Avisa quem vende, na hora — proposta aceita esfria rápido. */
async function avisarEquipe(
  cliente: string,
  responsavel: string | null,
  resposta: RespostaProposta,
  plano?: PlanoProposta
): Promise<void> {
  const destino = process.env.EMAIL_COMERCIAL ?? "contato@medimarketing.com.br";
  if (!emailConfigurado()) return;

  const aceitou = resposta === "aceita";
  const titulo = aceitou
    ? `${cliente} aceitou a proposta`
    : `${cliente} recusou a proposta`;

  await enviarEmail({
    para: destino,
    assunto: aceitou ? `✅ ${titulo}${plano ? ` — plano ${plano}` : ""}` : titulo,
    html: `
      <div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;
        max-width:520px;margin:0 auto;padding:24px;color:#2E3A40;">
        <h1 style="font-size:19px;color:#0B4F6C;margin:0 0 12px;">${titulo}</h1>
        <p style="margin:0 0 8px;font-size:15px;line-height:1.6;color:#6B7A82;">
          ${responsavel ? `Falado com ${responsavel}. ` : ""}
          ${plano ? `Plano escolhido: <strong>${plano}</strong>.` : ""}
        </p>
        <p style="margin:14px 0 0;font-size:15px;line-height:1.6;color:#6B7A82;">
          ${
            aceitou
              ? "Entre em contato hoje: aceite de proposta esfria em horas."
              : "Vale entender o motivo enquanto a conversa está fresca."
          }
        </p>
      </div>`,
    texto: `${titulo}${plano ? ` (plano ${plano})` : ""}.`,
    remetenteNome: "Medi Marketing",
  });
}

/* ------------------------------------------------------------------ */
/* Logo do cliente                                                     */
/* ------------------------------------------------------------------ */

const TIPOS_IMAGEM = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
const MAX_LOGO = 2 * 1024 * 1024;

export type ResultadoLogo =
  | { ok: true; url: string }
  | { ok: false; erro: string };

/**
 * Sobe a logo do cliente para uma proposta.
 *
 * Vai para o mesmo bucket público das logos de clínica, numa pasta
 * `propostas/` — é material de marca, feito para ser visto por quem
 * abre o link sem ter conta. A pasta é aleatória para que a logo de um
 * prospecto não seja adivinhável a partir da de outro.
 *
 * O cliente da proposta ainda não existe no banco quando a imagem
 * sobe, e é por isso que o caminho não usa o id dela.
 */
export async function salvarLogoProposta(
  formData: FormData
): Promise<ResultadoLogo> {
  const ctx = await contexto(SOMENTE_EQUIPE);
  if (ctx.estado !== "ok") return { ok: false, erro: "Sem permissão." };

  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, erro: "Escolha um arquivo de imagem." };
  }
  if (!TIPOS_IMAGEM.includes(file.type)) {
    return { ok: false, erro: "Use PNG, JPG, WEBP ou SVG." };
  }
  if (file.size > MAX_LOGO) {
    return { ok: false, erro: "A imagem precisa ter no máximo 2 MB." };
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
  const caminho = `propostas/${randomBytes(8).toString("hex")}/logo.${ext}`;

  const { error } = await ctx.supabase.storage
    .from("logos")
    .upload(caminho, file, { contentType: file.type, upsert: true });

  if (error) {
    console.error("[propostas] Falha no upload da logo:", error.message);
    if (/bucket/i.test(error.message)) {
      return {
        ok: false,
        erro: "O bucket de logos não existe. Rode o bloco de logo em supabase/atualizacoes.sql.",
      };
    }
    return { ok: false, erro: "Não foi possível enviar a imagem." };
  }

  const { data } = ctx.supabase.storage.from("logos").getPublicUrl(caminho);
  return { ok: true, url: data.publicUrl };
}
