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

/** Deixa apenas a primeira letra maiúscula (evita "10 De Julho" do CSS capitalize). */
export function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

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

/** Calcula a idade (em anos) a partir de "YYYY-MM-DD". */
export function calcularIdade(nascimento: string | null): number | null {
  if (!nascimento) return null;
  const nasc = new Date(nascimento);
  if (Number.isNaN(nasc.getTime())) return null;
  const hoje = new Date();
  let idade = hoje.getFullYear() - nasc.getFullYear();
  const m = hoje.getMonth() - nasc.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade--;
  return idade;
}

/** Formata bytes em KB/MB legível. */
export function formatarTamanho(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Formata valor em Real (R$). */
export function formatarValor(valor: number | null): string {
  if (valor == null) return "—";
  if (valor === 0) return "Coberto pelo convênio";
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
