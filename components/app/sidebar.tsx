"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarDays,
  Clock,
  BarChart3,
  User,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { logout } from "@/lib/actions/auth";
import { cn } from "@/lib/utils";

const links = [
  { href: "/app", label: "Dashboard", icon: LayoutDashboard, exato: true },
  { href: "/app/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/app/disponibilidade", label: "Disponibilidade", icon: Clock },
  // Fase 2 — placeholders com layout pronto
  { href: "/app/relatorios", label: "Relatórios", icon: BarChart3, fase2: true },
  { href: "/app/perfil", label: "Perfil", icon: User, fase2: true },
];

export function Sidebar({ nome }: { nome: string }) {
  const pathname = usePathname();
  const [aberto, setAberto] = useState(false);

  const conteudo = (
    <div className="flex h-full flex-col">
      <div className="p-6">
        <Logo href="/app" />
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {links.map((l) => {
          const ativo = l.exato
            ? pathname === l.href
            : pathname.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setAberto(false)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                ativo
                  ? "bg-verde-menta text-azul-medico"
                  : "text-cinza-suave hover:bg-verde-menta/60 hover:text-azul-medico"
              )}
            >
              <l.icon className="size-5" />
              {l.label}
              {l.fase2 && (
                <span className="ml-auto rounded-full bg-alerta/12 px-2 py-0.5 text-[10px] font-semibold text-alerta">
                  em breve
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border p-3">
        <div className="flex items-center gap-3 rounded-lg px-3 py-2">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-azul-medico text-sm font-semibold text-white">
            {inicial(nome)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-cinza-texto">{nome}</p>
            <p className="text-xs text-cinza-suave">Médico(a)</p>
          </div>
        </div>
        <form action={logout}>
          <button
            type="submit"
            className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-cinza-suave transition-colors hover:bg-coral/10 hover:text-coral"
          >
            <LogOut className="size-5" /> Sair
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <>
      {/* Topbar mobile */}
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-border bg-white px-4 py-3 lg:hidden">
        <Logo href="/app" />
        <button
          type="button"
          onClick={() => setAberto(true)}
          className="grid size-10 place-items-center rounded-md text-azul-medico"
          aria-label="Abrir menu"
        >
          <Menu />
        </button>
      </div>

      {/* Sidebar desktop */}
      <aside className="hidden w-64 shrink-0 border-r border-border bg-white lg:block">
        {conteudo}
      </aside>

      {/* Drawer mobile */}
      {aberto && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-azul-profundo/40"
            onClick={() => setAberto(false)}
          />
          <div className="absolute inset-y-0 left-0 w-72 bg-white shadow-card">
            <button
              type="button"
              onClick={() => setAberto(false)}
              className="absolute right-3 top-3 grid size-9 place-items-center rounded-md text-cinza-suave"
              aria-label="Fechar menu"
            >
              <X />
            </button>
            {conteudo}
          </div>
        </div>
      )}
    </>
  );
}

function inicial(nome: string) {
  return nome
    .replace(/^Dra?\.\s*/i, "")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
