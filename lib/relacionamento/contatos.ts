import "server-only";
import { createClient } from "@/lib/supabase/server";
import { emModoDemo, getConsultas } from "@/lib/supabase/queries";
import { pacientesDemo } from "@/lib/supabase/pacientes";
import { getPrecos, getProfissionais } from "@/lib/supabase/financeiro-dados";
import { catalogoServicos } from "@/lib/servicos";
import { primeiroNome } from "@/lib/mensagens";
import { linkWhatsApp } from "@/lib/lembretes";
import type { Consulta, PacienteResumo } from "@/lib/supabase/types";

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

export type TipoContato = "aniversario" | "faltou" | "pos_consulta" | "retorno" | "primeira_sem_retorno" | "reativacao";

export type ConfigAutomacao = {
  tipo: TipoContato;
  ativa: boolean;
  mensagem: string;
  /**
   * Prazo, que muda de sentido conforme o tipo: dias depois da consulta ou
   * da falta, dias antes do retorno vencer, ou meses sem consulta.
   */
  dias: number;
};

export type InfoAutomacao = {
  nome: string;
  descricao: string;
  padrao: Omit<ConfigAutomacao, "tipo">;
  temDias: boolean;
  /** Texto depois do número: "dia(s) após a consulta". */
  rotuloDias: string;
  /** Novidade e oferta: só para quem aceitou receber. */
  marketing?: boolean;
};

export const AUTOMACOES: Record<TipoContato, InfoAutomacao> = {
  aniversario: {
    nome: "Aniversário",
    descricao: "No dia do aniversário, uma felicitação da clínica.",
    temDias: false,
    rotuloDias: "",
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
    rotuloDias: "dia(s) após a falta",
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
    rotuloDias: "dia(s) após a consulta",
    padrao: {
      ativa: true,
      dias: 1,
      mensagem:
        "Olá, {nome}! Aqui é da {clinica}. Passando para saber como você está depois da sua consulta com {profissional}. Se tiver qualquer dúvida ou desconforto, é só responder por aqui. Estamos à disposição!",
    },
  },
  retorno: {
    nome: "Retorno do serviço",
    descricao: "Perto do retorno recomendado de cada serviço (definido na Tabela de preços). Sai da lista quando marcar.",
    temDias: true,
    rotuloDias: "dia(s) antes de vencer",
    padrao: {
      ativa: true,
      dias: 7,
      mensagem:
        "Olá, {nome}! Aqui é da {clinica}. Está chegando a hora do seu retorno de {servico} (o último foi em {data}). Quer que a gente reserve um horário para você? É só responder com o melhor dia e horário.",
    },
  },
  primeira_sem_retorno: {
    nome: "1ª consulta sem retorno",
    descricao: "Veio uma vez e não voltou. Aparece um tempo depois da consulta e fica 30 dias.",
    temDias: true,
    rotuloDias: "dia(s) após a consulta",
    padrao: {
      ativa: true,
      dias: 30,
      mensagem:
        "Olá, {nome}! Aqui é da {clinica}. Faz um tempinho desde a sua consulta com {profissional} e queríamos saber como você está. Se quiser dar continuidade, podemos agendar um horário. É só responder esta mensagem!",
    },
  },
  reativacao: {
    nome: "Reativação",
    descricao: "Sumiu há meses e não tem nada marcado. Só quem aceitou receber novidades; os que mais gastaram primeiro.",
    temDias: true,
    rotuloDias: "meses após a última consulta",
    marketing: true,
    padrao: {
      ativa: true,
      dias: 6,
      mensagem:
        "Olá, {nome}! Aqui é da {clinica}. Sentimos sua falta por aqui! Que tal agendar um horário para cuidar de você? É só responder esta mensagem que a gente encontra o melhor dia.",
    },
  },
};

/** Ordem de importância: no mesmo dia, vale a primeira. */
const PRIORIDADE: TipoContato[] = ["aniversario", "faltou", "pos_consulta", "retorno", "primeira_sem_retorno", "reativacao"];
/** Reativação por dia: a base parada pode ser grande; vai aos poucos. */
const LIMITE_REATIVACAO = 15;
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

type PacienteBase = Pick<
  PacienteResumo,
  | "id"
  | "nome"
  | "telefone"
  | "nascimento"
  | "descadastrado_em"
  | "ativo"
  | "consentimento_marketing"
  | "consultas_realizadas"
  | "ultima_consulta"
  | "proxima_consulta"
  | "total_gasto"
>;
const CAMPOS_PACIENTE = "id,nome,telefone,nascimento,descadastrado_em,ativo,consentimento_marketing,consultas_realizadas,ultima_consulta,proxima_consulta,total_gasto";

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
  const precos = await getPrecos(orgId).catch(() => []);
  // Retorno recomendado de cada linha da tabela (vale o do serviço inteiro)
  const retornoDe = new Map<string, { dias: number; nome: string }>();
  for (const s of catalogoServicos(precos)) {
    const ref = s.linhas.find((l) => !l.convenio) ?? s.linhas[0];
    const dias = ref.retorno_dias || s.linhas.find((l) => l.retorno_dias)?.retorno_dias;
    if (dias) for (const l of s.linhas) retornoDe.set(l.id, { dias, nome: s.nome });
  }
  const maiorRetorno = Math.max(0, ...[...retornoDe.values()].map((r) => r.dias));
  // Histórico: o bastante para o retorno mais longo e para a 1ª consulta sem retorno
  const diasHistorico = Math.min(
    800,
    Math.max(
      Math.max(cfg.pos_consulta.dias, cfg.faltou.dias) + JANELA_DIAS + 1,
      cfg.retorno.ativa ? maiorRetorno + 31 : 0,
      cfg.primeira_sem_retorno.ativa ? cfg.primeira_sem_retorno.dias + 31 : 0
    )
  );
  const desde = new Date(`${somarDias(hoje, -diasHistorico)}T00:00:00-03:00`);
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

  /* ---------- Retorno do serviço ---------- */
  if (cfg.retorno.ativa && retornoDe.size) {
    // Última consulta realizada de cada paciente em cada serviço com retorno
    const ultima = new Map<string, Consulta>();
    for (const c of consultas) {
      const r = c.servico_id ? retornoDe.get(c.servico_id) : undefined;
      if (!r || c.status !== "realizada" || new Date(c.data_hora) > new Date()) continue;
      const k = `${chavePaciente(c)}|${r.nome}`;
      const atual = ultima.get(k);
      if (!atual || c.data_hora > atual.data_hora) ultima.set(k, c);
    }
    for (const c of ultima.values()) {
      const r = retornoDe.get(c.servico_id!)!;
      const k = chavePaciente(c);
      if (fora(c.paciente_id) || temFutura(k)) continue;
      const dia = diaSP(c.data_hora);
      const vence = somarDias(dia, r.dias);
      const aparece = somarDias(vence, -cfg.retorno.dias);
      if (hoje < aparece || hoje > somarDias(vence, 30)) continue;
      const prof = nomesProf[c.medico_id] ?? null;
      add({
        chave: `retorno:${c.id}`,
        tipo: "retorno",
        pacienteId: c.paciente_id ?? null,
        consultaId: c.id,
        nome: c.paciente_nome,
        telefone: c.paciente_telefone,
        chavePac: k,
        detalhe: `${r.nome} em ${dataBr(dia)} · retorno ${vence < hoje ? "venceu" : "vence"} em ${dataBr(vence)}`,
        atrasoDias: diasEntre(aparece, hoje),
        vars: { nome: c.paciente_nome, clinica, profissional: prof, servico: r.nome, data: dataBr(dia) },
      });
    }
  }

  /* ---------- Primeira consulta sem retorno ---------- */
  if (cfg.primeira_sem_retorno.ativa) {
    const dias = cfg.primeira_sem_retorno.dias;
    for (const p of pacientes) {
      if (p.consultas_realizadas !== 1 || p.proxima_consulta || !p.ultima_consulta || p.descadastrado_em || !p.ativo) continue;
      const dia = diaSP(p.ultima_consulta);
      const passados = diasEntre(dia, hoje);
      if (passados < dias || passados > dias + 30) continue;
      // A consulta, para dizer com quem foi
      const c = consultas.find((x) => x.paciente_id === p.id && x.status === "realizada");
      const prof = c ? nomesProf[c.medico_id] ?? null : null;
      add({
        chave: `primeira:${p.id}`,
        tipo: "primeira_sem_retorno",
        pacienteId: p.id,
        consultaId: c?.id ?? null,
        nome: p.nome,
        telefone: p.telefone,
        chavePac: p.id,
        detalhe: [`Única consulta em ${dataBr(dia)}`, c?.servico_nome, prof].filter(Boolean).join(" · "),
        atrasoDias: passados - dias,
        vars: { nome: p.nome, clinica, profissional: prof, servico: c?.servico_nome, data: dataBr(dia) },
      });
    }
  }

  /* ---------- Reativação (só quem aceitou novidades) ---------- */
  if (cfg.reativacao.ativa) {
    const corte = somarDias(hoje, -cfg.reativacao.dias * 30);
    const parados = pacientes
      .filter(
        (p) =>
          p.ativo &&
          !p.descadastrado_em &&
          p.consentimento_marketing &&
          !p.proxima_consulta &&
          p.consultas_realizadas > 0 &&
          !!p.ultima_consulta &&
          diaSP(p.ultima_consulta) < corte
      )
      .sort((a, b) => Number(b.total_gasto) - Number(a.total_gasto));
    let n = 0;
    for (const p of parados) {
      if (n >= LIMITE_REATIVACAO) break;
      const dia = diaSP(p.ultima_consulta!);
      const chave = `reativacao:${p.id}:${dia}`;
      if (feitosChaves.has(chave)) continue;
      n += 1;
      const gasto = Number(p.total_gasto) || 0;
      add({
        chave,
        tipo: "reativacao",
        pacienteId: p.id,
        consultaId: null,
        nome: p.nome,
        telefone: p.telefone,
        chavePac: p.id,
        detalhe: [`Última consulta em ${dataBr(dia)}/${dia.slice(0, 4)}`, gasto ? `já gastou ${gasto.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}` : null]
          .filter(Boolean)
          .join(" · "),
        atrasoDias: 0,
        vars: { nome: p.nome, clinica, data: dataBr(dia) },
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
  if (demo) return pacientesDemo();
  if (!supabase || !orgId) return [];
  const lista: PacienteBase[] = [];
  for (let pagina = 0; pagina < 20; pagina++) {
    const { data, error } = await supabase
      .from("pacientes_resumo")
      .select(CAMPOS_PACIENTE)
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
