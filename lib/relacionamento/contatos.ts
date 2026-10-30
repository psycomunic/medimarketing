import "server-only";
import { createClient } from "@/lib/supabase/server";
import { emModoDemo, getConsultas } from "@/lib/supabase/queries";
import { pacientesDemo } from "@/lib/supabase/pacientes";
import { getProfissionais } from "@/lib/supabase/financeiro-dados";
import { primeiroNome } from "@/lib/mensagens";
import { linkWhatsApp } from "@/lib/lembretes";
import type { Consulta } from "@/lib/supabase/types";

/**
 * CONTATOS DE RELACIONAMENTO
 *
 * As automações com pacientes, no modo manual: o sistema monta a lista de
 * quem contatar hoje, com a mensagem pronta, e a equipe envia pelo
 * WhatsApp da clínica (copiando ou abrindo o link) e marca como feito.
 * Nada sai sozinho.
 *
 * Regras:
 * - Uma mensagem por paciente por dia (a mais importante) e nenhuma para
 *   quem recebeu outra nos últimos 3 dias.
 * - Quem pediu para não receber mensagens fica de fora.
 * - Cada contato tem uma chave (tipo + consulta, ou tipo + ano): feito ou
 *   pulado, não volta.
 */

export type TipoContato = "aniversario" | "faltou" | "pos_consulta";

export type ConfigAutomacao = {
  tipo: TipoContato;
  ativa: boolean;
  mensagem: string;
  /** Dias depois do gatilho para aparecer na lista (pós-consulta e faltou). */
  dias: number;
};

export const AUTOMACOES: Record<TipoContato, { nome: string; descricao: string; padrao: Omit<ConfigAutomacao, "tipo">; temDias: boolean }> = {
  aniversario: {
    nome: "Aniversário",
    descricao: "No dia do aniversário, uma felicitação da clínica.",
    temDias: false,
    padrao: {
      ativa: true,
      dias: 0,
      mensagem:
        "Olá, {nome}! Toda a equipe da {clinica} deseja um feliz aniversário! Que o seu novo ano seja cheio de saúde e de boas conquistas. Um grande abraço!",
    },
  },
  faltou: {
    nome: "Faltou",
    descricao: "Quem faltou e ainda não remarcou. Sai da lista quando marcar outra consulta.",
    temDias: true,
    padrao: {
      ativa: true,
      dias: 0,
      mensagem:
        "Olá, {nome}! Aqui é da {clinica}. Sentimos sua falta na consulta de {data}. Aconteceu alguma coisa? Se quiser, remarcamos para o dia e horário que ficarem melhores para você. É só responder esta mensagem.",
    },
  },
  pos_consulta: {
    nome: "Pós-consulta",
    descricao: "Depois do atendimento, saber como o paciente está.",
    temDias: true,
    padrao: {
      ativa: true,
      dias: 1,
      mensagem:
        "Olá, {nome}! Aqui é da {clinica}. Passando para saber como você está depois da sua consulta com {profissional}. Se tiver qualquer dúvida ou desconforto, é só responder por aqui. Estamos à disposição!",
    },
  },
};

/** Ordem de importância: no mesmo dia, vale a primeira. */
const PRIORIDADE: TipoContato[] = ["aniversario", "faltou", "pos_consulta"];
/** Quanto tempo o contato fica na lista depois de aparecer. */
const JANELA_DIAS = 3;
/** Sem outra mensagem para o mesmo paciente nesse intervalo. */
export const INTERVALO_DIAS = 3;

export type ItemContato = {
  chave: string;
  tipo: TipoContato;
  pacienteId: string | null;
  consultaId: string | null;
  nome: string;
  telefone: string | null;
  /** "Consulta de 28/10 · Quiropraxia · Dra. Ana" */
  detalhe: string;
  /** Aparece hoje pela primeira vez ou já está há dias na lista. */
  atrasoDias: number;
  mensagem: string;
  whatsapp: string | null;
};

export type ContatoFeito = {
  id: string;
  chave: string;
  tipo: TipoContato;
  paciente_id: string | null;
  nome: string;
  status: "enviado" | "pulado";
  feito_em: string;
};

export type FilaContatos = {
  instalado: boolean;
  itens: ItemContato[];
  config: ConfigAutomacao[];
  feitos: ContatoFeito[];
  /** Quantos ficaram de fora por terem recebido mensagem há pouco. */
  emIntervalo: number;
};

const TZ = "America/Sao_Paulo";
const diaSP = (d: Date | string) => new Date(d).toLocaleDateString("sv-SE", { timeZone: TZ });
const diasEntre = (a: string, b: string) => Math.round((new Date(`${b}T12:00:00Z`).getTime() - new Date(`${a}T12:00:00Z`).getTime()) / 864e5);
const somarDias = (s: string, n: number) => {
  const d = new Date(`${s}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const dataBr = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}`;

export function preencher(texto: string, v: { nome: string; clinica: string; profissional?: string | null; servico?: string | null; data?: string | null }): string {
  return texto
    .replaceAll("{nome}", primeiroNome(v.nome))
    .replaceAll("{nome_completo}", v.nome.trim())
    .replaceAll("{clinica}", v.clinica)
    .replaceAll("{profissional}", v.profissional || "nossa equipe")
    .replaceAll("{servico}", v.servico || "consulta")
    .replaceAll("{data}", v.data || "");
}

type PacienteBase = { id: string; nome: string; telefone: string | null; nascimento: string | null; descadastrado_em: string | null; ativo: boolean };

export async function montarFilaContatos(orgId: string | null, clinica: string): Promise<FilaContatos> {
  const demo = await emModoDemo();
  const hoje = diaSP(new Date());
  const supabase = demo ? null : await createClient();

  /* ---------- Configuração (padrões quando a tabela não existe) ---------- */
  let instalado = demo;
  const salvas = new Map<string, Partial<ConfigAutomacao>>();
  if (supabase && orgId) {
    const { data, error } = await supabase.from("automacoes_config").select("tipo,ativa,mensagem,dias").eq("organization_id", orgId);
    instalado = !error;
    for (const c of data ?? []) salvas.set(c.tipo, c as Partial<ConfigAutomacao>);
  }
  const config: ConfigAutomacao[] = PRIORIDADE.map((tipo) => {
    const s = salvas.get(tipo);
    const p = AUTOMACOES[tipo].padrao;
    return { tipo, ativa: s?.ativa ?? p.ativa, mensagem: s?.mensagem?.trim() || p.mensagem, dias: s?.dias ?? p.dias };
  });
  const cfg = Object.fromEntries(config.map((c) => [c.tipo, c])) as Record<TipoContato, ConfigAutomacao>;

  /* ---------- Dados ---------- */
  const desde = new Date(`${somarDias(hoje, -(Math.max(cfg.pos_consulta.dias, cfg.faltou.dias) + JANELA_DIAS + 1))}T00:00:00-03:00`);
  const [consultasTodas, profissionais, pacientes, feitos] = await Promise.all([
    getConsultas(desde.toISOString(), new Date(Date.now() + 400 * 864e5).toISOString()),
    getProfissionais(orgId),
    carregarPacientes(supabase, orgId, demo),
    carregarFeitos(supabase, orgId, hoje),
  ]);
  const consultas = orgId ? consultasTodas.filter((c) => c.organization_id === orgId) : consultasTodas;
  const nomesProf = Object.fromEntries(profissionais.map((p) => [p.id, p.nome]));
  const porPaciente = new Map(pacientes.map((p) => [p.id, p]));

  const chavePaciente = (c: { paciente_id?: string | null; paciente_telefone?: string | null; paciente_nome: string }) =>
    c.paciente_id ?? ((c.paciente_telefone ?? "").replace(/\D/g, "").slice(-8) || c.paciente_nome.trim().toLowerCase());
  const feitosChaves = new Set(feitos.map((f) => f.chave));
  // Recebeu mensagem há pouco: espera o intervalo
  const recentes = new Set(
    feitos.filter((f) => f.status === "enviado" && diasEntre(diaSP(f.feito_em), hoje) < INTERVALO_DIAS && f.paciente_id).map((f) => f.paciente_id!)
  );
  const ativa = (c: Consulta) => c.status !== "cancelada" && c.status !== "faltou";
  const temFutura = (k: string) => consultas.some((c) => chavePaciente(c) === k && ativa(c) && new Date(c.data_hora) > new Date());

  const candidatos: (ItemContato & { chavePac: string })[] = [];
  const add = (i: Omit<ItemContato, "whatsapp" | "mensagem"> & { chavePac: string; vars: Parameters<typeof preencher>[1] }) => {
    if (feitosChaves.has(i.chave)) return;
    const mensagem = preencher(cfg[i.tipo].mensagem, i.vars);
    const { vars: _vars, ...resto } = i;
    void _vars;
    candidatos.push({ ...resto, mensagem, whatsapp: i.telefone && i.telefone.replace(/\D/g, "").length >= 10 ? linkWhatsApp(i.telefone, mensagem) : null });
  };
  const fora = (pacienteId: string | null | undefined) => {
    const p = pacienteId ? porPaciente.get(pacienteId) : undefined;
    return !!p && (!!p.descadastrado_em || !p.ativo);
  };

  /* ---------- Aniversário ---------- */
  if (cfg.aniversario.ativa) {
    for (const p of pacientes) {
      if (!p.nascimento || p.nascimento.slice(5, 10) !== hoje.slice(5, 10) || p.descadastrado_em || !p.ativo) continue;
      const idade = Number(hoje.slice(0, 4)) - Number(p.nascimento.slice(0, 4));
      add({
        chave: `aniversario:${p.id}:${hoje.slice(0, 4)}`,
        tipo: "aniversario",
        pacienteId: p.id,
        consultaId: null,
        nome: p.nome,
        telefone: p.telefone,
        detalhe: idade > 0 && idade < 120 ? `Faz ${idade} anos hoje` : "Aniversário hoje",
        atrasoDias: 0,
        chavePac: p.id,
        vars: { nome: p.nome, clinica },
      });
    }
  }

  /* ---------- Faltou e pós-consulta ---------- */
  for (const c of consultas) {
    const dia = diaSP(c.data_hora);
    const passados = diasEntre(dia, hoje);
    const k = chavePaciente(c);
    if (fora(c.paciente_id)) continue;
    const prof = nomesProf[c.medico_id] ?? null;
    const base = {
      pacienteId: c.paciente_id ?? null,
      consultaId: c.id,
      nome: c.paciente_nome,
      telefone: c.paciente_telefone,
      chavePac: k,
    };
    const resumo = [`Consulta de ${dataBr(dia)}`, c.servico_nome, prof].filter(Boolean).join(" · ");
    for (const tipo of ["faltou", "pos_consulta"] as const) {
      const a = cfg[tipo];
      if (!a.ativa) continue;
      if (tipo === "faltou" ? c.status !== "faltou" : c.status !== "realizada") continue;
      if (passados < a.dias || passados > a.dias + JANELA_DIAS - 1) continue;
      // Já remarcou: não precisa do convite
      if (tipo === "faltou" && temFutura(k)) continue;
      add({
        ...base,
        chave: `${tipo}:${c.id}`,
        tipo,
        detalhe: resumo,
        atrasoDias: passados - a.dias,
        vars: { nome: c.paciente_nome, clinica, profissional: prof, servico: c.servico_nome, data: dataBr(dia) },
      });
    }
  }

  /* ---------- Um por paciente, sem quem recebeu há pouco ---------- */
  let emIntervalo = 0;
  const escolhido = new Map<string, ItemContato & { chavePac: string }>();
  for (const i of candidatos.sort((a, b) => PRIORIDADE.indexOf(a.tipo) - PRIORIDADE.indexOf(b.tipo) || b.atrasoDias - a.atrasoDias)) {
    if (recentes.has(i.chavePac)) {
      emIntervalo += 1;
      continue;
    }
    if (!escolhido.has(i.chavePac)) escolhido.set(i.chavePac, i);
  }
  const itens = [...escolhido.values()].map(({ chavePac: _c, ...i }) => {
    void _c;
    return i;
  });

  return { instalado, itens, config, feitos: feitos.filter((f) => diasEntre(diaSP(f.feito_em), hoje) <= 7), emIntervalo };
}

async function carregarPacientes(supabase: Awaited<ReturnType<typeof createClient>> | null, orgId: string | null, demo: boolean): Promise<PacienteBase[]> {
  if (demo) return (await pacientesDemo()).map((p) => ({ id: p.id, nome: p.nome, telefone: p.telefone, nascimento: p.nascimento, descadastrado_em: p.descadastrado_em, ativo: p.ativo }));
  if (!supabase || !orgId) return [];
  const lista: PacienteBase[] = [];
  for (let pagina = 0; pagina < 20; pagina++) {
    const { data, error } = await supabase
      .from("pacientes")
      .select("id,nome,telefone,nascimento,descadastrado_em,ativo")
      .eq("organization_id", orgId)
      .order("id")
      .range(pagina * 1000, pagina * 1000 + 999);
    if (error) break;
    lista.push(...((data ?? []) as PacienteBase[]));
    if (!data || data.length < 1000) break;
  }
  return lista;
}

async function carregarFeitos(supabase: Awaited<ReturnType<typeof createClient>> | null, orgId: string | null, hoje: string): Promise<ContatoFeito[]> {
  if (!supabase || !orgId) return [];
  const { data } = await supabase
    .from("contatos_relacionamento")
    .select("id,chave,tipo,paciente_id,nome,status,feito_em")
    .eq("organization_id", orgId)
    .gte("feito_em", `${somarDias(hoje, -20)}T00:00:00-03:00`)
    .order("feito_em", { ascending: false })
    .limit(2000);
  return (data ?? []) as ContatoFeito[];
}
