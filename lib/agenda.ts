import type { StatusConsulta, TipoConsulta } from "@/lib/supabase/types";

/** Rótulos amigáveis de status. */
export const rotuloStatus: Record<StatusConsulta, string> = {
  pendente: "Pendente",
  confirmada: "Confirmada",
  cancelada: "Cancelada",
  realizada: "Realizada",
};

/** Rótulos de tipo de consulta. */
export const rotuloTipo: Record<TipoConsulta, string> = {
  primeira: "Primeira consulta",
  retorno: "Retorno",
  teleconsulta: "Teleconsulta",
};

/** Classes de cor por status (dot/pill) usando a paleta. */
export const corStatus: Record<StatusConsulta, string> = {
  pendente: "bg-alerta",
  confirmada: "bg-sucesso",
  cancelada: "bg-coral",
  realizada: "bg-teal",
};

/** Formata "HH:MM" a partir de uma data ISO. */
export function formatarHora(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Formata data por extenso (ex.: "quinta-feira, 10 de julho"). */
export function formatarDataLonga(d: Date): string {
  return d.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
}

export const DIAS_SEMANA = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
];

export const DIAS_CURTOS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
