import { Reveal } from "@/components/ui/reveal";
import { comoFunciona } from "@/lib/conteudo";

export function ComoFunciona() {
  return (
    <section id="como-funciona" className="section bg-azul-medico text-white">
      <div className="container">
        <div className="mx-auto max-w-2xl text-center">
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-sm font-semibold text-teal-claro">
              Como funciona
            </span>
            <h2 className="mt-4 text-3xl text-white md:text-4xl">
              Simples do começo ao fim, em 3 passos
            </h2>
            <p className="mt-4 text-lg text-white/70">
              Você não precisa entender de tecnologia nem de anúncios. A gente
              cuida de tudo.
            </p>
          </Reveal>
        </div>

        <div className="mt-14 grid gap-8 md:grid-cols-3">
          {comoFunciona.map((etapa, i) => (
            <Reveal key={etapa.passo} delay={i * 0.1}>
              <div className="relative h-full rounded-lg border border-white/10 bg-white/5 p-8 backdrop-blur-sm">
                <span className="font-heading text-5xl font-bold text-teal-claro/40">
                  {etapa.passo}
                </span>
                <h3 className="mt-3 text-xl text-white">{etapa.titulo}</h3>
                <p className="mt-2 leading-relaxed text-white/70">
                  {etapa.texto}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
