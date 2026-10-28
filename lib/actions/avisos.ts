"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { bloqueio, contexto, type ActionResult } from "@/lib/actions/contexto";
import { createAdminClient, adminDisponivel } from "@/lib/supabase/admin";
import { LISTA_EVENTOS } from "@/lib/comunicacao/eventos";
import { enfileirar, processarFila } from "@/lib/comunicacao/fila";
import { emailEquipe, MARCA_MEDI } from "@/lib/email-modelos";
import { emailConfigurado } from "@/lib/email";
import { envioAutomatico } from "@/lib/envio";
import { urlPainel } from "@/lib/lembretes";

/**
 * PREFERÊNCIAS DE AVISO, REENVIO E TESTE
 *
 * Cada pessoa muda as próprias preferências; o gestor muda as de
 * qualquer um da clínica dele; a equipe Medi Marketing, as de todos.
 */

const TODOS_PAPEIS = ["super_admin", "gestor", "secretaria", "medico"] as const;
const MSG_SEM_CHAVE = "Falta a SUPABASE_SERVICE_ROLE_KEY nas variáveis de ambiente.";

const canalSchema = z.enum(["painel", "whatsapp", "email"]);

const prefSchema = z.object({
  usuarioId: z.string().min(1),
  canais: z.record(z.array(canalSchema)),
  resumoHora: z.number().int().min(0).max(23),
});

export type PreferenciasInput = z.input<typeof prefSchema>;

export async function salvarPreferencias(input: PreferenciasInput): Promise<ActionResult> {
  const parsed = prefSchema.safeParse(input);
  if (!parsed.success) return { ok: false, erro: "Preferências inválidas." };

  const ctx = await contexto(TODOS_PAPEIS);
  if (ctx.estado !== "ok") return bloqueio(ctx);
  if (!adminDisponivel()) return { ok: false, erro: MSG_SEM_CHAVE };

  const d = parsed.data;
  const admin = createAdminClient();
  const { data: alvo } = await admin
    .from("profiles")
    .select("id,organization_id")
    .eq("id", d.usuarioId)
    .maybeSingle();
  if (!alvo?.organization_id) return { ok: false, erro: "Pessoa não encontrada." };

  const eu = ctx.profile;
  const pode =
    eu.role === "super_admin" ||
    (eu.organization_id === alvo.organization_id && (eu.id === alvo.id || eu.role === "gestor"));
  if (!pode) return { ok: false, erro: "Você não pode mudar os avisos desta pessoa." };

  // Só eventos conhecidos: o resto da gravação é ignorado
  const canais = Object.fromEntries(
    Object.entries(d.canais).filter(([e]) => (LISTA_EVENTOS as string[]).includes(e))
  );

  const { error } = await admin.from("preferencias_aviso").upsert({
    usuario_id: alvo.id,
    organization_id: alvo.organization_id,
    canais,
    resumo_hora: d.resumoHora,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    console.error("[avisos] Erro ao salvar:", error.message);
    return { ok: false, erro: "Não foi possível salvar. O SQL da comunicação já foi rodado?" };
  }

  revalidatePath("/app/perfil");
  revalidatePath("/app/configuracoes");
  return { ok: true };
}

/** Manda de novo uma mensagem que falhou ou foi ignorada. */
export async function reenviarEnvio(id: string): Promise<ActionResult> {
  const ctx = await contexto(["super_admin", "gestor", "secretaria"]);
  if (ctx.estado !== "ok") return bloqueio(ctx);
  if (!adminDisponivel()) return { ok: false, erro: MSG_SEM_CHAVE };

  const admin = createAdminClient();
  const { data: envio } = await admin.from("envios").select("*").eq("id", id).maybeSingle();
  if (!envio) return { ok: false, erro: "Mensagem não encontrada." };
  if (ctx.profile.role !== "super_admin" && envio.organization_id !== ctx.profile.organization_id) {
    return { ok: false, erro: "Essa mensagem não é da sua clínica." };
  }
  if (!["falhou", "ignorado", "cancelado"].includes(envio.status)) {
    return { ok: false, erro: "Só dá para reenviar o que não saiu." };
  }

  // O número da clínica pode ter sido conectado depois da falha
  let payload = envio.payload;
  if (envio.canal === "whatsapp" && envio.organization_id) {
    const { data: org } = await admin
      .from("organizations")
      .select("merge_connection_id")
      .eq("id", envio.organization_id)
      .maybeSingle();
    payload = { ...payload, conexaoId: org?.merge_connection_id ?? null };
  }

  await admin
    .from("envios")
    .update({ status: "pendente", tentativas: 0, erro: null, agendado_para: new Date().toISOString(), payload })
    .eq("id", id);

  await processarFila({ ids: [id] });

  const { data: depois } = await admin.from("envios").select("status,erro").eq("id", id).maybeSingle();
  revalidatePath("/app/configuracoes");
  revalidatePath("/app/clinicas", "layout");

  if (depois?.status === "enviado") return { ok: true };
  return { ok: false, erro: `Não saiu de novo: ${depois?.erro ?? "erro desconhecido"}. Ficou na fila para nova tentativa.` };
}

export type ResultadoTeste =
  | { ok: true; resultados: { canal: string; status: string; erro: string | null }[] }
  | { ok: false; erro: string };

/** Manda um aviso de teste para a própria pessoa, por WhatsApp e e-mail. */
export async function enviarTeste(): Promise<ResultadoTeste> {
  const ctx = await contexto(TODOS_PAPEIS);
  if (ctx.estado !== "ok") {
    const b = bloqueio(ctx);
    return { ok: false, erro: b.ok ? "Sem permissão." : b.erro };
  }
  if (!adminDisponivel()) return { ok: false, erro: MSG_SEM_CHAVE };

  const eu = ctx.profile;
  const admin = createAdminClient();
  const [{ data: conta }, { data: org }] = await Promise.all([
    admin.auth.admin.getUserById(eu.id),
    eu.organization_id
      ? admin.from("organizations").select("nome,merge_connection_id").eq("id", eu.organization_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const email = conta?.user?.email ?? null;
  const conexaoId = org?.merge_connection_id ?? null;
  const chave = `teste:${eu.id}:${Date.now()}`;
  const painel = urlPainel("/app/perfil");
  const nome = eu.nome ?? "você";

  const itens: Parameters<typeof enfileirar>[0] = [];
  const base = {
    organizationId: eu.organization_id,
    evento: "teste",
    publico: "equipe" as const,
    usuarioId: eu.id,
    destinoNome: nome,
  };

  if (email && emailConfigurado()) {
    // Teste é do sistema: sai com a identidade da Medi Marketing
    const m = emailEquipe(MARCA_MEDI, {
      assunto: "Teste de aviso da Medi Marketing",
      faixa: { texto: "Teste de aviso" },
      frase: `Olá, ${nome}! Se este e-mail chegou, os avisos por e-mail estão funcionando.`,
      dados: [["Enviado para", email]],
      botao: { texto: "Ajustar meus avisos", url: painel },
    });
    itens.push({
      ...base,
      canal: "email",
      destino: email,
      assunto: m.assunto,
      conteudo: m.texto,
      payload: { html: m.html, remetenteNome: "Medi Marketing" },
      chave: `${chave}:email`,
    });
  }

  if (eu.telefone && envioAutomatico(conexaoId)) {
    itens.push({
      ...base,
      canal: "whatsapp",
      destino: eu.telefone,
      conteudo: `*Teste de aviso*\n\nOlá, ${nome}! Se esta mensagem chegou, os avisos por WhatsApp${org?.nome ? ` da ${org.nome}` : ""} estão funcionando.`,
      payload: { conexaoId },
      chave: `${chave}:whatsapp`,
    });
  }

  if (!itens.length) {
    return {
      ok: false,
      erro: !eu.telefone
        ? "Cadastre seu telefone em Meu Perfil para testar o WhatsApp. O e-mail também não está configurado."
        : "Nem o WhatsApp da clínica nem o envio de e-mail estão configurados.",
    };
  }

  await enfileirar(itens);

  const { data: envios } = await admin.from("envios").select("canal,status,erro").like("chave", `${chave}:%`);
  return {
    ok: true,
    resultados: (envios ?? []).map((e) => ({ canal: e.canal, status: e.status, erro: e.erro })),
  };
}
