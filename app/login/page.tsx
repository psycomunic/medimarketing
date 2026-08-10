import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/logo";
import { LoginForm } from "@/components/auth/login-form";
import { supabaseConfigurado } from "@/lib/supabase/queries";
import { CONTAS_DEMO, DEMO_EMAIL, DEMO_SENHA } from "@/lib/demo";
import { rotuloPapel } from "@/lib/rbac";

export const metadata = {
  title: "Entrar",
  description: "Acesse a plataforma Medi Marketing.",
};

export default function LoginPage({
  searchParams,
}: {
  searchParams: { redirect?: string };
}) {
  const demo = !supabaseConfigurado();

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Lado esquerdo — formulário */}
      <div className="flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-20">
        <div className="mx-auto w-full max-w-sm">
          <Link
            href="/"
            className="mb-10 inline-flex items-center gap-1.5 text-sm text-cinza-suave transition-colors hover:text-teal"
          >
            <ArrowLeft className="size-4" /> Voltar ao site
          </Link>

          <Logo href="/" />

          <h1 className="mt-8 text-2xl md:text-3xl">Área do Cliente</h1>
          <p className="mt-2 text-cinza-suave">
            Agenda, CRM, atendimento e resultados da sua clínica.
          </p>

          {/* Aviso de modo demonstração com uma conta de teste por papel */}
          {demo && (
            <div className="mt-6 rounded-lg border border-teal/30 bg-verde-menta px-4 py-3 text-sm">
              <p className="font-semibold text-azul-medico">🔓 Modo demonstração</p>
              <p className="mt-1 text-cinza-suave">
                O banco de dados não está conectado. Entre com uma das contas de
                teste. Cada uma enxerga um recorte diferente da plataforma.
              </p>
              <ul className="mt-3 space-y-1.5">
                {CONTAS_DEMO.map((c) => (
                  <li key={c.email} className="flex items-baseline justify-between gap-3">
                    <span className="font-mono text-xs text-cinza-texto">{c.email}</span>
                    <span className="shrink-0 text-[11px] text-cinza-suave">
                      {rotuloPapel(c.role)}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 font-mono text-xs text-cinza-texto">
                <span className="text-cinza-suave">senha (todas):</span> {DEMO_SENHA}
              </p>
            </div>
          )}

          <div className="mt-8">
            <LoginForm
              redirectTo={searchParams.redirect}
              demoEmail={demo ? DEMO_EMAIL : undefined}
              demoSenha={demo ? DEMO_SENHA : undefined}
            />
          </div>

          <p className="mt-8 text-sm text-cinza-suave">
            Ainda não tem acesso?{" "}
            <a
              href="/#contato"
              className="font-semibold text-teal hover:underline"
            >
              Fale com nossa equipe
            </a>
            {/* TODO: definir fluxo de cadastro (convite por admin vs. autocadastro) */}
          </p>
        </div>
      </div>

      {/* Lado direito — painel de marca (oculto no mobile) */}
      <div className="relative hidden overflow-hidden bg-azul-medico lg:block">
        <div
          aria-hidden
          className="absolute inset-0"
        >
          <div className="absolute -right-20 top-20 size-96 rounded-full bg-teal/30 blur-3xl" />
          <div className="absolute bottom-10 -left-10 size-80 rounded-full bg-teal-claro/20 blur-3xl" />
        </div>
        <div className="relative flex h-full flex-col justify-center px-16 text-white">
          <blockquote className="max-w-md">
            <p className="font-heading text-2xl font-semibold leading-snug">
              “Ter a agenda no celular mudou minha rotina. Vejo os horários do dia
              antes mesmo de chegar no consultório.”
            </p>
            <footer className="mt-6 text-white/70">
              Dra. Beatriz Nunes, Ginecologia
            </footer>
          </blockquote>
        </div>
      </div>
    </div>
  );
}
