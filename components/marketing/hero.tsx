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
    <section className="relative overflow-hidden bg-branco-clinico lg:flex lg:min-h-screen lg:items-center">
      {/* Brilho suave atrás do texto (só onde não atrapalha a imagem) */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-32 top-40 -z-10 size-[360px] rounded-full bg-verde-menta blur-3xl"
      />

      {/* Coluna de texto */}
      <div className="container relative z-10 pb-16 pt-28 md:pt-36 lg:pb-24 lg:pt-24">
        <div className="lg:max-w-2xl">
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
              agenda e CRM num painel único. A confirmação de consulta sai
              sozinha, pelo WhatsApp da sua clínica e por e-mail, e o que
              precisa de atenção vira alerta na hora. Você cuida da medicina,
              a gente cuida do resto.
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
      </div>

      {/*
        Banner com a agenda real da plataforma.
        No desktop ele cobre a seção inteira, ancorado à direita; como o fundo
        do arquivo (#F7FBFC) é o mesmo branco-clínico do site, a imagem se
        funde com a página e não aparece emenda. `object-contain` evita cortar
        a tela do notebook em telas muito largas.
        No mobile o mesmo elemento vira um bloco abaixo do texto — um único
        <Image> para o navegador não baixar o arquivo duas vezes.
      */}
      <div className="relative aspect-[3/2] w-full lg:absolute lg:inset-0 lg:z-0 lg:aspect-auto">
        <Image
          src="/BANNER-FUNDO-HEROok.jpg"
          alt="Notebook exibindo a agenda de consultas da plataforma Medi Marketing"
          fill
          sizes="100vw"
          priority
          className="object-contain object-right"
        />
        {/* Véu que garante leitura do texto caso o notebook avance para a
            esquerda em proporções de tela incomuns */}
        <div
          aria-hidden
          className="absolute inset-y-0 left-0 hidden w-3/5 bg-gradient-to-r from-branco-clinico via-branco-clinico/85 to-transparent lg:block"
        />
      </div>
    </section>
  );
}
