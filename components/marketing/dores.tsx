import { Frown } from "lucide-react";
import { Reveal } from "@/components/ui/reveal";
import { dores } from "@/lib/conteudo";

export function Dores() {
  return (
    <section className="section bg-verde-menta/50">
      <div className="container">
        <div className="mx-auto max-w-2xl text-center">
          <Reveal>
            <span className="eyebrow">Você se identifica?</span>
            <h2 className="mt-4 text-3xl md:text-4xl">
              Talvez você reconheça alguma dessas situações
            </h2>
            <p className="mt-4 text-lg text-cinza-suave">
              São as dores que mais ouvimos de médicos e clínicas. A boa notícia:
              todas têm solução.
            </p>
          </Reveal>
        </div>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {dores.map((dor, i) => (
            <Reveal key={dor.titulo} delay={i * 0.06}>
              <div className="h-full rounded-lg border border-border bg-white p-6 shadow-soft transition-shadow hover:shadow-card">
                <div className="mb-4 grid size-11 place-items-center rounded-lg bg-coral/10 text-coral">
                  <Frown className="size-5" />
                </div>
                <h3 className="text-lg font-semibold leading-snug">
                  “{dor.titulo}”
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-cinza-suave">
                  {dor.texto}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
