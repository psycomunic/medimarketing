/**
 * O que aparece no instante do clique, enquanto a tela nova é montada.
 *
 * Sem isto, o Next segura a tela antiga até a nova chegar inteira, e o
 * clique parece não ter funcionado. O menu lateral fica (é do layout);
 * só o conteúdo vira este esqueleto, no formato das telas do painel.
 */
export default function Carregando() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-8 md:px-8 md:py-10" aria-busy="true" aria-live="polite">
      <span className="sr-only">Carregando…</span>
      <div className="animate-pulse">
        <div className="h-8 w-48 rounded-md bg-azul-medico/10" />
        <div className="mt-3 h-4 w-72 max-w-full rounded bg-cinza-suave/15" />

        <div className="mt-8 grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="bg-white px-4 py-4">
              <div className="h-6 w-16 rounded bg-azul-medico/10" />
              <div className="mt-2 h-3 w-24 rounded bg-cinza-suave/15" />
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-xl border border-border bg-white p-5 shadow-soft">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex items-center gap-4 border-b border-border/70 py-3.5 last:border-0">
              <div className="size-10 shrink-0 rounded-lg bg-verde-menta" />
              <div className="min-w-0 flex-1">
                <div className="h-4 rounded bg-cinza-suave/15" style={{ width: `${55 + ((i * 13) % 35)}%` }} />
                <div className="mt-2 h-3 w-1/3 rounded bg-cinza-suave/10" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
