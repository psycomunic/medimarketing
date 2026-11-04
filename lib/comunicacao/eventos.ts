import type { CanalAviso, Role } from "@/lib/supabase/types";

/**
 * CATÁLOGO DE AVISOS DA EQUIPE
 *
 * Cada evento diz quem, na clínica, costuma querer saber dele e por
 * qual canal. É o padrão: cada pessoa ajusta o seu em Meu Perfil, e o
 * gestor ajusta o de qualquer um em Configurações.
 *
 * "medico" aqui não é o papel, é a relação: o profissional que atende
 * aquela consulta. O dono da clínica que também atende recebe como
 * médico nas consultas dele e como gestor nas dos outros.
 *
 * Funções puras: a tela de preferências e o servidor leem o mesmo
 * padrão, e não podem discordar.
 */

export const CANAIS: { id: CanalAviso; rotulo: string }[] = [
  { id: "painel", rotulo: "Painel" },
  { id: "push", rotulo: "No aparelho" },
  { id: "whatsapp", rotulo: "WhatsApp" },
  { id: "email", rotulo: "E-mail" },
];

export type EventoEquipe =
  | "consulta_nova"
  | "consulta_cancelada"
  | "consulta_remarcada"
  | "paciente_confirmou"
  | "paciente_remarcar"
  | "paciente_cancelou"
  | "agenda_do_dia"
  | "pendentes_vespera"
  | "envio_falhou"
  | "profissional_trocado"
  | "horario_lotado"
  | "encaixe_acima_limite"
  | "vaga_aberta"
  | "agenda_da_clinica";

type Relacao = "medico" | "gestor" | "secretaria";

type Definicao = {
  rotulo: string;
  descricao: string;
  padrao: Partial<Record<Relacao, CanalAviso[]>>;
};

const TODOS: CanalAviso[] = ["painel", "whatsapp", "email"];

export const EVENTOS: Record<EventoEquipe, Definicao> = {
  consulta_nova: {
    rotulo: "Consulta marcada",
    descricao: "Quando alguém marca uma consulta na agenda.",
    padrao: { medico: TODOS, gestor: ["painel"], secretaria: ["painel"] },
  },
  consulta_cancelada: {
    rotulo: "Consulta cancelada pela clínica",
    descricao: "Quando a equipe cancela uma consulta pela agenda.",
    padrao: { medico: TODOS, gestor: ["painel"], secretaria: ["painel"] },
  },
  consulta_remarcada: {
    rotulo: "Consulta remarcada",
    descricao: "Quando a consulta muda de dia ou horário.",
    padrao: { medico: TODOS, gestor: ["painel"], secretaria: ["painel"] },
  },
  paciente_confirmou: {
    rotulo: "Paciente confirmou presença",
    descricao: "Resposta ao lembrete, pelo link ou registrada por telefone.",
    padrao: { medico: ["painel"], gestor: ["painel"], secretaria: ["painel"] },
  },
  paciente_remarcar: {
    rotulo: "Paciente pediu para remarcar",
    descricao: "Pede contato rápido: o horário segue reservado.",
    padrao: { medico: TODOS, gestor: TODOS, secretaria: ["painel"] },
  },
  paciente_cancelou: {
    rotulo: "Paciente cancelou",
    descricao: "O horário fica livre para encaixe.",
    padrao: { medico: TODOS, gestor: TODOS, secretaria: ["painel"] },
  },
  agenda_do_dia: {
    rotulo: "Resumo da agenda do dia",
    descricao: "De manhã, as consultas do dia e quem já confirmou.",
    padrao: { medico: ["whatsapp", "email"] },
  },
  pendentes_vespera: {
    rotulo: "Sem confirmação na véspera",
    descricao: "À tarde, os pacientes do próximo dia útil que ainda não confirmaram.",
    padrao: { gestor: ["painel"], secretaria: ["painel"] },
  },
  envio_falhou: {
    rotulo: "Mensagem que não chegou ao paciente",
    descricao: "Lembrete ou aviso que falhou depois das tentativas.",
    padrao: { gestor: ["painel"], secretaria: ["painel"] },
  },
  profissional_trocado: {
    rotulo: "Consulta trocou de profissional",
    descricao: "Mesmo horário, outro profissional: quem saiu e quem entrou ficam sabendo.",
    padrao: { medico: TODOS, gestor: ["painel"], secretaria: ["painel"] },
  },
  horario_lotado: {
    rotulo: "Horário lotado",
    descricao: "Quando um horário chega ao limite de consultas ao mesmo tempo da clínica.",
    padrao: { gestor: ["painel"], secretaria: ["painel"] },
  },
  encaixe_acima_limite: {
    rotulo: "Encaixe acima do limite",
    descricao: "Quando uma consulta é marcada além do limite do horário.",
    padrao: { gestor: ["painel", "email"] },
  },
  vaga_aberta: {
    rotulo: "Vaga aberta em horário lotado",
    descricao: "Um horário que estava lotado voltou a ter vaga: dá para encaixar alguém.",
    padrao: { gestor: ["painel"], secretaria: ["painel", "email"] },
  },
  agenda_da_clinica: {
    rotulo: "Resumo da agenda da clínica",
    descricao: "De manhã, todas as consultas do dia por horário, com os profissionais e as vagas.",
    padrao: { gestor: ["email"], secretaria: ["email"] },
  },
};

export const LISTA_EVENTOS = Object.keys(EVENTOS) as EventoEquipe[];

/** Eventos que fazem sentido para um papel (para a tela de preferências). */
export function eventosDoPapel(papel: Role): EventoEquipe[] {
  if (papel === "super_admin") return [];
  return LISTA_EVENTOS.filter((e) => {
    const p = EVENTOS[e].padrao;
    if (papel === "medico") return !!p.medico;
    if (papel === "secretaria") return !!p.secretaria;
    // Gestor costuma atender também: vê os do médico e os da gestão
    return !!p.gestor || !!p.medico;
  });
}

/** Eventos que ficam só no painel, sem tocar no aparelho. */
const SEM_PUSH = new Set<EventoEquipe>(["paciente_confirmou", "horario_lotado", "pendentes_vespera"]);

/** Canais padrão de alguém para um evento, conforme o papel e a relação. */
export function canaisPadrao(
  evento: EventoEquipe,
  papel: Role,
  ehMedicoDaConsulta: boolean
): CanalAviso[] {
  const p = EVENTOS[evento].padrao;
  const conjunto = new Set<CanalAviso>();
  if (ehMedicoDaConsulta) p.medico?.forEach((c) => conjunto.add(c));
  if (papel === "gestor") p.gestor?.forEach((c) => conjunto.add(c));
  if (papel === "secretaria") p.secretaria?.forEach((c) => conjunto.add(c));
  // O que aparece no painel também toca no aparelho (app instalado), menos
  // o que é rotina demais para tirar a atenção de alguém
  if (conjunto.has("painel") && !SEM_PUSH.has(evento)) conjunto.add("push");
  return [...conjunto];
}

/**
 * Canais efetivos: a escolha da pessoa, quando existe, vale por cima do
 * padrão. Mas só para quem o evento diz respeito — escolher "WhatsApp"
 * para consulta nova não faz o médico receber as consultas dos colegas.
 */
export function canaisEfetivos(
  evento: EventoEquipe,
  papel: Role,
  ehMedicoDaConsulta: boolean,
  escolha?: Partial<Record<string, CanalAviso[]>>
): CanalAviso[] {
  const padrao = canaisPadrao(evento, papel, ehMedicoDaConsulta);
  if (!padrao.length) return [];
  const pessoal = escolha?.[evento];
  return pessoal ? pessoal.filter((c) => CANAIS.some((x) => x.id === c)) : padrao;
}

/** Padrão a mostrar na tela, sem consulta específica em jogo. */
export function canaisPadraoDoPapel(evento: EventoEquipe, papel: Role): CanalAviso[] {
  return canaisPadrao(evento, papel, papel === "medico" || papel === "gestor");
}
