"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/actions/contexto";
import { adminDisponivel, createAdminClient } from "@/lib/supabase/admin";
import { notificar } from "@/lib/supabase/notificacoes";
import { tokenValido } from "@/lib/supabase/formularios";
import {
  gravarRascunho,
  type RascunhoInput,
  type ResultadoRascunho,
} from "@/lib/formularios/servidor";

/**
 * DIAGNÓSTICO PELO LINK
 *
 * A clínica preenche sem conta: o token do link é a credencial. Toda
 * ação daqui roda com a service role e começa achando o diagnóstico pelo
 * token exato — nenhuma aceita id, para que um link nunca alcance o
 * diagnóstico de outra clínica.
 */

const BUCKET = "diagnosticos";
const MAX_ARQUIVO = 10 * 1024 * 1024;
const TIPOS = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
  "image/png",
  "image/jpeg",
];

const INDISPONIVEL = "Não foi possível acessar o diagnóstico agora. Tente de novo em instantes.";

async function porToken(token: string) {
  if (!adminDisponivel() || !tokenValido(token)) return null;
  const admin = createAdminClient();
  const { data } = await admin
    .from("formularios_respostas")
    .select("id,organization_id,status,modelo_id")
    .eq("token", token)
    .maybeSingle();
  return data ? { admin, r: data } : null;
}

export async function salvarRascunhoLink(
  token: string,
  versao: string,
  input: RascunhoInput
): Promise<ResultadoRascunho> {
  if (!adminDisponivel() || !tokenValido(token)) {
    return { ok: false, erro: "Link inválido." };
  }
  return gravarRascunho(
    createAdminClient(),
    { coluna: "token", valor: token },
    versao,
    input,
    null
  );
}

export async function enviarFormularioLink(token: string): Promise<ActionResult> {
  const achado = await porToken(token);
  if (!achado) return { ok: false, erro: "Link inválido." };
  const { admin, r } = achado;
  if (r.status !== "rascunho") return { ok: false, erro: "Este diagnóstico já foi enviado." };

  const { data: enviado, error } = await admin
    .from("formularios_respostas")
    .update({ status: "enviado", enviado_em: new Date().toISOString() })
    .eq("id", r.id)
    .eq("status", "rascunho")
    .select("id")
    .maybeSingle();
  if (error || !enviado) {
    if (error) console.error("[formulario-link] Erro ao enviar:", error.message);
    return { ok: false, erro: "Não foi possível enviar. Tente de novo em instantes." };
  }

  await admin.from("formularios_eventos").insert({ resposta_id: r.id, tipo: "enviado" });

  const [{ data: org }, { data: modelo }] = await Promise.all([
    admin.from("organizations").select("nome").eq("id", r.organization_id).maybeSingle(),
    admin.from("formularios_modelos").select("titulo").eq("id", r.modelo_id).maybeSingle(),
  ]);

  await notificar({
    organizationId: null,
    tipo: "sistema",
    prioridade: "alta",
    titulo: `${org?.nome ?? "Uma clínica"} enviou o ${(modelo?.titulo ?? "diagnóstico").toLowerCase()}`,
    descricao: "Preenchido pelo link. As respostas estão prontas para revisão.",
    href: `/app/admin/diagnosticos/${r.id}`,
    entidadeId: r.id,
    papeis: ["super_admin"],
  });

  revalidatePath(`/diagnostico/${token}`);
  revalidatePath(`/checkin/${token}`);
  revalidatePath("/app/admin/diagnosticos");
  return { ok: true };
}

export type ResultadoEnvioAnexo =
  | { ok: true; caminho: string; tokenEnvio: string }
  | { ok: false; erro: string };

/**
 * Autoriza o envio de um arquivo.
 *
 * O arquivo não passa pelo servidor: devolvemos uma URL de envio
 * assinada, de uso único, para uma pasta que só este diagnóstico usa.
 * O navegador sobe direto para o Storage.
 */
export async function autorizarAnexoLink(
  token: string,
  nome: string,
  tipo: string,
  tamanho: number
): Promise<ResultadoEnvioAnexo> {
  const achado = await porToken(token);
  if (!achado) return { ok: false, erro: "Link inválido." };
  const { admin, r } = achado;
  if (r.status !== "rascunho") return { ok: false, erro: "O diagnóstico já foi enviado." };
  if (tamanho > MAX_ARQUIVO) return { ok: false, erro: "O limite é 10 MB por arquivo." };
  if (!TIPOS.includes(tipo)) {
    return { ok: false, erro: "Use PDF, planilha (XLSX ou CSV) ou imagem (PNG ou JPG)." };
  }

  const seguro = nome.normalize("NFD").replace(/[^\w.-]+/g, "-").slice(-80) || "arquivo";
  const caminho = `${r.organization_id}/${r.id}/${Date.now()}-${seguro}`;
  const { data, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(caminho);
  if (error || !data) {
    console.error("[formulario-link] Upload não autorizado:", error?.message);
    return { ok: false, erro: INDISPONIVEL };
  }
  return { ok: true, caminho, tokenEnvio: data.token };
}

/** Só caminhos dentro da pasta deste diagnóstico. */
function caminhoDoDiagnostico(r: { id: string; organization_id: string }, caminho: string) {
  return caminho.startsWith(`${r.organization_id}/${r.id}/`) && !caminho.includes("..");
}

export async function removerAnexoLink(token: string, caminho: string): Promise<ActionResult> {
  const achado = await porToken(token);
  if (!achado) return { ok: false, erro: "Link inválido." };
  const { admin, r } = achado;
  if (r.status !== "rascunho" || !caminhoDoDiagnostico(r, caminho)) {
    return { ok: false, erro: "Não é possível remover este arquivo." };
  }
  await admin.storage.from(BUCKET).remove([caminho]);
  return { ok: true };
}

export async function abrirAnexoLink(
  token: string,
  caminho: string
): Promise<{ ok: true; url: string } | { ok: false; erro: string }> {
  const achado = await porToken(token);
  if (!achado || !caminhoDoDiagnostico(achado.r, caminho)) {
    return { ok: false, erro: "Arquivo indisponível." };
  }
  const { data } = await achado.admin.storage.from(BUCKET).createSignedUrl(caminho, 60);
  return data?.signedUrl ? { ok: true, url: data.signedUrl } : { ok: false, erro: "Arquivo indisponível." };
}
