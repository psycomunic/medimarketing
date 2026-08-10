import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";
import { Icone } from "@/components/marketing/icone";
import { dores } from "@/lib/conteudo";
import { site } from "@/lib/site";
import { whatsappLink } from "@/lib/utils";

export function Dores() {
  const zap = whatsappLink(
    site.whatsapp,
    "Me identifiquei com as situações do site. Quero o diagnóstico da minha clínica."
  );

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
              São as frases que mais ouvimos de clínicas e consultórios. A boa
              notícia: todas têm solução.
            </p>
          </Reveal>
        </div>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {dores.map((dor, i) => (
            <Reveal key={dor.titulo} delay={(i % 4) * 0.06}>
              <article className="group flex h-full flex-col rounded-lg border border-border bg-white p-6 shadow-soft transition-all hover:-translate-y-1 hover:border-coral/30 hover:shadow-card">
                <span className="grid size-11 place-items-center rounded-lg bg-coral/10 text-coral transition-colors group-hover:bg-coral group-hover:text-white">
                  <Icone nome={dor.icone} className="size-5" />
                </span>
                {/* text-wrap:pretty evita o balanceamento do CSS global, que
                    deixava títulos curtos quebrados em três linhas rasas */}
                <h3 className="mt-4 text-base font-semibold leading-snug [text-wrap:pretty]">
                  “{dor.titulo}”
                </h3>
                <p className="mt-2.5 text-sm leading-relaxed text-cinza-suave">
                  {dor.texto}
                </p>
              </article>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.1}>
          <div className="mt-12 flex flex-col items-center justify-center gap-5 rounded-xl border border-border bg-white px-7 py-6 text-center shadow-soft sm:flex-row sm:text-left">
            <p className="text-cinza-suave">
              Marcou duas ou mais?{" "}
              <strong className="text-azul-medico">
                É exatamente aí que a gente entra.
              </strong>
            </p>
            <Button asChild variant="primary" className="shrink-0">
              <a href={zap} target="_blank" rel="noopener noreferrer">
                Quero resolver isso
                <ArrowRight className="size-4" />
              </a>
            </Button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
