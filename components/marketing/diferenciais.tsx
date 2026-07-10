import {
  HeartHandshake,
  Stethoscope,
  CalendarCheck,
  LineChart,
  ShieldCheck,
  Headset,
  type LucideIcon,
} from "lucide-react";
import { Reveal } from "@/components/ui/reveal";
import { diferenciais } from "@/lib/conteudo";

// Mapa nome -> ícone (evita import dinâmico)
const icones: Record<string, LucideIcon> = {
  HeartHandshake,
  Stethoscope,
  CalendarCheck,
  LineChart,
  ShieldCheck,
  Headset,
};

export function Diferenciais() {
  return (
    <section id="diferenciais" className="section">
      <div className="container">
        <div className="mx-auto max-w-2xl text-center">
          <Reveal>
            <span className="eyebrow">Por que a Medi Marketing</span>
            <h2 className="mt-4 text-3xl md:text-4xl">
              Diferenciais que você sente no dia a dia
            </h2>
          </Reveal>
        </div>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {diferenciais.map((d, i) => {
            const Icone = icones[d.icone] ?? ShieldCheck;
            return (
              <Reveal key={d.titulo} delay={(i % 3) * 0.08}>
                <div className="group h-full rounded-lg border border-border bg-white p-7 shadow-soft transition-all hover:-translate-y-1 hover:shadow-card">
                  <div className="mb-4 grid size-12 place-items-center rounded-xl bg-verde-menta text-teal transition-colors group-hover:bg-teal group-hover:text-white">
                    <Icone className="size-6" />
                  </div>
                  <h3 className="text-lg font-semibold">{d.titulo}</h3>
                  <p className="mt-2 leading-relaxed text-cinza-suave">
                    {d.texto}
                  </p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
