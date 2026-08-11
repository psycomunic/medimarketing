import { Reveal } from "@/components/ui/reveal";
import { Icone } from "@/components/marketing/icone";
import { numeros, segmentos } from "@/lib/conteudo";

/**
 * Faixa de credibilidade: quem atendemos + números da operação.
 * Os valores ficam em lib/conteudo.ts para atualização rápida.
 */
export function ProvaSocial() {
  return (
    <section aria-label="Prova social" className="border-b border-border bg-white">
      <div className="container py-14 md:py-16">
        {/* Quem atendemos */}
        <Reveal>
          <p className="text-center text-xs font-semibold uppercase tracking-[0.12em] text-cinza-suave">
            Especialistas em saúde, e só em saúde
          </p>
          <ul className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
            {segmentos.map((s) => (
              <li
                key={s}
                className="rounded-full border border-border bg-branco-clinico px-4 py-1.5 text-sm font-medium text-azul-medico"
              >
                {s}
              </li>
            ))}
          </ul>
        </Reveal>

        {/*
          Painel único com divisórias de 1px (gap-px sobre o fundo da borda)
          em vez de quatro caixas soltas: as células ficam com a mesma altura
          e o bloco lê como um painel de resultados, não como cartões avulsos.
        */}
        <Reveal delay={0.08}>
          <dl className="mt-11 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
            {numeros.map((n) => (
              <div
                key={n.label}
                className="flex flex-col items-center bg-white px-6 py-8 text-center"
              >
                <span className="order-1 grid size-9 place-items-center rounded-lg bg-verde-menta text-teal">
                  <Icone nome={n.icone} className="size-5" />
                </span>
                {/* `dt` precisa vir antes de `dd` no HTML; a ordem visual
                    (número acima do rótulo) fica por conta do flex order */}
                <dt className="order-3 mt-2.5 max-w-[16rem] text-sm leading-snug text-cinza-suave">
                  {n.label}
                </dt>
                <dd className="order-2 mt-4 font-heading text-4xl font-bold leading-none text-azul-medico">
                  {n.valor}
                </dd>
              </div>
            ))}
          </dl>
        </Reveal>

        <Reveal delay={0.12}>
          <p className="mt-4 text-center text-xs text-cinza-suave/80">
            Números acumulados da nossa operação, atualizados periodicamente.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
