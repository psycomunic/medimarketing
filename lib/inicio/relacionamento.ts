import { nomeOrigem } from "@/lib/rotulos";
import type { Bloqueio, Consulta, Disponibilidade, Lead } from "@/lib/supabase/types";

/**
 * RELACIONAMENTO COM PACIENTES
 *
 * O que o dono pode fazer hoje para faturar mais sem gastar em anúncio:
 * chamar quem não voltou, lembrar de quem faz aniversário, encaixar
 * pacientes nos horários vagos de amanhã e saber de onde vêm os novos.
 *
 * Tudo em horário de Brasília: a agenda e a disponibilidade são locais
 * da clínica, não do servidor.
 */

const FUSO = "America/Sao_Paulo";
/** O Brasil não tem horário de verão desde 2019. */
const OFFSET = "-03:00";
/** Sem consulta realizada há mais que isso, o paciente "não voltou". */
export const MESES_SEM_RETORNO = 6;

export const dataSP = (d: Date) => d.toLocaleDateString("sv-SE", { timeZone: FUSO });
const diaSemanaSP = (data: string) => new Date(`${data}T12:00:00Z`).getUTCDay();
const instante = (data: string, minutos: number) =>
  new Date(`${data}T${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}:00${OFFSET}`);
const hhmm = (minutos: number) => `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`;
const minutosDe = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};
const somarDiasData = (data: string, dias: number) => {
  const d = new Date(`${data}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
};
const ativa = (c: Consulta) => c.status !== "cancelada" && c.status !== "faltou";
/** Mesmo paciente: pelo telefone quando há, senão pelo nome. */
const chavePaciente = (c: Pick<Consulta, "paciente_nome" | "paciente_telefone">) => {
  const tel = (c.paciente_telefone ?? "").replace(/\D/g, "");
  return tel.length >= 8 ? `t${tel.slice(-9)}` : `n${c.paciente_nome.trim().toLowerCase()}`;
};
const primeiroNome = (nome: string) => nome.trim().split(/\s+/)[0] ?? nome;

/* ------------------------------------------------------------------ */

export type Vagas = {
  data: string;
  rotulo: string;
  profissionais: { medicoId: string; faixas: string[]; minutos: number }[];
  totalMinutos: number;
};

/** Horários livres de amanhã, em blocos de 30 minutos agrupados em faixas. */
export function horariosVagos(
  agora: Date,
  consultas: Consulta[],
  disponibilidade: Disponibilidade[],
  bloqueios: Bloqueio[]
): Vagas | null {
  if (!disponibilidade.length) return null;
  const data = somarDiasData(dataSP(agora), 1);
  const dia = diaSemanaSP(data);
  const rotulo = new Date(`${data}T12:00:00Z`).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "short", timeZone: "UTC" });

  const porMedico = new Map<string, { faixas: string[]; minutos: number }>();
  for (const j of disponibilidade.filter((x) => x.dia_semana === dia)) {
    const ocupado = consultas
      .filter((c) => c.medico_id === j.medico_id && ativa(c))
      .map((c) => {
        const ini = new Date(c.data_hora).getTime();
        return [ini, ini + (c.duracao_min || 30) * 60000] as const;
      });
    const bloq = bloqueios
      .filter((b) => b.medico_id === j.medico_id)
      .map((b) => [new Date(b.data_inicio).getTime(), new Date(b.data_fim).getTime()] as const);

    const atual = porMedico.get(j.medico_id) ?? { faixas: [], minutos: 0 };
    let inicioFaixa: number | null = null;
    const fim = minutosDe(j.hora_fim);
    for (let m = minutosDe(j.hora_inicio); m + 30 <= fim; m += 30) {
      const a = instante(data, m).getTime();
      const b = a + 30 * 60000;
      const livre = ![...ocupado, ...bloq].some(([x, y]) => x < b && y > a);
      if (livre) {
        atual.minutos += 30;
        if (inicioFaixa === null) inicioFaixa = m;
      }
      if ((!livre || m + 60 > fim) && inicioFaixa !== null) {
        const fimFaixa = livre ? m + 30 : m;
        atual.faixas.push(`${hhmm(inicioFaixa)}–${hhmm(fimFaixa)}`);
        inicioFaixa = null;
      }
    }
    porMedico.set(j.medico_id, atual);
  }

  const profissionais = [...porMedico.entries()]
    .map(([medicoId, v]) => ({ medicoId, ...v }))
    .filter((p) => p.minutos > 0)
    .sort((a, b) => b.minutos - a.minutos);
  return { data, rotulo, profissionais, totalMinutos: profissionais.reduce((s, p) => s + p.minutos, 0) };
}

/* ------------------------------------------------------------------ */

export type Aniversariante = { nome: string; telefone: string | null; data: string; quando: string; idade: number; hoje: boolean };

/** Pacientes que fazem aniversário nos próximos 7 dias (hoje incluso). */
export function aniversariantes(agora: Date, historico: Consulta[]): Aniversariante[] {
  const hoje = dataSP(agora);
  const dias = Array.from({ length: 7 }, (_, i) => somarDiasData(hoje, i));
  const vistos = new Set<string>();
  const lista: Aniversariante[] = [];
  for (const c of historico) {
    if (!c.paciente_nascimento) continue;
    const k = chavePaciente(c);
    if (vistos.has(k)) continue;
    const mmdd = c.paciente_nascimento.slice(5, 10);
    const i = dias.findIndex((d) => d.slice(5) === mmdd);
    if (i < 0) continue;
    vistos.add(k);
    const data = dias[i];
    lista.push({
      nome: c.paciente_nome,
      telefone: c.paciente_telefone,
      data,
      quando:
        i === 0
          ? "hoje"
          : i === 1
            ? "amanhã"
            : new Date(`${data}T12:00:00Z`).toLocaleDateString("pt-BR", { weekday: "long", timeZone: "UTC" }),
      idade: Number(data.slice(0, 4)) - Number(c.paciente_nascimento.slice(0, 4)),
      hoje: i === 0,
    });
  }
  return lista.sort((a, b) => a.data.localeCompare(b.data));
}

export function mensagemAniversario(nome: string, clinica: string) {
  return `Oi, ${primeiroNome(nome)}! Aqui é da ${clinica}. Passando para desejar um feliz aniversário! Que seja um ano de muita saúde. Um abraço da nossa equipe.`;
}

/* ------------------------------------------------------------------ */

export type SemRetorno = {
  total: number;
  lista: { nome: string; telefone: string | null; ultima: string; meses: number }[];
};

/**
 * Pacientes atendidos que não voltam há mais de MESES_SEM_RETORNO meses
 * e não têm nada marcado. Os mais recentes primeiro: são os mais fáceis
 * de trazer de volta.
 */
export function semRetorno(agora: Date, historico: Consulta[]): SemRetorno {
  const corte = new Date(agora);
  corte.setMonth(corte.getMonth() - MESES_SEM_RETORNO);
  const ultimas = new Map<string, Consulta>();
  const comFuturo = new Set<string>();
  for (const c of historico) {
    const k = chavePaciente(c);
    if (ativa(c) && new Date(c.data_hora) >= agora) comFuturo.add(k);
    if (c.status !== "realizada") continue;
    const u = ultimas.get(k);
    if (!u || u.data_hora < c.data_hora) ultimas.set(k, c);
  }
  const lista = [...ultimas.entries()]
    .filter(([k, c]) => !comFuturo.has(k) && new Date(c.data_hora) < corte)
    .map(([, c]) => {
      const d = new Date(c.data_hora);
      const meses = (agora.getFullYear() - d.getFullYear()) * 12 + agora.getMonth() - d.getMonth();
      return { nome: c.paciente_nome, telefone: c.paciente_telefone, ultima: c.data_hora, meses };
    })
    .sort((a, b) => b.ultima.localeCompare(a.ultima));
  return { total: lista.length, lista: lista.slice(0, 5) };
}

export function mensagemRetorno(nome: string, clinica: string) {
  return `Oi, ${primeiroNome(nome)}! Aqui é da ${clinica}. Faz um tempo desde a sua última consulta e queríamos saber como você está. Que tal agendar um retorno? Temos horários nesta semana.`;
}

/* ------------------------------------------------------------------ */

export type Origem = { origem: string; contatos: number; agendaram: number };

/** De onde vieram os contatos do período e quantos viraram consulta. */
export function origens(leads: Pick<Lead, "origem" | "etapa_funil" | "status" | "created_at">[], ini: Date, fim: Date): Origem[] {
  const mapa = new Map<string, Origem>();
  for (const l of leads) {
    const d = new Date(l.created_at);
    if (d < ini || d >= fim) continue;
    const nome = nomeOrigem(l.origem);
    const o = mapa.get(nome) ?? { origem: nome, contatos: 0, agendaram: 0 };
    o.contatos += 1;
    if (l.status === "ganho" || ["agendado", "compareceu", "em_tratamento"].includes(l.etapa_funil)) o.agendaram += 1;
    mapa.set(nome, o);
  }
  return [...mapa.values()].sort((a, b) => b.contatos - a.contatos);
}
