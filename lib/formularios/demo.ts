import { DEMO_ORGANIZACOES } from "@/lib/demo";
import {
  DIAGNOSTICO_CLINICA,
  SLUG_DIAGNOSTICO,
} from "@/lib/formularios/diagnostico-clinica";
import { mesesPadrao, progresso, type Respostas } from "@/lib/formularios/tipos";
import type { FormularioModelo, FormularioResposta } from "@/lib/supabase/types";

/**
 * Diagnóstico fictício para o modo demonstração.
 *
 * Meio preenchido de propósito: quem visita vê a barra de progresso
 * andando, uma tabela com números e perguntas ainda em branco.
 */
export const DEMO_MODELO: FormularioModelo = {
  id: "demo-modelo-diagnostico",
  slug: SLUG_DIAGNOSTICO,
  versao: 1,
  titulo: "Diagnóstico inicial",
  descricao: "Estratégia para o crescimento da clínica",
  schema: DIAGNOSTICO_CLINICA,
  ativo: true,
  created_at: "2026-10-01T12:00:00Z",
};

const respostasDemo: Respostas = {
  meta_faturamento:
    "Chegar a R$ 120 mil por mês em 12 meses. Hoje a prioridade é ocupar melhor a agenda das tardes antes de pensar em ampliar a equipe.",
  principal_obstaculo:
    "Muitos contatos pelo Instagram que não viram consulta: a resposta demora e ninguém retoma a conversa.",
  servicos_prioritarios: "Dermatologia clínica e procedimentos com toxina, pela margem.",
  servicos: [
    { rotulo: "Avaliação inicial", preco: "350", duracao: "40", vagas: "30 / 22" },
    { rotulo: "Toxina botulínica", preco: "1.400", duracao: "30", vagas: "12 / 9" },
    { rotulo: "Peeling", preco: "480", duracao: "45", vagas: "10 / 4" },
  ],
  canais_origem: "Indicação (estimativa: metade), Instagram e Google. Não registramos a origem de forma sistemática.",
  indicadores: {
    meses: mesesPadrao(3),
    linhas: {
      faturamento_total: ["82.400", "88.150", "91.300"],
      "servicos:Toxina botulínica": ["31.000", "33.600", "35.000"],
      novos_interessados: ["140", "162", "171"],
      consultas_agendadas: ["58", "61", "66"],
      investimento_anuncios: ["3.000", "3.000", "3.500"],
    },
  },
};

function resposta(
  id: string,
  orgIndice: number,
  status: FormularioResposta["status"],
  respostas: Respostas,
  atualizado: string
): FormularioResposta {
  return {
    id,
    modelo_id: DEMO_MODELO.id,
    organization_id: DEMO_ORGANIZACOES[orgIndice]?.id ?? DEMO_ORGANIZACOES[0].id,
    status,
    respondente_nome: status === "rascunho" ? "Dra. Helena Costa" : "Ricardo Alves",
    respondente_cargo: status === "rascunho" ? "Sócia-fundadora" : "Gestor",
    data_referencia: atualizado.slice(0, 10),
    respostas,
    progresso: progresso(DIAGNOSTICO_CLINICA, respostas),
    token: `demo-${id}`,
    referencia: null,
    importado_em: null,
    enviado_em: status === "rascunho" ? null : atualizado,
    revisado_em: status === "revisado" ? atualizado : null,
    revisado_por: null,
    atualizado_por: null,
    created_at: "2026-10-01T12:00:00Z",
    updated_at: atualizado,
  };
}

export function demoRespostas(): FormularioResposta[] {
  return [
    resposta("demo-diagnostico-1", 0, "rascunho", respostasDemo, "2026-10-24T14:32:00Z"),
    resposta(
      "demo-diagnostico-2",
      1,
      "enviado",
      { ...respostasDemo, principal_obstaculo: "Agenda cheia nas manhãs e vazia nas tardes." },
      "2026-10-20T10:05:00Z"
    ),
  ];
}
