import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import type {
  Bloqueio,
  Consulta,
  Disponibilidade,
  Profile,
} from "@/lib/supabase/types";
import {
  DEMO_COOKIE,
  DEMO_USER_ID,
  demoProfile,
  demoConsultas,
  demoDisponibilidade,
  demoBloqueios,
} from "@/lib/demo";

/** Indica se as variáveis do Supabase estão configuradas. */
export function supabaseConfigurado() {
  return (
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

/** Sessão de demonstração ativa (sem Supabase + cookie de demo presente). */
export async function emModoDemo(): Promise<boolean> {
  if (supabaseConfigurado()) return false;
  const cookieStore = await cookies();
  return cookieStore.get(DEMO_COOKIE)?.value === "1";
}

/** Retorna o usuário autenticado e o profile associado (ou null). */
export async function getSessao(): Promise<{
  userId: string | null;
  profile: Profile | null;
}> {
  // Modo demonstração: sessão fictícia se o cookie de demo estiver presente
  if (!supabaseConfigurado()) {
    if (await emModoDemo()) {
      return { userId: DEMO_USER_ID, profile: demoProfile };
    }
    return { userId: null, profile: null };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { userId: null, profile: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return { userId: user.id, profile: profile ?? null };
}

/** Consultas do médico logado dentro de um intervalo (ISO). */
export async function getConsultas(
  inicio: string,
  fim: string
): Promise<Consulta[]> {
  if (await emModoDemo()) {
    return demoConsultas()
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

    const lista = demoConsultas().filter(
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
