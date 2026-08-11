import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Star, ShieldCheck, Users, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";
import { site } from "@/lib/site";
import { whatsappLink } from "@/lib/utils";

export function Hero() {
  const zap = whatsappLink(
    site.whatsapp,
    "Olá! Quero o diagnóstico gratuito da minha clínica. Podem me explicar como funciona?"
  );

  return (
    <section className="relative overflow-hidden pt-28 md:pt-36">
      {/* Fundo decorativo suave */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -right-24 -top-24 size-[420px] rounded-full bg-teal-claro/20 blur-3xl" />
        <div className="absolute -left-32 top-40 size-[360px] rounded-full bg-verde-menta blur-3xl" />
      </div>

      <div className="container grid items-center gap-12 pb-20 lg:grid-cols-[1.05fr_0.95fr] lg:pb-24">
        {/* Coluna de texto */}
        <div>
          <Reveal>
            <span className="eyebrow">
              <ShieldCheck className="size-4" />
              Plataforma all-in-one para clínicas e profissionais de saúde
            </span>
          </Reveal>

          <Reveal delay={0.05}>
            <h1 className="mt-5 text-4xl leading-[1.1] md:text-5xl lg:text-[3.4rem]">
              A sua clínica cheia, atendida e no controle.
              <span className="text-teal"> Tudo em um só lugar.</span>
            </h1>
          </Reveal>

          <Reveal delay={0.1}>
            <p className="mt-6 max-w-xl text-lg text-cinza-suave">
              Marketing que traz paciente, equipe humana que atende e converte,
              agenda e CRM num painel único, com os números na sua mão para
              saber o que está funcionando. Você cuida da medicina, a gente
              cuida do resto.
            </p>
          </Reveal>

          <Reveal delay={0.15}>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild variant="primary" size="lg">
                <a href={zap} target="_blank" rel="noopener noreferrer">
                  Quero meu diagnóstico gratuito
                  <ArrowRight className="size-5" />
                </a>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="#plataforma">Ver a plataforma</Link>
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
                  Clínicas que confiam no nosso time
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm text-cinza-suave">
                <Users className="size-4 text-teal" />
                {/* TODO: número real de clínicas atendidas */}
                <strong className="text-azul-medico">+120 médicos</strong> atendidos
              </div>
              <div className="flex items-center gap-2 text-sm text-cinza-suave">
                <TrendingDown className="size-4 text-sucesso" />
                <strong className="text-azul-medico">Faltas em queda</strong> com
                confirmação ativa
              </div>
            </div>
          </Reveal>
        </div>

        {/* Coluna visual: banner com a agenda real da plataforma */}
        <Reveal delay={0.15}>
          {/* Sangra para fora do container no desktop: o banner tem margem
              própria e fica pequeno demais se respeitar a coluna */}
          <div className="relative lg:-mr-12 xl:-mr-24">
            <Image
              src="/BANNER-FUNDO-HERO.jpg"
              alt="Notebook exibindo a agenda de consultas da plataforma Medi Marketing"
              width={2000}
              height={1333}
              sizes="(max-width: 1024px) 100vw, 55vw"
              priority
              className="h-auto w-full"
            />
          </div>
        </Reveal>
      </div>
    </section>
  );
}
