/**
 * Tipos do banco (espelham as tabelas do Supabase — ver supabase/schema.sql).
 * Para gerar automaticamente, use: `supabase gen types typescript`.
 */

export type StatusConsulta =
  | "pendente"
  | "confirmada"
  | "cancelada"
  | "realizada";

export type TipoConsulta = "primeira" | "retorno" | "teleconsulta";

/**
 * Papéis da plataforma (Parte B do briefing):
 * - super_admin: equipe Medi Marketing, enxerga todas as clínicas
 * - gestor:      dono/gestor da clínica, acesso total ao próprio tenant
 * - secretaria:  agenda, CRM, atendimento e retenção
 * - medico:      a própria agenda, os próprios indicadores e a Academy
 */
export type Role = "super_admin" | "gestor" | "secretaria" | "medico";

export type PlanoOrganizacao = "essencial" | "performance" | "full";

export type EtapaFunil =
  | "novo"
  | "em_contato"
  | "agendado"
  | "compareceu"
  | "em_tratamento"
  | "perdido";

export type StatusLead = "aberto" | "ganho" | "perdido";

// IMPORTANTE: usar `type` (não `interface`). Interfaces não são consideradas
// atribuíveis a `Record<string, unknown>` pelo TypeScript, o que faria o
// schema falhar na checagem GenericSchema do supabase-js e os tipos de
// insert/update colapsarem para `never`.

/** Clínica/consultório — o tenant da plataforma. */
export type Organization = {
  id: string;
  nome: string;
  slug: string | null;
  especialidade: string | null;
  plano: PlanoOrganizacao;
  cidade: string | null;
  telefone: string | null;
  email: string | null;
  ativo: boolean;
  created_at: string;
};

export type Profile = {
  id: string;
  organization_id: string | null;
  nome: string | null;
  especialidade: string | null;
  crm: string | null;
  telefone: string | null;
  foto_url: string | null;
  role: Role;
  ativo: boolean;
  created_at: string;
};

export type Consulta = {
  id: string;
  organization_id: string | null;
  medico_id: string;
  paciente_nome: string;
  paciente_telefone: string | null;
  paciente_email: string | null;
  paciente_nascimento: string | null; // "YYYY-MM-DD"
  convenio: string | null; // ex.: "Particular", "Unimed"
  data_hora: string; // ISO
  duracao_min: number | null; // duração estimada em minutos
  tipo: TipoConsulta;
  status: StatusConsulta;
  motivo: string | null; // queixa / motivo da consulta
  observacao: string | null;
  valor: number | null; // valor da consulta (R$)
  criado_por: string | null;
  created_at: string;
};

/** Documento anexado a uma consulta (exame, encaminhamento, receita...). */
export type Anexo = {
  id: string;
  consulta_id: string;
  medico_id: string;
  nome: string;
  caminho: string; // path no Supabase Storage
  tipo: string | null; // mime type
  tamanho: number | null; // bytes
  created_at: string;
};

export type Disponibilidade = {
  id: string;
  medico_id: string;
  dia_semana: number; // 0 (domingo) a 6 (sábado)
  hora_inicio: string; // "HH:MM"
  hora_fim: string;
};

export type Bloqueio = {
  id: string;
  medico_id: string;
  data_inicio: string;
  data_fim: string;
  motivo: string | null;
};

/**
 * Lead. Com `organization_id` nulo é um lead comercial da própria
 * Medi Marketing (formulário do site). Preenchido, é lead de uma clínica
 * cliente e alimenta o CRM da Fase 2.
 */
export type Lead = {
  id: string;
  organization_id: string | null;
  nome: string;
  especialidade: string | null;
  whatsapp: string;
  email: string | null;
  cidade: string | null;
  faturamento_medio: string | null;
  tem_equipe_comercial: boolean | null;
  mensagem: string | null;
  origem: string | null;
  etapa_funil: EtapaFunil;
  status: StatusLead;
  consentimento_lgpd: boolean;
  created_at: string;
};

// Cada tabela precisa expor Relationships para o supabase-js inferir os tipos.
type Tabela<Row, Insert, Update> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

/** Estrutura do Database para tipar o client do Supabase. */
export interface Database {
  public: {
    Tables: {
      organizations: Tabela<
        Organization,
        Omit<Organization, "id" | "created_at"> & { id?: string },
        Partial<Organization>
      >;
      profiles: Tabela<Profile, Partial<Profile> & { id: string }, Partial<Profile>>;
      consultas: Tabela<
        Consulta,
        Omit<Consulta, "id" | "created_at"> & { id?: string },
        Partial<Consulta>
      >;
      disponibilidade: Tabela<
        Disponibilidade,
        Omit<Disponibilidade, "id"> & { id?: string },
        Partial<Disponibilidade>
      >;
      bloqueios: Tabela<
        Bloqueio,
        Omit<Bloqueio, "id"> & { id?: string },
        Partial<Bloqueio>
      >;
      leads: Tabela<
        Lead,
        Omit<Lead, "id" | "created_at" | "etapa_funil" | "status"> & {
          id?: string;
          etapa_funil?: EtapaFunil;
          status?: StatusLead;
        },
        Partial<Lead>
      >;
      anexos: Tabela<
        Anexo,
        Omit<Anexo, "id" | "created_at"> & { id?: string },
        Partial<Anexo>
      >;
    };
    // Empty-key form (não use Record<string, never>: isso faria keyof = string
    // e todo nome de tabela casaria com a sobrecarga de "view", quebrando os tipos).
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
}
