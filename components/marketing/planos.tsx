import { Check, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";
import { planos } from "@/lib/conteudo";
import { site } from "@/lib/site";
import { whatsappLink, cn } from "@/lib/utils";

/**
 * Planos — três níveis. Os valores vêm de lib/conteudo.ts; o Full é o
 * único sem preço fixo, porque o escopo muda de clínica para clínica.
 */
export function Planos() {
  return (
    <section id="planos" className="section">
      <div className="container">
        <div className="mx-auto max-w-2xl text-center">
          <Reveal>
            <span className="eyebrow">
              <Sparkles className="size-4" />
              Planos
            </span>
            <h2 className="mt-4 text-3xl md:text-4xl">
              Escolha até onde quer ir agora
            </h2>
            <p className="mt-4 text-lg text-cinza-suave">
              Todos incluem a plataforma. A diferença está em quanta operação e
              inteligência entram junto.
            </p>
          </Reveal>
        </div>

        <div className="mt-14 grid items-start gap-6 lg:grid-cols-3">
          {planos.map((p, i) => {
            const zap = whatsappLink(
              site.whatsapp,
              `Olá! Tenho interesse no plano ${p.nome} da Medi Marketing.`
            );

            return (
              <Reveal key={p.id} delay={i * 0.08}>
                <div
                  className={cn(
                    "relative flex h-full flex-col rounded-2xl border bg-white p-7 shadow-soft",
                    p.destaque
                      ? "border-teal shadow-card lg:-mt-4 lg:pb-10 lg:pt-10"
                      : "border-border"
                  )}
                >
                  {p.destaque && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-teal px-4 py-1 text-xs font-semibold text-white">
                      Mais escolhido
                    </span>
                  )}

                  <h3 className="font-heading text-xl font-bold">{p.nome}</h3>
                  <p className="mt-1.5 min-h-[3rem] text-sm text-cinza-suave">
                    {p.resumo}
                  </p>

                  <p className="mt-5 flex items-baseline gap-1">
                    <span className="font-heading text-3xl font-bold text-azul-medico">
                      {p.preco}
                    </span>
                    {p.periodo && (
                      <span className="text-sm text-cinza-suave">{p.periodo}</span>
                    )}
                  </p>

                  <ul className="mt-6 flex-1 space-y-2.5 border-t border-border pt-6">
                    {p.itens.map((item) => (
                      <li key={item} className="flex items-start gap-2.5 text-sm">
                        <Check className="mt-0.5 size-4 shrink-0 text-teal" />
                        <span className="text-cinza-texto">{item}</span>
                      </li>
                    ))}
                    {p.naoInclui.map((item) => (
                      <li
                        key={item}
                        className="flex items-start gap-2.5 text-sm text-cinza-suave/70"
                      >
                        <X className="mt-0.5 size-4 shrink-0" />
                        <span className="line-through">{item}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    asChild
                    variant={p.destaque ? "primary" : "outline"}
                    size="lg"
                    className="mt-7 w-full"
                  >
                    <a href={zap} target="_blank" rel="noopener noreferrer">
                      {p.cta}
                    </a>
                  </Button>
                </div>
              </Reveal>
            );
          })}
        </div>

        <Reveal>
          <p className="mt-8 text-center text-sm text-cinza-suave">
            Não sabe qual escolher? O diagnóstico gratuito indica o plano certo
            para o momento da sua clínica.{" "}
            <a href="#contato" className="font-semibold text-teal hover:underline">
              agende o seu
            </a>
            .
          </p>
        </Reveal>
      </div>
    </section>
  );
}
