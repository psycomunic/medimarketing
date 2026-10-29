"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2, Search } from "lucide-react";
import { cn } from "@/lib/utils";

const SITUACOES = [
  { v: "ativos", r: "Todos ativos" },
  { v: "sem-retorno", r: "Sem retorno" },
  { v: "novos", r: "Novos no mês" },
  { v: "aniversariantes", r: "Aniversariantes do mês" },
  { v: "arquivados", r: "Arquivados" },
];

const seletor =
  "h-10 min-w-0 rounded-lg border border-border bg-white px-3 text-sm text-cinza-texto focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20";

/** Os filtros vivem no endereço: dá para salvar o link ou voltar com o navegador. */
export function FiltrosPacientes({
  convenios,
  tags,
  profissionais,
}: {
  convenios: string[];
  tags: string[];
  profissionais: { id: string; nome: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [busca, setBusca] = useState(params.get("busca") ?? "");
  const [pending, startTransition] = useTransition();
  const primeira = useRef(true);

  function aplicar(mudancas: Record<string, string>) {
    const p = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(mudancas)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    p.delete("pagina");
    startTransition(() => router.replace(`${pathname}${p.size ? `?${p}` : ""}`, { scroll: false }));
  }

  // Busca enquanto digita, com uma pausa para não consultar a cada tecla
  useEffect(() => {
    if (primeira.current) {
      primeira.current = false;
      return;
    }
    const t = setTimeout(() => aplicar({ busca: busca.trim() }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca]);

  const situacao = params.get("situacao") ?? "ativos";

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Situação">
        {SITUACOES.map((s) => (
          <button
            key={s.v}
            type="button"
            role="tab"
            aria-selected={situacao === s.v}
            onClick={() => aplicar({ situacao: s.v === "ativos" ? "" : s.v })}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors sm:text-sm",
              situacao === s.v
                ? "border-azul-medico bg-azul-medico text-white"
                : "border-border bg-white text-cinza-suave hover:border-teal hover:text-teal"
            )}
          >
            {s.r}
          </button>
        ))}
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))]">
        <label className="relative sm:col-span-2 lg:col-span-1">
          <span className="sr-only">Buscar paciente</span>
          {pending ? (
            <Loader2 className="absolute left-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-cinza-suave" />
          ) : (
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-cinza-suave" />
          )}
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Nome, telefone, e-mail ou CPF"
            className={cn(seletor, "w-full pl-9")}
          />
        </label>
        <select aria-label="Convênio" value={params.get("convenio") ?? ""} onChange={(e) => aplicar({ convenio: e.target.value })} className={seletor}>
          <option value="">Convênios</option>
          {convenios.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select aria-label="Profissional" value={params.get("profissional") ?? ""} onChange={(e) => aplicar({ profissional: e.target.value })} className={seletor}>
          <option value="">Profissionais</option>
          {profissionais.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
        </select>
        <select aria-label="Etiqueta" value={params.get("tag") ?? ""} onChange={(e) => aplicar({ tag: e.target.value })} className={seletor}>
          <option value="">Etiquetas</option>
          {tags.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select aria-label="Ordenar" value={params.get("ordem") ?? "recentes"} onChange={(e) => aplicar({ ordem: e.target.value === "recentes" ? "" : e.target.value })} className={seletor}>
          <option value="recentes">Mais recentes</option>
          <option value="ultima">Última consulta</option>
          <option value="gasto">Quem mais gastou</option>
          <option value="nome">Nome (A–Z)</option>
        </select>
      </div>
    </div>
  );
}
