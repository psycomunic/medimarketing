import "server-only";
import { createClient } from "@/lib/supabase/server";
import { emModoDemo, getConsultas } from "@/lib/supabase/queries";
import { getReceitas } from "@/lib/supabase/financeiro-dados";
import { pacientesDemo } from "@/lib/supabase/pacientes";
import { demoLeads } from "@/lib/demo";
import { bruto } from "@/lib/financeiro/calculos";
import { intervaloDoFiltro, type Filtro, type Intervalo } from "@/lib/inicio/painel";
import { demoAnuncios, demoOrcamento } from "@/lib/marketing/demo";
import type { AnuncioDiario } from "@/lib/supabase/types";

/**
 * PAINEL DE MÍDIA
 *
 * Junta os números diários das campanhas (Meta e Google) com o que
 * aconteceu depois na clínica: leads no CRM, primeiras consultas,
 * pacientes atendidos e quanto eles pagaram. "Contatos" são leads de
 * formulário mais conversas iniciadas no WhatsApp: para clínica, os dois
 * são gente pedindo atendimento.
 */

export type Plataforma = "meta" | "google";
export const PLATAFORMAS: Plataforma[] = ["meta", "google"];
/** Origem do lead/paciente que conta como vindo de cada plataforma. */
const ORIGENS: Record<Plataforma, string[]> = { meta: ["meta_ads"], google: ["google_ads"] };

export type Totais = {
  investimento: number;
  impressoes: number;
  alcance: number;
  cliques: number;
  leads: number;
  conversas: number;
  contatos: number;
  ctr: number;
  cpc: number;
  cpm: number;
  /** Custo por contato (lead + conversa). */
  cpl: number;
};

export type LinhaCampanha = {
  id: string;
  nome: string;
  plataforma: Plataforma;
  totais: Totais;
  /** Gasto por dia no período, para o minigráfico. */
  serie: number[];
  /** Custo por contato contra o período anterior. */
  variacaoCpl: number | null;
};

export type Atribuicao = {
  leadsCrm: number;
  primeiras: number;
  atendidos: number;
  faturamento: number;
  /** Faturamento ÷ investimento. */
  roas: number | null;
  custoPorPaciente: number | null;
};

export type Alerta = { tom: "critico" | "atencao" | "info"; texto: string };

export type PainelMidia = {
  temDados: boolean;
  intervalo: Intervalo;
  plataforma: Plataforma | null;
  ultimaData: string | null;
  totais: Totais;
  /** Trecho já passado do período contra o mesmo trecho do anterior; nulo sem dados para comparar. */
  comparacao: { atual: Totais; anterior: Totais } | null;
  porPlataforma: Record<Plataforma, Totais>;
  diario: { datas: string[]; investimento: Record<Plataforma, number[]>; contatos: number[] };
  /** Custo por contato por semana (ou por dia, em períodos curtos). */
  cplSerie: { rotulos: string[]; valores: (number | null)[] };
  campanhas: LinhaCampanha[];
  atribuicao: Record<Plataforma, Atribuicao> & { total: Atribuicao };
  orcamento: {
    mes: string;
    diasPassados: number;
    diasNoMes: number;
    linhas: { plataforma: Plataforma; orcado: number; gasto: number; projecao: number }[];
  };
  alertas: Alerta[];
  /** Conta do Meta ligada à clínica pela BM da Medi (dados chegam sozinhos). */
  metaConectado: boolean;
  metaAtualizado: string | null;
};

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const somarDias = (s: string, n: number) => {
  const d = new Date(`${s}T12:00:00`);
  d.setDate(d.getDate() + n);
  return iso(d);
};
const div = (a: number, b: number) => (b > 0 ? a / b : 0);
const reais = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export function somar(linhas: Pick<AnuncioDiario, "investimento" | "impressoes" | "alcance" | "cliques" | "leads" | "conversas">[]): Totais {
  const t = linhas.reduce(
    (a, l) => ({
      investimento: a.investimento + Number(l.investimento),
      impressoes: a.impressoes + Number(l.impressoes),
      alcance: a.alcance + Number(l.alcance),
      cliques: a.cliques + Number(l.cliques),
      leads: a.leads + Number(l.leads),
      conversas: a.conversas + Number(l.conversas),
    }),
    { investimento: 0, impressoes: 0, alcance: 0, cliques: 0, leads: 0, conversas: 0 }
  );
  const contatos = t.leads + t.conversas;
  return {
    ...t,
    contatos,
    ctr: div(t.cliques, t.impressoes) * 100,
    cpc: div(t.investimento, t.cliques),
    cpm: div(t.investimento, t.impressoes) * 1000,
    cpl: div(t.investimento, contatos),
  };
}

async function getAnuncios(orgId: string | null, de: string, ate: string): Promise<AnuncioDiario[]> {
  if (await emModoDemo()) return demoAnuncios().filter((l) => l.data >= de && l.data <= ate);
  if (!orgId) return [];
  const supabase = await createClient();
  const lista: AnuncioDiario[] = [];
  for (let pagina = 0; pagina < 30; pagina++) {
    const { data, error } = await supabase
      .from("anuncios_diarios")
      .select("*")
      .eq("organization_id", orgId)
      .gte("data", de)
      .lte("data", ate)
      .order("data")
      .order("id")
      .range(pagina * 1000, pagina * 1000 + 999);
    if (error) break;
    lista.push(...((data ?? []) as AnuncioDiario[]));
    if (!data || data.length < 1000) break;
  }
  return lista;
}

async function getOrcamento(orgId: string | null, mes: string): Promise<Record<Plataforma, number>> {
  if (await emModoDemo()) return demoOrcamento();
  const vazio = { meta: 0, google: 0 };
  if (!orgId) return vazio;
  const supabase = await createClient();
  const { data } = await supabase.from("orcamentos_midia").select("plataforma,valor").eq("organization_id", orgId).eq("mes", `${mes}-01`);
  for (const o of data ?? []) vazio[o.plataforma as Plataforma] = Number(o.valor);
  return vazio;
}

/** A clínica tem conta do Meta ligada pela BM da Medi? */
async function getConexaoMeta(orgId: string | null): Promise<{ conectado: boolean; atualizado: string | null }> {
  if (await emModoDemo()) return { conectado: true, atualizado: new Date(Date.now() - 2 * 3600_000).toISOString() };
  if (!orgId) return { conectado: false, atualizado: null };
  const supabase = await createClient();
  const { data } = await supabase.from("contas_anuncio").select("ultima_sincronizacao").eq("organization_id", orgId).eq("plataforma", "meta").eq("ativo", true);
  const datas = (data ?? []).map((c) => c.ultima_sincronizacao).filter((x): x is string => !!x).sort();
  return { conectado: !!data?.length, atualizado: datas[datas.length - 1] ?? null };
}

/** Pacientes e leads que vieram dos anúncios, para seguir até o faturamento. */
async function getOrigens(orgId: string | null, desde: string) {
  const todas = [...ORIGENS.meta, ...ORIGENS.google];
  if (await emModoDemo()) {
    const pacientes = (await pacientesDemo()).filter((p) => p.origem && todas.includes(p.origem)).map((p) => ({ id: p.id, nome: p.nome, origem: p.origem! }));
    const leads = demoLeads().filter((l) => l.origem && todas.includes(l.origem) && l.created_at.slice(0, 10) >= desde);
    return { pacientes, leads: leads.map((l) => ({ origem: l.origem!, created_at: l.created_at })) };
  }
  if (!orgId) return { pacientes: [], leads: [] };
  const supabase = await createClient();
  const [{ data: pacientes }, { data: leads }] = await Promise.all([
    supabase.from("pacientes").select("id,nome,origem").eq("organization_id", orgId).in("origem", todas).limit(10000),
    supabase.from("leads").select("origem,created_at").eq("organization_id", orgId).in("origem", todas).gte("created_at", `${desde}T00:00:00-03:00`).limit(10000),
  ]);
  return {
    pacientes: (pacientes ?? []).map((p) => ({ id: p.id as string, nome: p.nome as string, origem: p.origem as string })),
    leads: (leads ?? []) as { origem: string; created_at: string }[],
  };
}

export async function montarPainelMidia(orgId: string | null, filtro: Filtro, plataforma: Plataforma | null): Promise<PainelMidia> {
  const agora = new Date();
  const intervalo = intervaloDoFiltro(filtro, agora);
  const a = iso(intervalo.ini);
  const b = iso(new Date(intervalo.fim.getTime() - 864e5)); // inclusivo
  const hoje = iso(agora);
  const mes = hoje.slice(0, 7);
  const inicioMes = `${mes}-01`;
  const diasNoMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 0).getDate();
  const fimMes = `${mes}-${diasNoMes}`;
  const antA = iso(intervalo.antIni);
  const dias = Math.round((intervalo.fim.getTime() - intervalo.ini.getTime()) / 864e5);
  // Trecho comparável: até hoje, se o período ainda não terminou
  const corte = b < hoje ? b : hoje;
  const diasComparados = Math.max(Math.round((new Date(`${corte}T12:00:00`).getTime() - new Date(`${a}T12:00:00`).getTime()) / 864e5) + 1, 0);
  const antB = somarDias(antA, diasComparados - 1);

  const de = [antA, inicioMes, somarDias(hoje, -14)].sort()[0];
  const ate = [b, fimMes].sort()[1];
  const [todas, orcado, origens, conexao] = await Promise.all([
    getAnuncios(orgId, de, ate),
    getOrcamento(orgId, mes),
    getOrigens(orgId, a),
    getConexaoMeta(orgId),
  ]);
  const linhasTodas = plataforma ? todas.filter((l) => l.plataforma === plataforma) : todas;
  const doPeriodo = linhasTodas.filter((l) => l.data >= a && l.data <= b);
  const ultimaData = todas.reduce<string | null>((m, l) => (!m || l.data > m ? l.data : m), null);

  const totais = somar(doPeriodo);
  const atualComparavel = somar(linhasTodas.filter((l) => l.data >= a && l.data <= corte));
  const ant = linhasTodas.filter((l) => l.data >= antA && l.data <= antB);
  const primeira = linhasTodas.reduce((m, l) => (l.data < m ? l.data : m), "9999-12-31");
  const anterior = ant.length && primeira <= somarDias(antA, 7) && diasComparados > 0 ? somar(ant) : null;
  // A variação compara trechos do mesmo tamanho
  const totaisComparacao = anterior ? atualComparavel : null;

  const porPlataforma = Object.fromEntries(PLATAFORMAS.map((p) => [p, somar(doPeriodo.filter((l) => l.plataforma === p))])) as Record<Plataforma, Totais>;

  /* ---------- Séries ---------- */
  const datas = Array.from({ length: dias }, (_, i) => somarDias(a, i));
  const porDia = new Map<string, AnuncioDiario[]>();
  for (const l of doPeriodo) porDia.set(l.data, [...(porDia.get(l.data) ?? []), l]);
  const diario = {
    datas,
    investimento: Object.fromEntries(
      PLATAFORMAS.map((p) => [p, datas.map((d) => (porDia.get(d) ?? []).filter((l) => l.plataforma === p).reduce((s, l) => s + Number(l.investimento), 0))])
    ) as Record<Plataforma, number[]>,
    contatos: datas.map((d) => (porDia.get(d) ?? []).reduce((s, l) => s + Number(l.leads) + Number(l.conversas), 0)),
  };
  // Custo por contato: semanal acima de 3 semanas, diário abaixo
  const passo = dias > 21 ? 7 : 1;
  const cplSerie = { rotulos: [] as string[], valores: [] as (number | null)[] };
  for (let i = 0; i < datas.length; i += passo) {
    const bloco = datas.slice(i, i + passo).flatMap((d) => porDia.get(d) ?? []);
    const t = somar(bloco);
    cplSerie.rotulos.push(`${datas[i].slice(8, 10)}/${datas[i].slice(5, 7)}`);
    cplSerie.valores.push(t.contatos ? t.cpl : null);
  }

  /* ---------- Campanhas ---------- */
  const grupos = new Map<string, AnuncioDiario[]>();
  for (const l of doPeriodo) grupos.set(`${l.plataforma}|${l.campanha_id}`, [...(grupos.get(`${l.plataforma}|${l.campanha_id}`) ?? []), l]);
  const campanhas: LinhaCampanha[] = [...grupos.entries()]
    .map(([k, ls]) => {
      const [p, id] = k.split("|");
      const nome = ls.reduce((m, l) => (l.data >= m.data ? l : m)).campanha_nome;
      const t = somar(ls);
      const antC = somar(ant.filter((l) => l.plataforma === p && l.campanha_id === id));
      const atualC = somar(ls.filter((l) => l.data <= corte));
      return {
        id,
        nome,
        plataforma: p as Plataforma,
        totais: t,
        serie: datas.map((d) => ls.filter((l) => l.data === d).reduce((s, l) => s + Number(l.investimento), 0)),
        variacaoCpl: anterior && antC.contatos >= 3 && atualC.contatos ? ((atualC.cpl - antC.cpl) / antC.cpl) * 100 : null,
      };
    })
    .sort((x, y) => y.totais.investimento - x.totais.investimento);

  /* ---------- Atribuição: até o paciente e o dinheiro ---------- */
  const [consultasTodas, receitas] = await Promise.all([
    getConsultas(new Date(`${a}T00:00:00-03:00`).toISOString(), new Date(`${b}T23:59:59-03:00`).toISOString()),
    getReceitas(orgId, a, b),
  ]);
  const consultas = orgId ? consultasTodas.filter((c) => c.organization_id === orgId) : consultasTodas;
  const plataformaDaOrigem = (o: string | null | undefined): Plataforma | null =>
    o ? (PLATAFORMAS.find((p) => ORIGENS[p].includes(o)) ?? null) : null;
  const pacPlat = new Map(origens.pacientes.map((p) => [p.id, plataformaDaOrigem(p.origem)]));
  const nomeNorm = (s: string) => s.trim().toLowerCase();
  const pacPorNome = new Map(origens.pacientes.map((p) => [nomeNorm(p.nome), plataformaDaOrigem(p.origem)]));
  const consultaPorId = new Map(consultas.map((c) => [c.id, c]));
  const vazio = (): Atribuicao => ({ leadsCrm: 0, primeiras: 0, atendidos: 0, faturamento: 0, roas: null, custoPorPaciente: null });
  const atrib: Record<Plataforma, Atribuicao> = { meta: vazio(), google: vazio() };
  for (const l of origens.leads) {
    const p = plataformaDaOrigem(l.origem);
    if (p && l.created_at.slice(0, 10) <= b) atrib[p].leadsCrm += 1;
  }
  for (const c of consultas) {
    const p = c.paciente_id ? pacPlat.get(c.paciente_id) : pacPorNome.get(nomeNorm(c.paciente_nome));
    if (!p || c.tipo !== "primeira" || c.status === "cancelada") continue;
    atrib[p].primeiras += 1;
    if (c.status === "realizada") atrib[p].atendidos += 1;
  }
  for (const r of receitas) {
    if (r.status === "cancelado") continue;
    const c = r.consulta_id ? consultaPorId.get(r.consulta_id) : undefined;
    const p = c?.paciente_id ? pacPlat.get(c.paciente_id) : pacPorNome.get(nomeNorm(r.paciente_nome));
    if (p) atrib[p].faturamento += bruto(r);
  }
  for (const p of PLATAFORMAS) {
    const inv = porPlataforma[p].investimento;
    atrib[p].roas = inv > 0 ? atrib[p].faturamento / inv : null;
    atrib[p].custoPorPaciente = atrib[p].atendidos ? inv / atrib[p].atendidos : null;
  }
  const visiveis = plataforma ? [plataforma] : PLATAFORMAS;
  const total = visiveis.reduce<Atribuicao>(
    (s, p) => ({
      leadsCrm: s.leadsCrm + atrib[p].leadsCrm,
      primeiras: s.primeiras + atrib[p].primeiras,
      atendidos: s.atendidos + atrib[p].atendidos,
      faturamento: s.faturamento + atrib[p].faturamento,
      roas: null,
      custoPorPaciente: null,
    }),
    vazio()
  );
  total.roas = totais.investimento > 0 ? total.faturamento / totais.investimento : null;
  total.custoPorPaciente = total.atendidos ? totais.investimento / total.atendidos : null;

  /* ---------- Orçamento do mês ---------- */
  const diasPassados = agora.getDate();
  const doMes = todas.filter((l) => l.data >= inicioMes && l.data <= fimMes);
  const orcamento = {
    mes,
    diasPassados,
    diasNoMes,
    linhas: visiveis.map((p) => {
      const gasto = doMes.filter((l) => l.plataforma === p).reduce((s, l) => s + Number(l.investimento), 0);
      // Ritmo dos dias com dados (o relatório pode estar alguns dias atrás)
      const ultimoDia = Math.max(...doMes.filter((l) => l.plataforma === p).map((l) => Number(l.data.slice(8, 10))), 0);
      const base = Math.max(ultimoDia, 1);
      return { plataforma: p, orcado: orcado[p], gasto, projecao: gasto ? (gasto / base) * diasNoMes : 0 };
    }),
  };

  /* ---------- Alertas ---------- */
  const alertas: Alerta[] = [];
  if (ultimaData && ultimaData < somarDias(hoje, -3))
    alertas.push({ tom: "info", texto: `Os dados vão até ${ultimaData.slice(8, 10)}/${ultimaData.slice(5, 7)}. Importe o relatório mais recente para acompanhar o mês.` });
  if (ultimaData) {
    const u7 = linhasTodas.filter((l) => l.data > somarDias(ultimaData, -7) && l.data <= ultimaData);
    const p7 = linhasTodas.filter((l) => l.data > somarDias(ultimaData, -14) && l.data <= somarDias(ultimaData, -7));
    const tu = somar(u7);
    const tp = somar(p7);
    if (tp.contatos >= 5 && tu.contatos > 0 && tu.cpl > tp.cpl * 1.3)
      alertas.push({ tom: "atencao", texto: `O custo por contato subiu ${Math.round(((tu.cpl - tp.cpl) / tp.cpl) * 100)}% na última semana (${reais(tu.cpl)} contra ${reais(tp.cpl)}).` });
    const cplMedio = totais.cpl || tu.cpl;
    const porCamp = new Map<string, AnuncioDiario[]>();
    for (const l of u7) porCamp.set(`${l.plataforma}|${l.campanha_id}`, [...(porCamp.get(`${l.plataforma}|${l.campanha_id}`) ?? []), l]);
    for (const ls of porCamp.values()) {
      const t = somar(ls);
      if (t.contatos === 0 && t.investimento >= Math.max(cplMedio * 2, 50))
        alertas.push({ tom: "critico", texto: `"${ls[ls.length - 1].campanha_nome}" gastou ${reais(t.investimento)} na última semana sem nenhum contato.` });
    }
  }
  for (const o of orcamento.linhas) {
    if (!o.orcado) continue;
    const nome = o.plataforma === "meta" ? "Meta Ads" : "Google Ads";
    if (o.projecao > o.orcado * 1.1)
      alertas.push({ tom: "atencao", texto: `${nome}: no ritmo atual o mês fecha em ${reais(o.projecao)}, acima do orçamento de ${reais(o.orcado)}.` });
    else if (diasPassados >= 10 && o.projecao < o.orcado * 0.8)
      alertas.push({ tom: "info", texto: `${nome}: no ritmo atual sobram ${reais(o.orcado - o.projecao)} do orçamento do mês.` });
  }

  return {
    temDados: todas.length > 0,
    intervalo,
    plataforma,
    ultimaData,
    totais,
    comparacao: anterior && totaisComparacao ? { atual: totaisComparacao, anterior } : null,
    porPlataforma,
    diario,
    cplSerie,
    campanhas,
    atribuicao: { ...atrib, total },
    orcamento,
    alertas,
    metaConectado: conexao.conectado,
    metaAtualizado: conexao.atualizado,
  };
}
