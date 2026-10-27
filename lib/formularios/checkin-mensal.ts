import type { SchemaFormulario } from "@/lib/formularios/tipos";

/**
 * Check-in mensal — versão 1.
 *
 * O mesmo motor do diagnóstico, com um mês só e sem as perguntas de
 * descoberta: são os números que alimentam a evolução da clínica. Sai
 * todo mês pela rotina diária, para quem já tem marco zero no painel.
 *
 * As linhas da tabela mensal usam as mesmas chaves do diagnóstico, para
 * que a importação trate os dois do mesmo jeito.
 */
export const SLUG_CHECKIN = "checkin-mensal";

export const CHECKIN_MENSAL: SchemaFormulario = {
  intro: {
    eyebrow: "Acompanhamento mensal",
    titulo: "Como foi o último mês?",
    destaque: "Leva poucos minutos.",
    texto:
      "Os números do mês alimentam o painel da {clinica} e mostram a evolução desde o diagnóstico. Use o mesmo critério dos meses anteriores e marque o que for estimativa.",
  },
  aviso:
    "Indique “não medimos” quando não houver dados e “estimativa” para valores aproximados. Não inclua nomes ou dados pessoais de pacientes.",
  agradecimento:
    "Obrigado! Os números vão para o painel depois da revisão da MediMarketing, e a evolução do mês aparece nos seus Indicadores.",
  etapas: [
    {
      id: "numeros",
      rotulo: "Números",
      titulo: "Números do mês",
      instrucao:
        "Confira o mês no cabeçalho da tabela. Considere pacientes únicos separadamente do número de sessões.",
      campos: [
        {
          tipo: "tabela_mensal",
          id: "indicadores",
          rotulo: "Indicador",
          meses: 1,
          linhas: [
            { id: "faturamento_total", rotulo: "Faturamento total (R$)" },
            { id: "investimento_anuncios", rotulo: "Investimento em anúncios (R$)" },
            { id: "novos_interessados", rotulo: "Novos interessados que entraram em contato" },
            { id: "consultas_agendadas", rotulo: "Primeiras consultas agendadas" },
            { id: "consultas_realizadas", rotulo: "Primeiras consultas realizadas" },
            { id: "pacientes_unicos", rotulo: "Pacientes únicos atendidos" },
            { id: "novos_pacientes", rotulo: "Novos pacientes atendidos" },
            { id: "total_atendimentos", rotulo: "Total de atendimentos realizados" },
            { id: "ticket_medio", rotulo: "Ticket médio por atendimento (R$)" },
            { id: "gasto_medio_paciente", rotulo: "Gasto médio por paciente no mês (R$)" },
          ],
        },
        {
          tipo: "tabela",
          id: "receitas",
          rotulo: "Serviço",
          colunas: [{ id: "valor", titulo: "Receita no mês (R$)" }],
          linhas: [],
          permite_linhas: true,
          rotulo_editavel: true,
          nota: "Evite somar a mesma receita em mais de um serviço.",
        },
        {
          tipo: "texto",
          id: "destaques",
          pergunta: "O que mudou no mês?",
          ajuda:
            "Algo fora do comum: equipe, agenda, preço, uma campanha, feriados. Ajuda a ler os números.",
        },
      ],
    },
  ],
};
