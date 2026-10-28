"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/** Campo com rótulo e dica, para os formulários do financeiro. */
export function Campo({
  id,
  rotulo,
  dica,
  children,
  className,
}: {
  id: string;
  rotulo: string;
  dica?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid min-w-0 gap-1.5", className)}>
      <Label htmlFor={id}>{rotulo}</Label>
      {children}
      {dica && <p className="text-xs text-cinza-suave">{dica}</p>}
    </div>
  );
}

/** Campo de dinheiro com "R$" fixo à esquerda. */
export function CampoReais({
  id,
  valor,
  onChange,
  placeholder = "0,00",
  disabled,
}: {
  id: string;
  valor: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-cinza-suave">R$</span>
      <input
        id={id}
        inputMode="decimal"
        value={valor}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value.replace(/[^\d.,]/g, ""))}
        placeholder={placeholder}
        className="flex h-11 w-full rounded-md border border-input bg-white pl-10 pr-4 text-base tabular-nums text-cinza-texto shadow-sm focus-visible:border-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-60 md:text-sm"
      />
    </div>
  );
}

/** "1.234,56" → 1234.56 */
export function numero(v: string): number {
  if (!v.trim()) return 0;
  const limpo = v.includes(",") ? v.replace(/\./g, "").replace(",", ".") : v;
  const n = Number(limpo);
  return Number.isFinite(n) ? n : NaN;
}

export function emTexto(v: number | null | undefined): string {
  if (v == null || v === 0) return "";
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export const hojeLocal = () => new Date().toLocaleDateString("sv-SE");

/**
 * Executa uma action e atualiza a tela. Devolve o erro para mostrar
 * perto do botão que o causou.
 */
export function useAcao() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  function executar(fn: () => Promise<{ ok: boolean; erro?: string }>, depois?: () => void) {
    setErro(null);
    start(async () => {
      const r = await fn();
      if (!r.ok) {
        setErro(r.erro ?? "Algo deu errado.");
        return;
      }
      depois?.();
      router.refresh();
    });
  }
  return { pending, erro, setErro, executar };
}

export function Erro({ texto }: { texto: string | null }) {
  if (!texto) return null;
  return <p className="rounded-md bg-coral/10 px-3 py-2 text-sm text-[#B91C1C]">{texto}</p>;
}

export function Girando() {
  return <Loader2 className="size-4 animate-spin" />;
}
