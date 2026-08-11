/**
 * Conteúdo/copy do site comercial.
 *
 * Tudo centralizado aqui para revisar texto e números sem mexer nos
 * componentes. Os itens marcados com TODO precisam de dado real antes
 * de ir para produção.
 */

/* ------------------------------------------------------------------ */
/* Prova social — números fáceis de atualizar                          */
/* ------------------------------------------------------------------ */
export const numeros = [
  // TODO: substituir pelos números reais e atualizar periodicamente
  { icone: "Stethoscope", valor: "+120", label: "médicos e clínicas atendidos" },
  { icone: "Banknote", valor: "R$ 38 mi", label: "gerados em faturamento para clientes" },
  { icone: "CalendarCheck", valor: "+90 mil", label: "consultas agendadas pela nossa operação" },
  { icone: "TrendingDown", valor: "-41%", label: "de faltas com a régua de confirmação" },
] as const;

/** Segmentos atendidos — usados na faixa de credibilidade do topo. */
export const segmentos = [
  "Clínicas médicas",
  "Odontologia",
  "Nutrição",
  "Longevidade",
  "Estética com viés de saúde",
] as const;

/* ------------------------------------------------------------------ */
/* Dores                                                               */
/* ------------------------------------------------------------------ */
export const dores = [
  {
    icone: "PhoneMissed",
    titulo: "Perco consultas por falta de atendimento",
    texto:
      "O telefone toca, o WhatsApp acumula e você está no meio de um atendimento. Cada mensagem sem resposta é um paciente que marca com outro.",
  },
  {
    icone: "UserRoundX",
    titulo: "Perco quem não confirmou e quem não voltou",
    texto:
      "Paciente que faltou, orçamento que não fechou, base parada há meses. É dinheiro já conquistado escapando por falta de um retorno.",
  },
  {
    icone: "MessageSquareX",
    titulo: "Minha secretária atende, mas não vende",
    texto:
      "Ela informa preço e horário com educação, e encerra a conversa. Falta processo, script e acompanhamento para transformar contato em consulta.",
  },
  {
    icone: "TrendingDown",
    titulo: "Não tenho clareza dos meus números",
    texto:
      "Quanto custa cada paciente novo? Qual campanha trouxe faturamento? Sem indicador, a decisão vira achismo.",
  },
  {
    icone: "Unplug",
    titulo: "Meu marketing e meu atendimento não conversam",
    texto:
      "O anúncio gera lead, o lead cai no WhatsApp e some. Ninguém sabe o que aconteceu entre uma coisa e outra.",
  },
  {
    icone: "CalendarX",
    titulo: "Minha agenda é uma bagunça",
    texto:
      "WhatsApp, papel, caderno e a memória. Sem um lugar único, sobram encaixes errados, faltas e horários vagos.",
  },
  {
    icone: "Hourglass",
    titulo: "Sei que preciso de marketing, mas não tenho tempo",
    texto:
      "Você entende de medicina, não de anúncios. E aprender tudo isso sozinho toma um tempo que você não tem.",
  },
  {
    icone: "Banknote",
    titulo: "Já anunciei e só gastei dinheiro",
    texto:
      "Campanhas mal configuradas atraem curioso, não paciente. O resultado é orçamento queimado e nenhuma consulta nova.",
  },
] as const;

/* ------------------------------------------------------------------ */
/* O Método — jornada por tempo                                        */
/* ------------------------------------------------------------------ */
export const metodo = [
  {
    etapa: "Diagnóstico",
    prazo: "Semana 1",
    titulo: "Entender a clínica antes de mexer em qualquer coisa",
    texto:
      "Mapeamos agenda, origem dos pacientes, processo de atendimento e números atuais. Saímos com um plano escrito, não com um palpite.",
    entregas: [
      "Raio-X da agenda e da ocupação",
      "Diagnóstico do atendimento e do comercial",
      "Metas de 30, 90, 180 e 360 dias",
    ],
  },
  {
    etapa: "30 dias",
    prazo: "Implantação",
    titulo: "Estrutura no ar e agenda organizada",
    texto:
      "Plataforma configurada, equipe treinada, campanhas publicadas e a régua de confirmação rodando. A clínica passa a operar em um lugar só.",
    entregas: [
      "Painel e agenda implantados",
      "Campanhas de Google e Meta no ar",
      "Confirmação ativa reduzindo faltas",
    ],
  },
  {
    etapa: "90 dias",
    prazo: "Conversão",
    titulo: "O atendimento vira comercial",
    texto:
      "Scripts, funil e follow-up em uso diário. A secretária deixa de ser tiradora de pedido e passa a conduzir o paciente até a consulta.",
    entregas: [
      "Funil comercial rodando no CRM",
      "Trilha Secretária Vendedora concluída",
      "Taxa de conversão de lead em consulta medida",
    ],
  },
  {
    etapa: "180 dias",
    prazo: "Retenção",
    titulo: "Faturar de novo com quem já é seu",
    texto:
      "Réguas de reabordagem, no-show, recall e reativação de base ligadas. O paciente que já custou caro volta a gerar receita.",
    entregas: [
      "Réguas automatizadas ativas",
      "Recuperação de base parada",
      "Ticket médio e retorno acompanhados",
    ],
  },
  {
    etapa: "360 dias",
    prazo: "Escala",
    titulo: "Previsibilidade e crescimento",
    texto:
      "Com histórico no painel, dá para prever quanto investir para faturar quanto. A partir daí é escalar o que já funciona.",
    entregas: [
      "BI completo de investimento a faturamento",
      "Custo por paciente e LTV consolidados",
      "Plano de expansão baseado em dado",
    ],
  },
] as const;

/* ------------------------------------------------------------------ */
/* Soluções / pilares de serviço                                       */
/* ------------------------------------------------------------------ */
export const solucoes = [
  {
    icone: "Megaphone",
    titulo: "Marketing e Aquisição",
    resumo: "Pacientes certos chegando até você, todo mês.",
    itens: [
      "Google Ads para quem procura seu especialista agora",
      "Meta Ads no Instagram e Facebook",
      "Landing pages e conteúdo que geram contato",
      "SEO local para aparecer na sua região",
      "Publicidade dentro das normas do CFM",
    ],
  },
  {
    icone: "Headset",
    titulo: "Atendimento e Recepção",
    resumo: "Equipe humana atendendo em todos os canais.",
    itens: [
      "Atendentes treinadas respondendo por você",
      "Central omnichannel: WhatsApp, Instagram e Facebook",
      "Agendamento e confirmação registrados na hora",
      "Cobertura nos horários em que o paciente procura",
    ],
  },
  {
    icone: "Target",
    titulo: "Comercial e CRM",
    resumo: "Contato vira consulta com processo, não com sorte.",
    itens: [
      "Funil comercial visual do lead ao tratamento",
      "Scripts de venda por especialidade",
      "Tarefas e follow-up para a secretária",
      "Origem de cada paciente rastreada",
    ],
  },
  {
    icone: "Repeat",
    titulo: "Retenção e Reativação",
    resumo: "Faturar de novo com quem já passou pela clínica.",
    itens: [
      "Reabordagem de quem não fechou",
      "Resgate de no-show no mesmo dia",
      "Reativação de base parada",
      "Recall de retorno e revisão",
    ],
  },
  {
    icone: "GraduationCap",
    titulo: "Treinamento / Academy",
    resumo: "Sua equipe treinada, com trilha e certificado.",
    itens: [
      "Secretária Vendedora / Atendimento que Converte",
      "Contratação e gestão da secretária",
      "Reabordagem e reativação na prática",
      "Processo comercial da clínica",
    ],
  },
  {
    icone: "CalendarDays",
    titulo: "Agenda e Plataforma",
    resumo: "Tudo em um painel só, no computador ou no celular.",
    itens: [
      "Agenda por mês, semana e dia",
      "Status de confirmação em tempo real",
      "Disponibilidade e bloqueios sob seu controle",
      "Acesso por papel: gestor, secretária e médico",
    ],
  },
  {
    icone: "BarChart3",
    titulo: "Dados e Resultados",
    resumo: "Do investimento ao faturamento, sem jargão.",
    itens: [
      "Leads, agendamentos e comparecimento",
      "Custo por lead e custo por paciente",
      "Ticket médio, retorno e LTV",
      "Relatório para exportar e apresentar",
    ],
  },
] as const;

/* ------------------------------------------------------------------ */
/* Módulos da plataforma (seção "A Plataforma")                        */
/* ------------------------------------------------------------------ */
export const modulosPlataforma = [
  {
    icone: "CalendarDays",
    titulo: "Agenda",
    texto:
      "Mês, semana e dia com status de cada consulta, bloqueios, encaixes e controle de faltas, atualizada em tempo real entre secretária e médico.",
  },
  {
    icone: "Users",
    titulo: "CRM e Funil",
    texto:
      "Cada lead numa etapa clara: novo, em contato, agendado, compareceu, em tratamento. Com histórico, tarefas e origem do paciente.",
  },
  {
    icone: "MessagesSquare",
    titulo: "Central de Atendimento",
    texto:
      "WhatsApp, Instagram e Facebook numa caixa de entrada única, ligada à ficha do paciente, com scripts prontos e distribuição entre atendentes.",
  },
  {
    icone: "Megaphone",
    titulo: "Marketing",
    texto:
      "Campanhas de Google e Meta com investimento, leads, custo por lead e retorno, do jeito que dá para entender sem ser publicitário.",
  },
  {
    icone: "Repeat",
    titulo: "Retenção",
    texto:
      "Réguas de reabordagem, no-show, reativação e recall com cadência editável e alerta de paciente parado há muito tempo.",
  },
  {
    icone: "GraduationCap",
    titulo: "Academy",
    texto:
      "Trilhas em vídeo para a equipe, com progresso por pessoa e certificado ao final. Onboarding da plataforma incluído.",
  },
  {
    icone: "BarChart3",
    titulo: "Indicadores",
    texto:
      "A linha inteira: investimento, leads, agendamentos, comparecimento, faturamento e ROI, comparando períodos e etapas do método.",
  },
] as const;

/* ------------------------------------------------------------------ */
/* Academy — trilhas                                                   */
/* ------------------------------------------------------------------ */
export const trilhasAcademy = [
  {
    titulo: "Secretária Vendedora",
    texto: "Atendimento que acolhe e conduz o paciente até o agendamento.",
    aulas: 12,
  },
  {
    titulo: "Contratação e Gestão da Secretária",
    texto: "Como escolher, treinar e acompanhar quem atende sua clínica.",
    aulas: 8,
  },
  {
    titulo: "Reabordagem e Reativação",
    texto: "O que dizer para quem não fechou, faltou ou sumiu.",
    aulas: 9,
  },
  {
    titulo: "Processo Comercial da Clínica",
    texto: "Funil, metas e rotina de acompanhamento do time.",
    aulas: 10,
  },
  {
    titulo: "Marketing para a Clínica",
    texto: "Como ler os números das campanhas e cobrar resultado.",
    aulas: 7,
  },
  {
    titulo: "Onboarding da Plataforma",
    texto: "Primeiros passos no painel, para cada papel da equipe.",
    aulas: 6,
  },
] as const;

/** Isca de captação vinculada à Academy. */
export const iscaAcademy = {
  titulo: "Scripts de reabordagem para copiar e colar",
  texto:
    "As mensagens que a nossa operação usa para recuperar quem não confirmou, quem faltou e quem sumiu. Sem enrolação, prontas para usar hoje.",
  cta: "Receber os scripts no WhatsApp",
} as const;

/* ------------------------------------------------------------------ */
/* Como funciona (3 passos)                                            */
/* ------------------------------------------------------------------ */
export const comoFunciona = [
  {
    passo: "01",
    titulo: "Diagnóstico",
    texto:
      "Entendemos sua rotina, sua especialidade, seus números e seus objetivos. Você sai com um plano, não com uma proposta genérica.",
  },
  {
    passo: "02",
    titulo: "Implantação",
    texto:
      "Configuramos a plataforma, importamos sua base, treinamos a equipe e colocamos campanhas e réguas no ar.",
  },
  {
    passo: "03",
    titulo: "Operação",
    texto:
      "Sua agenda enche, seu paciente é bem atendido e você acompanha tudo pelo painel, com reunião de resultado no seu plano.",
  },
] as const;

/* ------------------------------------------------------------------ */
/* Diferenciais                                                        */
/* ------------------------------------------------------------------ */
export const diferenciais = [
  {
    icone: "MonitorSmartphone",
    titulo: "Ferramenta própria, não só serviço",
    texto:
      "A maioria entrega relatório em PDF. Aqui você tem o sistema que roda a clínica, com dado atualizado o tempo todo.",
  },
  {
    icone: "Stethoscope",
    titulo: "Foco exclusivo em saúde",
    texto:
      "Clínicas, consultórios, odontologia, nutrição e longevidade. Conhecemos o paciente, a jornada e a ética da área.",
  },
  {
    icone: "Layers",
    titulo: "Tudo integrado",
    texto:
      "Marketing, atendimento, agenda e retenção conversando entre si. Nada de time que joga a culpa no outro.",
  },
  {
    icone: "HeartHandshake",
    titulo: "Atendimento humano",
    texto:
      "Pessoas treinadas e cordiais, não robôs. Seu paciente sente cuidado desde o primeiro contato.",
  },
  {
    icone: "ShieldCheck",
    titulo: "Publicidade dentro das normas",
    texto:
      "Campanhas respeitando o Código de Ética Médica e as resoluções do CFM. E LGPD levada a sério nos dados.",
  },
  {
    icone: "Headset",
    titulo: "Suporte próximo",
    texto:
      "Um time acessível de verdade quando você precisar. Sem fila de robô, sem ticket sem resposta.",
  },
] as const;

/* ------------------------------------------------------------------ */
/* Planos — TODO: confirmar valores e itens comerciais                 */
/* ------------------------------------------------------------------ */
export const planos = [
  {
    id: "essencial",
    nome: "Essencial",
    resumo: "Para organizar a casa e começar a atrair paciente.",
    preco: "R$ 0.000", // TODO: valor real
    periodo: "/mês",
    destaque: false,
    itens: [
      "Plataforma: agenda + CRM básico",
      "Marketing: Google Ads e Meta Ads",
      "Landing page de captação",
      "Relatórios mensais de resultado",
      "Suporte por WhatsApp",
    ],
    naoInclui: ["Central de atendimento", "Réguas de retenção", "Academy"],
    cta: "Começar pelo Essencial",
  },
  {
    id: "performance",
    nome: "Performance",
    resumo: "O método completo: aquisição, atendimento e retenção.",
    preco: "R$ 0.000", // TODO: valor real
    periodo: "/mês",
    destaque: true,
    itens: [
      "Tudo do Essencial",
      "Central de atendimento omnichannel",
      "Réguas de retenção e reativação",
      "Academy liberada para a equipe",
      "Reunião mensal de resultado",
      "Scripts comerciais por especialidade",
    ],
    naoInclui: ["Recepção remota / SDR dedicado"],
    cta: "Quero o método completo",
  },
  {
    id: "full",
    nome: "Full / Parceria",
    resumo: "Para quem quer escalar com time e inteligência dedicados.",
    preco: "Sob consulta",
    periodo: "",
    destaque: false,
    itens: [
      "Tudo do Performance",
      "Estruturação comercial da clínica",
      "Recepção remota / SDR dedicado",
      "Mentoria com o time de gestão",
      "BI avançado e metas por período",
      "Acompanhamento semanal",
    ],
    naoInclui: [],
    cta: "Falar sobre parceria",
  },
] as const;

/* ------------------------------------------------------------------ */
/* Depoimentos                                                         */
/* ------------------------------------------------------------------ */
export const depoimentos = [
  {
    nome: "Dra. Marina Alves",
    especialidade: "Dermatologia",
    cidade: "São Paulo, SP",
    foto: null as string | null,
    texto:
      "Minha agenda parou de ter buracos. O time confirma tudo e as faltas caíram bastante. Hoje eu só me preocupo em atender bem.",
  },
  {
    nome: "Dr. Rafael Costa",
    especialidade: "Ortopedia",
    cidade: "Campinas, SP",
    foto: null as string | null,
    texto:
      "Os anúncios finalmente trouxeram paciente certo. Em dois meses a procura por consultas cresceu de forma consistente.",
  },
  {
    nome: "Dra. Beatriz Nunes",
    especialidade: "Ginecologia",
    cidade: "Belo Horizonte, MG",
    foto: null as string | null,
    texto:
      "Ter a agenda no celular mudou minha rotina. Vejo os horários do dia antes mesmo de chegar no consultório.",
  },
  {
    nome: "Dr. Thiago Mendes",
    especialidade: "Odontologia",
    cidade: "Curitiba, PR",
    foto: null as string | null,
    texto:
      "A régua de reabordagem trouxe de volta orçamento que eu já tinha dado como perdido. Foi a parte que mais me surpreendeu.",
  },
  {
    nome: "Dra. Camila Ferraz",
    especialidade: "Nutrição",
    cidade: "Recife, PE",
    foto: null as string | null,
    texto:
      "Pela primeira vez eu sei quanto custa cada paciente novo. Isso mudou completamente como eu decido onde investir.",
  },
  {
    nome: "Dr. André Pacheco",
    especialidade: "Longevidade",
    cidade: "Florianópolis, SC",
    foto: null as string | null,
    texto:
      "Minha secretária passou pela trilha de atendimento e o resultado apareceu em semanas. Ela conduz a conversa, não só informa preço.",
  },
] as const;

/* ------------------------------------------------------------------ */
/* FAQ                                                                 */
/* ------------------------------------------------------------------ */
export const faq = [
  {
    pergunta: "O que exatamente é a plataforma? É um sistema ou uma agência?",
    resposta:
      "Os dois. Você contrata o serviço (marketing, atendimento, comercial e retenção) e recebe junto o painel onde tudo isso acontece: agenda, CRM, central de atendimento, campanhas, réguas de retenção, treinamentos e indicadores. É a mesma ferramenta que a nossa operação usa para trabalhar na sua clínica.",
  },
  {
    pergunta: "Vocês respeitam as normas do CFM para publicidade?",
    resposta:
      "Sim. Todas as campanhas seguem o Código de Ética Médica e as resoluções do CFM sobre publicidade: sem promessa de resultado, sem sensacionalismo e sem antes/depois indevidos. O foco é informar e aproximar o paciente certo.",
  },
  {
    pergunta: "Como funciona a integração com o WhatsApp?",
    resposta:
      "A central de atendimento reúne WhatsApp, Instagram Direct e Facebook numa caixa de entrada única, ligada à ficha do paciente. A conexão é feita pela API oficial do WhatsApp, com o número da própria clínica. (TODO: confirmar o provedor oficial contratado.)",
  },
  {
    pergunta: "Preciso trocar o sistema que já uso hoje?",
    resposta:
      "Não necessariamente. A plataforma funciona de forma independente e pode ser o seu ponto único de organização. Na implantação avaliamos o que faz sentido migrar e o que pode conviver. Na prática, a maioria das clínicas acaba centralizando por ser mais fácil no dia a dia.",
  },
  {
    pergunta: "Como é a migração da minha base de pacientes?",
    resposta:
      "Na implantação importamos sua base a partir de planilha ou exportação do sistema atual, já organizada por etapa do funil. A partir daí as réguas de reativação passam a trabalhar em cima dela.",
  },
  {
    pergunta: "E a LGPD? Os dados dos meus pacientes ficam seguros?",
    resposta:
      "Cada clínica é um ambiente isolado no banco de dados, com regras de acesso aplicadas linha a linha: ninguém de fora da sua clínica enxerga seus dados. O acesso ainda é limitado por papel, então médico, secretária e gestor veem coisas diferentes. Formulários pedem consentimento explícito e você pode solicitar exclusão de dados a qualquer momento.",
  },
  {
    pergunta: "Quem da minha equipe consegue acessar o painel?",
    resposta:
      "Quantas pessoas você precisar, cada uma com o seu papel. O gestor vê tudo da clínica, incluindo números e financeiro. A secretária opera agenda, CRM, atendimento e retenção. O médico vê a própria agenda, os próprios indicadores e a Academy.",
  },
  {
    pergunta: "Tem fidelidade?",
    resposta:
      "Trabalhamos com contratos justos e sem fidelidade abusiva. A ideia é que você continue porque está tendo resultado, não porque está preso. (TODO: confirmar termos comerciais.)",
  },
  {
    pergunta: "Em quanto tempo vejo resultado?",
    resposta:
      "A organização da agenda e a queda de faltas aparecem já nos primeiros 30 dias. Conversão de lead em consulta costuma amadurecer por volta dos 90 dias, e retenção e previsibilidade a partir dos 180. É exatamente o que o método acompanha.",
  },
  {
    pergunta: "Atendem qualquer especialidade?",
    resposta:
      "Atendemos profissionais e clínicas de saúde: medicina em geral, odontologia, nutrição, longevidade e estética com viés de saúde. Não atendemos salão de beleza. No diagnóstico avaliamos sua área e montamos a estratégia adequada ao seu público.",
  },
] as const;

/* ------------------------------------------------------------------ */
/* Formulário de diagnóstico                                           */
/* ------------------------------------------------------------------ */
export const faixasFaturamento = [
  "Até R$ 20 mil/mês",
  "R$ 20 mil a R$ 50 mil/mês",
  "R$ 50 mil a R$ 100 mil/mês",
  "R$ 100 mil a R$ 300 mil/mês",
  "Acima de R$ 300 mil/mês",
  "Prefiro não informar",
] as const;
