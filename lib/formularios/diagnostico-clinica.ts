import type { SchemaFormulario } from "@/lib/formularios/tipos";

/**
 * Diagnóstico inicial da clínica — versão 1.
 *
 * O banco é a fonte de verdade: este arquivo é o que vai no seed
 * (`scripts/seed-formularios.mts` gera o SQL a partir dele) e o que o
 * modo demonstração desenha. Para mudar uma pergunta em produção,
 * publique uma versão nova do modelo; as respostas antigas continuam
 * presas à versão em que foram escritas.
 */
export const SLUG_DIAGNOSTICO = "diagnostico-clinica";

export const DIAGNOSTICO_CLINICA: SchemaFormulario = {
  intro: {
    eyebrow: "Estratégia para o crescimento da clínica",
    titulo: "Vamos entender o seu negócio.",
    destaque: "E planejar o próximo passo.",
    texto:
      "Este questionário nos ajuda a conhecer a operação da {clinica} e definir prioridades para aumentar o faturamento, considerando margem, capacidade de atendimento e experiência dos pacientes.",
  },
  aviso:
    "Use os três últimos meses completos. Indique “não medimos” quando não houver dados e “estimativa” para valores aproximados. Não inclua nomes ou dados pessoais de pacientes.",
  agradecimento:
    "Obrigado pelo preenchimento. As respostas vão orientar a definição de prioridades, metas e indicadores de acompanhamento junto à MediMarketing.",
  etapas: [
    {
      id: "objetivos",
      rotulo: "Objetivos",
      titulo: "Objetivos e prioridades",
      campos: [
        {
          tipo: "texto",
          id: "meta_faturamento",
          pergunta: "Qual é a meta de faturamento mensal e em quanto tempo desejam alcançá-la?",
          ajuda:
            "Informe também se a prioridade é aumentar faturamento, lucro, ocupação da agenda ou uma combinação desses objetivos.",
        },
        {
          tipo: "texto",
          id: "principal_obstaculo",
          pergunta: "O que vocês consideram o principal obstáculo ao crescimento hoje?",
          ajuda:
            "Exemplos: poucos contatos, dificuldade para agendar, faltas, baixa adesão ao tratamento ou agenda cheia.",
        },
        {
          tipo: "texto",
          id: "servicos_prioritarios",
          pergunta: "Quais serviços querem priorizar e por quê?",
          ajuda: "Considerem todos os serviços que estejam ativos.",
        },
        {
          tipo: "texto",
          id: "aumento_procura",
          pergunta: "Se a procura aumentasse no próximo mês, o que precisaria mudar para atender bem?",
        },
      ],
    },
    {
      id: "servicos",
      rotulo: "Serviços",
      titulo: "Serviços e capacidade de atendimento",
      instrucao:
        "Preencha uma linha por serviço ativo. Se as técnicas fizerem parte de uma mesma sessão, registre o serviço cobrado, sem duplicar a receita. Adicione linhas se necessário.",
      campos: [
        {
          tipo: "tabela",
          id: "servicos",
          rotulo: "Serviço",
          colunas: [
            { id: "preco", titulo: "Preço praticado (R$)" },
            { id: "duracao", titulo: "Duração (minutos)" },
            { id: "vagas", titulo: "Vagas por semana (total / ocupadas)" },
          ],
          linhas: ["Avaliação inicial", "Quiropraxia", "Fisioterapia", "Pilates", "Outros"],
          permite_linhas: true,
          rotulo_editavel: true,
          nota:
            "Em serviços recorrentes, como Pilates, informe se o valor corresponde à aula ou à mensalidade e se as vagas representam pessoas ou turmas.",
        },
        {
          tipo: "texto",
          id: "primeira_consulta",
          pergunta: "Como funciona a primeira consulta de quem procura o serviço principal?",
          ajuda:
            "O que está incluído, quem atende e como a proposta é explicada antes do agendamento?",
        },
        {
          tipo: "texto",
          id: "margem_servicos",
          pergunta: "Quais serviços deixam maior margem para a clínica?",
          ajuda:
            "Se possível, informe os custos diretos ou repasses por serviço. Não é necessário calcular caso esse controle ainda não exista.",
        },
        {
          tipo: "texto",
          id: "planos_pagamento",
          pergunta: "Há planos, pacotes, convênios ou parcelamento? Como funcionam?",
          ajuda: "Informe valores, descontos e formas de pagamento mais utilizadas.",
        },
        {
          tipo: "texto",
          id: "clinica_ou_profissional",
          pergunta: "Os pacientes procuram a clínica ou um profissional específico?",
          ajuda:
            "Quando a agenda desse profissional está cheia, aceitam atendimento com outro membro da equipe?",
        },
      ],
    },
    {
      id: "captacao",
      rotulo: "Captação",
      titulo: "Do primeiro contato ao atendimento",
      campos: [
        {
          tipo: "texto",
          id: "perfil_publico",
          pergunta: "Quem costuma procurar a clínica e de onde essas pessoas vêm?",
          ajuda:
            "Principais necessidades, faixa etária, bairros e cidades. Quais perfis a equipe está mais preparada para atender?",
        },
        {
          tipo: "texto",
          id: "canais_origem",
          pergunta: "De quais canais vêm os novos pacientes e como vocês registram essa origem?",
          ajuda: "Exemplos: indicação, Google, Instagram, anúncios, parceiros e outros.",
        },
        {
          tipo: "texto",
          id: "tempo_resposta",
          pergunta: "Quem responde aos contatos e qual é o tempo médio de primeira resposta?",
          ajuda: "Informe como funciona durante o expediente, à noite e nos fins de semana.",
        },
        {
          tipo: "texto",
          id: "motivos_nao_agendar",
          pergunta: "Quais são os motivos mais frequentes para um interessado não agendar?",
          ajuda:
            "Exemplos: preço, localização, falta de horário, dúvidas sobre o atendimento ou ausência de resposta.",
        },
        {
          tipo: "texto",
          id: "acompanhamento_interessados",
          pergunta: "Como acompanham quem pediu informações e não agendou?",
          ajuda: "Existe responsável, prazo para novo contato e registro do resultado?",
        },
        {
          tipo: "texto",
          id: "confirmacao_cancelamento",
          pergunta: "Como funcionam a confirmação, os cancelamentos e os reagendamentos?",
          ajuda: "Há lista de espera ou outra forma de preencher horários liberados?",
        },
        {
          tipo: "texto",
          id: "foco_anuncios",
          pergunta: "Qual serviço é o foco dos anúncios atuais? Por quê?",
          ajuda:
            "O que já funcionou ou não funcionou? Os contatos procuram uma sessão pontual ou entendem a proposta de avaliação e tratamento?",
        },
      ],
    },
    {
      id: "continuidade",
      rotulo: "Continuidade",
      titulo: "Continuidade e experiência do paciente",
      nota_final:
        "A continuidade deve acompanhar a necessidade clínica e a orientação da equipe. Para este diagnóstico, alta adequada e abandono são situações diferentes.",
      campos: [
        {
          tipo: "texto",
          id: "apresentacao_proposta",
          pergunta:
            "Quando há indicação de tratamento após a avaliação, como a proposta é apresentada?",
          ajuda:
            "Quem explica objetivos, frequência, valores e próximos passos? Quais são as dúvidas ou objeções mais comuns?",
        },
        {
          tipo: "texto",
          id: "adesao_tratamento",
          pergunta: "Quantos pacientes iniciam o tratamento indicado e quantos deixam de iniciar?",
          ajuda:
            "Use o mesmo período de referência. Se não houver números, descreva sua percepção e identifique como estimativa.",
        },
        {
          tipo: "texto",
          id: "duracao_gasto_tratamento",
          pergunta: "Qual é a duração habitual e o gasto médio por tratamento em cada serviço?",
          ajuda:
            "Diferencie duração de cada atendimento, número de sessões realizadas e tempo total em semanas ou meses.",
        },
        {
          tipo: "texto",
          id: "alta_interrupcao",
          pergunta:
            "Como diferenciam pacientes que receberam alta daqueles que interromperam o tratamento?",
          ajuda:
            "Quais motivos de interrupção são conhecidos? Como acompanham faltas e continuidade quando indicada pela equipe?",
        },
        {
          tipo: "texto",
          id: "servicos_recorrentes",
          pergunta:
            "Como funcionam os serviços recorrentes (ex.: Pilates, planos mensais) atualmente?",
          ajuda:
            "Informe alunos ou pacientes ativos, frequência semanal, mensalidade média, permanência média e motivos de saída. Se não houver, indique isso.",
        },
        {
          tipo: "texto",
          id: "percepcao_pacientes",
          pergunta:
            "O que os pacientes mais valorizam e quais reclamações aparecem com frequência?",
          ajuda:
            "Como essas opiniões são coletadas? O que diferencia a {clinica} na percepção dos pacientes?",
        },
      ],
    },
    {
      id: "indicadores",
      rotulo: "Indicadores",
      titulo: "Números para orientar o planejamento",
      instrucao:
        "Preencha os três últimos meses completos. Considere pacientes únicos separadamente do número de sessões: uma pessoa atendida quatro vezes representa um paciente e quatro atendimentos.",
      campos: [
        {
          tipo: "tabela_mensal",
          id: "indicadores",
          rotulo: "Indicador",
          meses: 3,
          linhas: [
            { id: "faturamento_total", rotulo: "Faturamento total (R$)" },
            { por_tabela: "servicos", modelo: "Receita de {item} (R$)", ignorar: ["Avaliação inicial"] },
            { id: "pacientes_unicos", rotulo: "Pacientes únicos atendidos" },
            { id: "novos_pacientes", rotulo: "Novos pacientes atendidos" },
            { id: "total_atendimentos", rotulo: "Total de atendimentos realizados" },
            { id: "ticket_medio", rotulo: "Ticket médio por atendimento (R$)" },
            { id: "gasto_medio_paciente", rotulo: "Gasto médio por paciente no mês (R$)" },
            { id: "novos_interessados", rotulo: "Novos interessados que entraram em contato" },
            { id: "consultas_agendadas", rotulo: "Primeiras consultas agendadas" },
            { id: "consultas_realizadas", rotulo: "Primeiras consultas realizadas" },
            { id: "investimento_anuncios", rotulo: "Investimento em anúncios (R$)" },
          ],
          nota:
            "Use o mesmo critério financeiro nos três meses e evite somar a mesma receita em mais de um serviço. Os contatos e agendamentos do mês podem se referir a pessoas de períodos diferentes.",
        },
        {
          tipo: "texto",
          id: "fonte_dados",
          pergunta:
            "Os valores acima representam serviços vendidos, realizados ou dinheiro recebido?",
          ajuda:
            "Informe a fonte dos dados e sinalize estimativas. Se houver relatórios dos últimos seis meses, anexe aqui.",
          anexos: true,
        },
        {
          tipo: "texto",
          id: "sistemas_planilhas",
          pergunta: "Quais sistemas ou planilhas usam para agenda, atendimento e financeiro?",
          ajuda:
            "Conseguem relacionar a origem do contato ao atendimento e à receita? Informe também quem pode esclarecer os dados e qualquer informação importante que tenha faltado.",
        },
      ],
    },
  ],
};
