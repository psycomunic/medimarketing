"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Loader2, Search, Unlock } from "lucide-react";
import { liberarFormulario } from "@/lib/actions/formularios";
import type { LinhaListaFormulario } from "@/lib/supabase/formularios";
import type { StatusFormulario } from "@/lib/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { formatarData, formatarDataHora } from "@/lib/formularios/formato";
import { cn } from "@/lib/utils";

export const ROTULO_STATUS: Record<StatusFormulario, { texto: string; cor: string }> = {
  rascunho: { texto: "Em preenchimento", cor: "bg-branco-clinico text-cinza-suave" },
  enviado: { texto: "Aguardando revisão", cor: "bg-coral/10 text-coral" },
  revisado: { texto: "Revisado", cor: "bg-verde-menta text-teal" },
};

export function StatusBadge({ status }: { status: StatusFormulario }) {
  const s = ROTULO_STATUS[status];
  return (
    <span className={cn("inline-flex shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold", s.cor)}>
      {s.texto}
    </span>
  );
}

/** Enviados primeiro: é o que está esperando alguém da equipe. */
const ORDEM: Record<StatusFormulario, number> = { enviado: 0, rascunho: 1, revisado: 2 };

export function ListaDiagnosticos({
  linhas,
  clinicas,
  slug,
  demo,
}: {
  linhas: LinhaListaFormulario[];
  clinicas: { id: string; nome: string }[];
  slug: string;
  demo: boolean;
}) {
  const router = useRouter();
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<StatusFormulario | "todos">("todos");
  const [clinica, setClinica] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const comDiagnostico = new Set(linhas.map((l) => l.organization_id));
  const semDiagnostico = clinicas.filter((c) => !comDiagnostico.has(c.id));

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    return linhas
      .filter((l) => filtro === "todos" || l.status === filtro)
      .filter((l) => !termo || l.clinica.toLocaleLowerCase("pt-BR").includes(termo))
      .sort(
        (a, b) => ORDEM[a.status] - ORDEM[b.status] || b.updated_at.localeCompare(a.updated_at)
      );
  }, [linhas, busca, filtro]);

  function liberar() {
    setErro(null);
    startTransition(async () => {
      const res = await liberarFormulario(clinica, slug);
      if (!res.ok) {
        setErro(res.erro);
        return;
      }
      setClinica("");
      router.push(`/app/admin/diagnosticos/${res.id}`);
    });
  }

  const contagem = (s: StatusFormulario) => linhas.filter((l) => l.status === s).length;

  return (
    <div className="mt-8 grid gap-6">
      <section className="rounded-lg border border-border bg-white p-5 shadow-soft md:p-6">
        <h2 className="text-lg font-semibold text-azul-medico">Liberar diagnóstico</h2>
        <p className="mt-1 text-sm text-cinza-suave">
          O questionário aparece no painel da clínica, para o gestor e o médico preencherem.
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="grid min-w-0 flex-1 gap-1.5">
            <Label htmlFor="liberar-clinica">Clínica</Label>
            <Select
              id="liberar-clinica"
              value={clinica}
              onChange={(e) => setClinica(e.target.value)}
            >
              <option value="">
                {semDiagnostico.length ? "Escolha a clínica" : "Todas as clínicas já têm diagnóstico"}
              </option>
              {semDiagnostico.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </Select>
          </div>
          <Button type="button" onClick={liberar} disabled={!clinica || pending || demo}>
            {pending ? <Loader2 className="animate-spin" /> : <Unlock />}
            Liberar
          </Button>
        </div>
        {demo && (
          <p className="mt-2 text-xs text-cinza-suave">Modo demonstração: nada é liberado de verdade.</p>
        )}
        {erro && <p className="mt-2 text-sm text-coral">{erro}</p>}
      </section>

      <section className="rounded-lg border border-border bg-white shadow-soft">
        <div className="flex flex-col gap-3 border-b border-border p-4 md:flex-row md:items-center md:justify-between md:p-5">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por status">
            {(
              [
                ["todos", `Todos (${linhas.length})`],
                ["enviado", `Aguardando revisão (${contagem("enviado")})`],
                ["rascunho", `Em preenchimento (${contagem("rascunho")})`],
                ["revisado", `Revisados (${contagem("revisado")})`],
              ] as const
            ).map(([valor, texto]) => (
              <button
                key={valor}
                type="button"
                onClick={() => setFiltro(valor)}
                aria-pressed={filtro === valor}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                  filtro === valor
                    ? "bg-azul-medico text-white"
                    : "bg-branco-clinico text-cinza-suave hover:text-azul-medico"
                )}
              >
                {texto}
              </button>
            ))}
          </div>
          <div className="relative md:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-cinza-suave" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar clínica"
              aria-label="Buscar clínica"
              className="h-10 pl-9"
            />
          </div>
        </div>

        {visiveis.length === 0 ? (
          <p className="p-8 text-center text-sm text-cinza-suave">
            {linhas.length === 0
              ? "Nenhum diagnóstico liberado ainda. Escolha uma clínica acima para começar."
              : "Nenhum diagnóstico com esse filtro."}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {visiveis.map((l) => (
              <li key={l.id}>
                <Link
                  href={`/app/admin/diagnosticos/${l.id}`}
                  className="flex items-center gap-4 p-4 transition-colors hover:bg-branco-clinico md:px-5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-semibold text-azul-medico">{l.clinica}</span>
                      <StatusBadge status={l.status} />
                    </div>
                    <div className="mt-2 flex items-center gap-3">
                      <div className="h-1.5 w-28 overflow-hidden rounded-full bg-verde-menta">
                        <div className="h-full rounded-full bg-teal" style={{ width: `${l.progresso}%` }} />
                      </div>
                      <span className="text-xs tabular-nums text-cinza-suave">{l.progresso}%</span>
                    </div>
                    <p className="mt-1.5 text-xs text-cinza-suave">
                      Atualizado em {formatarDataHora(l.updated_at)}
                      {l.enviado_em && ` · enviado em ${formatarData(l.enviado_em)}`}
                    </p>
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-cinza-suave" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
