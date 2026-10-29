import { MailCheck, MailX } from "lucide-react";
import type { Paciente } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

const FUSO = "America/Sao_Paulo";

export const dataCurta = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: FUSO }).replace(/\./g, "").replace(/ de /g, " ");

export const dataHora = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: FUSO }).replace(/\./g, "").replace(/ de /g, " ");

/** "há 3 meses", "há 12 dias", "hoje". */
export function relativo(iso: string): string {
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86400_000);
  if (dias <= 0) return "hoje";
  if (dias === 1) return "ontem";
  if (dias < 31) return `há ${dias} dias`;
  const meses = Math.floor(dias / 30.4);
  if (meses < 12) return `há ${meses} ${meses === 1 ? "mês" : "meses"}`;
  const anos = Math.floor(meses / 12);
  return `há ${anos} ano${anos === 1 ? "" : "s"}`;
}

export function idade(nascimento: string | null): number | null {
  if (!nascimento) return null;
  const n = new Date(`${nascimento}T12:00:00`);
  const h = new Date();
  let a = h.getFullYear() - n.getFullYear();
  if (h.getMonth() < n.getMonth() || (h.getMonth() === n.getMonth() && h.getDate() < n.getDate())) a--;
  return a;
}

/** Cores de avatar fixas por nome: a mesma pessoa sempre com a mesma cor. */
const TONS = ["bg-[#E6F4F1] text-[#0F766E]", "bg-[#E8F0FC] text-[#1D4ED8]", "bg-[#FDEFE8] text-[#C2410C]", "bg-[#EFEAFD] text-[#6D28D9]", "bg-[#FEF6E0] text-[#A16207]"];

export function Avatar({ nome, grande = false }: { nome: string; grande?: boolean }) {
  const partes = nome.trim().split(/\s+/);
  const iniciais = ((partes[0]?.[0] ?? "") + (partes.length > 1 ? partes[partes.length - 1][0] : "")).toUpperCase();
  const tom = TONS[[...nome].reduce((s, c) => s + c.charCodeAt(0), 0) % TONS.length];
  return (
    <span
      aria-hidden
      className={cn("grid shrink-0 place-items-center rounded-full font-heading font-semibold", tom, grande ? "size-16 text-xl" : "size-10 text-sm")}
    >
      {iniciais}
    </span>
  );
}

export function ConsentimentoIcone({ p }: { p: Pick<Paciente, "consentimento_marketing" | "descadastrado_em"> }) {
  if (p.descadastrado_em)
    return (
      <span title="Pediu para não receber campanhas" className="inline-flex text-coral">
        <MailX className="size-4" />
        <span className="sr-only">Descadastrado</span>
      </span>
    );
  if (p.consentimento_marketing)
    return (
      <span title="Aceita receber campanhas" className="inline-flex text-teal">
        <MailCheck className="size-4" />
        <span className="sr-only">Aceita campanhas</span>
      </span>
    );
  return (
    <span title="Sem consentimento para campanhas" className="inline-flex text-cinza-suave/50">
      <MailCheck className="size-4" />
      <span className="sr-only">Sem consentimento</span>
    </span>
  );
}
