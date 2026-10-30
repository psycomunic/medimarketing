"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Sparkles, Wand2 } from "lucide-react";
import type { GrupoClassificar } from "@/lib/financeiro/classificar";
import { classificarEmLote } from "@/lib/actions/servicos";
import { Button } from "@/components/ui/button";
import { reais } from "@/components/graficos/formato";
import { cn } from "@/lib/utils";

type Opcao = { id: string; nome: string; categoria: string | null };
type Aba = "todos" | "sugestao" | "sem";

const dataBr = (iso: string) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "");

export function ClassificarLista({ grupos, servicos, demo }: { grupos: GrupoClassificar[]; servicos: Opcao[]; demo: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [feito, setFeito] = useState<string | null>(null);
  const [aba, setAba] = useState<Aba>("todos");
  // Serviço escolhido e marcação de cada grupo; sugestão de alta confiança já vem marcada
  const [escolha, setEscolha] = useState<Record<string, string>>(() => Object.fromEntries(grupos.map((g) => [g.chave, g.sugestao ?? ""])));
  const [marcado, setMarcado] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(grupos.map((g) => [g.chave, g.confianca === "alta"]))
  );

  const categorias = useMemo(() => {
    const m = new Map<string, Opcao[]>();
    for (const s of servicos) m.set(s.categoria?.trim() || "Outros serviços", [...(m.get(s.categoria?.trim() || "Outros serviços") ?? []), s]);
    return [...m.entries()];
  }, [servicos]);

  const visiveis = grupos.filter((g) => (aba === "todos" ? true : aba === "sugestao" ? !!g.sugestao : !g.sugestao));
  const prontos = grupos.filter((g) => marcado[g.chave] && escolha[g.chave]);
  const atendimentos = (g: GrupoClassificar) => g.consultas + g.receitas;
  const totalSem = grupos.reduce((s, g) => s + atendimentos(g), 0);
  const totalProntos = prontos.reduce((s, g) => s + atendimentos(g), 0);

  function aplicar() {
    setErro(null);
    setFeito(null);
    startTransition(async () => {
      const r = await classificarEmLote({
        itens: prontos.map((g) => ({ servicoId: escolha[g.chave], consultaIds: g.consultaIds, receitaIds: g.receitaIds })),
      });
      if (!r.ok) return setErro(r.erro);
      setFeito(`${r.consultas} consulta${r.consultas === 1 ? "" : "s"} e ${r.receitas} receita${r.receitas === 1 ? "" : "s"} avulsa${r.receitas === 1 ? "" : "s"} classificadas.`);
      router.refresh();
    });
  }

  if (!grupos.length)
    return (
      <div className="rounded-xl border border-border bg-white px-6 py-12 text-center shadow-soft">
        <CheckCircle2 className="mx-auto size-10 text-teal" />
        <p className="mt-3 font-heading text-base font-semibold text-azul-medico">Tudo classificado</p>
        <p className="mt-1 text-sm text-cinza-suave">Nenhuma consulta ou receita dos últimos meses está sem serviço.</p>
      </div>
    );

  return (
    <section className="min-w-0 rounded-xl border border-border bg-white shadow-soft">
      <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-t-xl border-b border-border bg-white/95 px-5 py-3 backdrop-blur">
        <div className="min-w-0">
          <p className="text-sm text-cinza-texto">
            <strong className="text-azul-medico">{totalSem.toLocaleString("pt-BR")}</strong> atendimentos sem serviço em{" "}
            {grupos.length} grupo{grupos.length === 1 ? "" : "s"}
          </p>
          <p className="text-xs text-cinza-suave">
            {prontos.length} grupo{prontos.length === 1 ? "" : "s"} marcado{prontos.length === 1 ? "" : "s"} · {totalProntos.toLocaleString("pt-BR")} atendimento
            {totalProntos === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setMarcado(Object.fromEntries(grupos.map((g) => [g.chave, !!escolha[g.chave]])))}
          >
            <Wand2 /> Marcar todos com serviço
          </Button>
          <Button type="button" variant="marca" size="sm" disabled={pending || demo || !prontos.length} onClick={aplicar}>
            {pending && <Loader2 className="size-4 animate-spin" />} Aplicar ({prontos.length})
          </Button>
        </div>
      </header>

      {(erro || feito || demo) && (
        <div className="px-5 pt-3">
          {erro && <p className="rounded-md bg-coral/10 px-3 py-2 text-sm text-coral">{erro}</p>}
          {feito && (
            <p className="flex items-center gap-2 rounded-md bg-verde-menta px-3 py-2 text-sm text-azul-medico">
              <CheckCircle2 className="size-4 text-teal" /> {feito}
            </p>
          )}
          {demo && <p className="rounded-md bg-branco-clinico px-3 py-2 text-xs text-cinza-suave">Na demonstração nada é salvo.</p>}
        </div>
      )}

      <div className="flex gap-1.5 px-5 pt-3 text-xs">
        {(
          [
            ["todos", `Todos (${grupos.length})`],
            ["sugestao", `Com sugestão (${grupos.filter((g) => g.sugestao).length})`],
            ["sem", `Sem sugestão (${grupos.filter((g) => !g.sugestao).length})`],
          ] as [Aba, string][]
        ).map(([k, r]) => (
          <button
            key={k}
            type="button"
            onClick={() => setAba(k)}
            className={cn(
              "rounded-full px-3 py-1 font-semibold transition-colors",
              aba === k ? "bg-azul-medico text-white" : "bg-branco-clinico text-cinza-suave hover:text-azul-medico"
            )}
          >
            {r}
          </button>
        ))}
      </div>

      <ul className="mt-2 divide-y divide-border">
        {visiveis.map((g) => {
          const id = `grupo-${g.chave}`;
          return (
            <li key={g.chave} className={cn("grid gap-3 px-5 py-3.5 sm:grid-cols-[auto_minmax(0,1fr)_16rem] sm:items-center", marcado[g.chave] && "bg-verde-menta/30")}>
              <input
                id={id}
                type="checkbox"
                checked={!!marcado[g.chave]}
                disabled={!escolha[g.chave]}
                onChange={(e) => setMarcado({ ...marcado, [g.chave]: e.target.checked })}
                className="size-4 accent-teal"
                aria-label={`Incluir ${g.texto}`}
              />
              <label htmlFor={id} className="min-w-0 cursor-pointer">
                <span className="block truncate font-medium text-cinza-texto">{g.texto}</span>
                <span className="block text-xs text-cinza-suave">
                  {[
                    g.consultas ? `${g.consultas} consulta${g.consultas === 1 ? "" : "s"}` : null,
                    g.receitas ? `${g.receitas} receita${g.receitas === 1 ? "" : "s"} avulsa${g.receitas === 1 ? "" : "s"}` : null,
                    g.valor ? reais(g.valor) : null,
                    g.ultima ? `última em ${dataBr(g.ultima)}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
                {g.exemplos.length > 0 && <span className="block truncate text-xs text-cinza-suave/80">{g.exemplos.join(", ")}</span>}
              </label>
              <div className="grid gap-1">
                <select
                  value={escolha[g.chave] ?? ""}
                  onChange={(e) => {
                    setEscolha({ ...escolha, [g.chave]: e.target.value });
                    setMarcado({ ...marcado, [g.chave]: !!e.target.value });
                  }}
                  className="h-9 w-full rounded-md border border-input bg-white px-2 text-sm text-cinza-texto"
                  aria-label={`Serviço para ${g.texto}`}
                >
                  <option value="">Escolha o serviço…</option>
                  {categorias.map(([c, lista]) => (
                    <optgroup key={c} label={c}>
                      {lista.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.nome}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                {g.sugestao && escolha[g.chave] === g.sugestao && (
                  <span className={cn("inline-flex items-center gap-1 text-[11px] font-medium", g.confianca === "alta" ? "text-teal" : "text-[#B45309]")}>
                    <Sparkles className="size-3" /> {g.confianca === "alta" ? "Sugestão pelo nome" : "Sugestão provável, confira"}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
