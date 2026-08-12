"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Loader2, Lock, TriangleAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Estado = "verificando" | "pronto" | "expirado" | "salvo";

/**
 * Troca de senha a partir do link do e-mail.
 *
 * O token vem no fragmento da URL, que nunca chega ao servidor — é uma
 * proteção do próprio navegador. O cliente do Supabase lê esse
 * fragmento sozinho ao iniciar e abre a sessão; a partir daí, trocar a
 * senha é uma chamada comum.
 *
 * Por isso a tela começa em "verificando": até a sessão existir, não
 * há como saber se o link ainda vale, e mostrar o formulário antes
 * disso seria convidar a pessoa a digitar à toa.
 */
export function NovaSenhaForm() {
  const router = useRouter();
  const [estado, setEstado] = useState<Estado>("verificando");
  const [senha, setSenha] = useState("");
  const [repetir, setRepetir] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    // O link pode trazer erro explícito do Supabase (expirado, já usado)
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    if (hash.get("error")) {
      setEstado("expirado");
      return;
    }

    let vivo = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!vivo) return;
      setEstado(data.session ? "pronto" : "expirado");
    });

    // A sessão do fragmento pode chegar depois da primeira leitura
    const { data: sub } = supabase.auth.onAuthStateChange((_e, sessao) => {
      if (vivo && sessao) setEstado("pronto");
    });

    return () => {
      vivo = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);

    if (senha.length < 8) {
      setErro("A senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    if (senha !== repetir) {
      setErro("As duas senhas não são iguais.");
      return;
    }

    setSalvando(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: senha });
    setSalvando(false);

    if (error) {
      setErro(
        /should be different|same as/i.test(error.message)
          ? "Escolha uma senha diferente da atual."
          : "Não foi possível salvar a senha. Peça um novo link e tente de novo."
      );
      return;
    }

    setEstado("salvo");
    // Um respiro para a pessoa ler a confirmação antes de sair da tela
    setTimeout(() => router.replace("/app"), 1800);
  }

  if (estado === "verificando") {
    return (
      <p className="flex items-center gap-2 text-sm text-cinza-suave">
        <Loader2 className="size-4 animate-spin" /> Conferindo seu link…
      </p>
    );
  }

  if (estado === "expirado") {
    return (
      <div className="rounded-lg border border-alerta/30 bg-alerta/8 px-4 py-4 text-sm">
        <p className="flex items-center gap-2 font-semibold text-alerta">
          <TriangleAlert className="size-4" /> Link expirado ou já usado
        </p>
        <p className="mt-1.5 text-cinza-suave">
          Por segurança, o link de recuperação vale por uma hora e só funciona
          uma vez. Peça um novo na tela de login.
        </p>
        <Link
          href="/login"
          className="mt-3 inline-block text-sm font-medium text-teal hover:underline"
        >
          Pedir um novo link
        </Link>
      </div>
    );
  }

  if (estado === "salvo") {
    return (
      <div className="rounded-lg border border-teal/30 bg-verde-menta px-4 py-4 text-sm">
        <p className="flex items-center gap-2 font-semibold text-teal">
          <CheckCircle2 className="size-4" /> Senha alterada
        </p>
        <p className="mt-1.5 text-cinza-suave">
          Levando você para o painel…
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={salvar} className="grid gap-5" noValidate>
      <div className="grid gap-1.5">
        <Label htmlFor="senha">Nova senha</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-cinza-suave" />
          <Input
            id="senha"
            type="password"
            autoComplete="new-password"
            className="pl-9"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="Pelo menos 8 caracteres"
          />
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="repetir">Repita a nova senha</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-cinza-suave" />
          <Input
            id="repetir"
            type="password"
            autoComplete="new-password"
            className="pl-9"
            value={repetir}
            onChange={(e) => setRepetir(e.target.value)}
            placeholder="Para não errar sem perceber"
          />
        </div>
      </div>

      {erro && <p className="text-sm text-vermelho-alerta">{erro}</p>}

      <Button type="submit" disabled={salvando}>
        {salvando ? (
          <>
            <Loader2 className="size-4 animate-spin" /> Salvando…
          </>
        ) : (
          "Salvar nova senha"
        )}
      </Button>
    </form>
  );
}
