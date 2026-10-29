"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Merge } from "lucide-react";
import { juntarPacientes } from "@/lib/actions/pacientes";
import type { PacienteResumo } from "@/lib/supabase/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const data = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: "America/Sao_Paulo" }).replace(/\./g, "") : "—";

/** Um grupo de fichas parecidas: escolhe a que fica e junta as outras nela. */
export function GrupoDuplicado({ grupo, podeJuntar }: { grupo: PacienteResumo[]; podeJuntar: boolean }) {
  const router = useRouter();
  // Fica, por padrão, a ficha com mais histórico
  const [manter, setManter] = useState(() => [...grupo].sort((a, b) => b.consultas_realizadas - a.consultas_realizadas)[0].id);
  const [marcados, setMarcados] = useState<string[]>(grupo.map((p) => p.id));
  const [erro, setErro] = useState<string | null>(null);
  const [pronto, setPronto] = useState(false);
  const [pending, startTransition] = useTransition();
  const remover = marcados.filter((id) => id !== manter);

  if (pronto) return null;

  return (
    <section className="rounded-xl border border-border bg-white p-4 shadow-soft sm:p-5">
      <ul className="grid gap-2">
        {grupo.map((p) => {
          const fica = p.id === manter;
          const junta = marcados.includes(p.id);
          return (
            <li
              key={p.id}
              className={cn(
                "grid gap-2 rounded-lg border px-3 py-2.5 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center",
                fica ? "border-teal bg-verde-menta/50" : "border-border"
              )}
            >
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  aria-label={`Incluir ${p.nome}`}
                  checked={junta}
                  disabled={fica}
                  onChange={(e) => setMarcados(e.target.checked ? [...marcados, p.id] : marcados.filter((x) => x !== p.id))}
                  className="size-4 accent-teal"
                />
                <label className="flex items-center gap-1.5 text-xs font-medium text-cinza-suave">
                  <input type="radio" name={`manter-${grupo[0].id}`} checked={fica} onChange={() => setManter(p.id)} className="accent-azul-medico" />
                  Manter esta
                </label>
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-cinza-texto">{p.nome}</p>
                <p className="truncate text-xs text-cinza-suave">
                  {[p.telefone, p.email, p.nascimento && `nasc. ${data(`${p.nascimento}T12:00:00`)}`].filter(Boolean).join(" · ") || "Sem contato"}
                </p>
              </div>
              <p className="text-xs text-cinza-suave sm:text-right">
                {p.consultas_realizadas} consulta{p.consultas_realizadas === 1 ? "" : "s"} · última {data(p.ultima_consulta)}
              </p>
            </li>
          );
        })}
      </ul>
      {erro && <p className="mt-3 rounded-md bg-coral/10 px-3 py-2 text-sm text-coral">{erro}</p>}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-cinza-suave">
          {remover.length ? `As consultas de ${remover.length} ficha${remover.length === 1 ? "" : "s"} passam para a marcada como “manter”.` : "Marque pelo menos uma ficha para juntar."}
        </p>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => setPronto(true)}>
            Não são a mesma pessoa
          </Button>
          {podeJuntar && (
            <Button
              variant="marca"
              size="sm"
              disabled={pending || !remover.length}
              onClick={() =>
                startTransition(async () => {
                  setErro(null);
                  const r = await juntarPacientes(manter, remover);
                  if (!r.ok) return setErro(r.erro);
                  setPronto(true);
                  router.refresh();
                })
              }
            >
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Merge className="size-4" />}
              Juntar fichas
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
