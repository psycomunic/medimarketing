"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, adminDisponivel } from "@/lib/supabase/admin";
import { emModoDemo } from "@/lib/supabase/queries";
import { pesquisaManual } from "@/lib/avaliacoes";
import { linkWhatsApp } from "@/lib/lembretes";

const respostaSchema = z.object({
  token: z.string().regex(/^[\w-]{20,64}$/),
  nota: z.number().int().min(0).max(10),
  comentario: z.string().trim().max(1000).optional(),
});

/**
 * O paciente responde pela página pública. Sem login: o token é a
 * credencial, e a resposta vale uma vez só.
 */
export async function responderAvaliacao(
  input: z.input<typeof respostaSchema>
): Promise<{ ok: true } | { ok: false; erro: string }> {
  const parsed = respostaSchema.safeParse(input);
  if (!parsed.success) return { ok: false, erro: "Escolha uma nota de 0 a 10." };
  if (!adminDisponivel()) return { ok: false, erro: "Não foi possível registrar agora. Tente mais tarde." };

  const { token, nota, comentario } = parsed.data;
  const { data, error } = await createAdminClient()
    .from("avaliacoes")
    .update({ nota, comentario: comentario || null, respondido_em: new Date().toISOString() })
    .eq("token", token)
    .is("respondido_em", null)
    .select("id");

  if (error) return { ok: false, erro: "Não foi possível registrar agora. Tente mais tarde." };
  // Já respondida: para o paciente, tanto faz — a opinião dele já está lá
  if (!data?.length) return { ok: true };
  revalidatePath("/app");
  return { ok: true };
}

/**
 * Link da pesquisa para a recepção enviar do próprio WhatsApp, quando o
 * envio automático está desligado ou o paciente pediu de novo.
 */
export async function linkPesquisa(
  consultaId: string
): Promise<{ ok: true; link: string; texto: string; whatsapp: string | null } | { ok: false; erro: string }> {
  if (await emModoDemo()) {
    return { ok: false, erro: "Modo demonstração: a pesquisa não é criada. Numa conta de verdade, o WhatsApp abre com a mensagem pronta." };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, erro: "Sessão expirada." };

  // Só segue se quem pede enxerga a consulta (RLS)
  const { data: c } = await supabase.from("consultas").select("id,status").eq("id", consultaId).maybeSingle();
  if (!c) return { ok: false, erro: "Consulta não encontrada." };
  if (c.status !== "realizada") return { ok: false, erro: "A pesquisa é enviada depois da consulta realizada." };

  const r = await pesquisaManual(consultaId);
  if (!r) return { ok: false, erro: "A pesquisa de satisfação ainda não foi ativada no banco. Rode o SQL da atualização." };
  return { ok: true, link: r.link, texto: r.texto, whatsapp: r.telefone ? linkWhatsApp(r.telefone, r.texto) : null };
}
