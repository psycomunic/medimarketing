"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarRange, ChevronDown, ChevronLeft, ChevronRight, FileDown, Sheet } from "lucide-react";
import { atalhosPeriodo, deslocarPeriodo, paramsDoPeriodo, periodoFinanceiro } from "@/lib/financeiro/periodo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

export type AbaNav = {
  href: string;
  rotulo: string;
  /** Não usa período (tem filtro próprio ou mostra tudo): a barra some. */
  semMes?: boolean;
  /** Só funciona mês a mês (ex.: fechamento de repasses): sem trimestre, ano ou datas. */
  soMes?: boolean;
};

const mesAtual = () => new Date().toLocaleDateString("sv-SE").slice(0, 7);
const fimDoMes = (m: string) => `${m}-${String(new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 0).getDate()).padStart(2, "0")}`;

/** Um mês inteiro vira ?mes=; o resto, ?de=&ate=. */
function query(de: string, ate: string): string {
  const mes = de.slice(0, 7);
  return de === `${mes}-01` && ate === fimDoMes(mes) ? `mes=${mes}` : `de=${de}&ate=${ate}`;
}

/**
 * Abas do módulo e o período em análise. O período vai na URL (?mes= ou
 * ?de=&ate=), então trocar de aba mantém o recorte e o link pode ser
 * compartilhado. Com `intervalos`, além do mês dá para escolher trimestre,
 * ano, últimos 12 meses ou datas livres.
 */
export function NavFinanceiro({
  abas,
  base,
  relatorioHref,
  exportarHref,
  intervalos = false,
}: {
  abas: AbaNav[];
  base: string;
  relatorioHref?: string;
  /** Planilha (CSV) do período, para o contador. */
  exportarHref?: string;
  intervalos?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const params = useSearchParams();
  const ativa = (t: AbaNav) => (t.href === base ? pathname === base : pathname.startsWith(t.href));
  const aba = abas.find(ativa);
  const semMes = aba?.semMes ?? false;
  const soMes = !intervalos || (aba?.soMes ?? false);

  const lido = periodoFinanceiro(params);
  // Aba só de mês: vale o último mês do período escolhido
  const p = soMes && !lido.ehMes ? periodoFinanceiro({ mes: lido.mes }) : lido;
  const qs = new URLSearchParams(paramsDoPeriodo(p)).toString();
  const comPeriodo = (href: string) => `${href}?${qs}`;
  const comMes = (href: string) => `${href}?mes=${p.mes}`;
  const ir = (de: string, ate: string) => router.push(`${pathname}?${query(de, ate)}`);
  const andar = (n: -1 | 1) => {
    const d = deslocarPeriodo(p, n);
    ir(d.de, d.ate);
  };
  const ehAtual = p.ehMes && p.mes === mesAtual();

  const [aberto, setAberto] = useState(false);
  const [de, setDe] = useState(p.de);
  const [ate, setAte] = useState(p.ate);
  const caixa = useRef<HTMLDivElement>(null);
  // Em tela estreita o painel não cabe a partir do botão: encosta na margem
  const [desloc, setDesloc] = useState(0);
  function abrir() {
    const r = caixa.current?.getBoundingClientRect();
    const largura = Math.min(304, window.innerWidth - 32);
    setDesloc(r ? Math.min(0, window.innerWidth - 16 - (r.left + largura)) : 0);
    setAberto(!aberto);
  }
  useEffect(() => {
    setDe(p.de);
    setAte(p.ate);
  }, [p.de, p.ate]);
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

  const [a, m] = p.mes.split("-").map(Number);
  const atalhos = atalhosPeriodo();

  return (
    <div className="mt-6 rounded-xl border border-border bg-white shadow-soft print:hidden">
      {/* Abas sem período têm filtro e planilha próprios: a barra some */}
      <div className={cn("flex flex-wrap items-center justify-between gap-3 border-b border-border px-3 py-2.5 sm:px-4", semMes && "hidden")}>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex overflow-hidden rounded-lg border border-border">
            <button
              type="button"
              onClick={() => andar(-1)}
              className="grid size-9 place-items-center text-cinza-suave hover:bg-verde-menta hover:text-azul-medico"
              aria-label="Período anterior"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => andar(1)}
              className="grid size-9 place-items-center border-l border-border text-cinza-suave hover:bg-verde-menta hover:text-azul-medico"
              aria-label="Próximo período"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>

          {soMes ? (
            <p className="font-heading text-base font-semibold capitalize text-azul-medico sm:text-lg">
              {MESES[m - 1]} <span className="font-normal text-cinza-suave">{a}</span>
            </p>
          ) : (
            <div ref={caixa} className="relative">
              <button
                type="button"
                aria-expanded={aberto}
                onClick={abrir}
                className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 font-heading text-base font-semibold text-azul-medico hover:bg-verde-menta sm:text-lg"
              >
                <span className="first-letter:uppercase">{p.rotulo}</span>
                <ChevronDown className={cn("size-4 text-cinza-suave transition-transform", aberto && "rotate-180")} />
              </button>
              {aberto && (
                <div
                  className="absolute z-30 mt-2 w-[min(19rem,calc(100vw-2rem))] rounded-xl border border-border bg-white p-2 shadow-card"
                  style={{ left: desloc }}
                >
                  <ul className="grid">
                    {atalhos.map((x) => {
                      const ativo = x.de === p.de && x.ate === p.ate;
                      return (
                        <li key={x.chave}>
                          <button
                            type="button"
                            onClick={() => {
                              setAberto(false);
                              ir(x.de, x.ate);
                            }}
                            className={cn(
                              "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors",
                              ativo ? "bg-verde-menta font-semibold text-azul-medico" : "text-cinza-texto hover:bg-branco-clinico"
                            )}
                          >
                            {x.rotulo}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  <div className="mt-1 border-t border-border px-1 pt-3">
                    <p className="flex items-center gap-1.5 px-2 text-xs font-semibold uppercase tracking-wide text-cinza-suave">
                      <CalendarRange className="size-3.5" /> Datas
                    </p>
                    <div className="mt-2 grid grid-cols-2 gap-2 px-1">
                      <label className="grid gap-1 text-xs text-cinza-suave">
                        De
                        <Input type="date" value={de} max={ate || undefined} onChange={(e) => setDe(e.target.value)} className="h-9 px-2 text-sm" />
                      </label>
                      <label className="grid gap-1 text-xs text-cinza-suave">
                        Até
                        <Input type="date" value={ate} min={de || undefined} onChange={(e) => setAte(e.target.value)} className="h-9 px-2 text-sm" />
                      </label>
                    </div>
                    <Button
                      type="button"
                      variant="marca"
                      size="sm"
                      className="mx-1 mb-1 mt-2 w-[calc(100%-0.5rem)]"
                      disabled={!de || !ate}
                      onClick={() => {
                        setAberto(false);
                        ir(de <= ate ? de : ate, de <= ate ? ate : de);
                      }}
                    >
                      Aplicar
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {!ehAtual && (
            <button
              type="button"
              onClick={() => router.push(`${pathname}?mes=${mesAtual()}`)}
              className="rounded-lg border border-teal bg-verde-menta px-2.5 py-1.5 text-xs font-medium text-azul-medico hover:bg-teal hover:text-white"
            >
              Mês atual
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {exportarHref && (
            <a
              href={comPeriodo(exportarHref)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-azul-medico transition-colors hover:border-teal hover:text-teal"
              title="Receitas e despesas do período em planilha"
            >
              <Sheet className="size-4" /> Planilha
            </a>
          )}
          {relatorioHref && (
            <Link
              href={comMes(relatorioHref)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-azul-medico px-3 py-2 text-sm font-medium text-white shadow-soft transition-colors hover:bg-azul-profundo"
              title="Relatório do mês"
            >
              <FileDown className="size-4" /> Relatório em PDF
            </Link>
          )}
        </div>
      </div>
      <nav className="flex gap-1 overflow-x-auto px-2 py-1.5 [scrollbar-width:none]" aria-label="Seções do financeiro">
        {abas.map((t) => {
          const ativo = ativa(t);
          return (
            <Link
              key={t.href}
              href={t.semMes ? t.href : t.soMes ? comMes(t.href) : comPeriodo(t.href)}
              className={cn(
                "relative shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                ativo ? "bg-verde-menta text-azul-medico" : "text-cinza-suave hover:bg-branco-clinico hover:text-azul-medico"
              )}
            >
              {t.rotulo}
              {ativo && <span className="absolute inset-x-3 -bottom-1.5 h-0.5 rounded-full bg-teal" />}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
