/**
 * CONTEÚDO DA PROPOSTA COMERCIAL
 *
 * Separado do visual porque quem revisa argumento de venda não deve
 * precisar mexer em JSX — e porque o texto muda com muito mais
 * frequência que o layout.
 *
 * A ordem das telas segue a conversa que funciona: primeiro o que dói,
 * depois o que fazemos, depois a prova de que fazemos, e só então o
 * preço. Preço antes de valor vira comparação de tabela.
 */

/** Tela 2 — o que a clínica vive hoje, dito sem acusação. */
export const diagnostico = [
  {
    icone: "PhoneMissed",
    titulo: "Paciente que liga e não é atendido",
    texto:
      "Fora do horário, no almoço, com a recepção ocupada. Quem não é atendido em minutos procura o próximo da lista.",
  },
  {
    icone: "CalendarX",
    titulo: "Buraco na agenda por falta",
    texto:
      "Cada falta é um horário que não volta e um paciente que talvez não remarque. Quase sempre é esquecimento, não descaso.",
  },
  {
    icone: "Unplug",
    titulo: "Marketing que não conversa com o atendimento",
    texto:
      "Anúncio traz o contato, e ele se perde entre a mensagem, a planilha e a agenda. O investimento vira custo, não retorno.",
  },
  {
    icone: "TrendingDown",
    titulo: "Base parada valendo dinheiro",
    texto:
      "Pacientes que já confiaram em você e não voltam. É a receita mais barata que existe e a mais esquecida.",
  },
] as const;

/** Tela 3 — os quatro pilares, em uma linha cada. */
export const entregas = [
  {
    icone: "Megaphone",
    titulo: "Marketing que traz o paciente certo",
    itens: [
      "Google Ads para quem procura seu especialista agora",
      "Meta Ads no Instagram e Facebook",
      "Landing pages e conteúdo que geram contato",
      "Publicidade dentro das normas do CFM",
    ],
  },
  {
    icone: "Headset",
    titulo: "Sua equipe treinada para não perder paciente",
    itens: [
      "Formação da recepção: script, tom e condução até o agendamento",
      "Time comercial da clínica preparado para não deixar contato sem resposta",
      "Rotina de retorno para orçamento em aberto e paciente que sumiu",
      "Padrão de atendimento que transmite valor e profissionalismo",
    ],
  },
  {
    icone: "Repeat",
    titulo: "Retenção de quem já é seu",
    itens: [
      "Régua de retorno por especialidade",
      "Reativação de base parada",
      "Aniversário, pós-consulta e orçamento não fechado",
      "Scripts prontos para a equipe usar",
    ],
  },
  {
    icone: "BarChart3",
    titulo: "Números que você entende",
    itens: [
      "Leads, agendamentos e comparecimento",
      "Custo por lead e custo por paciente",
      "Ticket médio, retorno e faturamento",
      "Relatório para exportar e apresentar",
    ],
  },
] as const;

/**
 * O método, em cinco tempos.
 *
 * É o que diferencia um plano de um pacote de serviços avulsos: existe
 * uma ordem, e ela foi testada em mais de cem clínicas. Cada etapa só
 * começa quando a anterior está de pé, e é por isso que o faturamento
 * cresce em vez de oscilar.
 */
export const metodoProposta = [
  {
    quando: "Semana 1",
    etapa: "Diagnóstico",
    titulo: "Entender antes de mexer",
    texto:
      "Agenda, origem dos pacientes, processo de atendimento e números atuais. Você sai com um plano escrito e metas de 30, 90, 180 e 360 dias.",
  },
  {
    quando: "30 dias",
    etapa: "Implantação",
    titulo: "Estrutura no ar",
    texto:
      "Plataforma configurada, equipe treinada, campanhas publicadas e a confirmação rodando. A clínica passa a operar num lugar só.",
  },
  {
    quando: "90 dias",
    etapa: "Conversão",
    titulo: "O atendimento vira comercial",
    texto:
      "Script, funil e follow-up em uso diário. A recepção deixa de ser tiradora de pedido e passa a conduzir o paciente até a consulta.",
  },
  {
    quando: "180 dias",
    etapa: "Retenção",
    titulo: "Faturar de novo com quem já é seu",
    texto:
      "Réguas de retorno, recall e reativação ligadas. O paciente que já custou caro para chegar volta a gerar receita.",
  },
  {
    quando: "360 dias",
    etapa: "Escala",
    titulo: "Previsibilidade",
    texto:
      "Com histórico no painel, dá para prever quanto investir para faturar quanto. A partir daí é escalar o que já funciona.",
  },
] as const;

/** Tela 5 — o ciclo automático, que é onde a promessa fica concreta. */
export const cicloAutomatico = [
  {
    quando: "Ao marcar",
    titulo: "O paciente recebe o comprovante",
    texto: "Por e-mail e pelo WhatsApp da sua clínica, com data, horário e local.",
  },
  {
    quando: "Um dia útil antes",
    titulo: "O lembrete sai sozinho",
    texto: "Ninguém precisa lembrar de mandar. Sai na hora que você escolheu.",
  },
  {
    quando: "O paciente responde",
    titulo: "Confirma em um toque",
    texto: "Um botão, sem instalar nada. Sua agenda muda de status na hora.",
  },
  {
    quando: "Se pedir para remarcar",
    titulo: "Vira alerta imediato",
    texto: "Com o telefone dele na mensagem, enquanto dá tempo de salvar a vaga.",
  },
] as const;

/** Tela 7 — por que nós, e não a agência do lado. */
export const porQueNos = [
  {
    icone: "MonitorSmartphone",
    titulo: "Ferramenta própria, não só serviço",
    texto:
      "A maioria entrega relatório em PDF. Aqui você recebe o sistema que roda a clínica, com dado atualizado o tempo todo.",
  },
  {
    icone: "Stethoscope",
    titulo: "Só saúde",
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
    icone: "ShieldCheck",
    titulo: "Dentro das normas",
    texto:
      "Campanhas respeitando o Código de Ética Médica e as resoluções do CFM, com LGPD levada a sério nos dados.",
  },
] as const;

/**
 * Tela 8 — o que cada plano entrega.
 *
 * Cada item carrega o próprio ícone. Numa lista de seis checks iguais
 * o olho não separa "Google Ads" de "Relatório mensal", e é justamente
 * a diferença entre os planos que o cliente está tentando enxergar.
 *
 * `nota` é a condição de investimento que não cabe no número: o Full
 * é parceria, e o combinado com a clínica soma mensalidade e um
 * percentual sobre o crescimento. Aparece embaixo do preço, que é onde
 * a pergunta "quanto custa" está sendo feita.
 */
export const planosProposta = [
  {
    id: "essencial" as const,
    nome: "Essencial",
    resumo: "Organizar a casa e começar a atrair paciente.",
    para: "Para quem ainda não tem processo",
    itens: [
      { icone: "LayoutDashboard", texto: "Plataforma completa: agenda, CRM e confirmações" },
      { icone: "CalendarCheck", texto: "Lembrete e confirmação automáticos pelo seu WhatsApp" },
      { icone: "Megaphone", texto: "Google Ads e Meta Ads" },
      { icone: "MonitorSmartphone", texto: "Landing page de captação" },
      { icone: "BarChart3", texto: "Relatório mensal de resultado" },
      { icone: "MessageCircle", texto: "Suporte por WhatsApp" },
    ],
    nota: null,
  },
  {
    id: "performance" as const,
    nome: "Performance",
    resumo: "O método completo: aquisição, atendimento e retenção.",
    para: "O plano da maioria das clínicas",
    itens: [
      { icone: "Layers", texto: "Tudo do Essencial" },
      { icone: "MessagesSquare", texto: "Central de atendimento: WhatsApp, Instagram e Facebook" },
      { icone: "Repeat", texto: "Réguas de retenção e reativação de base" },
      { icone: "GraduationCap", texto: "Academy: formação da recepção e do comercial" },
      { icone: "Users", texto: "Reunião mensal de resultado" },
      { icone: "ScrollText", texto: "Scripts comerciais da sua especialidade" },
    ],
    nota: null,
  },
  {
    id: "full" as const,
    nome: "Full / Parceria",
    resumo: "Escalar com time e inteligência dedicados.",
    para: "Para clínicas com meta agressiva",
    itens: [
      { icone: "Layers", texto: "Tudo do Performance" },
      { icone: "Globe", texto: "Site completo da clínica, além da landing page" },
      { icone: "PenLine", texto: "Assessoria de conteúdo para as redes" },
      { icone: "MapPin", texto: "Google Meu Negócio otimizado e gerenciado" },
      { icone: "Bot", texto: "Presença nas buscas com IA, como o ChatGPT" },
      { icone: "GraduationCap", texto: "Treinamento de vendas para a equipe" },
      { icone: "Target", texto: "Estruturação comercial da clínica" },
      { icone: "Headset", texto: "Recepção remota e SDR dedicado" },
      { icone: "LineChart", texto: "BI avançado e metas por período" },
      { icone: "HeartHandshake", texto: "Mentoria e acompanhamento semanal" },
    ],
    nota: "Mensalidade + 5% sobre o aumento de faturamento",
  },
] as const;

/** Tela 9 — o que tira o medo de assinar. */
export const seguranca = [
  {
    titulo: "Sem fidelidade",
    texto: "Você fica porque está dando resultado, não porque assinou um papel.",
  },
  {
    titulo: "Implantação em até 15 dias",
    texto: "Plataforma no ar, base importada, equipe treinada e campanhas rodando.",
  },
  {
    titulo: "Seus dados são seus",
    texto: "Exportáveis a qualquer momento. Se sair, leva sua base com você.",
  },
  {
    titulo: "Uma clínica por região",
    texto: "Não atendemos concorrentes diretos na mesma praça e especialidade.",
  },
] as const;

/** Tela 10 — o que acontece depois do aceite. */
export const proximosPassos = [
  {
    passo: "01",
    titulo: "Você aceita por aqui",
    texto: "Um clique nesta página. Nada de contrato de vinte páginas para ler.",
  },
  {
    passo: "02",
    titulo: "Reunião de diagnóstico",
    texto: "Uma hora para entender sua rotina, sua agenda e seus números.",
  },
  {
    passo: "03",
    titulo: "Implantação",
    texto: "Configuramos tudo, importamos sua base e treinamos sua equipe.",
  },
  {
    passo: "04",
    titulo: "Primeira campanha no ar",
    texto: "Em até 15 dias, com a agenda já organizada para receber.",
  },
] as const;
