import { CheckCircle2 } from "lucide-react";
import { Reveal } from "@/components/ui/reveal";
import { LeadForm } from "@/components/marketing/lead-form";

const promessas = [
  "Diagnóstico gratuito da agenda, do atendimento e dos números",
  "Plano com metas de 30, 90, 180 e 360 dias",
  "Sem compromisso e sem fidelidade abusiva",
  "Resposta pelo WhatsApp em poucas horas",
];

export function CtaFinal() {
  return (
    <section
      id="contato"
      className="section bg-azul-medico text-white"
    >
      <div className="container">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <Reveal>
            <div>
              <h2 className="text-3xl text-white md:text-4xl lg:text-[2.75rem] lg:leading-tight">
                Vamos olhar os números da sua clínica juntos?
              </h2>
              <p className="mt-5 text-lg text-white/70">
                Deixe seus dados e nosso time entra em contato para entender sua
                operação, mostrar a plataforma por dentro e montar o plano ideal
                para o seu momento.
              </p>
              <ul className="mt-8 space-y-3">
                {promessas.map((p) => (
                  <li key={p} className="flex items-center gap-3 text-white/90">
                    <CheckCircle2 className="size-5 shrink-0 text-teal-claro" />
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <LeadForm origem="cta-final" />
          </Reveal>
        </div>
      </div>
    </section>
  );
}
