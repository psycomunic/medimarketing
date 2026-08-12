import Link from "next/link";
import { ArrowRight, MonitorSmartphone, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";
import { Icone } from "@/components/marketing/icone";
import { PainelMockup } from "@/components/marketing/painel-mockup";
import { modulosPlataforma } from "@/lib/conteudo";

/**
 * "A Plataforma" — o diferencial contra concorrentes do nicho:
 * aqui não é só serviço, é o sistema que roda a clínica.
 */
export function Plataforma() {
  return (
    <section
      id="plataforma"
      className="section relative overflow-hidden bg-azul-medico text-white"
    >
      {/* Fundo decorativo */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="pointer-events-none absolute -right-32 top-10 size-[420px] rounded-full bg-teal/25 blur-3xl" />
        <div className="absolute -left-24 bottom-0 size-[360px] rounded-full bg-teal-claro/15 blur-3xl" />
      </div>

      <div className="container relative">
        <div className="mx-auto max-w-2xl text-center">
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-sm font-semibold text-teal-claro">
              <MonitorSmartphone className="size-4" />A plataforma
            </span>
            <h2 className="mt-4 text-3xl text-white md:text-4xl">
              Não é só agência. É o sistema que roda a sua clínica.
            </h2>
            <p className="mt-4 text-lg text-white/70">
              Um painel único para gestor, secretária e médico, cada um vendo
              exatamente o que precisa, no computador ou no celular.
            </p>
          </Reveal>
        </div>

        {/* Mockup do painel */}
        <Reveal delay={0.1}>
          <div className="mx-auto mt-14 max-w-4xl">
            <PainelMockup />
          </div>
        </Reveal>

        {/* Módulos */}
        <div className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {modulosPlataforma.map((m, i) => (
            <Reveal key={m.titulo} delay={(i % 4) * 0.06}>
              <div className="h-full rounded-lg border border-white/10 bg-white/5 p-6 backdrop-blur-sm transition-colors hover:bg-white/10">
                <div className="mb-3 grid size-10 place-items-center rounded-lg bg-teal/20 text-teal-claro">
                  <Icone nome={m.icone} className="size-5" />
                </div>
                <h3 className="text-base font-semibold text-white">{m.titulo}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/65">
                  {m.texto}
                </p>
              </div>
            </Reveal>
          ))}
        </div>

        {/* Acesso por papel + CTA */}
        <Reveal delay={0.1}>
          <div className="mt-14 flex flex-col items-center justify-between gap-6 rounded-xl border border-white/10 bg-white/5 p-7 md:flex-row">
            <div className="flex items-start gap-4">
              <div className="grid size-11 shrink-0 place-items-center rounded-lg bg-teal/20 text-teal-claro">
                <Lock className="size-5" />
              </div>
              <div>
                <p className="font-heading font-semibold text-white">
                  Acesso separado por papel
                </p>
                <p className="mt-1 text-sm text-white/65">
                  Gestor vê os números e o financeiro. Secretária opera agenda,
                  CRM e atendimento. Médico vê a própria agenda e a Academy.
                  Cada clínica é um ambiente isolado.
                </p>
              </div>
            </div>
            <Button asChild variant="teal" size="lg" className="shrink-0">
              <Link href="/login">
                Ver a plataforma por dentro
                <ArrowRight className="size-5" />
              </Link>
            </Button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
