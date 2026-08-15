"use client";

import { useTransition } from "react";
import { usePathname } from "next/navigation";
import { Eye, Loader2, X } from "lucide-react";
import { sairDaDemo, verComoPapel } from "@/lib/actions/demonstracao";
import { PAPEIS_DEMONSTRACAO } from "@/lib/demo";
import type { Role } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

/**
 * Barra da demonstração comercial.
 *
 * Flutua no rodapé, e não no topo, por dois motivos: continua ao alcance
 * depois de rolar qualquer tela, e não disputa espaço com a barra do
 * celular, que já é fixa lá em cima.
 *
 * A troca de papel manda o caminho atual junto para a action decidir se
 * dá para ficar na mesma tela. Mostrar a MESMA agenda pelos olhos do
 * médico e da atendente é o momento que vende; voltar para o início a
 * cada troca desperdiçaria isso.
 */
export function BarraDemo({ papelAtual }: { papelAtual: Role }) {
  const caminho = usePathname();
  const [pendente, iniciar] = useTransition();

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center p-3 sm:p-4">
      <div className="pointer-events-auto flex max-w-[calc(100vw-1.5rem)] flex-wrap items-center justify-center gap-x-3 gap-y-2 rounded-2xl border border-white/10 bg-azul-medico/95 px-3 py-2.5 shadow-card backdrop-blur">
        {/* No celular fica só o olho: com as duas palavras a barra
            quebrava em duas linhas e virava um bloco no rodapé. */}
        <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-teal-claro">
          <Eye className="size-3.5" />
          <span className="hidden sm:inline">Vendo como</span>
        </span>

        <div className="flex items-center gap-1 rounded-full bg-white/10 p-1">
          {PAPEIS_DEMONSTRACAO.map((p) => {
            const ativo = p.role === papelAtual;
            return (
              <button
                key={p.role}
                type="button"
                disabled={pendente || ativo}
                onClick={() => iniciar(() => verComoPapel(p.role, caminho))}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                  ativo
                    ? "bg-white text-azul-medico"
                    : "text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-50"
                )}
              >
                {p.curto}
              </button>
            );
          })}
        </div>

        {pendente && (
          <Loader2 className="size-4 animate-spin text-teal-claro" aria-hidden />
        )}

        <button
          type="button"
          disabled={pendente}
          onClick={() => iniciar(() => sairDaDemo())}
          className="flex items-center gap-1 text-xs font-medium text-white/60 transition-colors hover:text-white"
        >
          <X className="size-3.5" />
          Sair
        </button>
      </div>
    </div>
  );
}
