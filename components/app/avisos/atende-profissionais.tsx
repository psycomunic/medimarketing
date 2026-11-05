"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { salvarAtendimentoSecretaria } from "@/lib/actions/avisos";
import { cn } from "@/lib/utils";

/**
 * "Secretária de quem": marca os profissionais de quem ela cuida. Ela
 * recebe os avisos das consultas só deles. Nenhum marcado = recepção
 * geral, recebe de todos.
 */
export function AtendeProfissionais({
  secretariaId,
  profissionais,
  inicial,
  demo,
}: {
  secretariaId: string;
  profissionais: { id: string; nome: string }[];
  inicial: string[];
  demo: boolean;
}) {
  const router = useRouter();
  const [marcados, setMarcados] = useState<string[]>(inicial);
  const [pendente, iniciar] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const mudou = [...marcados].sort().join() !== [...inicial].sort().join();

  function alternar(id: string) {
    setMsg(null);
    setMarcados((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id]));
  }

  function salvar() {
    iniciar(async () => {
      const r = await salvarAtendimentoSecretaria(secretariaId, marcados);
      setMsg(r.ok ? { ok: true, texto: "Salvo." } : { ok: false, texto: r.erro });
      if (r.ok) router.refresh();
    });
  }

  if (!profissionais.length) return null;

  return (
    <div className="rounded-lg border border-border bg-branco-clinico p-3 sm:p-4">
      <p className="text-sm font-semibold text-azul-medico">Atende a agenda de</p>
      <p className="mt-0.5 text-xs text-cinza-suave">
        Recebe os avisos das consultas só dos profissionais marcados. Sem nenhum marcado, recebe de todos (recepção geral).
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {profissionais.map((p) => {
          const ativo = marcados.includes(p.id);
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => alternar(p.id)}
              aria-pressed={ativo}
              className={cn(
                "inline-flex min-h-10 max-w-full items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                ativo
                  ? "border-teal bg-teal text-white"
                  : "border-border bg-white text-cinza-texto hover:border-teal-claro"
              )}
            >
              {ativo && <Check className="size-4 shrink-0" />}
              <span className="truncate">{p.nome}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button size="sm" onClick={salvar} disabled={!mudou || pendente || demo}>
          {pendente ? "Salvando..." : "Salvar"}
        </Button>
        <span className={cn("text-xs", msg ? (msg.ok ? "text-sucesso" : "text-coral") : "text-cinza-suave")}>
          {msg?.texto ?? (marcados.length ? `${marcados.length} profissiona${marcados.length === 1 ? "l" : "is"}` : "Recepção geral: todos")}
        </span>
      </div>
    </div>
  );
}
