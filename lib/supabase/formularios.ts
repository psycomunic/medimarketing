import "server-only";

import { createClient } from "@/lib/supabase/server";
import { emModoDemo } from "@/lib/supabase/queries";
import { DEMO_ORGANIZACOES } from "@/lib/demo";
import { DEMO_MODELO, demoRespostas } from "@/lib/formularios/demo";
import type {
  FormularioEvento,
  FormularioModelo,
  FormularioNota,
  FormularioResposta,
  Profile,
} from "@/lib/supabase/types";

/**
 * Leitura dos formulários (diagnóstico da clínica).
 *
 * A RLS decide quem vê o quê: a clínica só alcança as próprias
 * respostas, e notas e histórico só existem para a equipe. Aqui não há
 * filtro de segurança, só de conveniência.
 */

export type FormularioComModelo = {
  resposta: FormularioResposta;
  modelo: FormularioModelo;
};

/** O formulário liberado para a clínica de quem está logado. */
export async function getMeuFormulario(
  profile: Profile,
  slug: string
): Promise<FormularioComModelo | null> {
  if (await emModoDemo()) {
    return { resposta: demoRespostas()[0], modelo: DEMO_MODELO };
  }
  if (!profile.organization_id) return null;

  const supabase = await createClient();
  const { data: modelos } = await supabase
    .from("formularios_modelos")
    .select("*")
    .eq("slug", slug);
  if (!modelos?.length) return null;

  const { data: resposta } = await supabase
    .from("formularios_respostas")
    .select("*")
    .eq("organization_id", profile.organization_id)
    .in(
      "modelo_id",
      modelos.map((m) => m.id)
    )
    .maybeSingle();
  if (!resposta) return null;

  const modelo = modelos.find((m) => m.id === resposta.modelo_id);
  return modelo ? { resposta, modelo } : null;
}

export type LinhaListaFormulario = FormularioResposta & {
  clinica: string;
  modelo_titulo: string;
};

/** Todas as respostas, para a equipe. */
export async function getFormulariosAdmin(): Promise<LinhaListaFormulario[]> {
  if (await emModoDemo()) {
    return demoRespostas().map((r) => ({
      ...r,
      clinica: DEMO_ORGANIZACOES.find((o) => o.id === r.organization_id)?.nome ?? "Clínica",
      modelo_titulo: DEMO_MODELO.titulo,
    }));
  }

  const supabase = await createClient();
  const [{ data: respostas }, { data: orgs }, { data: modelos }] = await Promise.all([
    supabase
      .from("formularios_respostas")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(500),
    supabase.from("organizations").select("id,nome"),
    supabase.from("formularios_modelos").select("id,titulo"),
  ]);

  const nomeOrg = new Map((orgs ?? []).map((o) => [o.id, o.nome]));
  const tituloModelo = new Map((modelos ?? []).map((m) => [m.id, m.titulo]));

  return (respostas ?? []).map((r) => ({
    ...r,
    clinica: nomeOrg.get(r.organization_id) ?? "Clínica removida",
    modelo_titulo: tituloModelo.get(r.modelo_id) ?? "Formulário",
  }));
}

export type NotaComAutor = FormularioNota & { autor: string | null };
export type EventoComAutor = FormularioEvento & { autor: string | null };

export type DetalheFormulario = FormularioComModelo & {
  clinica: string;
  notas: NotaComAutor[];
  eventos: EventoComAutor[];
  revisor: string | null;
};

export async function getFormularioAdmin(id: string): Promise<DetalheFormulario | null> {
  if (await emModoDemo()) {
    const r = demoRespostas().find((x) => x.id === id);
    if (!r) return null;
    return {
      resposta: r,
      modelo: DEMO_MODELO,
      clinica: DEMO_ORGANIZACOES.find((o) => o.id === r.organization_id)?.nome ?? "Clínica",
      notas: [
        {
          id: "demo-nota",
          resposta_id: r.id,
          autor_id: null,
          autor: "Equipe Medi Marketing",
          texto: "Conferir na call se a receita de toxina já está dentro do faturamento total.",
          created_at: r.updated_at,
        },
      ],
      eventos: [
        { id: "demo-ev", resposta_id: r.id, autor_id: null, autor: null, tipo: "liberado", created_at: r.created_at },
      ],
      revisor: null,
    };
  }

  const supabase = await createClient();
  const { data: resposta } = await supabase
    .from("formularios_respostas")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!resposta) return null;

  const [{ data: modelo }, { data: org }, { data: notas }, { data: eventos }] =
    await Promise.all([
      supabase.from("formularios_modelos").select("*").eq("id", resposta.modelo_id).single(),
      supabase.from("organizations").select("nome").eq("id", resposta.organization_id).maybeSingle(),
      supabase
        .from("formularios_notas")
        .select("*")
        .eq("resposta_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("formularios_eventos")
        .select("*")
        .eq("resposta_id", id)
        .order("created_at", { ascending: false }),
    ]);
  if (!modelo) return null;

  const autores = new Set<string>();
  for (const x of [...(notas ?? []), ...(eventos ?? [])]) if (x.autor_id) autores.add(x.autor_id);
  if (resposta.revisado_por) autores.add(resposta.revisado_por);

  const nomes = new Map<string, string>();
  if (autores.size) {
    const { data: perfis } = await supabase
      .from("profiles")
      .select("id,nome")
      .in("id", [...autores]);
    for (const p of perfis ?? []) if (p.nome) nomes.set(p.id, p.nome);
  }
  const nome = (id: string | null) => (id ? nomes.get(id) ?? null : null);

  return {
    resposta,
    modelo,
    clinica: org?.nome ?? "Clínica",
    notas: (notas ?? []).map((n) => ({ ...n, autor: nome(n.autor_id) })),
    eventos: (eventos ?? []).map((e) => ({ ...e, autor: nome(e.autor_id) })),
    revisor: nome(resposta.revisado_por),
  };
}

/** Clínicas ativas, para o seletor de "liberar diagnóstico". */
export async function getClinicasParaLiberar(): Promise<{ id: string; nome: string }[]> {
  if (await emModoDemo()) return DEMO_ORGANIZACOES.map((o) => ({ id: o.id, nome: o.nome }));

  const supabase = await createClient();
  const { data } = await supabase
    .from("organizations")
    .select("id,nome")
    .eq("ativo", true)
    .order("nome");
  return data ?? [];
}
