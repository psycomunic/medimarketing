/**
 * Rótulos em português e cores dos enums dos módulos.
 *
 * Fonte única: página, filtro e formulário leem daqui, então renomear uma
 * etapa do funil (ou trocar a cor de um status) acontece num lugar só.
 */
import type {
  CanalContato,
  CanalConversa,
  EtapaFunil,
  FormaPagamento,
  PlataformaAds,
  ProvedorIntegracao,
  StatusCampanha,
  StatusConversa,
  StatusLancamento,
  StatusLead,
  TipoInteracao,
  TipoRegua,
} from "@/lib/supabase/types";

/* ---------------------------- CRM ---------------------------- */

/** Etapas na ordem em que aparecem no funil. `perdido` fica fora do fluxo. */
export const ETAPAS_FUNIL: readonly EtapaFunil[] = [
  "novo",
  "em_contato",
  "agendado",
  "compareceu",
  "em_tratamento",
] as const;

export const rotuloEtapa: Record<EtapaFunil, string> = {
  novo: "Novo",
  em_contato: "Em contato",
  agendado: "Agendado",
  compareceu: "Compareceu",
  em_tratamento: "Em tratamento",
  perdido: "Perdido",
};

/** Texto curto que explica o que fazer na etapa. */
export const dicaEtapa: Record<EtapaFunil, string> = {
  novo: "Chegou e ainda não foi abordado",
  em_contato: "Conversa em andamento",
  agendado: "Tem horário marcado",
  compareceu: "Veio à consulta",
  em_tratamento: "Fechou e está em atendimento",
  perdido: "Não seguiu adiante",
};

export const corEtapa: Record<EtapaFunil, string> = {
  novo: "bg-teal-claro",
  em_contato: "bg-teal",
  agendado: "bg-azul-medico",
  compareceu: "bg-sucesso",
  em_tratamento: "bg-alerta",
  perdido: "bg-cinza-suave",
};

export const rotuloStatusLead: Record<StatusLead, string> = {
  aberto: "Em aberto",
  ganho: "Ganho",
  perdido: "Perdido",
};

export const rotuloTipoInteracao: Record<TipoInteracao, string> = {
  nota: "Nota",
  mensagem: "Mensagem",
  ligacao: "Ligação",
  tarefa: "Tarefa",
};

export const rotuloCanal: Record<CanalContato, string> = {
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  facebook: "Facebook",
  telefone: "Telefone",
  email: "E-mail",
  presencial: "Presencial",
};

/** De onde veio o lead. Chaves livres: o site pode mandar qualquer origem. */
export const rotuloOrigem: Record<string, string> = {
  meta_ads: "Meta Ads",
  google_ads: "Google Ads",
  instagram: "Instagram",
  facebook: "Facebook",
  indicacao: "Indicação",
  site: "Site",
  landing: "Site",
  whatsapp: "WhatsApp",
  organico: "Orgânico",
  outro: "Outro",
};

export function nomeOrigem(origem: string | null): string {
  if (!origem) return "Não informada";
  return rotuloOrigem[origem] ?? origem;
}

/* ------------------------- Atendimento ------------------------- */

export const rotuloCanalConversa: Record<CanalConversa, string> = {
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  facebook: "Facebook",
};

export const corCanal: Record<CanalConversa, string> = {
  whatsapp: "bg-sucesso/12 text-sucesso",
  instagram: "bg-coral/12 text-coral",
  facebook: "bg-azul-medico/12 text-azul-medico",
};

export const rotuloStatusConversa: Record<StatusConversa, string> = {
  aberta: "Em aberto",
  pendente: "Sem responsável",
  resolvida: "Resolvida",
};

/* --------------------------- Retenção --------------------------- */

export const rotuloTipoRegua: Record<TipoRegua, string> = {
  reabordagem: "Reabordagem",
  no_show: "Falta (no-show)",
  reativacao: "Reativação de base",
  recall: "Recall de retorno",
  pos_consulta: "Pós-consulta",
};

/** O que dispara cada régua, em linguagem de clínica. */
export const gatilhoRegua: Record<TipoRegua, string> = {
  reabordagem: "Lead recebeu o orçamento e não respondeu",
  no_show: "Paciente faltou à consulta marcada",
  reativacao: "Paciente sem retorno há mais de 8 meses",
  recall: "Protocolo clínico pede revisão",
  pos_consulta: "Consulta foi realizada",
};

/* --------------------------- Marketing --------------------------- */

export const rotuloPlataforma: Record<PlataformaAds, string> = {
  meta: "Meta Ads",
  google: "Google Ads",
  organico: "Orgânico",
  outro: "Outro",
};

export const corPlataforma: Record<PlataformaAds, string> = {
  meta: "bg-azul-medico/12 text-azul-medico",
  google: "bg-alerta/12 text-alerta",
  organico: "bg-teal/12 text-teal",
  outro: "bg-verde-menta text-cinza-suave",
};

export const rotuloStatusCampanha: Record<StatusCampanha, string> = {
  ativa: "Ativa",
  pausada: "Pausada",
  encerrada: "Encerrada",
};

/* --------------------------- Financeiro --------------------------- */

export const rotuloFormaPagamento: Record<FormaPagamento, string> = {
  pix: "Pix",
  dinheiro: "Dinheiro",
  cartao_credito: "Cartão de crédito",
  cartao_debito: "Cartão de débito",
  convenio: "Convênio",
  boleto: "Boleto",
};

export const rotuloStatusLancamento: Record<StatusLancamento, string> = {
  previsto: "A receber",
  recebido: "Recebido",
  atrasado: "Atrasado",
  cancelado: "Cancelado",
};

export const corStatusLancamento: Record<StatusLancamento, string> = {
  previsto: "bg-alerta/12 text-alerta",
  recebido: "bg-sucesso/12 text-sucesso",
  atrasado: "bg-coral/12 text-coral",
  cancelado: "bg-verde-menta text-cinza-suave",
};

/* ------------------------- Configurações ------------------------- */

export const rotuloProvedor: Record<ProvedorIntegracao, string> = {
  meta_ads: "Meta Ads",
  google_ads: "Google Ads",
  ga4: "Google Analytics 4",
  whatsapp: "WhatsApp Business",
  instagram: "Instagram Direct",
};

export const descricaoProvedor: Record<ProvedorIntegracao, string> = {
  meta_ads: "Traz investimento, leads e custo por lead das campanhas do Facebook e Instagram.",
  google_ads: "Traz investimento, cliques e leads das campanhas de pesquisa.",
  ga4: "Mostra como o visitante se comporta no site antes de virar lead.",
  whatsapp: "Conecta o número da clínica à caixa de entrada, pela API oficial.",
  instagram: "Puxa as mensagens do Direct para a mesma caixa de entrada.",
};

/* --------------------------- Utilidades --------------------------- */

/** "há 2 h", "há 3 dias", "agora há pouco". */
export function tempoRelativo(iso: string): string {
  const minutos = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutos < 1) return "agora há pouco";
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.round(minutos / 60);
  if (horas < 24) return `há ${horas} h`;
  const dias = Math.round(horas / 24);
  if (dias < 30) return `há ${dias} ${dias === 1 ? "dia" : "dias"}`;
  const meses = Math.round(dias / 30);
  return `há ${meses} ${meses === 1 ? "mês" : "meses"}`;
}

/** Quanto falta (ou passou) de um prazo: "vence em 3 h", "atrasada 2 dias". */
export function prazoRelativo(iso: string): { texto: string; atrasado: boolean } {
  const minutos = Math.round((new Date(iso).getTime() - Date.now()) / 60_000);
  const atrasado = minutos < 0;
  const abs = Math.abs(minutos);

  const quanto =
    abs < 60
      ? `${abs} min`
      : abs < 60 * 24
        ? `${Math.round(abs / 60)} h`
        : `${Math.round(abs / (60 * 24))} ${Math.round(abs / (60 * 24)) === 1 ? "dia" : "dias"}`;

  return { texto: atrasado ? `atrasada ${quanto}` : `vence em ${quanto}`, atrasado };
}

/** "10/08 às 14:30" */
export function dataHoraCurta(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")} às ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** "10/08/2026" a partir de "2026-08-10". */
export function dataBr(data: string): string {
  const [ano, mes, dia] = data.slice(0, 10).split("-");
  return `${dia}/${mes}/${ano}`;
}
