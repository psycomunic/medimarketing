"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  IdCard,
  Image as ImageIcon,
  KeyRound,
  Loader2,
  Phone,
  Stethoscope,
  User,
} from "lucide-react";
import type { Profile } from "@/lib/supabase/types";
import { alterarSenha, salvarPerfil } from "@/lib/actions/perfil";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function FormPerfil({
  profile,
  demo,
}: {
  profile: Profile;
  demo: boolean;
}) {
  const router = useRouter();
  const [v, setV] = useState({
    nome: profile.nome ?? "",
    especialidade: profile.especialidade ?? "",
    crm: profile.crm ?? "",
    telefone: profile.telefone ?? "",
    fotoUrl: profile.foto_url ?? "",
  });
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);
  const [pending, startTransition] = useTransition();

  function enviar() {
    setErro(null);
    setSalvo(false);
    startTransition(async () => {
      const res = await salvarPerfil(v);
      if (!res.ok) {
        setErro(res.erro);
        return;
      }
      setSalvo(true);
      router.refresh();
    });
  }

  const campos = [
    { chave: "nome", label: "Nome", icone: User, ph: "Seu nome completo" },
    {
      chave: "especialidade",
      label: "Especialidade",
      icone: Stethoscope,
      ph: "Ex.: Dermatologia",
    },
    { chave: "crm", label: "CRM", icone: IdCard, ph: "CRM/UF 000000" },
    { chave: "telefone", label: "Telefone", icone: Phone, ph: "(11) 99999-9999" },
    {
      chave: "fotoUrl",
      label: "Foto (endereço da imagem)",
      icone: ImageIcon,
      ph: "https://…",
    },
  ] as const;

  return (
    <section className="rounded-lg border border-border bg-white p-6 shadow-soft">
      <h2 className="text-lg font-semibold text-azul-medico">Dados profissionais</h2>
      <p className="mt-1 text-sm text-cinza-suave">
        É o que aparece para a sua equipe e nos registros das consultas.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {campos.map((c) => (
          <div
            key={c.chave}
            className={`grid gap-1.5 ${c.chave === "fotoUrl" ? "sm:col-span-2" : ""}`}
          >
            <Label htmlFor={c.chave}>{c.label}</Label>
            <div className="relative">
              <c.icone className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-cinza-suave" />
              <Input
                id={c.chave}
                value={v[c.chave]}
                onChange={(e) => setV({ ...v, [c.chave]: e.target.value })}
                placeholder={c.ph}
                className="pl-10"
              />
            </div>
          </div>
        ))}
      </div>

      {erro && (
        <p className="mt-4 rounded-md bg-coral/10 px-3 py-2 text-sm text-coral">{erro}</p>
      )}
      {salvo && (
        <p className="mt-4 flex items-center gap-2 rounded-md bg-sucesso/10 px-3 py-2 text-sm text-sucesso">
          <CheckCircle2 className="size-4" /> Perfil atualizado.
        </p>
      )}
      {demo && (
        <p className="mt-4 rounded-md border border-dashed border-border bg-branco-clinico px-3 py-2 text-xs text-cinza-suave">
          Modo demonstração: as alterações não são salvas.
        </p>
      )}

      <div className="mt-5 flex justify-end">
        <Button variant="marca" onClick={enviar} disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          Salvar alterações
        </Button>
      </div>
    </section>
  );
}

/* ---------------------------- Troca de senha ---------------------------- */

/** Força da senha em quatro faixas, para dar retorno enquanto a pessoa digita. */
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

export function FormSenha({ demo }: { demo: boolean }) {
  const [v, setV] = useState({ senhaAtual: "", novaSenha: "", confirmacao: "" });
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);
  const [pending, startTransition] = useTransition();

  const forca = forcaSenha(v.novaSenha);

  function enviar() {
    setErro(null);
    setSalvo(false);
    startTransition(async () => {
      const res = await alterarSenha(v);
      if (!res.ok) {
        setErro(res.erro);
        return;
      }
      setSalvo(true);
      setV({ senhaAtual: "", novaSenha: "", confirmacao: "" });
    });
  }

  const campos = [
    { chave: "senhaAtual", label: "Senha atual", auto: "current-password" },
    { chave: "novaSenha", label: "Nova senha", auto: "new-password" },
    { chave: "confirmacao", label: "Confirme a nova senha", auto: "new-password" },
  ] as const;

  return (
    <section className="mt-6 rounded-lg border border-border bg-white p-6 shadow-soft">
      <div className="flex items-center gap-2">
        <KeyRound className="size-5 text-teal" />
        <h2 className="text-lg font-semibold text-azul-medico">Trocar senha</h2>
      </div>
      <p className="mt-1 text-sm text-cinza-suave">
        Pedimos a senha atual porque ela é a única prova de que é você mesmo
        de frente para a tela.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        {campos.map((c) => (
          <div key={c.chave} className="grid gap-1.5">
            <Label htmlFor={c.chave}>{c.label}</Label>
            <Input
              id={c.chave}
              type="password"
              autoComplete={c.auto}
              value={v[c.chave]}
              onChange={(e) => setV({ ...v, [c.chave]: e.target.value })}
              placeholder="••••••••"
            />
          </div>
        ))}
      </div>

      {v.novaSenha && (
        <div className="mt-3">
          <div className="flex gap-1">
            {[1, 2, 3, 4].map((n) => (
              <span
                key={n}
                className={`h-1.5 flex-1 rounded-full ${
                  n <= forca.nivel ? forca.cor : "bg-border"
                }`}
              />
            ))}
          </div>
          <p className="mt-1.5 text-xs text-cinza-suave">
            Senha {forca.rotulo}. Misture maiúsculas, números e um símbolo para
            ficar mais difícil de adivinhar.
          </p>
        </div>
      )}

      {erro && (
        <p className="mt-4 rounded-md bg-coral/10 px-3 py-2 text-sm text-coral">{erro}</p>
      )}
      {salvo && (
        <p className="mt-4 flex items-center gap-2 rounded-md bg-sucesso/10 px-3 py-2 text-sm text-sucesso">
          <CheckCircle2 className="size-4" /> Senha alterada.
        </p>
      )}
      {demo && (
        <p className="mt-4 rounded-md border border-dashed border-border bg-branco-clinico px-3 py-2 text-xs text-cinza-suave">
          Modo demonstração: a senha das contas de teste é fixa e não pode ser
          trocada.
        </p>
      )}

      <div className="mt-5 flex justify-end">
        <Button
          variant="outline"
          onClick={enviar}
          disabled={pending || !v.senhaAtual || !v.novaSenha || !v.confirmacao}
        >
          {pending && <Loader2 className="size-4 animate-spin" />}
          Alterar senha
        </Button>
      </div>
    </section>
  );
}
