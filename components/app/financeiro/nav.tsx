"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, FileDown } from "lucide-react";
import { cn } from "@/lib/utils";

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

function mesAtual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function deslocar(mes: string, n: number) {
  const [a, m] = mes.split("-").map(Number);
  const d = new Date(a, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export type AbaNav = { href: string; rotulo: string; semMes?: boolean };

/**
 * Abas do módulo e o mês em análise. O mês vai na URL (?mes=), então
 * trocar de aba mantém o período e o link pode ser compartilhado.
 */
export function NavFinanceiro({
  abas,
  base,
  relatorioHref,
}: {
  abas: AbaNav[];
  base: string;
  relatorioHref?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const params = useSearchParams();
  const bruto = params.get("mes");
  const mes = bruto && /^\d{4}-\d{2}$/.test(bruto) ? bruto : mesAtual();
  const [a, m] = mes.split("-").map(Number);
  const comMes = (href: string) => `${href}?mes=${mes}`;
  const ir = (n: number) => router.push(`${pathname}?mes=${deslocar(mes, n)}`);
  const ehAtual = mes === mesAtual();

  return (
    <div className="mt-6 rounded-xl border border-border bg-white shadow-soft print:hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-3 py-2.5 sm:px-4">
        <div className="flex items-center gap-2">
          <div className="flex overflow-hidden rounded-lg border border-border">
            <button
              type="button"
              onClick={() => ir(-1)}
              className="grid size-9 place-items-center text-cinza-suave hover:bg-verde-menta hover:text-azul-medico"
              aria-label="Mês anterior"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => ir(1)}
              className="grid size-9 place-items-center border-l border-border text-cinza-suave hover:bg-verde-menta hover:text-azul-medico"
              aria-label="Próximo mês"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
          <p className="font-heading text-base font-semibold capitalize text-azul-medico sm:text-lg">
            {MESES[m - 1]} <span className="font-normal text-cinza-suave">{a}</span>
          </p>
          {!ehAtual && (
            <button
              type="button"
              onClick={() => router.push(`${pathname}?mes=${mesAtual()}`)}
              className="rounded-lg border border-teal bg-verde-menta px-2.5 py-1.5 text-xs font-medium text-azul-medico hover:bg-teal hover:text-white"
            >
              Mês atual
            </button>
          )}
        </div>
        {relatorioHref && (
          <Link
            href={comMes(relatorioHref)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-azul-medico px-3 py-2 text-sm font-medium text-white shadow-soft transition-colors hover:bg-azul-profundo"
          >
            <FileDown className="size-4" /> Relatório em PDF
          </Link>
        )}
      </div>
      <nav className="flex gap-1 overflow-x-auto px-2 py-1.5 [scrollbar-width:none]" aria-label="Seções do financeiro">
        {abas.map((t) => {
          const ativo = t.href === base ? pathname === base : pathname.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.semMes ? t.href : comMes(t.href)}
              className={cn(
                "relative shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                ativo ? "bg-verde-menta text-azul-medico" : "text-cinza-suave hover:bg-branco-clinico hover:text-azul-medico"
              )}
            >
              {t.rotulo}
              {ativo && <span className="absolute inset-x-3 -bottom-1.5 h-0.5 rounded-full bg-teal" />}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
