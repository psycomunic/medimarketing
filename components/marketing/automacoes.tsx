import Link from "next/link";
import { ArrowRight, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";
import { Icone } from "@/components/marketing/icone";
import { ConversaWhatsApp } from "@/components/comum/conversa-whatsapp";
import { automacoes, automacoesDestaques } from "@/lib/conteudo";

/**
 * "Automações" — a parte do produto que trabalha sozinha.
 *
 * Vem logo depois da plataforma porque responde à objeção natural de
 * quem acabou de ver um painel: "mais um sistema para alguém alimentar".
 * Aqui a promessa é o contrário — é o pedaço que tira trabalho da
 * recepção em vez de somar.
 *
 * A prova é a própria mensagem: em vez de descrever o lembrete, a
 * seção mostra a conversa como ela chega no celular do paciente.
 */
export function Automacoes() {
  return (
    <section
      id="automacoes"
      className="section relative overflow-hidden bg-branco-clinico"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-32 top-24 size-[420px] rounded-full bg-verde-menta blur-3xl"
      />

      <div className="container relative">
        <div className="mx-auto max-w-2xl text-center">
          <Reveal>
            <span className="eyebrow">
              <Zap className="size-4" />
              Automações de confirmação
            </span>
            <h2 className="mt-4 text-3xl md:text-4xl">
              A consulta se confirma sozinha.
              <span className="text-teal"> Pelo número da sua clínica.</span>
            </h2>
            <p className="mt-4 text-lg text-cinza-suave">
              Falta de paciente quase nunca é descaso: é esquecimento. Um
              lembrete na véspera e um botão para confirmar resolvem a maior
              parte — e o que não resolve vira aviso na hora, enquanto ainda dá
              tempo de encaixar outro.
            </p>
          </Reveal>
        </div>

        <div className="mt-14 grid items-center gap-12 lg:grid-cols-2">
          {/* A conversa, como ela chega */}
          <Reveal>
            <ConversaWhatsApp />
          </Reveal>

          {/* O ciclo, na ordem em que acontece */}
          <Reveal delay={0.1}>
            <ol className="relative space-y-7 border-l border-dashed border-teal/30 pl-7">
              {automacoes.map((a) => (
                <li key={a.titulo} className="relative">
                  <span className="absolute -left-[2.4rem] grid size-9 place-items-center rounded-full border border-teal/25 bg-white text-teal shadow-soft">
                    <Icone nome={a.icone} className="size-4" />
                  </span>
                  <p className="text-xs font-semibold uppercase tracking-wide text-teal">
                    {a.quando}
                  </p>
                  <h3 className="mt-1 font-heading text-lg font-semibold text-azul-medico">
                    {a.titulo}
                  </h3>
                  <p className="mt-1 text-cinza-suave">{a.texto}</p>
                </li>
              ))}
            </ol>
          </Reveal>
        </div>

        <div className="mt-16 grid gap-5 md:grid-cols-3">
          {automacoesDestaques.map((d, i) => (
            <Reveal key={d.titulo} delay={i * 0.06}>
              <div className="h-full rounded-lg border border-border bg-white p-6 shadow-soft">
                <div className="mb-3 grid size-10 place-items-center rounded-lg bg-verde-menta text-teal">
                  <Icone nome={d.icone} className="size-5" />
                </div>
                <h3 className="font-heading text-base font-semibold text-azul-medico">
                  {d.titulo}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-cinza-suave">
                  {d.texto}
                </p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.1}>
          <div className="mt-12 flex flex-col items-center gap-5 rounded-xl border border-teal/20 bg-verde-menta/60 p-7 text-center md:flex-row md:justify-between md:text-left">
            <p className="max-w-xl text-cinza-texto">
              <strong className="font-semibold text-azul-medico">
                Cada consulta que não vira falta é receita que já estava na
                agenda.
              </strong>{" "}
              Nada disso exige que sua secretária lembre de mandar mensagem — e
              tudo fica registrado no painel.
            </p>
            <Button asChild variant="teal" size="lg" className="shrink-0">
              <Link href="#contato">
                Quero isso na minha clínica
                <ArrowRight className="size-5" />
              </Link>
            </Button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
