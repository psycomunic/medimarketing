import "server-only";

import { createClient } from "@/lib/supabase/server";
import { emModoDemo, getSessao } from "@/lib/supabase/queries";
import { pacientesDemo } from "@/lib/supabase/pacientes";
import { DEMO_ORG_ID, DEMO_USER_ID } from "@/lib/demo";
import type { NotaPaciente, SegmentoPacientes, TarefaPaciente } from "@/lib/supabase/types";

/**
 * FOLLOW-UP
 *
 * Tarefas com data e responsável e anotações livres, sempre presas a um
 * paciente. A RLS deixa cada um ver o que vê na ficha, e o responsável
 * sempre vê as próprias tarefas.
 */

export type Aba = "atrasadas" | "hoje" | "proximas" | "concluidas";

export type TarefaComPaciente = TarefaPaciente & {
  paciente: { id: string; nome: string; telefone: string | null } | null;
};

/** Data de hoje em Brasília, no formato da coluna `vencimento`. */
export const hojeSP = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

export async function getTarefas(opcoes: { aba: Aba; minhas: boolean }): Promise<{ instalado: boolean; lista: TarefaComPaciente[] }> {
  const hoje = hojeSP();
  if (await emModoDemo()) {
    const { profile } = await getSessao();
    const todas = await tarefasDemo();
    return {
      instalado: true,
      lista: todas.filter((t) => naAba(t, opcoes.aba, hoje) && (!opcoes.minhas || t.responsavel_id === profile?.id)),
    };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let q = supabase.from("paciente_tarefas").select("*");
  if (opcoes.aba === "concluidas") q = q.eq("status", "feita").order("concluida_em", { ascending: false }).limit(100);
  else {
    q = q.eq("status", "aberta");
    if (opcoes.aba === "atrasadas") q = q.lt("vencimento", hoje).order("vencimento");
    if (opcoes.aba === "hoje") q = q.eq("vencimento", hoje).order("created_at");
    if (opcoes.aba === "proximas") q = q.gt("vencimento", hoje).order("vencimento").limit(200);
  }
  if (opcoes.minhas && user) q = q.eq("responsavel_id", user.id);
  const { data, error } = await q;
  if (error) return { instalado: false, lista: [] };
  return { instalado: true, lista: await comPaciente(data ?? []) };
}

/** Quantas tarefas abertas estão atrasadas e quantas vencem hoje. */
export async function contarTarefas(opcoes: { minhas: boolean }): Promise<{ atrasadas: number; hoje: number } | null> {
  const hoje = hojeSP();
  if (await emModoDemo()) {
    const { profile } = await getSessao();
    const todas = (await tarefasDemo()).filter((t) => !opcoes.minhas || t.responsavel_id === profile?.id);
    return {
      atrasadas: todas.filter((t) => naAba(t, "atrasadas", hoje)).length,
      hoje: todas.filter((t) => naAba(t, "hoje", hoje)).length,
    };
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const base = () => {
    let q = supabase.from("paciente_tarefas").select("id", { count: "exact", head: true }).eq("status", "aberta");
    if (opcoes.minhas && user) q = q.eq("responsavel_id", user.id);
    return q;
  };
  const [a, h] = await Promise.all([base().lt("vencimento", hoje), base().eq("vencimento", hoje)]);
  if (a.error) return null;
  return { atrasadas: a.count ?? 0, hoje: h.count ?? 0 };
}

export async function getFollowupDoPaciente(pacienteId: string): Promise<{ notas: NotaPaciente[]; tarefas: TarefaPaciente[]; instalado: boolean }> {
  if (await emModoDemo()) {
    return {
      instalado: true,
      notas: notasDemo(pacienteId),
      tarefas: (await tarefasDemo()).filter((t) => t.paciente_id === pacienteId),
    };
  }
  const supabase = await createClient();
  const [notas, tarefas] = await Promise.all([
    supabase.from("paciente_notas").select("*").eq("paciente_id", pacienteId).order("created_at", { ascending: false }).limit(200),
    supabase.from("paciente_tarefas").select("*").eq("paciente_id", pacienteId).order("vencimento", { ascending: false }).limit(200),
  ]);
  if (notas.error || tarefas.error) return { instalado: false, notas: [], tarefas: [] };
  return { instalado: true, notas: notas.data ?? [], tarefas: tarefas.data ?? [] };
}

export async function getSegmentos(): Promise<SegmentoPacientes[]> {
  if (await emModoDemo()) {
    return [
      {
        id: "seg-demo-1",
        organization_id: DEMO_ORG_ID,
        nome: "Estética VIP",
        filtros: { tag: "VIP" },
        criado_por: DEMO_USER_ID,
        created_at: new Date().toISOString(),
      },
      {
        id: "seg-demo-2",
        organization_id: DEMO_ORG_ID,
        nome: "Unimed sem retorno",
        filtros: { convenio: "Unimed", situacao: "sem-retorno" },
        criado_por: DEMO_USER_ID,
        created_at: new Date().toISOString(),
      },
    ];
  }
  const supabase = await createClient();
  const { data, error } = await supabase.from("segmentos_pacientes").select("*").order("nome");
  return error ? [] : (data ?? []) as SegmentoPacientes[];
}

/* ------------------------------------------------------------------ */

function naAba(t: TarefaPaciente, aba: Aba, hoje: string) {
  if (aba === "concluidas") return t.status === "feita";
  if (t.status !== "aberta") return false;
  if (aba === "atrasadas") return t.vencimento < hoje;
  if (aba === "hoje") return t.vencimento === hoje;
  return t.vencimento > hoje;
}

async function comPaciente(tarefas: TarefaPaciente[]): Promise<TarefaComPaciente[]> {
  if (!tarefas.length) return [];
  const supabase = await createClient();
  const ids = [...new Set(tarefas.map((t) => t.paciente_id))];
  const { data } = await supabase.from("pacientes").select("id,nome,telefone").in("id", ids);
  const mapa = new Map((data ?? []).map((p) => [p.id, p]));
  return tarefas.map((t) => ({ ...t, paciente: mapa.get(t.paciente_id) ?? null }));
}

/* ---------------------------- Demonstração ---------------------------- */

const diaRel = (dias: number) => {
  const d = new Date(Date.now() - 3 * 3600_000);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
};

const MODELOS: { titulo: string; tipo: TarefaPaciente["tipo"]; dias: number; feita?: boolean }[] = [
  { titulo: "Ligar para saber como está após o procedimento", tipo: "ligar", dias: -2 },
  { titulo: "Enviar orçamento do tratamento de melasma", tipo: "orcamento", dias: -1 },
  { titulo: "Lembrar do retorno de 3 meses", tipo: "retorno", dias: 0 },
  { titulo: "Mandar fotos do antes e depois", tipo: "whatsapp", dias: 0 },
  { titulo: "Confirmar interesse no pacote de sessões", tipo: "whatsapp", dias: 2 },
  { titulo: "Ligar para reagendar a consulta perdida", tipo: "ligar", dias: 3 },
  { titulo: "Retorno da biópsia: avisar o resultado", tipo: "retorno", dias: 6 },
  { titulo: "Enviar orientações pós-consulta", tipo: "whatsapp", dias: -4, feita: true },
  { titulo: "Ligar para pesquisa de satisfação", tipo: "ligar", dias: -6, feita: true },
];

async function tarefasDemo(): Promise<TarefaComPaciente[]> {
  const pacientes = await pacientesDemo();
  const { profile } = await getSessao();
  return MODELOS.map((m, i) => {
    const p = pacientes[(i * 5 + 2) % pacientes.length];
    return {
      id: `tarefa-demo-${i}`,
      organization_id: DEMO_ORG_ID,
      paciente_id: p.id,
      titulo: m.titulo,
      tipo: m.tipo,
      vencimento: diaRel(m.dias),
      // Metade para quem está vendo a demonstração, metade para outra pessoa
      responsavel_id: i % 2 === 0 ? profile?.id ?? DEMO_USER_ID : DEMO_USER_ID,
      status: m.feita ? "feita" : "aberta",
      resultado: m.feita ? "Paciente respondeu, tudo certo." : null,
      concluida_em: m.feita ? `${diaRel(m.dias)}T15:00:00.000Z` : null,
      concluida_por: m.feita ? DEMO_USER_ID : null,
      criado_por: DEMO_USER_ID,
      created_at: `${diaRel(m.dias - 3)}T12:00:00.000Z`,
      paciente: { id: p.id, nome: p.nome, telefone: p.telefone },
    };
  });
}

/** Duas anotações fictícias em toda ficha, para mostrar como fica. */
function notasDemo(pacienteId: string): NotaPaciente[] {
  const nota = (i: number, texto: string, dias: number, fixada = false): NotaPaciente => ({
    id: `nota-demo-${pacienteId}-${i}`,
    organization_id: DEMO_ORG_ID,
    paciente_id: pacienteId,
    autor_id: DEMO_USER_ID,
    texto,
    fixada,
    created_at: `${diaRel(dias)}T14:30:00.000Z`,
  });
  return [
    nota(1, "Prefere horários pela manhã e contato pelo WhatsApp, não por ligação.", -40, true),
    nota(2, "Perguntou sobre o pacote de sessões; ficou de pensar e retornar na próxima semana.", -6),
  ];
}
