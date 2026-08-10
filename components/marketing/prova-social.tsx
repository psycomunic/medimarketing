import { Reveal } from "@/components/ui/reveal";
import { numeros, segmentos } from "@/lib/conteudo";

/**
 * Faixa de credibilidade: quem atendemos + números da operação.
 * Os valores ficam em lib/conteudo.ts para atualização rápida.
 */
export function ProvaSocial() {
  return (
    <section aria-label="Prova social" className="border-b border-border bg-white">
      <div className="container py-14 md:py-16">
        <Reveal>
          <p className="text-center text-sm font-medium uppercase tracking-wide text-cinza-suave">
            Especialistas em saúde — e só em saúde
          </p>
          <ul className="mt-5 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
            {segmentos.map((s) => (
              <li
                key={s}
                className="font-heading text-base font-semibold text-azul-medico/70 md:text-lg"
              >
                {s}
              </li>
            ))}
          </ul>
        </Reveal>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {numeros.map((n, i) => (
            <Reveal key={n.label} delay={i * 0.08}>
              <div className="rounded-lg border border-border bg-branco-clinico p-6 text-center">
                <p className="font-heading text-3xl font-bold text-teal md:text-4xl">
                  {n.valor}
                </p>
                <p className="mt-2 text-sm leading-snug text-cinza-suave">
                  {n.label}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
