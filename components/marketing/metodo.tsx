import { Check, Route } from "lucide-react";
import { Reveal } from "@/components/ui/reveal";
import { metodo } from "@/lib/conteudo";

/**
 * O Método — jornada por tempo (Diagnóstico → 30 → 90 → 180 → 360 dias).
 * Comunica processo e previsibilidade: cada etapa tem entrega própria.
 */
export function Metodo() {
  return (
    <section id="metodo" className="section">
      <div className="container">
        <div className="mx-auto max-w-2xl text-center">
          <Reveal>
            <span className="eyebrow">
              <Route className="size-4" />O Método Medi
            </span>
            <h2 className="mt-4 text-3xl md:text-4xl">
              Um caminho com etapa, prazo e entrega
            </h2>
            <p className="mt-4 text-lg text-cinza-suave">
              Nada de “vamos testar e ver no que dá”. Você sabe o que acontece
              no primeiro mês, no terceiro e no primeiro ano.
            </p>
          </Reveal>
        </div>

        <ol className="relative mt-16 space-y-8 md:space-y-0">
          {/* Linha da timeline (só no desktop) */}
          <div
            aria-hidden
            className="absolute left-[7.5rem] top-2 hidden h-[calc(100%-1rem)] w-px bg-gradient-to-b from-teal via-teal-claro to-transparent md:block"
          />

          {metodo.map((m, i) => (
            <li key={m.etapa}>
              <Reveal delay={i * 0.06}>
                <div className="md:grid md:grid-cols-[7.5rem_1fr] md:gap-8 md:pb-10">
                  {/* Coluna do prazo */}
                  <div className="flex items-center gap-3 md:block md:pt-1 md:text-right">
                    <span className="font-heading text-lg font-bold text-azul-medico">
                      {m.etapa}
                    </span>
                    <span className="text-xs font-semibold uppercase tracking-wide text-teal md:mt-1 md:block">
                      {m.prazo}
                    </span>
                  </div>

                  {/* Card da etapa */}
                  <div className="relative mt-3 rounded-lg border border-border bg-white p-6 shadow-soft md:mt-0 md:ml-6">
                    {/* Marcador na linha */}
                    <span
                      aria-hidden
                      className="absolute -left-[1.9rem] top-7 hidden size-3 rounded-full border-2 border-white bg-teal ring-4 ring-verde-menta md:block"
                    />
                    <h3 className="text-xl font-semibold">{m.titulo}</h3>
                    <p className="mt-2 leading-relaxed text-cinza-suave">
                      {m.texto}
                    </p>
                    <ul className="mt-5 grid gap-2 sm:grid-cols-3">
                      {m.entregas.map((e) => (
                        <li
                          key={e}
                          className="flex items-start gap-2 rounded-md bg-verde-menta/60 px-3 py-2 text-sm text-cinza-texto"
                        >
                          <Check className="mt-0.5 size-4 shrink-0 text-teal" />
                          {e}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </Reveal>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
