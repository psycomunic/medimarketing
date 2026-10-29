"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Bookmark, BookmarkPlus, Loader2, Search, Sparkles, X } from "lucide-react";
import { excluirSegmento, salvarSegmento } from "@/lib/actions/followup";
import type { SegmentoPacientes } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

const SITUACOES = [
  { v: "ativos", r: "Todos ativos" },
  { v: "sem-retorno", r: "Sem retorno" },
  { v: "novos", r: "Novos no mês" },
  { v: "aniversariantes", r: "Aniversariantes do mês" },
  { v: "arquivados", r: "Arquivados" },
];

/** Grupos que toda clínica quer achar: cada um é uma ação de relacionamento. */
const PRONTOS = [
  { v: "primeira-sem-retorno", r: "1ª consulta sem retorno", dica: "Vieram uma vez, há mais de 60 dias, e não voltaram" },
  { v: "faltaram", r: "Faltaram e não remarcaram", dica: "Têm falta registrada e nada marcado" },
  { v: "promotores", r: "Promotores (NPS 9–10)", dica: "Bons para pedir indicação e avaliação no Google" },
  { v: "detratores", r: "Detratores (NPS 0–6)", dica: "Pedem um contato da equipe" },
  { v: "valiosos", r: "Mais valiosos", dica: "Ordenados pelo total gasto" },
];
const CHAVES = ["busca", "situacao", "convenio", "profissional", "tag", "ordem"];

const seletor =
  "h-10 min-w-0 rounded-lg border border-border bg-white px-3 text-sm text-cinza-texto focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20";

/** Os filtros vivem no endereço: dá para salvar o link ou voltar com o navegador. */
export function FiltrosPacientes({
  convenios,
  tags,
  profissionais,
  segmentos = [],
  organizationId,
}: {
  convenios: string[];
  tags: string[];
  profissionais: { id: string; nome: string }[];
  segmentos?: SegmentoPacientes[];
  organizationId?: string;
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
  const atuais = Object.fromEntries(CHAVES.filter((k) => params.get(k)).map((k) => [k, params.get(k)!]));
  const temFiltro = Object.keys(atuais).length > 0;
  const mesmoFiltro = (f: Record<string, string>) => CHAVES.every((k) => (f[k] ?? "") === (atuais[k] ?? ""));
  const [salvando, setSalvando] = useState(false);
  const [nomeSeg, setNomeSeg] = useState("");
  const [erroSeg, setErroSeg] = useState<string | null>(null);

  function abrirSegmento(f: Record<string, string>) {
    const p = new URLSearchParams(f);
    setBusca(f.busca ?? "");
    startTransition(() => router.replace(`${pathname}${p.size ? `?${p}` : ""}`, { scroll: false }));
  }

  function guardar() {
    setErroSeg(null);
    startTransition(async () => {
      const r = await salvarSegmento(nomeSeg, atuais, organizationId);
      if (!r.ok) return setErroSeg(r.erro);
      setSalvando(false);
      setNomeSeg("");
      router.refresh();
    });
  }

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

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 inline-flex items-center gap-1 text-xs font-medium text-cinza-suave">
          <Sparkles className="size-3.5 text-teal" /> Segmentos
        </span>
        {PRONTOS.map((s) => (
          <button
            key={s.v}
            type="button"
            title={s.dica}
            aria-pressed={situacao === s.v}
            onClick={() => aplicar({ situacao: situacao === s.v ? "" : s.v })}
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
              situacao === s.v ? "bg-teal text-white" : "bg-verde-menta text-azul-medico hover:bg-teal/15"
            )}
          >
            {s.r}
          </button>
        ))}
        {segmentos.map((s) => (
          <span
            key={s.id}
            className={cn(
              "inline-flex items-center rounded-full text-xs font-medium",
              mesmoFiltro(s.filtros) ? "bg-azul-medico text-white" : "bg-[#EEF2F7] text-azul-medico"
            )}
          >
            <button type="button" onClick={() => abrirSegmento(s.filtros)} className="inline-flex items-center gap-1 py-1 pl-2.5 pr-1">
              <Bookmark className="size-3" /> {s.nome}
            </button>
            <button
              type="button"
              aria-label={`Excluir o segmento ${s.nome}`}
              onClick={() =>
                startTransition(async () => {
                  const r = await excluirSegmento(s.id);
                  if (r.ok) router.refresh();
                  else setErroSeg(r.erro);
                })
              }
              className="rounded-full py-1 pl-0.5 pr-2 opacity-60 hover:opacity-100"
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
        {temFiltro && !segmentos.some((s) => mesmoFiltro(s.filtros)) && !salvando && (
          <button
            type="button"
            onClick={() => setSalvando(true)}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-teal px-2.5 py-1 text-xs font-medium text-teal hover:bg-verde-menta"
          >
            <BookmarkPlus className="size-3.5" /> Salvar este filtro
          </button>
        )}
        {salvando && (
          <span className="inline-flex items-center gap-1.5">
            <input
              autoFocus
              value={nomeSeg}
              onChange={(e) => setNomeSeg(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") guardar();
                if (e.key === "Escape") setSalvando(false);
              }}
              placeholder="Nome do segmento"
              maxLength={80}
              className="h-7 w-44 rounded-full border border-border bg-white px-3 text-xs focus:border-teal focus:outline-none"
            />
            <button type="button" onClick={guardar} className="rounded-full bg-teal px-2.5 py-1 text-xs font-semibold text-white">
              Salvar
            </button>
            <button type="button" onClick={() => setSalvando(false)} className="text-xs text-cinza-suave hover:underline">
              Cancelar
            </button>
          </span>
        )}
        {erroSeg && <span className="w-full text-xs text-coral">{erroSeg}</span>}
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
        <select aria-label="Ordenar" value={params.get("ordem") ?? (situacao === "valiosos" ? "gasto" : "recentes")} onChange={(e) => aplicar({ ordem: e.target.value === "recentes" ? "" : e.target.value })} className={seletor}>
          <option value="recentes">Mais recentes</option>
          <option value="ultima">Última consulta</option>
          <option value="gasto">Quem mais gastou</option>
          <option value="nome">Nome (A–Z)</option>
        </select>
      </div>
    </div>
  );
}
