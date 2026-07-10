import { CalendarCheck, ArrowRight, Star, ShieldCheck, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Reveal } from "@/components/ui/reveal";
import { AgendaMockup } from "@/components/marketing/agenda-mockup";
import { site } from "@/lib/site";
import { whatsappLink } from "@/lib/utils";

export function Hero() {
  const zap = whatsappLink(
    site.whatsapp,
    "Olá! Quero organizar minha agenda e atrair mais pacientes. Podem me explicar como funciona?"
  );

  return (
    <section className="relative overflow-hidden pt-28 md:pt-36">
      {/* Fundo decorativo suave */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
      >
        <div className="absolute -right-24 -top-24 size-[420px] rounded-full bg-teal-claro/20 blur-3xl" />
        <div className="absolute -left-32 top-40 size-[360px] rounded-full bg-verde-menta blur-3xl" />
      </div>

      <div className="container grid items-center gap-12 pb-20 lg:grid-cols-[1.05fr_0.95fr] lg:pb-28">
        {/* Coluna de texto */}
        <div>
          <Reveal>
            <span className="eyebrow">
              <ShieldCheck className="size-4" />
              Atendimento + Marketing para médicos
            </span>
          </Reveal>

          <Reveal delay={0.05}>
            <h1 className="mt-5 text-4xl leading-[1.1] md:text-5xl lg:text-6xl">
              Sua agenda cheia. Seu paciente bem atendido.
              <span className="text-teal"> Sem você se preocupar com nada disso.</span>
            </h1>
          </Reveal>

          <Reveal delay={0.1}>
            <p className="mt-6 max-w-xl text-lg text-cinza-suave">
              Atendimento para marcar suas consultas + marketing que atrai
              pacientes de verdade. Você cuida da medicina, a gente cuida do
              resto.
            </p>
          </Reveal>

          <Reveal delay={0.15}>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild variant="primary" size="lg">
                <a href={zap} target="_blank" rel="noopener noreferrer">
                  Quero minha agenda organizada
                  <ArrowRight className="size-5" />
                </a>
              </Button>
              <Button asChild variant="outline" size="lg">
                <a href="#como-funciona">Ver como funciona</a>
              </Button>
            </div>
          </Reveal>

          {/* Selos de confiança */}
          <Reveal delay={0.2}>
            <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4">
              <div className="flex items-center gap-2">
                <div className="flex text-alerta">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="size-4 fill-current" />
                  ))}
                </div>
                <span className="text-sm text-cinza-suave">
                  Médicos que confiam no nosso time
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm text-cinza-suave">
                <Users className="size-4 text-teal" />
                {/* TODO: número real de médicos atendidos */}
                <strong className="text-azul-medico">+120 médicos</strong> atendidos
              </div>
            </div>
          </Reveal>
        </div>

        {/* Coluna visual: mockup de agenda */}
        <Reveal delay={0.15}>
          <div className="relative">
            <div className="absolute -inset-4 -z-10 rounded-[2rem] bg-gradient-to-br from-teal-claro/25 to-verde-menta" />
            <AgendaMockup />

            {/* Card flutuante de destaque */}
            <div className="absolute -bottom-6 -left-4 hidden rounded-xl border border-border bg-white p-4 shadow-card sm:flex sm:items-center sm:gap-3">
              <div className="grid size-10 place-items-center rounded-lg bg-sucesso/12 text-sucesso">
                <CalendarCheck className="size-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-azul-medico">
                  Consulta confirmada
                </p>
                <p className="text-xs text-cinza-suave">Faltas em queda</p>
              </div>
            </div>
          </div>
        </Reveal>
      </div>

      {/* Barra de credibilidade */}
      <div className="border-y border-border bg-white/60">
        <div className="container flex flex-wrap items-center justify-center gap-x-10 gap-y-3 py-5 text-sm font-medium text-cinza-suave">
          <span className="flex items-center gap-2">
            <Badge variant="neutro">Google Ads</Badge> Especialistas certificados
          </span>
          <span className="flex items-center gap-2">
            <Badge variant="neutro">Meta Ads</Badge> Instagram e Facebook
          </span>
          <span>Atendimento humano</span>
          <span>Agenda integrada</span>
        </div>
      </div>
    </section>
  );
}
