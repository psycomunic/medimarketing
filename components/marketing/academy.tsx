import { GraduationCap, PlayCircle, Gift, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";
import { trilhasAcademy, iscaAcademy } from "@/lib/conteudo";
import { site } from "@/lib/site";
import { whatsappLink } from "@/lib/utils";

/**
 * Academy — treinamento como valor agregado e porta de entrada
 * (a isca de scripts serve como captação de lead pelo WhatsApp).
 */
export function Academy() {
  const zap = whatsappLink(
    site.whatsapp,
    "Quero receber os scripts de reabordagem da Medi Marketing."
  );

  return (
    <section id="academy" className="section bg-verde-menta/50">
      <div className="container">
        <div className="mx-auto max-w-2xl text-center">
          <Reveal>
            <span className="eyebrow">
              <GraduationCap className="size-4" />
              Medi Academy
            </span>
            <h2 className="mt-4 text-3xl md:text-4xl">
              Sua equipe treinada, não só instruída
            </h2>
            <p className="mt-4 text-lg text-cinza-suave">
              Trilhas em vídeo dentro do painel, com progresso por pessoa e
              certificado no final. Incluídas a partir do plano Performance.
            </p>
          </Reveal>
        </div>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {trilhasAcademy.map((t, i) => (
            <Reveal key={t.titulo} delay={(i % 3) * 0.08}>
              <article className="flex h-full flex-col rounded-lg border border-border bg-white p-6 shadow-soft transition-all hover:-translate-y-1 hover:shadow-card">
                <div className="mb-4 grid size-11 place-items-center rounded-lg bg-teal/12 text-teal">
                  <PlayCircle className="size-5" />
                </div>
                <h3 className="text-base font-semibold">{t.titulo}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-cinza-suave">
                  {t.texto}
                </p>
                <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-teal">
                  {t.aulas} aulas
                </p>
              </article>
            </Reveal>
          ))}
        </div>

        {/* Isca — material gratuito */}
        <Reveal delay={0.1}>
          <div className="mt-14 flex flex-col items-center gap-6 rounded-xl border-2 border-dashed border-teal/40 bg-white p-8 text-center md:flex-row md:text-left">
            <div className="grid size-14 shrink-0 place-items-center rounded-xl bg-coral/10 text-coral">
              <Gift className="size-7" />
            </div>
            <div className="flex-1">
              <p className="font-heading text-lg font-semibold text-azul-medico">
                {iscaAcademy.titulo}
              </p>
              <p className="mt-1.5 text-cinza-suave">{iscaAcademy.texto}</p>
            </div>
            <Button asChild variant="primary" size="lg" className="shrink-0">
              <a href={zap} target="_blank" rel="noopener noreferrer">
                {iscaAcademy.cta}
                <ArrowRight className="size-5" />
              </a>
            </Button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
