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

export type Role = "medico" | "admin";

// IMPORTANTE: usar `type` (não `interface`). Interfaces não são consideradas
// atribuíveis a `Record<string, unknown>` pelo TypeScript, o que faria o
// schema falhar na checagem GenericSchema do supabase-js e os tipos de
// insert/update colapsarem para `never`.
export type Profile = {
  id: string;
  nome: string | null;
  especialidade: string | null;
  crm: string | null;
  telefone: string | null;
  foto_url: string | null;
  role: Role;
  created_at: string;
};

export type Consulta = {
  id: string;
  medico_id: string;
  paciente_nome: string;
  paciente_telefone: string | null;
  data_hora: string; // ISO
  tipo: TipoConsulta;
  status: StatusConsulta;
  observacao: string | null;
  criado_por: string | null;
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

export type Lead = {
  id: string;
  nome: string;
  especialidade: string | null;
  whatsapp: string;
  cidade: string | null;
  origem: string | null;
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
      leads: Tabela<Lead, Omit<Lead, "id" | "created_at"> & { id?: string }, Partial<Lead>>;
    };
    // Empty-key form (não use Record<string, never>: isso faria keyof = string
    // e todo nome de tabela casaria com a sobrecarga de "view", quebrando os tipos).
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
}
