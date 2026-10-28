import { createClient } from "@/lib/supabase/server";
import { emModoDemo } from "@/lib/supabase/queries";
import { DEMO_MEDICOS, DEMO_ORGANIZACOES } from "@/lib/demo";
import {
  demoConfigFinanceira,
  demoContratos,
  demoCustosAgencia,
  demoDespesas,
  demoFaturas,
  demoNomeCliente,
  demoPrecos,
  demoReceitas,
  demoRegrasRepasse,
  demoRepassesFechados,
} from "@/lib/demo-financeiro";
import { CONFIG_PADRAO } from "@/lib/financeiro/calculos";
import type {
  ConfigFinanceira,
  Contrato,
  ContratoEvento,
  CustoAgencia,
  Despesa,
  Fatura,
  Lancamento,
  PrecoProcedimento,
  RegraRepasse,
  Repasse,
} from "@/lib/supabase/types";

/**
 * Leitura do financeiro (clínica e agência). Tabelas que ainda não
 * existem (SQL não rodado) devolvem lista vazia: a tela mostra o aviso
 * em vez de quebrar.
 */

const entre = <T extends Record<string, unknown>>(lista: T[], campo: keyof T, de: string, ate: string) =>
  lista.filter((x) => String(x[campo]) >= de && String(x[campo]) <= ate);

export async function getReceitas(orgId: string | null, de: string, ate: string): Promise<Lancamento[]> {
  if (await emModoDemo()) return entre(demoReceitas(), "data_competencia", de, ate);
  if (!orgId) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("lancamentos")
    .select("*")
    .eq("organization_id", orgId)
    .gte("data_competencia", de)
    .lte("data_competencia", ate)
    .order("data_competencia", { ascending: false })
    .limit(5000);
  return (data ?? []) as Lancamento[];
}

/** Receitas ainda não recebidas, de qualquer data (para caixa e atrasos). */
export async function getRecebiveis(orgId: string | null): Promise<Lancamento[]> {
  if (await emModoDemo()) return demoReceitas().filter((l) => l.status === "previsto" || l.status === "atrasado");
  if (!orgId) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("lancamentos")
    .select("*")
    .eq("organization_id", orgId)
    .in("status", ["previsto", "atrasado"])
    .limit(3000);
  return (data ?? []) as Lancamento[];
}

export async function getDespesas(orgId: string | null, de: string, ate: string): Promise<Despesa[]> {
  if (await emModoDemo()) return entre(demoDespesas(), "vencimento", de, ate);
  if (!orgId) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("despesas")
    .select("*")
    .eq("organization_id", orgId)
    .gte("vencimento", de)
    .lte("vencimento", ate)
    .order("vencimento", { ascending: true })
    .limit(3000);
  return (data ?? []) as Despesa[];
}

/** Contas em aberto de qualquer data (vencidas e a vencer). */
export async function getContasAbertas(orgId: string | null): Promise<Despesa[]> {
  if (await emModoDemo()) return demoDespesas().filter((d) => d.status === "aberta");
  if (!orgId) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("despesas")
    .select("*")
    .eq("organization_id", orgId)
    .eq("status", "aberta")
    .order("vencimento", { ascending: true })
    .limit(1000);
  return (data ?? []) as Despesa[];
}

export async function getConfigFinanceira(orgId: string | null): Promise<ConfigFinanceira | null> {
  if (await emModoDemo()) return demoConfigFinanceira();
  if (!orgId) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("config_financeira").select("*").eq("organization_id", orgId).maybeSingle();
  return (data as ConfigFinanceira | null) ?? CONFIG_PADRAO(orgId);
}

export async function getPrecos(orgId: string | null): Promise<PrecoProcedimento[]> {
  if (await emModoDemo()) return demoPrecos();
  if (!orgId) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("tabela_precos")
    .select("*")
    .eq("organization_id", orgId)
    .order("procedimento", { ascending: true });
  return (data ?? []) as PrecoProcedimento[];
}

export async function getRegrasRepasse(orgId: string | null): Promise<RegraRepasse[]> {
  if (await emModoDemo()) return demoRegrasRepasse();
  if (!orgId) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("regras_repasse").select("*").eq("organization_id", orgId);
  return (data ?? []) as RegraRepasse[];
}

export async function getRepasses(orgId: string | null, competencia?: string): Promise<Repasse[]> {
  if (await emModoDemo()) return demoRepassesFechados();
  if (!orgId) return [];
  const supabase = await createClient();
  let q = supabase.from("repasses").select("*").eq("organization_id", orgId);
  if (competencia) q = q.eq("competencia", competencia);
  const { data } = await q.order("competencia", { ascending: false }).limit(500);
  return (data ?? []) as Repasse[];
}

/** Repasses do próprio profissional (a política do banco filtra). */
export async function getMeusRepasses(userId: string): Promise<Repasse[]> {
  if (await emModoDemo()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("repasses")
    .select("*")
    .eq("medico_id", userId)
    .order("competencia", { ascending: false })
    .limit(24);
  return (data ?? []) as Repasse[];
}

/** Profissionais da clínica, id → nome. */
export async function getProfissionais(orgId: string | null): Promise<{ id: string; nome: string; role: string }[]> {
  if (await emModoDemo()) {
    return DEMO_MEDICOS.filter((m) => !orgId || m.organization_id === orgId).map((m) => ({
      id: m.id,
      nome: m.nome,
      role: "medico",
    }));
  }
  if (!orgId) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id,nome,role")
    .eq("organization_id", orgId)
    .in("role", ["medico", "gestor"]);
  return (data ?? []).map((p) => ({ id: p.id, nome: p.nome ?? "Profissional", role: p.role }));
}

/** Diz se o SQL do financeiro já rodou (a tabela de despesas existe). */
export async function financeiroInstalado(): Promise<boolean> {
  if (await emModoDemo()) return true;
  const supabase = await createClient();
  const { error } = await supabase.from("despesas").select("id", { head: true, count: "exact" }).limit(1);
  return !error || !/does not exist|schema cache|relation/i.test(error.message);
}

/* ============================== AGÊNCIA ============================== */

export type ClienteResumo = { id: string; nome: string; logo_url: string | null; plano: string };

export async function getAgencia(): Promise<{
  contratos: Contrato[];
  eventos: ContratoEvento[];
  faturas: Fatura[];
  custos: CustoAgencia[];
  clientes: ClienteResumo[];
}> {
  if (await emModoDemo()) {
    const { contratos, eventos } = demoContratos();
    const ids = new Set(contratos.map((c) => c.organization_id));
    return {
      contratos,
      eventos,
      faturas: demoFaturas(),
      custos: demoCustosAgencia(),
      clientes: [
        ...DEMO_ORGANIZACOES.map((o) => ({ id: o.id, nome: o.nome, logo_url: o.logo_url, plano: o.plano })),
        ...[...ids]
          .filter((id) => !DEMO_ORGANIZACOES.some((o) => o.id === id))
          .map((id) => ({ id, nome: demoNomeCliente(id), logo_url: null, plano: "essencial" })),
      ],
    };
  }
  const supabase = await createClient();
  const [c, e, f, k, o] = await Promise.all([
    supabase.from("contratos").select("*").order("inicio", { ascending: true }),
    supabase.from("contrato_eventos").select("*").order("data", { ascending: true }),
    supabase.from("faturas").select("*").order("vencimento", { ascending: false }).limit(3000),
    supabase.from("custos_agencia").select("*").order("competencia", { ascending: false }).limit(3000),
    supabase.from("organizations").select("id,nome,logo_url,plano").order("nome"),
  ]);
  return {
    contratos: (c.data ?? []) as Contrato[],
    eventos: (e.data ?? []) as ContratoEvento[],
    faturas: (f.data ?? []) as Fatura[],
    custos: (k.data ?? []) as CustoAgencia[],
    clientes: (o.data ?? []) as ClienteResumo[],
  };
}

/** Faturas da própria clínica (gestor vê o que deve à agência). */
export async function getMinhasFaturas(orgId: string | null): Promise<Fatura[]> {
  if (await emModoDemo()) return demoFaturas().filter((f) => f.organization_id === orgId);
  if (!orgId) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("faturas")
    .select("*")
    .eq("organization_id", orgId)
    .order("vencimento", { ascending: false })
    .limit(24);
  return (data ?? []) as Fatura[];
}
