import Link from "next/link";
import { ArrowRight, Building2, Eye, Stethoscope, Headset } from "lucide-react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { entrarNaDemo } from "@/lib/actions/demonstracao";
import { PAPEIS_DEMONSTRACAO } from "@/lib/demo";
import type { Role } from "@/lib/supabase/types";

export const metadata = {
  title: "Demonstração da plataforma",
  description:
    "Navegue pela plataforma Medi Marketing como dono da clínica, médico ou atendente.",
  robots: { index: false, follow: false },
};

const ICONES: Record<string, typeof Building2> = {
  gestor: Building2,
  medico: Stethoscope,
  secretaria: Headset,
};

/**
 * Porta de entrada da demonstração comercial.
 *
 * A escolha do papel vem antes do painel de propósito: o argumento de
 * venda não é "temos um sistema", é "cada pessoa da clínica vê
 * exatamente o que precisa". Quem escolhe o papel aqui já entra
 * entendendo que existem três painéis diferentes.
 *
 * Fica fora do índice dos buscadores: é link para mandar em conversa,
 * não página de captação.
 */
export default function DemonstracaoPage() {
  return (
    <div className="min-h-screen bg-azul-medico text-white">
      <div className="mx-auto max-w-5xl px-5 py-12 md:px-8 md:py-16">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Logo href="/" light />
          <Link
            href="/"
            className="text-sm text-white/60 transition-colors hover:text-white"
          >
            Voltar ao site
          </Link>
        </div>

        <div className="mt-12 max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-sm font-semibold text-teal-claro">
            <Eye className="size-4" />
            Demonstração
          </span>
          <h1 className="mt-4 text-3xl text-white md:text-4xl">
            Entre na plataforma e veja por dentro.
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-white/70">
            É o sistema de verdade, com uma clínica fictícia dentro.
            Escolha por quais olhos você quer ver primeiro. Depois dá para
            trocar de papel a qualquer momento, sem sair da tela.
          </p>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {PAPEIS_DEMONSTRACAO.map((p) => {
            const Icone = ICONES[p.role] ?? Building2;
            const entrar = entrarNaDemo.bind(null, p.role as Role);

            return (
              <form
                key={p.role}
                action={entrar}
                className="flex h-full flex-col rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm transition-colors hover:bg-white/10"
              >
                <span className="mb-4 grid size-11 place-items-center rounded-lg bg-teal/20 text-teal-claro">
                  <Icone className="size-5" />
                </span>
                <h2 className="font-heading text-xl font-bold text-white">
                  {p.titulo}
                </h2>
                <p className="mt-0.5 text-sm text-teal-claro">{p.quem}</p>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-white/65">
                  {p.resumo}
                </p>
                <Button type="submit" variant="teal" className="mt-6 w-full">
                  Entrar como {p.curto.toLowerCase()}
                  <ArrowRight className="size-4" />
                </Button>
              </form>
            );
          })}
        </div>

        <p className="mt-10 max-w-2xl text-sm leading-relaxed text-white/50">
          Os dados são fictícios e nada do que você fizer aqui é salvo. A
          demonstração dura oito horas e pode ser encerrada a qualquer
          momento pelo botão no rodapé do painel.
        </p>
      </div>
    </div>
  );
}
