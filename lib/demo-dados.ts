/**
 * Dados fictícios da Academy, dos indicadores e da carteira de clientes.
 *
 * Vive fora de lib/demo.ts de propósito: aquele arquivo é importado pelo
 * middleware (Edge) e não deve carregar este volume de conteúdo.
 */
import type {
  ComentarioComAutor,
  Course,
  IndicadorMensal,
  Lesson,
  Organization,
} from "@/lib/supabase/types";
import { DEMO_ORG_ID, demoOrganization, CONTAS_DEMO } from "@/lib/demo";

// Vídeo público usado só para o player funcionar na demonstração
const VIDEO_DEMO =
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4";

function dias(atras: number): string {
  const d = new Date();
  d.setDate(d.getDate() - atras);
  return d.toISOString();
}

/* ------------------------------------------------------------------ */
/* Trilhas                                                             */
/* ------------------------------------------------------------------ */

type TrilhaDemo = {
  curso: Omit<Course, "created_at">;
  aulas: { titulo: string; descricao: string; duracao: number }[];
};

const TRILHAS: TrilhaDemo[] = [
  {
    curso: {
      id: "c1",
      slug: "secretaria-vendedora",
      titulo: "Secretária Vendedora",
      resumo: "Atendimento que acolhe e conduz o paciente até o agendamento.",
      descricao:
        "A trilha mais importante da operação. Sua secretária sai daqui sabendo conduzir a conversa do primeiro oi até o horário marcado, sem soar comercial demais nem entregar preço e sumir.",
      nivel: "essencial",
      papeis: ["gestor", "secretaria"],
      ordem: 1,
      publicado: true,
    },
    aulas: [
      { titulo: "Por que informar preço não é atender", descricao: "A diferença entre tirar pedido e conduzir uma decisão de saúde.", duracao: 9 },
      { titulo: "Os 4 momentos de uma conversa que converte", descricao: "Acolher, entender, apresentar e combinar o próximo passo.", duracao: 14 },
      { titulo: "Como perguntar sem parecer interrogatório", descricao: "Perguntas que revelam a real necessidade do paciente.", duracao: 11 },
      { titulo: "Apresentando valor antes do preço", descricao: "O que dizer para o preço fazer sentido quando ele chegar.", duracao: 13 },
      { titulo: "Contornando o 'vou pensar'", descricao: "O que está por trás da objeção e como seguir sem pressionar.", duracao: 16 },
      { titulo: "Fechando o agendamento na conversa", descricao: "Técnicas de fechamento que respeitam o tempo do paciente.", duracao: 12 },
      { titulo: "O follow-up que não incomoda", descricao: "Cadência, tom e limite para retomar quem não respondeu.", duracao: 10 },
      { titulo: "Erros que fazem o paciente sumir", descricao: "Os oito deslizes mais comuns no WhatsApp da clínica.", duracao: 15 },
    ],
  },
  {
    curso: {
      id: "c2",
      slug: "contratacao-e-gestao-da-secretaria",
      titulo: "Contratação e Gestão da Secretária",
      resumo: "Como escolher, treinar e acompanhar quem atende sua clínica.",
      descricao:
        "Para o gestor que cansou de trocar de secretária a cada seis meses. Processo de seleção, onboarding, metas e rotina de acompanhamento.",
      nivel: "intermediario",
      papeis: ["gestor"],
      ordem: 2,
      publicado: true,
    },
    aulas: [
      { titulo: "O perfil certo para a sua clínica", descricao: "Competências que importam e as que não fazem diferença.", duracao: 12 },
      { titulo: "Anúncio de vaga e triagem", descricao: "Como escrever a vaga e filtrar currículos sem perder tempo.", duracao: 10 },
      { titulo: "Entrevista com teste prático", descricao: "O roteiro de entrevista e o teste de atendimento simulado.", duracao: 18 },
      { titulo: "Primeiros 30 dias de onboarding", descricao: "O que treinar em cada semana para reduzir o tempo de rampa.", duracao: 14 },
      { titulo: "Metas e comissão sem virar bagunça", descricao: "Como remunerar por resultado numa clínica de saúde.", duracao: 16 },
      { titulo: "Reunião semanal de acompanhamento", descricao: "A pauta de 20 minutos que mantém o time no ritmo.", duracao: 11 },
    ],
  },
  {
    curso: {
      id: "c3",
      slug: "reabordagem-e-reativacao",
      titulo: "Reabordagem e Reativação",
      resumo: "O que dizer para quem não fechou, faltou ou sumiu.",
      descricao:
        "Dinheiro que já está na sua base. Scripts e cadências para recuperar orçamento parado, no-show e paciente antigo.",
      nivel: "essencial",
      papeis: ["gestor", "secretaria"],
      ordem: 3,
      publicado: true,
    },
    aulas: [
      { titulo: "Por que a base parada vale mais que lead novo", descricao: "A conta que mostra o custo de ignorar quem já te conhece.", duracao: 8 },
      { titulo: "Régua de reabordagem em 3 toques", descricao: "Quando falar, o que falar e quando parar.", duracao: 13 },
      { titulo: "Resgatando o no-show no mesmo dia", descricao: "A janela de ouro das primeiras duas horas.", duracao: 9 },
      { titulo: "Campanha de reativação de base", descricao: "Como segmentar e abordar quem não volta há meses.", duracao: 17 },
      { titulo: "Recall de retorno e revisão", descricao: "Transformando protocolo clínico em agenda cheia.", duracao: 12 },
    ],
  },
  {
    curso: {
      id: "c4",
      slug: "processo-comercial-da-clinica",
      titulo: "Processo Comercial da Clínica",
      resumo: "Funil, metas e rotina de acompanhamento do time.",
      descricao:
        "Como estruturar o comercial da clínica com etapas claras, responsáveis definidos e números acompanhados toda semana.",
      nivel: "intermediario",
      papeis: ["gestor", "secretaria"],
      ordem: 4,
      publicado: true,
    },
    aulas: [
      { titulo: "Desenhando o funil da sua clínica", descricao: "Da origem do lead ao paciente em tratamento.", duracao: 15 },
      { titulo: "Quem faz o quê em cada etapa", descricao: "Divisão de responsabilidades sem sobreposição.", duracao: 11 },
      { titulo: "Definindo metas que fazem sentido", descricao: "Meta de agenda, de conversão e de faturamento.", duracao: 14 },
      { titulo: "A rotina semanal do comercial", descricao: "O que revisar toda segunda para não perder o mês.", duracao: 10 },
      { titulo: "Usando o CRM no dia a dia", descricao: "Higiene de funil: o que atualizar e quando.", duracao: 13 },
    ],
  },
  {
    curso: {
      id: "c5",
      slug: "marketing-para-a-clinica",
      titulo: "Marketing para a Clínica",
      resumo: "Como ler os números das campanhas e cobrar resultado.",
      descricao:
        "Você não precisa saber configurar anúncio, precisa saber ler o resultado. Esta trilha traduz as métricas que importam.",
      nivel: "essencial",
      papeis: ["gestor", "medico"],
      ordem: 5,
      publicado: true,
    },
    aulas: [
      { titulo: "As 6 métricas que você precisa entender", descricao: "Investimento, lead, CPL, agendamento, comparecimento e ROI.", duracao: 16 },
      { titulo: "Quanto deve custar um paciente novo", descricao: "Como chegar no seu número, por especialidade.", duracao: 12 },
      { titulo: "Lendo o relatório sem se enganar", descricao: "As armadilhas de métrica de vaidade.", duracao: 14 },
      { titulo: "Publicidade médica dentro do CFM", descricao: "O que pode, o que não pode e onde a maioria erra.", duracao: 18 },
    ],
  },
  {
    curso: {
      id: "c6",
      slug: "onboarding-da-plataforma",
      titulo: "Onboarding da Plataforma",
      resumo: "Primeiros passos no painel, para cada papel da equipe.",
      descricao:
        "Comece por aqui. Em menos de uma hora sua equipe sabe operar agenda, CRM e atendimento dentro da plataforma.",
      nivel: "essencial",
      papeis: ["gestor", "secretaria", "medico"],
      ordem: 6,
      publicado: true,
    },
    aulas: [
      { titulo: "Conhecendo o painel", descricao: "O que cada módulo faz e quem acessa o quê.", duracao: 7 },
      { titulo: "Operando a agenda", descricao: "Criar consulta, confirmar, remarcar e bloquear horário.", duracao: 12 },
      { titulo: "Configurando sua disponibilidade", descricao: "Horários semanais, bloqueios e férias.", duracao: 8 },
      { titulo: "Acompanhando seus indicadores", descricao: "Onde ver os números e como interpretá-los.", duracao: 9 },
      { titulo: "Usando a Academy", descricao: "Progresso, certificado e como tirar dúvidas nas aulas.", duracao: 6 },
    ],
  },
];

export function demoCourses(): Course[] {
  return TRILHAS.map((t, i) => ({
    ...t.curso,
    created_at: dias(200 - i * 20),
  }));
}

export function demoLessons(courseId?: string): Lesson[] {
  const todas = TRILHAS.flatMap((t) =>
    t.aulas.map((a, i) => ({
      id: `${t.curso.id}-a${i + 1}`,
      course_id: t.curso.id,
      slug: `aula-${i + 1}`,
      titulo: a.titulo,
      descricao: a.descricao,
      // Só a primeira trilha tem vídeo em todas as aulas; nas demais o
      // conteúdo aparece parcialmente publicado, como numa operação real
      video_url: t.curso.id === "c1" || i < 2 ? VIDEO_DEMO : null,
      material_url: i === 0 ? "https://example.com/material.pdf" : null,
      duracao_min: a.duracao,
      ordem: i + 1,
      publicado: true,
      created_at: dias(180 - i),
    }))
  );
  return courseId ? todas.filter((a) => a.course_id === courseId) : todas;
}

/** Aulas que o usuário de demonstração já concluiu. */
export function demoAulasConcluidas(): string[] {
  return [
    "c1-a1", "c1-a2", "c1-a3", "c1-a4", "c1-a5",
    "c3-a1", "c3-a2",
    "c6-a1", "c6-a2", "c6-a3", "c6-a4", "c6-a5",
  ];
}

/** Data fictícia da conclusão da trilha, usada no certificado do modo demo. */
export function demoDataConclusao(): string {
  const d = new Date();
  d.setDate(d.getDate() - 12);
  return d.toISOString();
}

/* ------------------------------------------------------------------ */
/* Comentários das aulas                                               */
/* ------------------------------------------------------------------ */

const secretaria = CONTAS_DEMO[1].profile;
const gestor = CONTAS_DEMO[2].profile;
const equipe = CONTAS_DEMO[3].profile;

const COMENTARIOS: Record<string, ComentarioComAutor[]> = {
  "c1-a5": [
    {
      id: "cm1",
      lesson_id: "c1-a5",
      user_id: secretaria.id,
      organization_id: DEMO_ORG_ID,
      parent_id: null,
      conteudo:
        "Quando o paciente diz que vai pensar e depois some, quanto tempo eu espero antes de mandar a segunda mensagem? Tenho medo de parecer insistente.",
      created_at: dias(4),
      autor_nome: secretaria.nome ?? "Atendimento",
      autor_papel: "secretaria",
      respostas: [
        {
          id: "cm1r1",
          lesson_id: "c1-a5",
          user_id: equipe.id,
          organization_id: DEMO_ORG_ID,
          parent_id: "cm1",
          conteudo:
            "Espere 48 horas para o segundo toque e mais 4 dias para o terceiro. O segredo não é o intervalo, é trazer informação nova em cada mensagem em vez de repetir o mesmo lembrete. Na aula 7 mostramos três exemplos prontos.",
          created_at: dias(3),
          autor_nome: equipe.nome ?? "Equipe Medi Marketing",
          autor_papel: "super_admin",
        },
      ],
    },
  ],
  "c1-a2": [
    {
      id: "cm2",
      lesson_id: "c1-a2",
      user_id: gestor.id,
      organization_id: DEMO_ORG_ID,
      parent_id: null,
      conteudo:
        "Dá para aplicar esses 4 momentos também no atendimento por telefone ou funciona melhor só no WhatsApp?",
      created_at: dias(9),
      autor_nome: gestor.nome ?? "Gestor",
      autor_papel: "gestor",
      respostas: [],
    },
  ],
  "c3-a3": [
    {
      id: "cm3",
      lesson_id: "c3-a3",
      user_id: secretaria.id,
      organization_id: DEMO_ORG_ID,
      parent_id: null,
      conteudo:
        "No caso de teleconsulta o resgate de no-show funciona igual? O paciente costuma sumir mais.",
      created_at: dias(1),
      autor_nome: secretaria.nome ?? "Atendimento",
      autor_papel: "secretaria",
      respostas: [],
    },
  ],
};

export function demoComentarios(lessonId: string): ComentarioComAutor[] {
  return COMENTARIOS[lessonId] ?? [];
}

/** Todos os comentários, para a fila de respostas do painel administrativo. */
export function demoTodosComentarios(): ComentarioComAutor[] {
  return Object.values(COMENTARIOS).flat();
}

/* ------------------------------------------------------------------ */
/* Indicadores mensais                                                 */
/* ------------------------------------------------------------------ */

/** Doze meses de evolução, do mês atual para trás. */
export function demoIndicadores(): IndicadorMensal[] {
  // Curva de amadurecimento coerente com o método (30/90/180/360 dias)
  const serie = [
    { investimento: 4000, leads: 42, agendamentos: 18, comparecimentos: 12, faturamento: 14400 },
    { investimento: 4000, leads: 51, agendamentos: 24, comparecimentos: 17, faturamento: 20400 },
    { investimento: 4500, leads: 58, agendamentos: 29, comparecimentos: 21, faturamento: 25200 },
    { investimento: 4500, leads: 63, agendamentos: 34, comparecimentos: 26, faturamento: 32500 },
    { investimento: 5000, leads: 71, agendamentos: 40, comparecimentos: 31, faturamento: 39680 },
    { investimento: 5000, leads: 78, agendamentos: 45, comparecimentos: 36, faturamento: 46080 },
    { investimento: 5500, leads: 84, agendamentos: 51, comparecimentos: 41, faturamento: 53300 },
    { investimento: 5500, leads: 89, agendamentos: 56, comparecimentos: 46, faturamento: 59800 },
    { investimento: 6000, leads: 96, agendamentos: 62, comparecimentos: 51, faturamento: 66300 },
    { investimento: 6000, leads: 103, agendamentos: 68, comparecimentos: 57, faturamento: 74100 },
    { investimento: 6500, leads: 112, agendamentos: 75, comparecimentos: 63, faturamento: 82530 },
    { investimento: 6500, leads: 118, agendamentos: 81, comparecimentos: 69, faturamento: 90390 },
  ];

  const hoje = new Date();
  return serie.map((s, i) => {
    // i=0 é o mês mais antigo (11 meses atrás)
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - (serie.length - 1 - i), 1);
    const mes = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
    return {
      id: `ind-${mes}`,
      organization_id: DEMO_ORG_ID,
      mes,
      ...s,
      observacao: null,
      atualizado_em: new Date(d).toISOString(),
    };
  });
}

/* ------------------------------------------------------------------ */
/* Carteira de clientes (painel administrativo)                        */
/* ------------------------------------------------------------------ */

export type ClienteResumo = Organization & {
  usuarios: number;
  consultas_mes: number;
  leads_mes: number;
  faturamento_mes: number;
};

export function demoClientes(): ClienteResumo[] {
  return [
    {
      ...demoOrganization,
      usuarios: 3,
      consultas_mes: 81,
      leads_mes: 118,
      faturamento_mes: 90390,
    },
    {
      id: "org-2",
      nome: "Odonto Sorriso Real",
      slug: "sorriso-real",
      especialidade: "Odontologia",
      plano: "full",
      cidade: "Curitiba, PR",
      telefone: "(41) 3222-1010",
      email: "contato@sorrisoreal.com.br",
      ativo: true,
      created_at: dias(420),
      usuarios: 7,
      consultas_mes: 164,
      leads_mes: 231,
      faturamento_mes: 187400,
    },
    {
      id: "org-3",
      nome: "Instituto Nutrir",
      slug: "instituto-nutrir",
      especialidade: "Nutrição",
      plano: "essencial",
      cidade: "Recife, PE",
      telefone: "(81) 3444-2020",
      email: "contato@nutrir.com.br",
      ativo: true,
      created_at: dias(95),
      usuarios: 2,
      consultas_mes: 43,
      leads_mes: 61,
      faturamento_mes: 25800,
    },
    {
      id: "org-4",
      nome: "Clínica Longevità",
      slug: "longevita",
      especialidade: "Longevidade",
      plano: "performance",
      cidade: "Florianópolis, SC",
      telefone: "(48) 3555-3030",
      email: "contato@longevita.com.br",
      ativo: true,
      created_at: dias(210),
      usuarios: 5,
      consultas_mes: 96,
      leads_mes: 143,
      faturamento_mes: 132500,
    },
    {
      id: "org-5",
      nome: "Núcleo Ortopédico Campinas",
      slug: "nucleo-ortopedico",
      especialidade: "Ortopedia",
      plano: "performance",
      cidade: "Campinas, SP",
      telefone: "(19) 3777-4040",
      email: "contato@nucleoortopedico.com.br",
      ativo: false,
      created_at: dias(520),
      usuarios: 4,
      consultas_mes: 0,
      leads_mes: 0,
      faturamento_mes: 0,
    },
  ];
}
