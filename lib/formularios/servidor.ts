import "server-only";

import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { progresso, type Respostas } from "@/lib/formularios/tipos";
import type { Database } from "@/lib/supabase/types";

/**
 * Gravação do rascunho, comum ao painel e ao link público.
 *
 * O painel grava com a sessão de quem está logado (a RLS confere a
 * clínica). O link grava com a service role, mas sempre filtrando pelo
 * token exato — é a mesma porta, com chaves diferentes.
 */

/** Teto do JSON de respostas. Texto de questionário não chega perto disso. */
const MAX_BYTES = 400_000;

export const esquemaRascunho = z.object({
  respondenteNome: z.string().max(160),
  respondenteCargo: z.string().max(160),
  dataReferencia: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .or(z.literal("")),
  respostas: z.record(z.unknown()),
});

export type RascunhoInput = z.input<typeof esquemaRascunho>;

export type ResultadoRascunho =
  | { ok: true; versao: string; progresso: number }
  | { ok: false; erro: string; conflito?: boolean; travado?: boolean };

export type Filtro = { coluna: "id" | "token"; valor: string };

/**
 * `versao` é o `updated_at` que a tela conhece. Se o banco tiver um mais
 * novo, outra pessoa salvou nesse meio-tempo, e gravar por cima apagaria
 * o que ela escreveu sem ninguém perceber. Nesse caso nada é gravado e a
 * tela avisa.
 */
export async function gravarRascunho(
  supabase: SupabaseClient<Database>,
  filtro: Filtro,
  versao: string,
  input: RascunhoInput,
  autorId: string | null
): Promise<ResultadoRascunho> {
  const parsed = esquemaRascunho.safeParse(input);
  if (!parsed.success) return { ok: false, erro: "Dados inválidos." };
  const d = parsed.data;

  if (JSON.stringify(d.respostas).length > MAX_BYTES) {
    return { ok: false, erro: "As respostas passaram do tamanho máximo. Resuma os textos mais longos." };
  }

  const { data: atual } = await supabase
    .from("formularios_respostas")
    .select("id,modelo_id,status,updated_at")
    .eq(filtro.coluna, filtro.valor)
    .maybeSingle();
  if (!atual) return { ok: false, erro: "Diagnóstico não encontrado." };
  if (atual.status !== "rascunho") {
    return { ok: false, travado: true, erro: "Este diagnóstico já foi enviado e não aceita alterações." };
  }
  if (atual.updated_at !== versao) {
    return { ok: false, conflito: true, erro: "Outra pessoa alterou este diagnóstico." };
  }

  const { data: modelo } = await supabase
    .from("formularios_modelos")
    .select("schema")
    .eq("id", atual.modelo_id)
    .single();
  const pct = modelo ? progresso(modelo.schema, d.respostas as Respostas) : 0;

  const { data: gravado, error } = await supabase
    .from("formularios_respostas")
    .update({
      respondente_nome: d.respondenteNome.trim() || null,
      respondente_cargo: d.respondenteCargo.trim() || null,
      data_referencia: d.dataReferencia || null,
      respostas: d.respostas as Respostas,
      progresso: pct,
      atualizado_por: autorId,
    })
    .eq("id", atual.id)
    // A trava otimista vai junto no próprio update: entre a leitura acima
    // e esta linha, outra aba pode ter salvo.
    .eq("updated_at", versao)
    .eq("status", "rascunho")
    .select("updated_at")
    .maybeSingle();

  if (error) {
    console.error("[formularios] Erro ao salvar:", error.message);
    return { ok: false, erro: "Não foi possível salvar." };
  }
  if (!gravado) {
    return { ok: false, conflito: true, erro: "Outra pessoa alterou este diagnóstico." };
  }

  return { ok: true, versao: gravado.updated_at, progresso: pct };
}
