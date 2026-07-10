/**
 * MODO DEMONSTRAÇÃO
 * ----------------------------------------------------------------------
 * Quando o Supabase NÃO está configurado, o sistema entra em modo demo:
 * um login de teste fixo e dados fictícios, para navegar pela área do
 * médico sem banco de dados. Alterações não são persistidas.
 *
 * Este arquivo é "puro" (sem next/headers) para poder ser importado tanto
 * no middleware (Edge) quanto em Server Components/Actions.
 */
import type {
  Anexo,
  Bloqueio,
  Consulta,
  Disponibilidade,
  Profile,
} from "@/lib/supabase/types";

// Cookie que marca uma sessão de demonstração
export const DEMO_COOKIE = "medi_demo";

// Credenciais de teste (exibidas na tela de login em modo demo)
export const DEMO_EMAIL = "medico@teste.com";
export const DEMO_SENHA = "demo1234";

export const DEMO_USER_ID = "00000000-0000-0000-0000-000000000000";

export const demoProfile: Profile = {
  id: DEMO_USER_ID,
  nome: "Dra. Marina Alves",
  especialidade: "Dermatologia",
  crm: "CRM/SP 123456",
  telefone: "(11) 98888-7777",
  foto_url: null,
  role: "medico",
  created_at: new Date().toISOString(),
};

/** Confere as credenciais de demonstração. */
export function checarCredenciaisDemo(email: string, senha: string) {
  return email.trim().toLowerCase() === DEMO_EMAIL && senha === DEMO_SENHA;
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
  ];
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
