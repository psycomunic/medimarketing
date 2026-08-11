"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  Building2,
  CheckCircle2,
  Loader2,
  Lock,
  Mail,
  MailCheck,
  Phone,
  User,
} from "lucide-react";
import { cadastrar } from "@/lib/actions/cadastro";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/** Mesma régua do perfil: quatro faixas, sem bloquear nada. */
function forcaSenha(senha: string): { nivel: number; rotulo: string; cor: string } {
  let pontos = 0;
  if (senha.length >= 8) pontos++;
  if (senha.length >= 12) pontos++;
  if (/[a-z]/.test(senha) && /[A-Z]/.test(senha)) pontos++;
  if (/\d/.test(senha)) pontos++;
  if (/[^A-Za-z0-9]/.test(senha)) pontos++;

  if (pontos <= 1) return { nivel: 1, rotulo: "fraca", cor: "bg-coral" };
  if (pontos === 2) return { nivel: 2, rotulo: "razoável", cor: "bg-alerta" };
  if (pontos === 3) return { nivel: 3, rotulo: "boa", cor: "bg-teal" };
  return { nivel: 4, rotulo: "forte", cor: "bg-sucesso" };
}

export function CadastroForm() {
  const [v, setV] = useState({
    nome: "",
    clinica: "",
    email: "",
    telefone: "",
    senha: "",
    confirmacao: "",
    consentimento: false,
  });
  const [erro, setErro] = useState<string | null>(null);
  const [concluido, setConcluido] = useState<{ confirmar: boolean } | null>(null);
  const [pending, startTransition] = useTransition();

  const forca = forcaSenha(v.senha);

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    startTransition(async () => {
      const res = await cadastrar({
        ...v,
        consentimento: v.consentimento as true,
      });
      if (!res.ok) {
        setErro(res.erro);
        return;
      }
      setConcluido({ confirmar: res.precisaConfirmarEmail });
    });
  }

  if (concluido) {
    return (
      <div className="rounded-lg border border-teal/30 bg-verde-menta px-5 py-6">
        <span className="grid size-11 place-items-center rounded-full bg-white text-teal">
          {concluido.confirmar ? (
            <MailCheck className="size-5" />
          ) : (
            <CheckCircle2 className="size-5" />
          )}
        </span>

        <h2 className="mt-4 font-heading text-lg font-semibold text-azul-medico">
          Cadastro recebido
        </h2>

        <div className="mt-2 space-y-2 text-sm text-cinza-suave">
          {concluido.confirmar && (
            <p>
              Enviamos um e-mail de confirmação para{" "}
              <strong className="text-azul-medico">{v.email}</strong>. Confirme
              para validar o endereço.
            </p>
          )}
          <p>
            Depois disso, nossa equipe libera o seu acesso e define o que a
            sua conta enxerga no painel. Você recebe um aviso assim que
            estiver pronto.
          </p>
          <p className="text-xs">
            Entrar antes da liberação não vai funcionar — é proposital: a
            conta existe, mas ainda não tem permissão.
          </p>
        </div>

        <Link
          href="/login"
          className="mt-5 inline-block text-sm font-semibold text-teal hover:underline"
        >
          Ir para a tela de entrada
        </Link>
      </div>
    );
  }

  const campos = [
    { chave: "nome", label: "Seu nome", icone: User, tipo: "text", ph: "Nome completo", auto: "name" },
    { chave: "clinica", label: "Nome da clínica", icone: Building2, tipo: "text", ph: "Clínica Vida Derma", auto: "organization" },
    { chave: "email", label: "E-mail", icone: Mail, tipo: "email", ph: "voce@clinica.com.br", auto: "email" },
    { chave: "telefone", label: "WhatsApp", icone: Phone, tipo: "tel", ph: "(11) 99999-9999", auto: "tel" },
  ] as const;

  return (
    <form onSubmit={enviar} className="space-y-4">
      {campos.map((c) => (
        <div key={c.chave} className="grid gap-1.5">
          <Label htmlFor={c.chave}>{c.label}</Label>
          <div className="relative">
            <c.icone className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-cinza-suave" />
            <Input
              id={c.chave}
              type={c.tipo}
              autoComplete={c.auto}
              value={v[c.chave]}
              onChange={(e) => setV({ ...v, [c.chave]: e.target.value })}
              placeholder={c.ph}
              className="pl-10"
              required
            />
          </div>
        </div>
      ))}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="senha">Senha</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-cinza-suave" />
            <Input
              id="senha"
              type="password"
              autoComplete="new-password"
              value={v.senha}
              onChange={(e) => setV({ ...v, senha: e.target.value })}
              placeholder="••••••••"
              className="pl-10"
              required
            />
          </div>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="confirmacao">Confirme a senha</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-cinza-suave" />
            <Input
              id="confirmacao"
              type="password"
              autoComplete="new-password"
              value={v.confirmacao}
              onChange={(e) => setV({ ...v, confirmacao: e.target.value })}
              placeholder="••••••••"
              className="pl-10"
              required
            />
          </div>
        </div>
      </div>

      {v.senha && (
        <div>
          <div className="flex gap-1">
            {[1, 2, 3, 4].map((n) => (
              <span
                key={n}
                className={cn(
                  "h-1.5 flex-1 rounded-full",
                  n <= forca.nivel ? forca.cor : "bg-border"
                )}
              />
            ))}
          </div>
          <p className="mt-1.5 text-xs text-cinza-suave">Senha {forca.rotulo}.</p>
        </div>
      )}

      <label className="flex items-start gap-2.5 text-sm">
        <input
          type="checkbox"
          checked={v.consentimento}
          onChange={(e) => setV({ ...v, consentimento: e.target.checked })}
          className="mt-0.5 size-4 shrink-0 accent-teal"
          required
        />
        <span className="text-cinza-suave">
          Autorizo o contato da Medi Marketing e li a{" "}
          <Link href="/privacidade" className="font-medium text-teal hover:underline">
            política de privacidade
          </Link>
          .
        </span>
      </label>

      {erro && (
        <p className="rounded-md bg-coral/10 px-3 py-2.5 text-sm text-coral">{erro}</p>
      )}

      <Button
        type="submit"
        variant="primary"
        size="lg"
        className="w-full"
        disabled={pending}
      >
        {pending && <Loader2 className="size-4 animate-spin" />}
        Criar minha conta
      </Button>

      <p className="text-center text-sm text-cinza-suave">
        Já tem acesso?{" "}
        <Link href="/login" className="font-semibold text-teal hover:underline">
          Entrar
        </Link>
      </p>
    </form>
  );
}
