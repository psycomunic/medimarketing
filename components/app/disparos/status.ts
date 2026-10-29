import type { StatusDisparo } from "@/lib/supabase/types";

export const STATUS_DISPARO: Record<StatusDisparo, { r: string; c: string }> = {
  agendado: { r: "Agendado", c: "bg-[#EEF2F7] text-azul-medico" },
  enviando: { r: "Enviando", c: "bg-[#FEF3C7] text-[#B45309]" },
  concluido: { r: "Concluído", c: "bg-[#E9F8EF] text-[#15803D]" },
  cancelado: { r: "Cancelado", c: "bg-[#F1F5F9] text-[#64748B]" },
};
