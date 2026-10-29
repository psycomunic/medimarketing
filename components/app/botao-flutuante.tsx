"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * BOTÃO FLUTUANTE
 *
 * A ação mais comum de cada tela, sempre à mão no canto inferior
 * direito, inclusive no celular, onde o botão do topo some ao rolar.
 *
 * Com uma ação, o botão a executa direto. Com várias, abre um pequeno
 * menu acima dele. Cada ação ou dispara um evento (que a lista da tela
 * escuta para abrir o próprio formulário) ou leva a outra tela já com
 * o formulário aberto (`?novo=1`).
 */
export type AcaoFlutuante = {
  rotulo: string;
  icone: React.ComponentType<{ className?: string }>;
  /** Nome do evento que a tela escuta (ver `useAcaoFlutuante`). */
  evento?: string;
  /** Ou: ir para outra tela. */
  href?: string;
};

export function BotaoFlutuante({ acoes, rotulo }: { acoes: AcaoFlutuante[]; rotulo?: string }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [folga, setFolga] = useState(0);
  const caixa = useRef<HTMLDivElement>(null);

  // A barra da demonstração ocupa o rodapé: o botão sobe acima dela
  useEffect(() => {
    const medir = () => {
      const barra = document.querySelector("[data-barra-demo]");
      setFolga(barra ? barra.getBoundingClientRect().height : 0);
    };
    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, []);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [aberto]);

  function executar(a: AcaoFlutuante) {
    setAberto(false);
    if (a.evento) window.dispatchEvent(new CustomEvent(a.evento));
    else if (a.href) router.push(a.href);
  }

  if (!acoes.length) return null;
  const unica = acoes.length === 1 ? acoes[0] : null;
  const Icone = unica?.icone ?? Plus;

  return (
    <div
      ref={caixa}
      className="fixed bottom-5 right-4 z-40 flex flex-col items-end gap-3 sm:bottom-8 sm:right-8 print:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)", marginBottom: folga }}
    >
      {aberto && !unica && (
        <ul className="flex flex-col items-end gap-2.5" role="menu">
          {acoes.map((a, i) => (
            <li
              key={a.rotulo}
              className="animate-in fade-in slide-in-from-bottom-2"
              style={{ animationDelay: `${(acoes.length - 1 - i) * 30}ms`, animationFillMode: "both" }}
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => executar(a)}
                className="group flex items-center gap-3"
              >
                <span className="rounded-lg bg-azul-profundo px-3 py-1.5 text-sm font-medium text-white shadow-card">
                  {a.rotulo}
                </span>
                <span className="grid size-11 place-items-center rounded-full border border-border bg-white text-azul-medico shadow-card transition-colors group-hover:bg-verde-menta group-hover:text-teal">
                  <a.icone className="size-5" />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={() => (unica ? executar(unica) : setAberto(!aberto))}
        aria-label={unica ? unica.rotulo : aberto ? "Fechar ações" : rotulo ?? "Ações rápidas"}
        aria-expanded={unica ? undefined : aberto}
        className={cn(
          "group flex h-14 items-center gap-2 rounded-full bg-azul-medico pl-4 pr-5 text-white shadow-[0_12px_32px_-8px_rgba(11,79,108,0.55)] transition-all hover:-translate-y-0.5 hover:bg-azul-profundo",
          aberto && "bg-azul-profundo"
        )}
      >
        {aberto ? <X className="size-6" /> : <Icone className="size-6" />}
        <span className="text-sm font-semibold">{aberto ? "Fechar" : unica ? unica.rotulo : rotulo ?? "Novo"}</span>
      </button>
    </div>
  );
}

/**
 * Faz a tela reagir ao botão flutuante: abre o formulário quando o
 * evento chega, ou logo ao entrar se a URL vier com `?novo=1`.
 */
export function useAcaoFlutuante(evento: string, abrir: () => void, comNovoNaUrl = true) {
  const ref = useRef(abrir);
  ref.current = abrir;
  useEffect(() => {
    const ouvir = () => ref.current();
    window.addEventListener(evento, ouvir);
    if (comNovoNaUrl) {
      const url = new URL(window.location.href);
      if (url.searchParams.get("novo") === "1") {
        ref.current();
        url.searchParams.delete("novo");
        window.history.replaceState(null, "", url.toString());
      }
    }
    return () => window.removeEventListener(evento, ouvir);
  }, [evento, comNovoNaUrl]);
}
