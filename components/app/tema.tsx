"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * TEMA CLARO / ESCURO DO PAINEL
 *
 * A escolha fica num cookie (`medi_tema`), lido por um script curto que
 * roda antes da página aparecer: sem o clarão branco ao abrir no
 * escuro. "Sistema" segue o que o computador ou o celular estiver usando.
 *
 * Só o painel muda de tema: ao sair dele (site, página do paciente) a
 * classe é retirada.
 */
export type Tema = "claro" | "escuro" | "sistema";

const COOKIE = "medi_tema";

/** Script que aplica o tema antes da primeira pintura. */
export const SCRIPT_TEMA = `(function(){try{var m=document.cookie.match(/(?:^|; )medi_tema=([^;]+)/);var t=m?m[1]:"claro";var e=t==="escuro"||(t==="sistema"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",e);}catch(_){}})();`;

function lerTema(): Tema {
  const m = document.cookie.match(/(?:^|; )medi_tema=([^;]+)/);
  const t = m?.[1];
  return t === "escuro" || t === "sistema" ? t : "claro";
}

function aplicar(t: Tema) {
  const escuro = t === "escuro" || (t === "sistema" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", escuro);
}

/** Mantém o tema enquanto o painel está aberto e o tira ao sair. */
export function TemaDoPainel() {
  useEffect(() => {
    aplicar(lerTema());
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const mudouSistema = () => lerTema() === "sistema" && aplicar("sistema");
    mq.addEventListener("change", mudouSistema);
    return () => {
      mq.removeEventListener("change", mudouSistema);
      document.documentElement.classList.remove("dark");
    };
  }, []);
  return null;
}

/** Os três botões: claro, escuro, sistema. `compacto` alterna num botão só. */
export function SeletorTema({ compacto = false }: { compacto?: boolean }) {
  const [tema, setTema] = useState<Tema>("claro");
  useEffect(() => setTema(lerTema()), []);

  function escolher(t: Tema) {
    document.cookie = `${COOKIE}=${t}; path=/; max-age=31536000; samesite=lax`;
    setTema(t);
    aplicar(t);
  }

  const opcoes: { id: Tema; rotulo: string; icone: typeof Sun }[] = [
    { id: "claro", rotulo: "Claro", icone: Sun },
    { id: "escuro", rotulo: "Escuro", icone: Moon },
    { id: "sistema", rotulo: "Automático", icone: Monitor },
  ];

  if (compacto) {
    const atual = opcoes.find((o) => o.id === tema) ?? opcoes[0];
    const proximo = opcoes[(opcoes.indexOf(atual) + 1) % opcoes.length];
    return (
      <button
        type="button"
        onClick={() => escolher(proximo.id)}
        className="grid size-10 place-items-center rounded-lg text-cinza-suave transition-colors hover:bg-verde-menta/60 hover:text-azul-medico"
        title={`Tema: ${atual.rotulo} (clique para ${proximo.rotulo.toLowerCase()})`}
        aria-label={`Tema ${atual.rotulo}. Mudar para ${proximo.rotulo}`}
      >
        <atual.icone className="size-5" />
      </button>
    );
  }

  return (
    <div className="flex rounded-lg bg-branco-clinico p-1" role="radiogroup" aria-label="Tema do painel">
      {opcoes.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={tema === o.id}
          onClick={() => escolher(o.id)}
          title={o.rotulo}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
            tema === o.id ? "bg-white text-azul-medico shadow-sm" : "text-cinza-suave hover:text-azul-medico"
          )}
        >
          <o.icone className="size-3.5" />
          <span className="truncate">{o.rotulo}</span>
        </button>
      ))}
    </div>
  );
}

/** Documentos (PDF) ficam sempre claros, mesmo com o painel no escuro. */
export function ForcarTemaClaro() {
  useEffect(() => {
    const tinha = document.documentElement.classList.contains("dark");
    document.documentElement.classList.remove("dark");
    return () => {
      if (tinha) aplicar(lerTema());
    };
  }, []);
  return null;
}
