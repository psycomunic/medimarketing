"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Menu, X, Building2, Bell, ChevronsLeft, ChevronsRight, Plus } from "lucide-react";
import { Logo } from "@/components/logo";
import { MarcaClinica } from "@/components/marca-clinica";
import { SeletorTema } from "@/components/app/tema";
import { logout } from "@/lib/actions/auth";
import { cn } from "@/lib/utils";
import { GRUPOS, modulosDoPapel, rotuloPapel } from "@/lib/rbac";
import type { Role } from "@/lib/supabase/types";

/**
 * Menu lateral do painel.
 *
 * No computador ele recolhe para uma faixa só de ícones, liberando a
 * tela para agenda, gráficos e tabelas. A escolha fica num cookie e vale
 * para as próximas visitas. No celular o menu é sempre a gaveta inteira.
 */
export function Sidebar({
  nome,
  fotoUrl = null,
  role,
  organizacao,
  logoUrl = null,
  naoLidas = 0,
  recolhidoInicial = false,
}: {
  nome: string;
  /** Foto de perfil; sem ela, as iniciais. */
  fotoUrl?: string | null;
  role: Role;
  organizacao: string | null;
  /** Logo da clínica; sem ela, cai no monograma. */
  logoUrl?: string | null;
  /** Notificações não lidas, para o contador do sino. */
  naoLidas?: number;
  /** Como o menu estava na última visita (cookie). */
  recolhidoInicial?: boolean;
}) {
  const pathname = usePathname();
  const [aberto, setAberto] = useState(false);
  const [recolhido, setRecolhido] = useState(recolhidoInicial);

  function alternar() {
    const novo = !recolhido;
    setRecolhido(novo);
    document.cookie = `medi_menu=${novo ? "recolhido" : "aberto"}; path=/; max-age=31536000; samesite=lax`;
  }

  // Só aparece o que o papel pode acessar
  const modulos = modulosDoPapel(role);
  const emNotificacoes = pathname.startsWith("/app/notificacoes");

  const conteudo = (compacto: boolean) => (
    <div className="flex h-full flex-col">
      <div className={cn("pb-4", compacto ? "px-3 pt-5" : "p-6")}>
        {/* A marca da clínica manda no painel dela. A da plataforma vira
            assinatura no rodapé. Sem clínica (super admin), o contrário. */}
        {compacto ? (
          <Link href="/app" className="mx-auto grid size-10 place-items-center" aria-label={organizacao ?? "Medi Marketing"} title={organizacao ?? "Medi Marketing"}>
            {organizacao && logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt={organizacao} className="logo-clinica size-10 rounded-lg object-contain" />
            ) : organizacao ? (
              <span className="grid size-10 place-items-center rounded-lg bg-azul-medico font-heading text-base font-bold text-white">
                {organizacao.trim().charAt(0).toUpperCase()}
              </span>
            ) : (
              <span className="grid size-10 place-items-center rounded-full bg-azul-medico text-teal-claro">
                <Plus className="size-6" strokeWidth={3} />
              </span>
            )}
          </Link>
        ) : organizacao ? (
          logoUrl ? (
            // Com logo, ela já diz quem é: o nome fica só no texto alternativo
            <Link href="/app" className="block" aria-label={organizacao}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logoUrl}
                alt={organizacao}
                className="logo-clinica h-9 w-auto max-w-[160px] object-contain object-left"
              />
            </Link>
          ) : (
            <MarcaClinica nome={organizacao} logoUrl={null} href="/app" />
          )
        ) : (
          <>
            <Logo href="/app" className="so-claro" />
            <Logo href="/app" light className="so-escuro" />
          </>
        )}

        {!organizacao && !compacto && (
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
          title={compacto ? "Notificações" : undefined}
          className={cn(
            "mt-2 flex items-center rounded-lg py-2.5 text-sm font-medium transition-colors",
            compacto ? "justify-center px-0" : "gap-3 px-3",
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
          {!compacto && <span className="truncate">Notificações</span>}
          {!compacto && naoLidas > 0 && (
            <span className="ml-auto shrink-0 rounded-full bg-coral px-1.5 py-0.5 text-[10px] font-bold text-white">
              {naoLidas > 99 ? "99+" : naoLidas}
            </span>
          )}
        </Link>
      </div>

      <nav className={cn("flex-1 overflow-y-auto overflow-x-hidden pb-4", compacto ? "space-y-3 px-2.5" : "space-y-5 px-3")}>
        {GRUPOS.map((grupo) => {
          const doGrupo = modulos.filter((m) => m.grupo === grupo.id);
          if (doGrupo.length === 0) return null;

          return (
            <div key={grupo.id}>
              {compacto ? (
                <div className="mx-auto mb-2 h-px w-8 bg-border" aria-hidden />
              ) : (
                <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-cinza-suave/70">
                  {grupo.label}
                </p>
              )}
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
                      title={compacto ? m.label : undefined}
                      aria-label={compacto ? m.label : undefined}
                      className={cn(
                        "flex items-center rounded-lg py-2.5 text-sm font-medium transition-colors",
                        compacto ? "justify-center px-0" : "gap-3 px-3",
                        ativo
                          ? "bg-verde-menta text-azul-medico"
                          : "text-cinza-suave hover:bg-verde-menta/60 hover:text-azul-medico"
                      )}
                    >
                      <m.icone className="size-5 shrink-0" />
                      {!compacto && <span className="truncate">{m.label}</span>}
                      {!compacto && m.fase > 1 && (
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

      <div className={cn("border-t border-border", compacto ? "px-2.5 py-3" : "p-3")}>
        {compacto ? (
          <div className="flex flex-col items-center gap-1">
            <Link href="/app/perfil" title={`${nome} · ${rotuloPapel(role)}`} className="mb-1">
              {fotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={fotoUrl} alt="" className="size-9 rounded-full object-cover" />
              ) : (
                <span className="grid size-9 place-items-center rounded-full bg-azul-medico text-sm font-semibold text-white">
                  {inicial(nome)}
                </span>
              )}
            </Link>
            <SeletorTema compacto />
            <form action={logout}>
              <button
                type="submit"
                title="Sair"
                aria-label="Sair"
                className="grid size-10 place-items-center rounded-lg text-cinza-suave transition-colors hover:bg-coral/10 hover:text-coral"
              >
                <LogOut className="size-5" />
              </button>
            </form>
          </div>
        ) : (
          <>
            <Link href="/app/perfil" className="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-branco-clinico">
              {fotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={fotoUrl} alt="" className="size-9 shrink-0 rounded-full object-cover" />
              ) : (
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-azul-medico text-sm font-semibold text-white">
                  {inicial(nome)}
                </span>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-cinza-texto">{nome}</p>
                <p className="truncate text-xs text-cinza-suave">{rotuloPapel(role)}</p>
              </div>
            </Link>
            <div className="mt-2 px-1">
              <SeletorTema />
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
              <a
                href="https://medimarketing.com.br"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 pt-2 text-[10px] text-cinza-suave/70 opacity-80 transition-opacity hover:opacity-100"
              >
                Feito com
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo-medimarketing-email.png" alt="Medi Marketing" className="h-3 w-auto" />
              </a>
            )}
          </>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Topbar mobile */}
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-border bg-white px-4 py-3 lg:hidden print:hidden">
        {organizacao ? (
          <MarcaClinica nome={organizacao} logoUrl={logoUrl} href="/app" tamanho="sm" />
        ) : (
          <>
            <Logo href="/app" className="so-claro" />
            <Logo href="/app" light className="so-escuro" />
          </>
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
      <aside
        className={cn(
          "relative hidden shrink-0 border-r border-border bg-white transition-[width] duration-200 lg:block print:hidden",
          recolhido ? "w-[76px]" : "w-64"
        )}
      >
        <div className="sticky top-0 h-screen">{conteudo(recolhido)}</div>
        <button
          type="button"
          onClick={alternar}
          className="absolute -right-3.5 top-7 z-20 grid size-7 place-items-center rounded-full border border-border bg-white text-cinza-suave shadow-soft transition-colors hover:border-teal hover:text-teal"
          aria-label={recolhido ? "Expandir menu" : "Recolher menu"}
          title={recolhido ? "Expandir menu" : "Recolher menu"}
        >
          {recolhido ? <ChevronsRight className="size-4" /> : <ChevronsLeft className="size-4" />}
        </button>
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
            {conteudo(false)}
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
