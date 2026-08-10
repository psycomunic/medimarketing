import { Check, Layers } from "lucide-react";
import { Reveal } from "@/components/ui/reveal";
import { Icone } from "@/components/marketing/icone";
import { solucoes } from "@/lib/conteudo";

/**
 * Soluções — um bloco por pilar de serviço (do marketing aos dados).
 * Substitui a antiga seção "Serviços", que cobria só três frentes.
 */
export function Solucoes() {
  return (
    <section id="solucoes" className="section">
      <div className="container">
        <div className="mx-auto max-w-2xl text-center">
          <Reveal>
            <span className="eyebrow">
              <Layers className="size-4" />
              Nossas soluções
            </span>
            <h2 className="mt-4 text-3xl md:text-4xl">
              Do primeiro anúncio ao paciente que volta
            </h2>
            <p className="mt-4 text-lg text-cinza-suave">
              Sete frentes que funcionam juntas. Você pode começar por uma,
              mas é a soma delas que enche e mantém a agenda.
            </p>
          </Reveal>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {solucoes.map((s, i) => (
            <Reveal key={s.titulo} delay={(i % 3) * 0.08}>
              <article className="flex h-full flex-col rounded-lg border border-border bg-white p-7 shadow-soft transition-all hover:-translate-y-1 hover:shadow-card">
                <div className="mb-4 grid size-12 place-items-center rounded-xl bg-verde-menta text-teal">
                  <Icone nome={s.icone} className="size-6" />
                </div>
                <h3 className="text-lg font-semibold">{s.titulo}</h3>
                <p className="mt-1.5 text-cinza-suave">{s.resumo}</p>
                <ul className="mt-5 space-y-2.5 border-t border-border pt-5">
                  {s.itens.map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-sm">
                      <Check className="mt-0.5 size-4 shrink-0 text-teal" />
                      <span className="text-cinza-suave">{item}</span>
                    </li>
                  ))}
                </ul>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
