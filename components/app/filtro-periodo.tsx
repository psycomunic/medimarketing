"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarRange, Loader2, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const hojeIso = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

/**
 * Filtro de período reutilizável: atalhos (hoje, 7 dias, mês...), um
 * intervalo de datas livre e, opcionalmente, o profissional. Tudo vai na
 * URL (?periodo=, ?de=, ?ate=, ?profissional=), então a página do servidor
 * recalcula e o link pode ser compartilhado.
 */
export function FiltroPeriodo({
  periodos,
  padrao,
  atual,
  profissionais,
  profissional,
}: {
  periodos: { chave: string; rotulo: string }[];
  /** Período que vale sem nada na URL. */
  padrao: string;
  atual: { periodo: string; de?: string; ate?: string };
  profissionais?: { id: string; nome: string }[];
  profissional?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [aberto, setAberto] = useState(false);
  const [carregando, setCarregando] = useState<string | null>(null);
  const hoje = hojeIso();
  const [de, setDe] = useState(atual.de ?? `${hoje.slice(0, 8)}01`);
  const [ate, setAte] = useState(atual.ate ?? hoje);
  const caixa = useRef<HTMLDivElement>(null);
  // Abre para o lado que tem espaço: perto da borda direita, alinha pela direita
  const [desloc, setDesloc] = useState(0);
  function abrir() {
    const r = caixa.current?.getBoundingClientRect();
    const largura = Math.min(288, window.innerWidth - 32);
    setDesloc(r ? Math.max(16 - r.left, Math.min(0, window.innerWidth - 16 - (r.left + largura))) : 0);
    setAberto(!aberto);
  }

  // A troca de URL terminou: some o indicador
  useEffect(() => setCarregando(null), [params]);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => caixa.current && !caixa.current.contains(e.target as Node) && setAberto(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [aberto]);

  function ir(mudar: Record<string, string | null>, marca: string) {
    const p = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(mudar)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    setCarregando(marca);
    router.push(p.size ? `${pathname}?${p}` : pathname, { scroll: false });
  }

  const personalizado = atual.periodo === "personalizado";
  const fmt = (d?: string) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : "");
  const intervaloValido = !!de && !!ate;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <nav aria-label="Período" className="flex max-w-full overflow-x-auto rounded-full border border-border bg-white p-1 shadow-soft [scrollbar-width:none]">
        {periodos.map((x) => {
          const ativo = x.chave === atual.periodo;
          return (
            <button
              key={x.chave}
              type="button"
              aria-pressed={ativo}
              onClick={() => ir({ periodo: x.chave === padrao ? null : x.chave, de: null, ate: null }, x.chave)}
              className={cn(
                "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-colors sm:text-sm",
                ativo ? "bg-azul-medico text-white" : "text-cinza-suave hover:text-azul-medico"
              )}
            >
              {carregando === x.chave && <Loader2 className="size-3 animate-spin" />}
              {x.rotulo}
            </button>
          );
        })}
      </nav>

      <div ref={caixa} className="relative">
        <button
          type="button"
          aria-expanded={aberto}
          onClick={abrir}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-semibold shadow-soft transition-colors sm:text-sm",
            personalizado ? "border-azul-medico bg-azul-medico text-white" : "border-border bg-white text-cinza-suave hover:text-azul-medico"
          )}
        >
          {carregando === "personalizado" ? <Loader2 className="size-4 animate-spin" /> : <CalendarRange className="size-4" />}
          {personalizado ? (atual.de === atual.ate ? fmt(atual.de) : `${fmt(atual.de)} a ${fmt(atual.ate)}`) : "Escolher datas"}
        </button>
        {aberto && (
          <div
            className="absolute z-30 mt-2 w-[min(18rem,calc(100vw-2rem))] rounded-xl border border-border bg-white p-4 shadow-card"
            style={{ left: desloc }}
          >
            <p className="text-sm font-semibold text-azul-medico">Período personalizado</p>
            <div className="mt-3 grid gap-3">
              <label className="grid gap-1 text-xs font-medium text-cinza-suave">
                De
                <Input type="date" value={de} max={ate || undefined} onChange={(e) => setDe(e.target.value)} />
              </label>
              <label className="grid gap-1 text-xs font-medium text-cinza-suave">
                Até
                <Input type="date" value={ate} min={de || undefined} onChange={(e) => setAte(e.target.value)} />
              </label>
              <Button
                type="button"
                variant="marca"
                size="sm"
                disabled={!intervaloValido}
                onClick={() => {
                  setAberto(false);
                  ir({ periodo: "personalizado", de, ate }, "personalizado");
                }}
              >
                Aplicar
              </Button>
            </div>
          </div>
        )}
      </div>

      {profissionais && profissionais.length > 1 && (
        <label className="relative inline-flex items-center">
          <span className="sr-only">Profissional</span>
          <UserRound className="pointer-events-none absolute left-3 size-4 text-cinza-suave" />
          <select
            value={profissional ?? ""}
            onChange={(e) => ir({ profissional: e.target.value || null }, "profissional")}
            className={cn(
              "h-9 max-w-[14rem] appearance-none truncate rounded-full border bg-white pl-9 pr-8 text-xs font-semibold shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 sm:text-sm",
              profissional ? "border-azul-medico text-azul-medico" : "border-border text-cinza-suave"
            )}
          >
            <option value="">Todos os profissionais</option>
            {profissionais.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
          {carregando === "profissional" ? (
            <Loader2 className="pointer-events-none absolute right-3 size-3.5 animate-spin text-cinza-suave" />
          ) : (
            <span aria-hidden className="pointer-events-none absolute right-3 text-[10px] text-cinza-suave">▼</span>
          )}
        </label>
      )}
    </div>
  );
}
