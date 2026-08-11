import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Check } from "lucide-react";
import { Logo } from "@/components/logo";
import { CadastroForm } from "@/components/auth/cadastro-form";
import { supabaseConfigurado } from "@/lib/supabase/queries";

export const metadata = {
  title: "Cadastre sua clínica",
  description:
    "Crie a conta da sua clínica na plataforma Medi Marketing: agenda, CRM, atendimento e resultados num lugar só.",
};

const BENEFICIOS = [
  "Agenda, CRM e atendimento na mesma tela",
  "Seus números de marketing traduzidos em pacientes na cadeira",
  "Trilhas de treinamento para a sua secretária",
  "Réguas automáticas para quem não fechou, faltou ou sumiu",
];

export default function CadastroPage() {
  // Sem banco não há o que cadastrar: manda para o login, que explica
  // o modo demonstração e oferece as contas de teste.
  if (!supabaseConfigurado()) redirect("/login");

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Lado esquerdo — formulário */}
      <div className="flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-20">
        <div className="mx-auto w-full max-w-md">
          <Link
            href="/"
            className="mb-10 inline-flex items-center gap-1.5 text-sm text-cinza-suave transition-colors hover:text-teal"
          >
            <ArrowLeft className="size-4" /> Voltar ao site
          </Link>

          <Logo href="/" />

          <h1 className="mt-8 text-2xl md:text-3xl">Cadastre sua clínica</h1>
          <p className="mt-2 text-cinza-suave">
            Crie a sua conta. Nossa equipe libera o acesso e acompanha os
            primeiros passos com você.
          </p>

          <div className="mt-8">
            <CadastroForm />
          </div>
        </div>
      </div>

      {/* Lado direito — painel de marca (oculto no mobile) */}
      <div className="relative hidden overflow-hidden bg-azul-medico lg:block">
        <div aria-hidden className="absolute inset-0">
          <div className="absolute -right-20 top-20 size-96 rounded-full bg-teal/30 blur-3xl" />
          <div className="absolute bottom-10 -left-10 size-80 rounded-full bg-teal-claro/20 blur-3xl" />
        </div>

        <div className="relative flex h-full flex-col justify-center px-16 text-white">
          <h2 className="max-w-md font-heading text-3xl font-semibold leading-snug">
            A clínica inteira num painel só.
          </h2>

          <ul className="mt-8 max-w-md space-y-3">
            {BENEFICIOS.map((b) => (
              <li key={b} className="flex items-start gap-3">
                <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-teal">
                  <Check className="size-3" />
                </span>
                <span className="text-white/80">{b}</span>
              </li>
            ))}
          </ul>

          <p className="mt-10 max-w-md text-sm text-white/60">
            O cadastro cria a sua conta e registra a clínica. A liberação do
            acesso é feita pela nossa equipe, que também define o que cada
            pessoa do seu time enxerga.
          </p>
        </div>
      </div>
    </div>
  );
}
