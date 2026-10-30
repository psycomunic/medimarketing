import "server-only";

import { createClient } from "@/lib/supabase/server";
import { emModoDemo, getSessao } from "@/lib/supabase/queries";
import { demoConsultasVisiveis, DEMO_ORG_ID } from "@/lib/demo";
import type { Consulta, Envio, Lancamento, PacienteResumo } from "@/lib/supabase/types";

/**
 * BANCO DE PACIENTES
 *
 * A lista lê a view `pacientes_resumo`, que já traz consultas, faltas,
 * última e próxima visita e quanto o paciente gastou. A RLS decide quem
 * enxerga quem: dono e atendimento, a clínica toda; o médico, quem ele
 * atendeu.
 */

export const POR_PAGINA = 25;
/** Sem consulta realizada há mais que isso e nada marcado: "sem retorno". */
export const MESES_SEM_RETORNO = 6;

export type Situacao =
  | "ativos"
  | "sem-retorno"
  | "novos"
  | "aniversariantes"
  | "arquivados"
  | "todos"
  // Segmentos prontos
  | "primeira-sem-retorno"
  | "faltaram"
  | "promotores"
  | "detratores"
  | "valiosos";

/** Primeira consulta há mais que isso, sem voltar: o paciente não "pegou". */
const DIAS_PRIMEIRA_SEM_RETORNO = 60;
export type Ordem = "recentes" | "nome" | "gasto" | "ultima";

export type FiltrosPacientes = {
  busca?: string;
  situacao?: Situacao;
  convenio?: string;
  profissional?: string;
  tag?: string;
  /** Linha da Tabela de preços: pacientes que já fizeram esse serviço. */
  servico?: string;
  ordem?: Ordem;
  pagina?: number;
};

export type ListaPacientes = {
  instalado: boolean;
  lista: PacienteResumo[];
  total: number;
  /** Para os seletores de filtro. */
  convenios: string[];
  tags: string[];
};

export type NumerosPacientes = {
  total: number;
  ativos12m: number;
  novosMes: number;
  semRetorno: number;
  comConsentimento: number;
};

const corteSemRetorno = () => {
  const d = new Date();
  d.setMonth(d.getMonth() - MESES_SEM_RETORNO);
  return d;
};
const inicioDoMes = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
};
const diasAtras = (n: number) => new Date(Date.now() - n * 86400_000);

/**
 * Pacientes cuja última nota no NPS os coloca no grupo. As notas ficam
 * nas avaliações, ligadas à consulta; sem a tabela, ninguém entra.
 */
async function pacientesPorNota(grupo: "promotores" | "detratores"): Promise<string[]> {
  const supabase = await createClient();
  const { data: notas, error } = await supabase
    .from("avaliacoes")
    .select("consulta_id,nota,respondido_em")
    .not("nota", "is", null)
    .order("respondido_em", { ascending: false })
    .limit(5000);
  if (error || !notas?.length) return [];
  const paciente = new Map<string, string>();
  const ids = notas.map((n) => n.consulta_id);
  for (let i = 0; i < ids.length; i += 500) {
    const { data } = await supabase.from("consultas").select("id,paciente_id").in("id", ids.slice(i, i + 500));
    for (const c of data ?? []) if (c.paciente_id) paciente.set(c.id, c.paciente_id);
  }
  // Vale a nota mais recente de cada paciente
  const ultima = new Map<string, number>();
  for (const n of notas) {
    const p = paciente.get(n.consulta_id);
    if (p && !ultima.has(p)) ultima.set(p, n.nota as number);
  }
  return [...ultima.entries()].filter(([, nota]) => (grupo === "promotores" ? nota >= 9 : nota <= 6)).map(([id]) => id);
}

/** Tira o que quebraria o filtro `or` do PostgREST. */
const limparBusca = (t: string) => t.replace(/[,()*%\\]/g, " ").trim();

export async function getPacientes(f: FiltrosPacientes): Promise<ListaPacientes> {
  if (await emModoDemo()) return filtrarEmMemoria(await pacientesDemo(), f);

  const supabase = await createClient();
  const pagina = Math.max(f.pagina ?? 1, 1);
  const { data, count, error } = await (await consultaFiltrada(supabase, f)).q.range((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA - 1);
  if (error) return { instalado: false, lista: [], total: 0, convenios: [], tags: [] };

  const { data: opcoes } = await supabase.from("pacientes").select("convenio,tags").limit(5000);
  return {
    instalado: true,
    lista: (data ?? []).map(normalizar),
    total: count ?? 0,
    ...opcoesDe(opcoes ?? []),
  };
}

/**
 * Todos os pacientes de um filtro (o público de um disparo), sem paginar
 * a tela. Até 10 mil fichas, lidas de mil em mil.
 */
export async function getPacientesFiltrados(f: FiltrosPacientes): Promise<PacienteResumo[] | null> {
  if (await emModoDemo()) return filtrarEmMemoria(await pacientesDemo(), { ...f, pagina: 1 }, Infinity).lista;
  const supabase = await createClient();
  const lista: PacienteResumo[] = [];
  for (let pagina = 0; pagina < 10; pagina++) {
    const { data, error } = await (await consultaFiltrada(supabase, f)).q.range(pagina * 1000, pagina * 1000 + 999);
    if (error) return pagina ? lista : null;
    lista.push(...(data ?? []).map(normalizar));
    if (!data || data.length < 1000) break;
  }
  return lista;
}

/** A consulta da lista com todos os filtros aplicados, pronta para paginar. */
async function consultaFiltrada(supabase: Awaited<ReturnType<typeof createClient>>, f: FiltrosPacientes) {
  let q = supabase.from("pacientes_resumo").select("*", { count: "exact" });

  const situacao = f.situacao ?? "ativos";
  if (situacao === "arquivados") q = q.eq("ativo", false);
  else if (situacao !== "todos") q = q.eq("ativo", true);
  if (situacao === "sem-retorno") q = q.lt("ultima_consulta", corteSemRetorno().toISOString()).is("proxima_consulta", null);
  if (situacao === "novos") q = q.gte("created_at", inicioDoMes().toISOString());
  if (situacao === "aniversariantes") q = q.eq("mes_nascimento", new Date().getMonth() + 1);
  if (situacao === "primeira-sem-retorno")
    q = q.eq("consultas_realizadas", 1).is("proxima_consulta", null).lt("ultima_consulta", diasAtras(DIAS_PRIMEIRA_SEM_RETORNO).toISOString());
  if (situacao === "faltaram") q = q.gt("faltas", 0).is("proxima_consulta", null);
  if (situacao === "valiosos") q = q.gt("total_gasto", 0);
  if (situacao === "promotores" || situacao === "detratores") {
    const ids = await pacientesPorNota(situacao);
    // Sem ninguém no grupo, um id que não existe devolve a lista vazia
    q = q.in("id", ids.length ? ids.slice(0, 1000) : ["00000000-0000-0000-0000-000000000000"]);
  }

  const busca = limparBusca(f.busca ?? "");
  if (busca) {
    const digitos = busca.replace(/\D/g, "");
    const partes = [`nome.ilike.%${busca}%`, `email.ilike.%${busca}%`];
    if (digitos.length >= 4) partes.push(`telefone_chave.ilike.%${digitos.slice(-8)}%`, `cpf.ilike.%${digitos}%`);
    q = q.or(partes.join(","));
  }
  if (f.convenio) q = q.eq("convenio", f.convenio);
  if (f.profissional) q = q.eq("profissional_principal", f.profissional);
  if (f.tag) q = q.contains("tags", [f.tag]);
  if (f.servico) q = q.contains("servicos", [f.servico]);

  const ordem = f.ordem ?? (situacao === "valiosos" ? "gasto" : "recentes");
  if (ordem === "nome") q = q.order("nome", { ascending: true });
  else if (ordem === "gasto") q = q.order("total_gasto", { ascending: false });
  else if (ordem === "ultima") q = q.order("ultima_consulta", { ascending: false, nullsFirst: false });
  else q = q.order("created_at", { ascending: false });
  // Desempate estável: sem ele, a mesma ficha pode cair em duas páginas.
  // Embrulhado: devolver a consulta solta de uma função async a executaria.
  return { q: q.order("id") };
}

export async function getNumerosPacientes(): Promise<NumerosPacientes | null> {
  if (await emModoDemo()) {
    const lista = await pacientesDemo();
    return numerosEmMemoria(lista);
  }
  const supabase = await createClient();
  const contar = async (aplicar: (q: ReturnType<typeof base>) => ReturnType<typeof base>) => {
    const { count, error } = await aplicar(base());
    return error ? null : count ?? 0;
  };
  const base = () => supabase.from("pacientes_resumo").select("id", { count: "exact", head: true }).eq("ativo", true);
  const umAno = new Date();
  umAno.setFullYear(umAno.getFullYear() - 1);

  const [total, ativos12m, novosMes, semRetorno, comConsentimento] = await Promise.all([
    contar((q) => q),
    contar((q) => q.gte("ultima_consulta", umAno.toISOString())),
    contar((q) => q.gte("created_at", inicioDoMes().toISOString())),
    contar((q) => q.lt("ultima_consulta", corteSemRetorno().toISOString()).is("proxima_consulta", null)),
    contar((q) => q.eq("consentimento_marketing", true).is("descadastrado_em", null)),
  ]);
  if (total === null) return null;
  return {
    total,
    ativos12m: ativos12m ?? 0,
    novosMes: novosMes ?? 0,
    semRetorno: semRetorno ?? 0,
    comConsentimento: comConsentimento ?? 0,
  };
}

export type FichaPaciente = {
  paciente: PacienteResumo;
  consultas: Consulta[];
  receitas: Lancamento[];
  avaliacoes: { consulta_id: string; nota: number; comentario: string | null; respondido_em: string }[];
  mensagens: Pick<Envio, "id" | "evento" | "canal" | "status" | "created_at" | "enviado_em" | "consulta_id">[];
  campanhas: { nome: string; canal: string; quando: string; status: string }[];
};

export async function getFichaPaciente(id: string): Promise<FichaPaciente | null> {
  if (await emModoDemo()) {
    const lista = await pacientesDemo();
    const paciente = lista.find((p) => p.id === id);
    if (!paciente) return null;
    const consultas = (await consultasDemo())
      .filter((c) => chaveDemo(c) === id)
      .sort((a, b) => b.data_hora.localeCompare(a.data_hora));
    return { paciente, consultas, receitas: [], avaliacoes: [], mensagens: [], campanhas: [] };
  }

  const supabase = await createClient();
  const { data: p } = await supabase.from("pacientes_resumo").select("*").eq("id", id).maybeSingle();
  if (!p) return null;
  const { data: consultas } = await supabase
    .from("consultas")
    .select("*")
    .eq("paciente_id", id)
    .order("data_hora", { ascending: false })
    .limit(500);
  const ids = (consultas ?? []).map((c) => c.id);

  const [receitas, avaliacoes, mensagens] = ids.length
    ? await Promise.all([
        supabase.from("lancamentos").select("*").in("consulta_id", ids).neq("status", "cancelado"),
        supabase.from("avaliacoes").select("consulta_id,nota,comentario,respondido_em").in("consulta_id", ids).not("nota", "is", null),
        supabase
          .from("envios")
          .select("id,evento,canal,status,created_at,enviado_em,consulta_id")
          .in("consulta_id", ids)
          .eq("publico", "paciente")
          .order("created_at", { ascending: false })
          .limit(100),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];

  // Disparos que o paciente recebeu (sem a tabela, a ficha segue sem eles)
  const { data: recebidos } = await supabase
    .from("disparo_destinatarios")
    .select("disparo_id,status,previsto_para")
    .eq("paciente_id", id)
    .in("status", ["programado", "enviado"])
    .lte("previsto_para", new Date().toISOString())
    .limit(100);
  const disparoIds = [...new Set((recebidos ?? []).map((r) => r.disparo_id))];
  const { data: disparos } = disparoIds.length
    ? await supabase.from("disparos").select("id,nome,canal").in("id", disparoIds)
    : { data: [] as { id: string; nome: string; canal: string }[] };
  const porDisparo = new Map((disparos ?? []).map((d) => [d.id, d]));

  return {
    campanhas: (recebidos ?? []).map((r) => ({
      nome: porDisparo.get(r.disparo_id)?.nome ?? "Campanha",
      canal: porDisparo.get(r.disparo_id)?.canal ?? "whatsapp",
      quando: r.previsto_para,
      status: r.status,
    })),
    paciente: normalizar(p),
    consultas: consultas ?? [],
    receitas: (receitas.data ?? []) as Lancamento[],
    // Sem a tabela de avaliações (SQL não rodou), a ficha segue sem elas
    avaliacoes: ((avaliacoes.data ?? []) as FichaPaciente["avaliacoes"]).filter((a) => a.respondido_em),
    mensagens: (mensagens.data ?? []) as FichaPaciente["mensagens"],
  };
}

export type PacienteBasico = { id: string; organization_id: string; nome: string; telefone: string | null; email: string | null; nascimento: string | null; convenio: string | null };

/**
 * Fichas para a busca da Nova consulta: quem foi cadastrado ou importado
 * sem nunca ter vindo também precisa aparecer. Sem o SQL, devolve vazio.
 */
export async function getPacientesBasicos(): Promise<PacienteBasico[]> {
  if (await emModoDemo()) return [];
  const supabase = await createClient();
  const lista: PacienteBasico[] = [];
  for (let pagina = 0; pagina < 10; pagina++) {
    const { data, error } = await supabase
      .from("pacientes")
      .select("id,organization_id,nome,telefone,email,nascimento,convenio")
      .eq("ativo", true)
      .order("nome")
      .range(pagina * 1000, pagina * 1000 + 999);
    if (error) break;
    lista.push(...((data ?? []) as PacienteBasico[]));
    if (!data || data.length < 1000) break;
  }
  return lista;
}

/** Todas as fichas ativas, para exportar. Paginado de 1000 em 1000. */
export async function getTodosPacientes(): Promise<PacienteResumo[]> {
  if (await emModoDemo()) return (await pacientesDemo()).filter((p) => p.ativo);
  const supabase = await createClient();
  const lista: PacienteResumo[] = [];
  for (let pagina = 0; pagina < 50; pagina++) {
    const { data, error } = await supabase
      .from("pacientes_resumo")
      .select("*")
      .eq("ativo", true)
      .order("nome")
      .range(pagina * 1000, pagina * 1000 + 999);
    if (error) break;
    lista.push(...(data ?? []).map(normalizar));
    if (!data || data.length < 1000) break;
  }
  return lista;
}

/** Possíveis duplicados: mesmo nome, ou mesmo e-mail, em fichas diferentes. */
export async function getDuplicados(): Promise<PacienteResumo[][]> {
  let lista: PacienteResumo[];
  if (await emModoDemo()) lista = await pacientesDemo();
  else {
    const supabase = await createClient();
    const { data, error } = await supabase.from("pacientes_resumo").select("*").eq("ativo", true).limit(10000);
    if (error) return [];
    lista = (data ?? []).map(normalizar);
  }
  const grupos = new Map<string, PacienteResumo[]>();
  const juntar = (chave: string, p: PacienteResumo) => {
    const g = grupos.get(chave) ?? [];
    if (!g.some((x) => x.id === p.id)) g.push(p);
    grupos.set(chave, g);
  };
  for (const p of lista) {
    juntar(`n:${semAcento(p.nome)}`, p);
    if (p.email) juntar(`e:${p.email.trim().toLowerCase()}`, p);
  }
  // Um grupo que é subconjunto de outro maior não precisa aparecer duas vezes
  const resultado = [...grupos.values()].filter((g) => g.length > 1);
  const vistos = new Set<string>();
  return resultado
    .sort((a, b) => b.length - a.length)
    .filter((g) => {
      const k = g.map((p) => p.id).sort().join("|");
      if (vistos.has(k)) return false;
      vistos.add(k);
      return true;
    });
}

/* ------------------------------------------------------------------ */

const semAcento = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

/** O PostgREST devolve numeric como texto. */
function normalizar(p: PacienteResumo): PacienteResumo {
  return {
    ...p,
    tags: p.tags ?? [],
    total_gasto: Number(p.total_gasto ?? 0),
    consultas_realizadas: Number(p.consultas_realizadas ?? 0),
    faltas: Number(p.faltas ?? 0),
  };
}

function opcoesDe(linhas: { convenio: string | null; tags: string[] | null }[]) {
  const convenios = new Set<string>();
  const tags = new Set<string>();
  for (const l of linhas) {
    if (l.convenio?.trim()) convenios.add(l.convenio.trim());
    for (const t of l.tags ?? []) tags.add(t);
  }
  const ordenar = (s: Set<string>) => [...s].sort((a, b) => a.localeCompare(b, "pt-BR"));
  return { convenios: ordenar(convenios), tags: ordenar(tags) };
}

/* ---------------------------- Demonstração ---------------------------- */

const chaveDemo = (c: Pick<Consulta, "paciente_nome" | "paciente_telefone">) => {
  const d = (c.paciente_telefone ?? "").replace(/\D/g, "");
  return d.length >= 10 ? `demo-t${d.slice(-8)}` : `demo-n${semAcento(c.paciente_nome).replace(/\W/g, "-")}`;
};

const TAGS_DEMO: Record<string, string[]> = {
  "Ana Ribeiro": ["VIP", "Indicou amigos"],
  "Beatriz Souza": ["Biópsia"],
  "Tatiana Reis": ["Estética", "VIP"],
  "Camila Nogueira": ["Estética"],
};

/**
 * Consultas fictícias com histórico: quem vem para retorno ganha visitas
 * anteriores (a cada 2 a 3 meses), quem vem pela primeira vez não.
 * Determinístico, para a lista e a ficha baterem.
 */
async function consultasDemo(): Promise<Consulta[]> {
  const { profile } = await getSessao();
  const base = profile ? demoConsultasVisiveis(profile) : [];
  const extras: Consulta[] = [];
  const vistos = new Set<string>();
  for (const c of base) {
    const k = chaveDemo(c);
    if (vistos.has(k) || c.tipo !== "retorno") continue;
    vistos.add(k);
    const visitas = 2 + ([...c.paciente_nome].reduce((s, ch) => s + ch.charCodeAt(0), 0) % 5);
    for (let i = 1; i <= visitas; i++) {
      const d = new Date(c.data_hora);
      d.setDate(d.getDate() - i * (55 + ((i * 17) % 35)));
      extras.push({
        ...c,
        id: `${c.id}-h${i}`,
        data_hora: d.toISOString(),
        tipo: i === visitas ? "primeira" : "retorno",
        status: "realizada",
        motivo: i === visitas ? "Avaliação inicial" : "Acompanhamento",
        valor: i === visitas ? 350 : 250,
        observacao: null,
      });
    }
  }
  return [...base, ...extras];
}

/** Fichas montadas a partir das consultas fictícias, como a migração faria. */
export async function pacientesDemo(): Promise<PacienteResumo[]> {
  const consultas = await consultasDemo();
  const agora = new Date();
  const mapa = new Map<string, Consulta[]>();
  for (const c of [...consultas].sort((a, b) => b.data_hora.localeCompare(a.data_hora))) {
    const k = chaveDemo(c);
    mapa.set(k, [...(mapa.get(k) ?? []), c]);
  }
  return [...mapa.entries()].map(([id, cs], i) => {
    const recente = cs[0];
    const realizadas = cs.filter((c) => c.status === "realizada");
    const futuras = cs.filter((c) => new Date(c.data_hora) > agora && (c.status === "pendente" || c.status === "confirmada"));
    const contagem = new Map<string, number>();
    for (const c of cs) contagem.set(c.medico_id, (contagem.get(c.medico_id) ?? 0) + 1);
    const nascimento = cs.find((c) => c.paciente_nascimento)?.paciente_nascimento ?? null;
    const criado = new Date(cs[cs.length - 1].data_hora);
    return {
      id,
      organization_id: recente.organization_id ?? DEMO_ORG_ID,
      nome: recente.paciente_nome,
      telefone: cs.find((c) => c.paciente_telefone)?.paciente_telefone ?? null,
      telefone_chave: null,
      email: cs.find((c) => c.paciente_email)?.paciente_email ?? null,
      nascimento,
      cpf: null,
      sexo: null,
      cidade: "São Paulo, SP",
      convenio: cs.find((c) => c.convenio)?.convenio ?? "Particular",
      carteirinha: null,
      origem: ["instagram", "google_ads", "indicacao", "meta_ads", null][i % 5],
      lead_id: null,
      tags: TAGS_DEMO[recente.paciente_nome] ?? [],
      observacoes: null,
      ativo: true,
      consentimento_marketing: i % 3 !== 2,
      consentimento_em: i % 3 !== 2 ? criado.toISOString() : null,
      consentimento_canal: i % 3 !== 2 ? "presencial" : null,
      descadastrado_em: null,
      criado_por: null,
      created_at: criado.toISOString(),
      updated_at: recente.data_hora,
      mes_nascimento: nascimento ? Number(nascimento.slice(5, 7)) : null,
      servicos: [...new Set(realizadas.map((c) => c.servico_id).filter((x): x is string => !!x))],
      consultas_realizadas: realizadas.length,
      faltas: cs.filter((c) => c.status === "faltou").length,
      primeira_consulta: realizadas.length ? realizadas[realizadas.length - 1].data_hora : null,
      ultima_consulta: realizadas[0]?.data_hora ?? null,
      proxima_consulta: futuras.length ? futuras[futuras.length - 1].data_hora : null,
      total_gasto: realizadas.reduce((s, c) => s + Number(c.valor ?? 0), 0),
      profissional_principal: [...contagem.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
    };
  });
}

function filtrarEmMemoria(todos: PacienteResumo[], f: FiltrosPacientes, porPagina = POR_PAGINA): ListaPacientes {
  const situacao = f.situacao ?? "ativos";
  const corte = corteSemRetorno().toISOString();
  const busca = semAcento(f.busca ?? "");
  const digitos = (f.busca ?? "").replace(/\D/g, "");
  let lista = todos.filter((p) => {
    if (situacao === "arquivados" ? p.ativo : situacao !== "todos" && !p.ativo) return false;
    if (situacao === "sem-retorno" && !(p.ultima_consulta && p.ultima_consulta < corte && !p.proxima_consulta)) return false;
    if (situacao === "novos" && p.created_at < inicioDoMes().toISOString()) return false;
    if (situacao === "aniversariantes" && p.mes_nascimento !== new Date().getMonth() + 1) return false;
    if (
      situacao === "primeira-sem-retorno" &&
      !(p.consultas_realizadas === 1 && !p.proxima_consulta && (p.ultima_consulta ?? "") < diasAtras(DIAS_PRIMEIRA_SEM_RETORNO).toISOString())
    )
      return false;
    if (situacao === "faltaram" && !(p.faltas > 0 && !p.proxima_consulta)) return false;
    if (situacao === "valiosos" && !(p.total_gasto > 0)) return false;
    // Na demonstração não há respostas de NPS ligadas às fichas: uma divisão fixa e plausível
    if (situacao === "promotores" && !(p.consultas_realizadas >= 3)) return false;
    if (situacao === "detratores" && !(p.faltas > 0)) return false;
    if (busca && !semAcento(p.nome).includes(busca) && !(digitos.length >= 4 && (p.telefone ?? "").replace(/\D/g, "").includes(digitos)))
      return false;
    if (f.convenio && p.convenio !== f.convenio) return false;
    if (f.profissional && p.profissional_principal !== f.profissional) return false;
    if (f.tag && !p.tags.includes(f.tag)) return false;
    if (f.servico && !(p.servicos ?? []).includes(f.servico)) return false;
    return true;
  });
  const ordem = f.ordem ?? (situacao === "valiosos" ? "gasto" : "recentes");
  lista = lista.sort((a, b) =>
    ordem === "nome"
      ? a.nome.localeCompare(b.nome, "pt-BR")
      : ordem === "gasto"
        ? b.total_gasto - a.total_gasto
        : ordem === "ultima"
          ? (b.ultima_consulta ?? "").localeCompare(a.ultima_consulta ?? "")
          : b.created_at.localeCompare(a.created_at)
  );
  const pagina = Math.max(f.pagina ?? 1, 1);
  return {
    instalado: true,
    lista: porPagina === Infinity ? lista : lista.slice((pagina - 1) * porPagina, pagina * porPagina),
    total: lista.length,
    ...opcoesDe(todos),
  };
}

function numerosEmMemoria(lista: PacienteResumo[]): NumerosPacientes {
  const ativos = lista.filter((p) => p.ativo);
  const umAno = new Date();
  umAno.setFullYear(umAno.getFullYear() - 1);
  const corte = corteSemRetorno().toISOString();
  return {
    total: ativos.length,
    ativos12m: ativos.filter((p) => p.ultima_consulta && p.ultima_consulta >= umAno.toISOString()).length,
    novosMes: ativos.filter((p) => p.created_at >= inicioDoMes().toISOString()).length,
    semRetorno: ativos.filter((p) => p.ultima_consulta && p.ultima_consulta < corte && !p.proxima_consulta).length,
    comConsentimento: ativos.filter((p) => p.consentimento_marketing && !p.descadastrado_em).length,
  };
}
