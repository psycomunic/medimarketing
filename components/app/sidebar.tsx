"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Menu, X, Building2, Bell } from "lucide-react";
import { Logo } from "@/components/logo";
import { MarcaClinica } from "@/components/marca-clinica";
import { logout } from "@/lib/actions/auth";
import { cn } from "@/lib/utils";
import { GRUPOS, modulosDoPapel, rotuloPapel } from "@/lib/rbac";
import type { Role } from "@/lib/supabase/types";

export function Sidebar({
  nome,
  role,
  organizacao,
  logoUrl = null,
  naoLidas = 0,
}: {
  nome: string;
  role: Role;
  organizacao: string | null;
  /** Logo da clínica; sem ela, cai no monograma. */
  logoUrl?: string | null;
  /** Notificações não lidas, para o contador do sino. */
  naoLidas?: number;
}) {
  const pathname = usePathname();
  const [aberto, setAberto] = useState(false);

  // Só aparece o que o papel pode acessar
  const modulos = modulosDoPapel(role);
  const emNotificacoes = pathname.startsWith("/app/notificacoes");

  const conteudo = (
    <div className="flex h-full flex-col">
      <div className="p-6 pb-4">
        {/* A marca da clínica manda no painel dela. A da plataforma vira
            assinatura no rodapé. Sem clínica (super admin), o contrário. */}
        {organizacao ? (
          <MarcaClinica nome={organizacao} logoUrl={logoUrl} href="/app" />
        ) : (
          <Logo href="/app" />
        )}

        {!organizacao && (
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-verde-menta px-3 py-2">
            <Building2 className="size-4 shrink-0 text-teal" />
            <span className="truncate text-xs font-semibold text-azul-medico">
              Todas as clínicas
            </span>
          </div>
        )}

        {/* Notificações fora dos grupos: é o que se olha primeiro */}
        <Link
          href="/app/notificacoes"
          onClick={() => setAberto(false)}
          className={cn(
            "mt-2 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
            emNotificacoes
              ? "bg-verde-menta text-azul-medico"
              : naoLidas > 0
                ? "bg-coral/8 text-coral hover:bg-coral/12"
                : "text-cinza-suave hover:bg-verde-menta/60 hover:text-azul-medico"
          )}
        >
          <span className="relative">
            <Bell className="size-5 shrink-0" />
            {naoLidas > 0 && (
              <span className="absolute -right-1.5 -top-1 size-2 rounded-full bg-coral" />
            )}
          </span>
          <span className="truncate">Notificações</span>
          {naoLidas > 0 && (
            <span className="ml-auto shrink-0 rounded-full bg-coral px-1.5 py-0.5 text-[10px] font-bold text-white">
              {naoLidas > 99 ? "99+" : naoLidas}
            </span>
          )}
        </Link>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
        {GRUPOS.map((grupo) => {
          const doGrupo = modulos.filter((m) => m.grupo === grupo.id);
          if (doGrupo.length === 0) return null;

          return (
            <div key={grupo.id}>
              <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-cinza-suave/70">
                {grupo.label}
              </p>
              <div className="space-y-0.5">
                {doGrupo.map((m) => {
                  const ativo =
                    m.href === "/app"
                      ? pathname === "/app"
                      : pathname.startsWith(m.href);
                  return (
                    <Link
                      key={m.href}
                      href={m.href}
                      onClick={() => setAberto(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                        ativo
                          ? "bg-verde-menta text-azul-medico"
                          : "text-cinza-suave hover:bg-verde-menta/60 hover:text-azul-medico"
                      )}
                    >
                      <m.icone className="size-5 shrink-0" />
                      <span className="truncate">{m.label}</span>
                      {m.fase > 1 && (
                        <span className="ml-auto shrink-0 rounded-full bg-alerta/12 px-1.5 py-0.5 text-[9px] font-semibold text-alerta">
                          F{m.fase}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
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
            <p className="truncate text-xs text-cinza-suave">{rotuloPapel(role)}</p>
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

        {/* Assinatura discreta: o painel é da clínica, a plataforma é nossa */}
        {organizacao && (
          <p className="px-3 pt-2 text-[10px] text-cinza-suave/70">
            Plataforma <span className="font-semibold">Medi Marketing</span>
          </p>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Topbar mobile */}
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-border bg-white px-4 py-3 lg:hidden">
        {organizacao ? (
          <MarcaClinica nome={organizacao} logoUrl={logoUrl} href="/app" tamanho="sm" />
        ) : (
          <Logo href="/app" />
        )}
        <div className="flex items-center gap-1">
          {/* No celular o sino fica no topo: é o atalho mais usado */}
          <Link
            href="/app/notificacoes"
            className="relative grid size-10 place-items-center rounded-md text-azul-medico"
            aria-label={
              naoLidas > 0 ? `${naoLidas} notificações não lidas` : "Notificações"
            }
          >
            <Bell className="size-5" />
            {naoLidas > 0 && (
              <span className="absolute right-1.5 top-1.5 grid min-w-4 place-items-center rounded-full bg-coral px-1 text-[9px] font-bold text-white">
                {naoLidas > 9 ? "9+" : naoLidas}
              </span>
            )}
          </Link>
          <button
            type="button"
            onClick={() => setAberto(true)}
            className="grid size-10 place-items-center rounded-md text-azul-medico"
            aria-label="Abrir menu"
          >
            <Menu />
          </button>
        </div>
      </div>

      {/* Sidebar desktop */}
      <aside className="hidden w-64 shrink-0 border-r border-border bg-white lg:block">
        <div className="sticky top-0 h-screen">{conteudo}</div>
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
