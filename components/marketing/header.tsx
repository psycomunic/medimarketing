"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X, MessageCircle, LogIn } from "lucide-react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { navLinks, site } from "@/lib/site";
import { whatsappLink, cn } from "@/lib/utils";

export function Header() {
  const [aberto, setAberto] = useState(false);
  const [comSombra, setComSombra] = useState(false);

  // Adiciona sombra ao rolar (feedback sutil de header fixo)
  useEffect(() => {
    const onScroll = () => setComSombra(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const zap = whatsappLink(
    site.whatsapp,
    "Olá! Vim pelo site e quero saber mais sobre atendimento e marketing para meu consultório."
  );

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 border-b border-transparent bg-branco-clinico/80 backdrop-blur-md transition-shadow",
        comSombra && "border-border shadow-soft"
      )}
    >
      <div className="container flex h-16 items-center justify-between md:h-20">
        <Logo />

        {/* Navegação desktop */}
        <nav className="hidden items-center gap-8 lg:flex">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-cinza-texto transition-colors hover:text-teal"
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* CTAs desktop */}
        <div className="hidden items-center gap-3 md:flex">
          <Button asChild variant="ghost" size="sm">
            <Link href="/login">
              <LogIn className="size-4" />
              Área do Médico
            </Link>
          </Button>
          <Button asChild variant="primary" size="sm">
            <a href={zap} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="size-4" />
              Fale com a gente
            </a>
          </Button>
        </div>

        {/* Botão mobile */}
        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          className="grid size-10 place-items-center rounded-md text-azul-medico md:hidden"
          aria-label={aberto ? "Fechar menu" : "Abrir menu"}
          aria-expanded={aberto}
        >
          {aberto ? <X /> : <Menu />}
        </button>
      </div>

      {/* Menu mobile */}
      {aberto && (
        <div className="border-t border-border bg-branco-clinico md:hidden">
          <nav className="container flex flex-col gap-1 py-4">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setAberto(false)}
                className="rounded-md px-2 py-3 font-medium text-cinza-texto hover:bg-verde-menta"
              >
                {link.label}
              </a>
            ))}
            <div className="mt-2 flex flex-col gap-2">
              <Button asChild variant="outline">
                <Link href="/login">
                  <LogIn className="size-4" />
                  Área do Médico
                </Link>
              </Button>
              <Button asChild variant="primary">
                <a href={zap} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="size-4" />
                  Fale com a gente
                </a>
              </Button>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
