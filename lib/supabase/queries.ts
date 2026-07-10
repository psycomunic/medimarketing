import { createClient } from "@/lib/supabase/server";
import type {
  Bloqueio,
  Consulta,
  Disponibilidade,
  Profile,
} from "@/lib/supabase/types";

/** Indica se as variáveis do Supabase estão configuradas. */
export function supabaseConfigurado() {
  return (
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

/** Retorna o usuário autenticado e o profile associado (ou null). */
export async function getSessao(): Promise<{
  userId: string | null;
  profile: Profile | null;
}> {
  // Sem Supabase configurado ainda: trata como sessão inexistente
  // (a área logada redireciona para /login em vez de quebrar).
  if (!supabaseConfigurado()) return { userId: null, profile: null };

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
  const supabase = await createClient();
  const agora = new Date();

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
  const supabase = await createClient();
  const { data } = await supabase
    .from("disponibilidade")
    .select("*")
    .order("dia_semana", { ascending: true });
  return data ?? [];
}

/** Bloqueios (futuros e recentes) do médico logado. */
export async function getBloqueios(): Promise<Bloqueio[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("bloqueios")
    .select("*")
    .order("data_inicio", { ascending: true });
  return data ?? [];
}
