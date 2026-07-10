import { Quote } from "lucide-react";
import { Reveal } from "@/components/ui/reveal";
import { depoimentos } from "@/lib/conteudo";

export function Depoimentos() {
  return (
    <section id="depoimentos" className="section bg-verde-menta/50">
      <div className="container">
        <div className="mx-auto max-w-2xl text-center">
          <Reveal>
            <span className="eyebrow">Depoimentos</span>
            <h2 className="mt-4 text-3xl md:text-4xl">
              Médicos que já cuidam só da medicina
            </h2>
            {/* TODO: substituir por depoimentos reais com autorização de uso */}
          </Reveal>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {depoimentos.map((d, i) => (
            <Reveal key={d.nome} delay={i * 0.1}>
              <figure className="flex h-full flex-col rounded-lg border border-border bg-white p-7 shadow-soft">
                <Quote className="size-8 text-teal-claro" />
                <blockquote className="mt-4 flex-1 text-cinza-texto">
                  “{d.texto}”
                </blockquote>
                <figcaption className="mt-6 flex items-center gap-3 border-t border-border pt-5">
                  {/* Avatar com iniciais (placeholder até haver foto real) */}
                  <span className="grid size-11 place-items-center rounded-full bg-azul-medico font-heading font-semibold text-white">
                    {d.nome
                      .replace(/^Dra?\.\s*/, "")
                      .split(" ")
                      .map((p) => p[0])
                      .slice(0, 2)
                      .join("")}
                  </span>
                  <div>
                    <p className="font-semibold text-azul-medico">{d.nome}</p>
                    <p className="text-sm text-cinza-suave">
                      {d.especialidade} · {d.cidade}
                    </p>
                  </div>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
