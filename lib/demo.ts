/**
 * MODO DEMONSTRAÇÃO
 * ----------------------------------------------------------------------
 * Quando o Supabase NÃO está configurado, o sistema entra em modo demo:
 * logins de teste fixos (um por papel) e dados fictícios, para navegar
 * pela plataforma sem banco de dados. Alterações não são persistidas.
 *
 * Este arquivo é "puro" (sem next/headers) para poder ser importado tanto
 * no middleware (Edge) quanto em Server Components/Actions.
 */
import type {
  Anexo,
  Bloqueio,
  Consulta,
  Disponibilidade,
  Lead,
  Organization,
  Profile,
  Role,
} from "@/lib/supabase/types";

// Cookie que marca uma sessão de demonstração (guarda o papel escolhido)
export const DEMO_COOKIE = "medi_demo";

// Senha única das contas de teste
export const DEMO_SENHA = "demo1234";

export const DEMO_ORG_ID = "00000000-0000-0000-0000-0000000000aa";

function org(
  id: string,
  nome: string,
  slug: string,
  especialidade: string,
  plano: Organization["plano"],
  cidade: string,
  telefone: string,
  extras: Partial<Organization> = {}
): Organization {
  return {
    id,
    nome,
    slug,
    especialidade,
    plano,
    cidade,
    telefone,
    email: `contato@${slug.replace(/-/g, "")}.com.br`,
    ativo: true,
    cnpj: null,
    endereco: null,
    responsavel: null,
    site: null,
    instagram: `@${slug.replace(/-/g, "")}`,
    mensagem_lembrete: null,
    antecedencia_lembrete_h: 24,
    lembrete_dias_uteis: 1,
    lembrete_hora: 9,
    lembrete_ativo: true,
    created_at: new Date("2024-01-15").toISOString(),
    ...extras,
  };
}

/**
 * Carteira fictícia da Medi Marketing. A primeira é a clínica do usuário
 * de demonstração; as demais existem para o super admin ter o que filtrar.
 */
export const DEMO_ORGANIZACOES: readonly Organization[] = [
  org(
    DEMO_ORG_ID,
    "Clínica Vida Derma",
    "vida-derma",
    "Dermatologia",
    "performance",
    "São Paulo, SP",
    "(11) 3333-4444",
    {
      cnpj: "12.345.678/0001-90",
      endereco: "Rua Oscar Freire, 1200 — Jardins",
      responsavel: "Dr. Paulo Andrade",
      site: "https://vidaderma.com.br",
    }
  ),
  org("org-2", "Odonto Sorriso Real", "sorriso-real", "Odontologia", "full", "Curitiba, PR", "(41) 3222-1010", {
    responsavel: "Dra. Helena Prado",
  }),
  org("org-3", "Instituto Nutrir", "instituto-nutrir", "Nutrição", "essencial", "Recife, PE", "(81) 3444-2020", {
    responsavel: "Dra. Bianca Correia",
  }),
  org("org-4", "Clínica Longevità", "longevita", "Longevidade", "performance", "Florianópolis, SC", "(48) 3555-3030", {
    responsavel: "Dr. Ricardo Mendes",
  }),
  org("org-5", "Núcleo Ortopédico Campinas", "nucleo-ortopedico", "Ortopedia", "performance", "Campinas, SP", "(19) 3777-4040", {
    ativo: false,
    responsavel: "Dr. Sérgio Vasques",
  }),
] as const;

/** Clínica fictícia usada como tenant da demonstração. */
export const demoOrganization: Organization = DEMO_ORGANIZACOES[0];

export function demoOrganizacaoPorId(id: string): Organization | undefined {
  return DEMO_ORGANIZACOES.find((o) => o.id === id);
}

/**
 * Médicos das clínicas fictícias. O primeiro é a conta de demonstração;
 * os demais dão volume ao filtro por profissional na agenda.
 */
export const DEMO_MEDICOS: readonly {
  id: string;
  nome: string;
  organization_id: string;
  especialidade: string;
}[] = [
  { id: "00000000-0000-0000-0000-000000000000", nome: "Dra. Marina Alves", organization_id: DEMO_ORG_ID, especialidade: "Dermatologia" },
  { id: "med-vd-2", nome: "Dr. Paulo Andrade", organization_id: DEMO_ORG_ID, especialidade: "Dermatologia" },
  { id: "med-sr-1", nome: "Dra. Helena Prado", organization_id: "org-2", especialidade: "Implantodontia" },
  { id: "med-sr-2", nome: "Dr. Vitor Camargo", organization_id: "org-2", especialidade: "Ortodontia" },
  { id: "med-in-1", nome: "Dra. Bianca Correia", organization_id: "org-3", especialidade: "Nutrição clínica" },
  { id: "med-lg-1", nome: "Dr. Ricardo Mendes", organization_id: "org-4", especialidade: "Geriatria" },
] as const;

type ContaDemo = {
  email: string;
  role: Role;
  profile: Profile;
};

function perfil(
  id: string,
  role: Role,
  nome: string,
  extras: Partial<Profile> = {}
): Profile {
  return {
    id,
    organization_id: role === "super_admin" ? null : DEMO_ORG_ID,
    nome,
    especialidade: null,
    crm: null,
    telefone: null,
    foto_url: null,
    role,
    ativo: true,
    aguardando_liberacao: false,
    created_at: new Date("2024-01-15").toISOString(),
    ...extras,
  };
}

/** Uma conta de teste por papel — todas com a mesma senha. */
export const CONTAS_DEMO: readonly ContaDemo[] = [
  {
    email: "medico@teste.com",
    role: "medico",
    profile: perfil("00000000-0000-0000-0000-000000000000", "medico", "Dra. Marina Alves", {
      especialidade: "Dermatologia",
      crm: "CRM/SP 123456",
      telefone: "(11) 98888-7777",
    }),
  },
  {
    email: "secretaria@teste.com",
    role: "secretaria",
    profile: perfil("00000000-0000-0000-0000-000000000001", "secretaria", "Camila Rocha", {
      telefone: "(11) 97777-6666",
    }),
  },
  {
    email: "gestor@teste.com",
    role: "gestor",
    profile: perfil("00000000-0000-0000-0000-000000000002", "gestor", "Dr. Paulo Andrade", {
      especialidade: "Dermatologia",
      crm: "CRM/SP 654321",
      telefone: "(11) 96666-5555",
    }),
  },
  {
    email: "admin@teste.com",
    role: "super_admin",
    profile: perfil("00000000-0000-0000-0000-000000000003", "super_admin", "Equipe Medi Marketing"),
  },
] as const;

// O médico continua sendo a conta padrão da demonstração
export const DEMO_EMAIL = CONTAS_DEMO[0].email;
export const DEMO_USER_ID = CONTAS_DEMO[0].profile.id;
export const demoProfile = CONTAS_DEMO[0].profile;

/** Papel gravado no cookie é válido? ("1" = formato antigo, vira médico) */
export function papelDemoValido(valor: string | undefined): Role | null {
  if (!valor) return null;
  if (valor === "1") return "medico";
  const conta = CONTAS_DEMO.find((c) => c.role === valor);
  return conta ? conta.role : null;
}

/** Confere as credenciais de demonstração e devolve o papel correspondente. */
export function checarCredenciaisDemo(email: string, senha: string): Role | null {
  if (senha !== DEMO_SENHA) return null;
  const alvo = email.trim().toLowerCase();
  return CONTAS_DEMO.find((c) => c.email === alvo)?.role ?? null;
}

/** Perfil fictício de um papel. */
export function demoProfilePorPapel(role: Role): Profile {
  return (CONTAS_DEMO.find((c) => c.role === role) ?? CONTAS_DEMO[0]).profile;
}

/**
 * Equipe de uma clínica: as contas de teste mais os médicos fictícios.
 * Alimenta os seletores de responsável (CRM, atendimento, configurações).
 */
export function demoEquipe(organizationId: string | null): Profile[] {
  const contas = CONTAS_DEMO.filter(
    (c) => c.role !== "super_admin" && c.profile.organization_id === organizationId
  ).map((c) => c.profile);

  const extras = DEMO_MEDICOS.filter(
    (m) => m.organization_id === organizationId && !contas.some((p) => p.id === m.id)
  ).map((m) =>
    perfil(m.id, "medico", m.nome, {
      organization_id: m.organization_id,
      especialidade: m.especialidade,
    })
  );

  return [...contas, ...extras];
}

/** Nome do médico numa consulta fictícia. */
export function demoNomeMedico(id: string): string {
  return DEMO_MEDICOS.find((m) => m.id === id)?.nome ?? "Profissional";
}

// Monta uma data relativa a hoje (offset de dias + hora)
function em(diasOffset: number, hora: number, minuto = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + diasOffset);
  d.setHours(hora, minuto, 0, 0);
  return d.toISOString();
}

/** Consultas fictícias distribuídas ao longo da semana atual. */
export function demoConsultas(): Consulta[] {
  const base = (parcial: Partial<Consulta> & Pick<Consulta, "id" | "paciente_nome" | "data_hora" | "tipo" | "status">): Consulta => ({
    organization_id: DEMO_ORG_ID,
    medico_id: DEMO_USER_ID,
    criado_por: DEMO_USER_ID,
    created_at: new Date().toISOString(),
    paciente_telefone: null,
    paciente_email: null,
    paciente_nascimento: null,
    convenio: "Particular",
    duracao_min: 30,
    motivo: null,
    observacao: null,
    valor: null,
    ...parcial,
  });

  return [
    // Hoje
    base({ id: "d1", paciente_nome: "Ana Ribeiro", paciente_telefone: "(11) 99111-2233", paciente_email: "ana.ribeiro@email.com", paciente_nascimento: "1990-04-12", convenio: "Unimed", data_hora: em(0, 8, 30), duracao_min: 40, tipo: "primeira", status: "confirmada", motivo: "Avaliação de manchas na pele", valor: 350 }),
    base({ id: "d2", paciente_nome: "Carlos Menezes", paciente_telefone: "(11) 99222-3344", paciente_email: "carlos.m@email.com", paciente_nascimento: "1978-11-03", convenio: "Bradesco Saúde", data_hora: em(0, 9, 15), tipo: "retorno", status: "confirmada", motivo: "Retorno pós-tratamento", observacao: "Trazer exames anteriores.", valor: 0 }),
    base({ id: "d3", paciente_nome: "Juliana Faria", paciente_nascimento: "1995-07-21", data_hora: em(0, 10, 0), duracao_min: 20, tipo: "teleconsulta", status: "pendente", motivo: "Orientação sobre rotina de skincare", valor: 250 }),
    base({ id: "d4", paciente_nome: "Marcos Lima", paciente_telefone: "(11) 99333-4455", convenio: "SulAmérica", data_hora: em(0, 11, 0), tipo: "retorno", status: "confirmada", valor: 0 }),
    base({ id: "d5", paciente_nome: "Beatriz Souza", paciente_telefone: "(11) 99444-5566", paciente_email: "bia.souza@email.com", paciente_nascimento: "1985-01-30", data_hora: em(0, 14, 30), duracao_min: 45, tipo: "primeira", status: "realizada", motivo: "Lesão suspeita no braço", observacao: "Encaminhada para biópsia.", valor: 350 }),
    // Amanhã
    base({ id: "d6", paciente_nome: "Rafael Costa", paciente_telefone: "(11) 99555-6677", paciente_nascimento: "2000-09-09", data_hora: em(1, 9, 0), tipo: "primeira", status: "pendente", motivo: "Acne persistente", valor: 350 }),
    base({ id: "d7", paciente_nome: "Patrícia Gomes", convenio: "Amil", data_hora: em(1, 10, 30), tipo: "retorno", status: "confirmada", valor: 0 }),
    base({ id: "d8", paciente_nome: "Eduardo Nunes", paciente_telefone: "(11) 99666-7788", data_hora: em(1, 15, 0), tipo: "teleconsulta", status: "cancelada", observacao: "Paciente remarcou.", valor: 250 }),
    // Próximos dias
    base({ id: "d9", paciente_nome: "Fernanda Dias", paciente_telefone: "(11) 99777-8899", paciente_nascimento: "1992-03-15", data_hora: em(2, 8, 0), tipo: "primeira", status: "confirmada", motivo: "Queda de cabelo", valor: 350 }),
    base({ id: "d10", paciente_nome: "Gustavo Rocha", data_hora: em(3, 11, 30), tipo: "retorno", status: "pendente", valor: 0 }),
    base({ id: "d11", paciente_nome: "Helena Martins", paciente_telefone: "(11) 99888-9900", convenio: "Unimed", data_hora: em(4, 9, 45), tipo: "primeira", status: "confirmada", motivo: "Rosácea", valor: 0 }),
    base({ id: "d12", paciente_nome: "Igor Barbosa", paciente_telefone: "(11) 99999-0011", data_hora: em(5, 16, 0), tipo: "teleconsulta", status: "pendente", valor: 250 }),
    // Ontem (para histórico)
    base({ id: "d13", paciente_nome: "Larissa Pinto", paciente_nascimento: "1998-12-01", data_hora: em(-1, 10, 0), tipo: "retorno", status: "realizada", valor: 0 }),
    base({ id: "d14", paciente_nome: "Bruno Almeida", paciente_telefone: "(11) 99000-1122", data_hora: em(-1, 14, 0), tipo: "primeira", status: "realizada", motivo: "Dermatite", valor: 350 }),

    // Segundo médico da mesma clínica — dá o que filtrar por profissional
    base({ id: "d15", organization_id: DEMO_ORG_ID, medico_id: "med-vd-2", paciente_nome: "Camila Nogueira", paciente_telefone: "(11) 98111-2020", data_hora: em(0, 9, 0), tipo: "primeira", status: "confirmada", motivo: "Melasma", valor: 400 }),
    base({ id: "d16", organization_id: DEMO_ORG_ID, medico_id: "med-vd-2", paciente_nome: "Rodrigo Salles", data_hora: em(1, 14, 0), tipo: "retorno", status: "pendente", valor: 0 }),
    base({ id: "d17", organization_id: DEMO_ORG_ID, medico_id: "med-vd-2", paciente_nome: "Tatiana Reis", paciente_telefone: "(11) 98222-3030", data_hora: em(2, 16, 30), tipo: "primeira", status: "confirmada", motivo: "Preenchimento facial", valor: 1200 }),

    // Outras clínicas da carteira — só o super admin enxerga
    base({ id: "d18", organization_id: "org-2", medico_id: "med-sr-1", convenio: "Particular", paciente_nome: "Everton Muniz", paciente_telefone: "(41) 99111-3040", data_hora: em(0, 8, 0), duracao_min: 60, tipo: "primeira", status: "confirmada", motivo: "Avaliação para implante", valor: 480 }),
    base({ id: "d19", organization_id: "org-2", medico_id: "med-sr-1", paciente_nome: "Simone Bastos", data_hora: em(0, 13, 30), tipo: "retorno", status: "realizada", valor: 0 }),
    base({ id: "d20", organization_id: "org-2", medico_id: "med-sr-2", paciente_nome: "Lucas Ferreira", paciente_telefone: "(41) 99222-4050", data_hora: em(1, 10, 0), tipo: "retorno", status: "confirmada", motivo: "Manutenção do aparelho", valor: 260 }),
    base({ id: "d21", organization_id: "org-2", medico_id: "med-sr-2", paciente_nome: "Aline Duarte", data_hora: em(3, 15, 0), tipo: "primeira", status: "pendente", valor: 380 }),
    base({ id: "d22", organization_id: "org-3", medico_id: "med-in-1", paciente_nome: "Priscila Amaral", paciente_telefone: "(81) 99333-5060", data_hora: em(0, 11, 0), duracao_min: 50, tipo: "primeira", status: "confirmada", motivo: "Reeducação alimentar", valor: 320 }),
    base({ id: "d23", organization_id: "org-3", medico_id: "med-in-1", paciente_nome: "Wagner Peixoto", data_hora: em(2, 9, 30), tipo: "retorno", status: "pendente", valor: 0 }),
    base({ id: "d24", organization_id: "org-4", medico_id: "med-lg-1", paciente_nome: "Yara Fontes", paciente_telefone: "(48) 99444-6070", data_hora: em(0, 15, 0), duracao_min: 60, tipo: "primeira", status: "confirmada", motivo: "Check-up de longevidade", valor: 890 }),
    base({ id: "d25", organization_id: "org-4", medico_id: "med-lg-1", paciente_nome: "Nelson Braga", data_hora: em(1, 8, 30), tipo: "teleconsulta", status: "cancelada", observacao: "Paciente pediu para remarcar.", valor: 450 }),
    base({ id: "d26", organization_id: "org-4", medico_id: "med-lg-1", paciente_nome: "Cristina Vasques", paciente_telefone: "(48) 99555-7080", data_hora: em(4, 14, 0), tipo: "retorno", status: "confirmada", valor: 0 }),
  ];
}

/**
 * Consultas que um perfil enxerga de fato.
 *
 * Espelha a RLS: super admin vê a carteira inteira, gestor e secretária
 * veem a clínica toda e o médico só a própria agenda.
 */
export function demoConsultasVisiveis(profile: Profile): Consulta[] {
  const todas = demoConsultas();
  if (profile.role === "super_admin") return todas;
  if (profile.role === "medico") return todas.filter((c) => c.medico_id === profile.id);
  return todas.filter((c) => c.organization_id === profile.organization_id);
}

/** Anexos fictícios para algumas consultas de demonstração. */
export function demoAnexos(consultaId: string): Anexo[] {
  const anexo = (id: string, nome: string, tipo: string, tamanho: number, diasAtras: number): Anexo => {
    const d = new Date();
    d.setDate(d.getDate() - diasAtras);
    return {
      id,
      consulta_id: consultaId,
      medico_id: DEMO_USER_ID,
      nome,
      caminho: `demo/${consultaId}/${nome}`,
      tipo,
      tamanho,
      created_at: d.toISOString(),
    };
  };

  const mapa: Record<string, Anexo[]> = {
    d1: [
      anexo("a1", "Encaminhamento-dermatologia.pdf", "application/pdf", 184_320, 3),
      anexo("a2", "Foto-lesao.jpg", "image/jpeg", 1_248_000, 3),
    ],
    d2: [anexo("a3", "Exame-sangue-anterior.pdf", "application/pdf", 96_500, 30)],
    d5: [anexo("a4", "Resultado-biopsia.pdf", "application/pdf", 210_400, 1)],
  };

  return mapa[consultaId] ?? [];
}

/** Disponibilidade semanal fictícia (seg–sex, 08:00–18:00; sáb 08:00–12:00). */
export function demoDisponibilidade(): Disponibilidade[] {
  const dias: Disponibilidade[] = [1, 2, 3, 4, 5].map((d) => ({
    id: `disp-${d}`,
    medico_id: DEMO_USER_ID,
    dia_semana: d,
    hora_inicio: "08:00",
    hora_fim: "18:00",
  }));
  dias.push({
    id: "disp-6",
    medico_id: DEMO_USER_ID,
    dia_semana: 6,
    hora_inicio: "08:00",
    hora_fim: "12:00",
  });
  return dias;
}

/** Bloqueio fictício (férias no próximo mês). */
export function demoBloqueios(): Bloqueio[] {
  const inicio = new Date();
  inicio.setDate(inicio.getDate() + 20);
  const fim = new Date(inicio);
  fim.setDate(fim.getDate() + 7);
  return [
    {
      id: "bloq-1",
      medico_id: DEMO_USER_ID,
      data_inicio: inicio.toISOString(),
      data_fim: fim.toISOString(),
      motivo: "Férias",
    },
  ];
}

/** Leads fictícios da clínica — a base do funil do CRM. */
export function demoLeads(): Lead[] {
  const lead = (
    id: string,
    nome: string,
    origem: string,
    etapa: Lead["etapa_funil"],
    diasAtras: number,
    extras: Partial<Lead> = {}
  ): Lead => {
    const d = new Date();
    d.setDate(d.getDate() - diasAtras);
    return {
      id,
      organization_id: DEMO_ORG_ID,
      nome,
      especialidade: "Dermatologia",
      whatsapp: "(11) 99000-0000",
      email: null,
      cidade: "São Paulo, SP",
      faturamento_medio: null,
      tem_equipe_comercial: null,
      mensagem: null,
      origem,
      etapa_funil: etapa,
      status: etapa === "perdido" ? "perdido" : "aberto",
      consentimento_lgpd: true,
      responsavel_id: null,
      valor_estimado: null,
      tags: [],
      proximo_contato: null,
      ultimo_contato: null,
      motivo_perda: null,
      created_at: d.toISOString(),
      ...extras,
    };
  };

  // Horas à frente/atrás de agora, para as datas de contato
  const horas = (h: number) => new Date(Date.now() + h * 3600_000).toISOString();
  const SECRETARIA = "00000000-0000-0000-0000-000000000001";
  const GESTOR = "00000000-0000-0000-0000-000000000002";

  return [
    lead("l1", "Renata Prado", "meta_ads", "novo", 0, {
      whatsapp: "(11) 98811-2201", email: "renata.prado@email.com",
      mensagem: "Vi o anúncio sobre tratamento de melasma. Queria saber valores.",
      valor_estimado: 2400, tags: ["melasma", "estética"],
      responsavel_id: SECRETARIA, proximo_contato: horas(3),
    }),
    lead("l2", "Tiago Moreira", "google_ads", "novo", 0, {
      whatsapp: "(11) 98822-3302", valor_estimado: 900, tags: ["acne"],
      responsavel_id: SECRETARIA, proximo_contato: horas(-5),
    }),
    lead("l3", "Sofia Camargo", "instagram", "em_contato", 1, {
      whatsapp: "(11) 98833-4403", email: "sofia.camargo@email.com",
      valor_estimado: 3800, tags: ["botox", "alta prioridade"],
      responsavel_id: SECRETARIA, ultimo_contato: horas(-20), proximo_contato: horas(26),
    }),
    lead("l4", "Diego Ferraz", "meta_ads", "em_contato", 2, {
      whatsapp: "(11) 98844-5504", valor_estimado: 1500, tags: ["queda capilar"],
      responsavel_id: GESTOR, ultimo_contato: horas(-40), proximo_contato: horas(-2),
    }),
    lead("l5", "Luana Teixeira", "indicacao", "agendado", 3, {
      whatsapp: "(11) 98855-6605", email: "luana.t@email.com",
      valor_estimado: 5200, tags: ["preenchimento", "indicação"],
      responsavel_id: SECRETARIA, ultimo_contato: horas(-30), proximo_contato: horas(48),
    }),
    lead("l6", "Otávio Brandão", "google_ads", "compareceu", 6, {
      whatsapp: "(11) 98866-7706", valor_estimado: 2800, tags: ["laser"],
      responsavel_id: SECRETARIA, ultimo_contato: horas(-72),
    }),
    lead("l7", "Vanessa Lopes", "meta_ads", "em_tratamento", 12, {
      whatsapp: "(11) 98877-8807", email: "vanessa.lopes@email.com",
      status: "ganho", valor_estimado: 7400, tags: ["protocolo completo"],
      responsavel_id: GESTOR, ultimo_contato: horas(-120),
    }),
    lead("l8", "Henrique Sales", "meta_ads", "perdido", 15, {
      whatsapp: "(11) 98888-9908", valor_estimado: 1800,
      motivo_perda: "Achou o valor acima do orçamento e não quis parcelar.",
      responsavel_id: SECRETARIA, ultimo_contato: horas(-200),
    }),
    lead("l9", "Marcela Antunes", "instagram", "novo", 1, {
      whatsapp: "(11) 98899-0109", valor_estimado: 1100, tags: ["skincare"],
      proximo_contato: horas(20),
    }),
    lead("l10", "Fábio Queiroz", "site", "em_contato", 4, {
      whatsapp: "(11) 98900-1210", email: "fabio.queiroz@email.com",
      valor_estimado: 3200, tags: ["cicatriz de acne"],
      responsavel_id: GESTOR, ultimo_contato: horas(-60), proximo_contato: horas(12),
    }),
    lead("l11", "Bruna Sicsú", "indicacao", "agendado", 5, {
      whatsapp: "(11) 98911-2311", valor_estimado: 4100, tags: ["indicação"],
      responsavel_id: SECRETARIA, ultimo_contato: horas(-48), proximo_contato: horas(72),
    }),
    lead("l12", "Ronaldo Vieira", "google_ads", "perdido", 22, {
      whatsapp: "(11) 98922-3412", valor_estimado: 950,
      motivo_perda: "Sumiu depois do orçamento; três tentativas sem resposta.",
      responsavel_id: SECRETARIA, ultimo_contato: horas(-300),
    }),
  ];
}
