"use server";

import { createClient } from "@/lib/supabase/server";
import { emModoDemo } from "@/lib/supabase/queries";
import { demoAnexos } from "@/lib/demo";
import type { Anexo } from "@/lib/supabase/types";

const BUCKET = "anexos";
const MSG_DEMO =
  "Modo demonstração: o anexo não é salvo. Conecte o Supabase para armazenar documentos.";

export type AnexoComUrl = Anexo & { url: string | null };

export type AnexoResult =
  | { ok: true; anexo?: AnexoComUrl }
  | { ok: false; erro: string };

async function getUserId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, userId: user?.id };
}

/** Lista os anexos de uma consulta, já com URL assinada para download. */
export async function listarAnexos(consultaId: string): Promise<AnexoComUrl[]> {
  if (await emModoDemo()) {
    // No demo não há URL real; o link é desabilitado no componente.
    return demoAnexos(consultaId).map((a) => ({ ...a, url: null }));
  }

  const { supabase } = await getUserId();
  const { data } = await supabase
    .from("anexos")
    .select("*")
    .eq("consulta_id", consultaId)
    .order("created_at", { ascending: false });

  const anexos = data ?? [];
  // Gera URLs assinadas (bucket privado)
  const comUrl = await Promise.all(
    anexos.map(async (a) => {
      const { data: signed } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(a.caminho, 60 * 60);
      return { ...a, url: signed?.signedUrl ?? null };
    })
  );
  return comUrl;
}

/** Faz upload de um documento e registra o anexo. */
export async function salvarAnexo(
  consultaId: string,
  formData: FormData
): Promise<AnexoResult> {
  if (await emModoDemo()) return { ok: false, erro: MSG_DEMO };

  const { supabase, userId } = await getUserId();
  if (!userId) return { ok: false, erro: "Sessão expirada." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, erro: "Selecione um arquivo válido." };
  }
  if (file.size > 10 * 1024 * 1024) {
    return { ok: false, erro: "Arquivo muito grande (máx. 10 MB)." };
  }

  // Nome de arquivo seguro; path por médico/consulta (exigido pelo RLS de Storage)
  const nomeSeguro = file.name.replace(/[^\w.\-]+/g, "_");
  const caminho = `${userId}/${consultaId}/${crypto.randomUUID()}-${nomeSeguro}`;

  const up = await supabase.storage.from(BUCKET).upload(caminho, file, {
    contentType: file.type || undefined,
    upsert: false,
  });
  if (up.error) return { ok: false, erro: "Falha no upload do arquivo." };

  const { data: inserted, error } = await supabase
    .from("anexos")
    .insert({
      consulta_id: consultaId,
      medico_id: userId,
      nome: file.name,
      caminho,
      tipo: file.type || null,
      tamanho: file.size,
    })
    .select("*")
    .single();

  if (error || !inserted) {
    // Rollback do arquivo se o registro falhar
    await supabase.storage.from(BUCKET).remove([caminho]);
    return { ok: false, erro: "Não foi possível registrar o anexo." };
  }

  const { data: signed } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(caminho, 60 * 60);

  return { ok: true, anexo: { ...inserted, url: signed?.signedUrl ?? null } };
}

/** Remove um anexo (arquivo do Storage + registro). */
export async function removerAnexo(
  id: string,
  caminho: string
): Promise<AnexoResult> {
  if (await emModoDemo()) return { ok: false, erro: MSG_DEMO };

  const { supabase, userId } = await getUserId();
  if (!userId) return { ok: false, erro: "Sessão expirada." };

  await supabase.storage.from(BUCKET).remove([caminho]);
  const { error } = await supabase.from("anexos").delete().eq("id", id);
  if (error) return { ok: false, erro: "Não foi possível remover o anexo." };

  return { ok: true };
}
