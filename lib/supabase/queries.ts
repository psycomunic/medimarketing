import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import type {
  Bloqueio,
  Consulta,
  Disponibilidade,
  Organization,
  Profile,
} from "@/lib/supabase/types";
import {
  DEMO_COOKIE,
  DEMO_MEDICOS,
  DEMO_ORGANIZACOES,
  demoOrganization,
  demoProfilePorPapel,
  demoConsultasVisiveis,
  demoDisponibilidade,
  demoBloqueios,
  papelDemoValido,
} from "@/lib/demo";

/** Indica se as variáveis do Supabase estão configuradas. */
export function supabaseConfigurado() {
  return (
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

/** Sessão de demonstração ativa (sem Supabase + cookie de demo válido). */
export async function emModoDemo(): Promise<boolean> {
  if (supabaseConfigurado()) return false;
  const cookieStore = await cookies();
  return papelDemoValido(cookieStore.get(DEMO_COOKIE)?.value) !== null;
}

export type Sessao = {
  userId: string | null;
  profile: Profile | null;
  organizacao: Organization | null;
};

/** Retorna o usuário autenticado, o profile e a clínica dele (ou nulos). */
export async function getSessao(): Promise<Sessao> {
  // Modo demonstração: sessão fictícia conforme o papel gravado no cookie
  if (!supabaseConfigurado()) {
    const cookieStore = await cookies();
    const papel = papelDemoValido(cookieStore.get(DEMO_COOKIE)?.value);
    if (!papel) return { userId: null, profile: null, organizacao: null };

    const profile = demoProfilePorPapel(papel);
    return {
      userId: profile.id,
      profile,
      // Super admin não pertence a uma clínica específica
      organizacao: profile.organization_id ? demoOrganization : null,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { userId: null, profile: null, organizacao: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  let organizacao: Organization | null = null;
  if (profile?.organization_id) {
    const { data } = await supabase
      .from("organizations")
      .select("*")
      .eq("id", profile.organization_id)
      .single();
    organizacao = data ?? null;
  }

  return { userId: user.id, profile: profile ?? null, organizacao };
}

/** Consultas visíveis para o usuário logado dentro de um intervalo (ISO). */
export async function getConsultas(
  inicio: string,
  fim: string
): Promise<Consulta[]> {
  if (await emModoDemo()) {
    const { profile } = await getSessao();
    const lista = profile ? demoConsultasVisiveis(profile) : [];
    return lista
      .filter((c) => c.data_hora >= inicio && c.data_hora <= fim)
      .sort((a, b) => a.data_hora.localeCompare(b.data_hora));
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("consultas")
    .select("*")
    .gte("data_hora", inicio)
    .lte("data_hora", fim)
    .order("data_hora", { ascending: true });

  return data ?? [];
}

/** Consulta com o nome da clínica e do profissional, para a agenda filtrável. */
export type ConsultaComContexto = Consulta & {
  organizacao_nome: string | null;
  medico_nome: string | null;
};

/** Opções que alimentam os seletores da barra de filtros. */
export type OpcoesAgenda = {
  clinicas: { id: string; nome: string }[];
  medicos: { id: string; nome: string; organization_id: string | null }[];
  convenios: string[];
};

/**
 * Agenda com o contexto de quem atende e de qual clínica.
 *
 * A RLS já limita o que cada papel enxerga; aqui só resolvemos os nomes
 * para a tela poder filtrar sem uma segunda rodada de requisições.
 */
export async function getAgenda(
  inicio: string,
  fim: string
): Promise<{ consultas: ConsultaComContexto[]; opcoes: OpcoesAgenda }> {
  const consultas = await getConsultas(inicio, fim);

  let nomeOrg = new Map<string, string>();
  let nomeMedico = new Map<string, string>();
  let orgDoMedico = new Map<string, string | null>();

  if (await emModoDemo()) {
    nomeOrg = new Map(DEMO_ORGANIZACOES.map((o) => [o.id, o.nome]));
    nomeMedico = new Map(DEMO_MEDICOS.map((m) => [m.id, m.nome]));
    orgDoMedico = new Map(DEMO_MEDICOS.map((m) => [m.id, m.organization_id]));
  } else if (consultas.length) {
    const supabase = await createClient();
    const orgIds = [...new Set(consultas.map((c) => c.organization_id).filter(Boolean))] as string[];
    const medicoIds = [...new Set(consultas.map((c) => c.medico_id))];

    const [{ data: orgs }, { data: perfis }] = await Promise.all([
      orgIds.length
        ? supabase.from("organizations").select("id,nome").in("id", orgIds)
        : Promise.resolve({ data: [] as { id: string; nome: string }[] }),
      supabase.from("profiles").select("id,nome,organization_id").in("id", medicoIds),
    ]);

    nomeOrg = new Map((orgs ?? []).map((o) => [o.id, o.nome]));
    nomeMedico = new Map((perfis ?? []).map((p) => [p.id, p.nome ?? "Profissional"]));
    orgDoMedico = new Map((perfis ?? []).map((p) => [p.id, p.organization_id]));
  }

  const comContexto: ConsultaComContexto[] = consultas.map((c) => ({
    ...c,
    organizacao_nome: c.organization_id ? nomeOrg.get(c.organization_id) ?? null : null,
    medico_nome: nomeMedico.get(c.medico_id) ?? null,
  }));

  // As opções saem do que está de fato na janela carregada: nada de
  // oferecer um filtro que não devolve nenhuma consulta.
  const clinicas = [...new Set(comContexto.map((c) => c.organization_id).filter(Boolean))]
    .map((id) => ({ id: id as string, nome: nomeOrg.get(id as string) ?? "Clínica" }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  const medicos = [...new Set(comContexto.map((c) => c.medico_id))]
    .map((id) => ({
      id,
      nome: nomeMedico.get(id) ?? "Profissional",
      organization_id: orgDoMedico.get(id) ?? null,
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  const convenios = [...new Set(comContexto.map((c) => c.convenio).filter(Boolean))]
    .sort((a, b) => (a as string).localeCompare(b as string, "pt-BR")) as string[];

  return { consultas: comContexto, opcoes: { clinicas, medicos, convenios } };
}

/** Métricas para os cards do dashboard. */
export async function getResumo(): Promise<{
  hoje: number;
  proximos7: number;
  taxaConfirmacao: number;
  totalMes: number;
}> {
  const agora = new Date();

  // Em modo demo, calcula a partir das consultas fictícias
  if (await emModoDemo()) {
    const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1).toISOString();
    const fimMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 1).toISOString();
    const inicioHoje = new Date(agora); inicioHoje.setHours(0, 0, 0, 0);
    const fimHoje = new Date(inicioHoje); fimHoje.setDate(fimHoje.getDate() + 1);
    const fim7 = new Date(inicioHoje); fim7.setDate(fim7.getDate() + 7);

    const { profile } = await getSessao();
    const lista = (profile ? demoConsultasVisiveis(profile) : []).filter(
      (c) => c.data_hora >= inicioMes && c.data_hora < fimMes
    );
    const hoje = lista.filter((c) => c.data_hora >= inicioHoje.toISOString() && c.data_hora < fimHoje.toISOString()).length;
    const proximos7 = lista.filter((c) => c.data_hora >= inicioHoje.toISOString() && c.data_hora < fim7.toISOString()).length;
    const confirmadas = lista.filter((c) => c.status === "confirmada" || c.status === "realizada").length;
    return {
      hoje,
      proximos7,
      taxaConfirmacao: lista.length ? Math.round((confirmadas / lista.length) * 100) : 0,
      totalMes: lista.length,
    };
  }

  const supabase = await createClient();

  const inicioHoje = new Date(agora);
  inicioHoje.setHours(0, 0, 0, 0);
  const fimHoje = new Date(inicioHoje);
  fimHoje.setDate(fimHoje.getDate() + 1);

  const fim7 = new Date(inicioHoje);
  fim7.setDate(fim7.getDate() + 7);

  const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
  const fimMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 1);

  const { data: doMes } = await supabase
    .from("consultas")
    .select("data_hora,status")
    .gte("data_hora", inicioMes.toISOString())
    .lt("data_hora", fimMes.toISOString());

  const lista = doMes ?? [];
  const hoje = lista.filter(
    (c) => c.data_hora >= inicioHoje.toISOString() && c.data_hora < fimHoje.toISOString()
  ).length;
  const proximos7 = lista.filter(
    (c) => c.data_hora >= inicioHoje.toISOString() && c.data_hora < fim7.toISOString()
  ).length;
  const confirmadas = lista.filter((c) => c.status === "confirmada" || c.status === "realizada").length;
  const taxaConfirmacao = lista.length
    ? Math.round((confirmadas / lista.length) * 100)
    : 0;

  return { hoje, proximos7, taxaConfirmacao, totalMes: lista.length };
}

/** Disponibilidade semanal do médico logado. */
export async function getDisponibilidade(): Promise<Disponibilidade[]> {
  if (await emModoDemo()) return demoDisponibilidade();

  const supabase = await createClient();
  const { data } = await supabase
    .from("disponibilidade")
    .select("*")
    .order("dia_semana", { ascending: true });
  return data ?? [];
}

/** Bloqueios (futuros e recentes) do médico logado. */
export async function getBloqueios(): Promise<Bloqueio[]> {
  if (await emModoDemo()) return demoBloqueios();

  const supabase = await createClient();
  const { data } = await supabase
    .from("bloqueios")
    .select("*")
    .order("data_inicio", { ascending: true });
  return data ?? [];
}
