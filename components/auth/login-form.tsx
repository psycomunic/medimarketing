"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Mail, Lock, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { login, solicitarReset } from "@/lib/actions/auth";

const schema = z.object({
  email: z.string().email("Informe um e-mail válido"),
  senha: z.string().min(6, "Mínimo de 6 caracteres"),
});

type FormData = z.infer<typeof schema>;

export function LoginForm({
  redirectTo,
  demoEmail,
  demoSenha,
}: {
  redirectTo?: string;
  demoEmail?: string;
  demoSenha?: string;
}) {
  const [erro, setErro] = useState<string | null>(null);
  const [resetMsg, setResetMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    // Preenche a conta de teste automaticamente em modo demonstração
    defaultValues: { email: demoEmail ?? "", senha: demoSenha ?? "" },
  });

  function onSubmit(data: FormData) {
    setErro(null);
    startTransition(async () => {
      const res = await login({ ...data, redirectTo });
      // Em sucesso há redirect (não retorna); só chega aqui em erro.
      if (res && !res.ok) setErro(res.erro);
    });
  }

  async function onReset() {
    setResetMsg(null);
    const email = getValues("email");
    if (!email) {
      setErro("Digite seu e-mail para redefinir a senha.");
      return;
    }
    const res = await solicitarReset(email);
    if (res.ok) setResetMsg("Enviamos um link de redefinição para seu e-mail.");
    else setErro(res.erro);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-5" noValidate>
      <div className="grid gap-1.5">
        <Label htmlFor="email">E-mail</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-cinza-suave" />
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="voce@clinica.com.br"
            className="pl-10"
            {...register("email")}
          />
        </div>
        {errors.email && (
          <span className="text-xs text-coral">{errors.email.message}</span>
        )}
      </div>

      <div className="grid gap-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="senha">Senha</Label>
          <button
            type="button"
            onClick={onReset}
            className="text-xs font-medium text-teal hover:underline"
          >
            Esqueci minha senha
          </button>
        </div>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-cinza-suave" />
          <Input
            id="senha"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            className="pl-10"
            {...register("senha")}
          />
        </div>
        {errors.senha && (
          <span className="text-xs text-coral">{errors.senha.message}</span>
        )}
      </div>

      {erro && (
        <p className="rounded-md bg-coral/10 px-3 py-2 text-sm text-coral">{erro}</p>
      )}
      {resetMsg && (
        <p className="flex items-center gap-2 rounded-md bg-sucesso/10 px-3 py-2 text-sm text-sucesso">
          <CheckCircle2 className="size-4" /> {resetMsg}
        </p>
      )}

      <Button type="submit" variant="marca" size="lg" disabled={pending}>
        {pending ? (
          <>
            <Loader2 className="size-5 animate-spin" /> Entrando...
          </>
        ) : (
          "Entrar"
        )}
      </Button>
    </form>
  );
}
