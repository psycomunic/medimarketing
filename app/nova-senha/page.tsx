import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/logo";
import { NovaSenhaForm } from "@/components/auth/nova-senha-form";

export const metadata = {
  title: "Criar nova senha",
  description: "Defina uma nova senha para sua conta.",
};

/**
 * Destino do link de recuperação de senha.
 *
 * O Supabase manda a pessoa para cá com o token no fragmento da URL
 * (`#access_token=...`), que o navegador não envia ao servidor. Por
 * isso a leitura é obrigatoriamente no cliente — daí o formulário ser
 * um componente separado.
 */
export default function NovaSenhaPage() {
  return (
    <div className="flex min-h-screen flex-col justify-center px-6 py-12 sm:px-12">
      <div className="mx-auto w-full max-w-sm">
        <Link
          href="/login"
          className="mb-10 inline-flex items-center gap-1.5 text-sm text-cinza-suave transition-colors hover:text-teal"
        >
          <ArrowLeft className="size-4" /> Voltar ao login
        </Link>

        <Logo href="/" />

        <h1 className="mt-8 text-2xl md:text-3xl">Criar nova senha</h1>
        <p className="mt-2 text-cinza-suave">
          Escolha uma senha que você não use em outro lugar.
        </p>

        <div className="mt-8">
          <NovaSenhaForm />
        </div>
      </div>
    </div>
  );
}
