"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Ban, CheckCircle2, KeyRound, Link2, Loader2, UserPlus, UsersRound } from "lucide-react";
import type { Role } from "@/lib/supabase/types";
import type { UsuarioGerenciavel } from "@/lib/supabase/usuarios";
import { criarUsuario, vincularClinica } from "@/lib/actions/usuarios";
import { senhaProvisoria } from "@/components/app/admin/gestao-usuarios";
import { rotuloPapel } from "@/lib/rbac";
import { tempoRelativo } from "@/lib/rotulos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

type PapelClinica = Exclude<Role, "super_admin">;

const PAPEIS: PapelClinica[] = ["gestor", "medico", "secretaria"];

/**
 * Quem entra no painel desta clínica.
 *
 * É o vínculo que faz os dados que a equipe montou (diagnóstico, marco
 * zero, check-ins) aparecerem para o cliente: o login de alguém passa a
 * apontar para esta clínica e ele enxerga tudo o que já está aqui.
 */
export function AcessosClinica({
  clinicaId,
  clinica,
  membros,
  candidatos,
  bloqueado,
}: {
  clinicaId: string;
  clinica: string;
  membros: UsuarioGerenciavel[];
  /** Contas de outras clínicas ou sem clínica, que podem ser trazidas para cá. */
  candidatos: UsuarioGerenciavel[];
  bloqueado: boolean;
}) {
  const router = useRouter();
  const [modo, setModo] = useState<"vincular" | "criar" | null>(null);
  const [contaId, setContaId] = useState("");
  const [papel, setPapel] = useState<PapelClinica>("gestor");
  const [novo, setNovo] = useState({ nome: "", email: "", senha: senhaProvisoria() });
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function abrir(m: "vincular" | "criar") {
    setModo(modo === m ? null : m);
    setErro(null);
    setAviso(null);
  }

  function vincular(e: React.FormEvent) {
    e.preventDefault();
    const conta = candidatos.find((c) => c.id === contaId);
    if (!conta) return;
    if (
      conta.organization_id &&
      !conta.aguardando_liberacao &&
      !confirm(`${conta.nome} sai de ${conta.organizacao_nome ?? "outra clínica"} e passa a ver só ${clinica}. Continuar?`)
    ) {
      return;
    }
    setErro(null);
    startTransition(async () => {
      const res = await vincularClinica(conta.id, clinicaId, papel);
      if (!res.ok) {
        setErro(res.erro ?? "Não foi possível vincular.");
        return;
      }
      setAviso(`${conta.nome} agora acessa ${clinica} como ${rotuloPapel(papel)}.`);
      setContaId("");
      setModo(null);
      router.refresh();
    });
  }

  function criar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    startTransition(async () => {
      const res = await criarUsuario({
        nome: novo.nome,
        email: novo.email,
        senha: novo.senha,
        papel,
        organizationId: clinicaId,
      });
      if (!res.ok) {
        setErro(res.erro ?? "Não foi possível criar o acesso.");
        return;
      }
      setAviso(`Acesso criado. Login: ${novo.email.trim().toLowerCase()} · senha provisória: ${novo.senha}`);
      setNovo({ nome: "", email: "", senha: senhaProvisoria() });
      setModo(null);
      router.refresh();
    });
  }

  return (
    <section className="mt-6 rounded-lg border border-border bg-white p-6 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <UsersRound className="mt-0.5 size-5 shrink-0 text-teal" />
          <div>
            <h2 className="text-lg font-semibold text-azul-medico">Acessos ao painel</h2>
            <p className="mt-1 max-w-xl text-sm text-cinza-suave">
              Quem entra com login nesta clínica vê o diagnóstico, os indicadores e os check-ins
              dela, os mesmos que aparecem aqui.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={modo === "vincular" ? "primary" : "outline"}
            size="sm"
            disabled={bloqueado || candidatos.length === 0}
            title={candidatos.length === 0 ? "Não há outras contas para vincular" : undefined}
            onClick={() => abrir("vincular")}
          >
            <Link2 /> Vincular conta existente
          </Button>
          <Button
            type="button"
            variant={modo === "criar" ? "primary" : "outline"}
            size="sm"
            disabled={bloqueado}
            onClick={() => abrir("criar")}
          >
            <UserPlus /> Criar acesso
          </Button>
        </div>
      </div>

      {modo === "vincular" && (
        <form onSubmit={vincular} className="mt-4 grid gap-3 rounded-lg bg-branco-clinico p-4 sm:grid-cols-[minmax(0,1fr)_12rem_auto] sm:items-end">
          <div className="grid gap-1.5">
            <Label htmlFor="ac-conta">Conta</Label>
            <Select id="ac-conta" value={contaId} onChange={(e) => setContaId(e.target.value)} required>
              <option value="" disabled>
                Escolha a pessoa
              </option>
              {candidatos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome ?? "Sem nome"}
                  {c.email ? ` · ${c.email}` : ""}
                  {c.aguardando_liberacao
                    ? " (cadastro aguardando)"
                    : c.organizacao_nome
                      ? ` (hoje em ${c.organizacao_nome})`
                      : " (sem clínica)"}
                </option>
              ))}
            </Select>
          </div>
          <CampoPapel id="ac-papel" valor={papel} onChange={setPapel} />
          <Button type="submit" disabled={pending || !contaId}>
            {pending && <Loader2 className="animate-spin" />} Vincular
          </Button>
        </form>
      )}

      {modo === "criar" && (
        <form onSubmit={criar} className="mt-4 grid gap-3 rounded-lg bg-branco-clinico p-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="ac-nome">Nome</Label>
            <Input id="ac-nome" value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} required />
          </div>
          <CampoPapel id="ac-papel-novo" valor={papel} onChange={setPapel} />
          <div className="grid gap-1.5">
            <Label htmlFor="ac-email">E-mail de login</Label>
            <Input id="ac-email" type="email" value={novo.email} onChange={(e) => setNovo({ ...novo, email: e.target.value })} required />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ac-senha">Senha provisória</Label>
            <div className="flex gap-2">
              <Input
                id="ac-senha"
                value={novo.senha}
                onChange={(e) => setNovo({ ...novo, senha: e.target.value })}
                minLength={8}
                required
                className="font-mono"
              />
              <Button type="button" variant="outline" onClick={() => setNovo({ ...novo, senha: senhaProvisoria() })}>
                Gerar
              </Button>
            </div>
          </div>
          <div className="flex justify-end sm:col-span-2">
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />} Criar acesso
            </Button>
          </div>
        </form>
      )}

      {erro && <p className="mt-4 rounded-md bg-coral/10 px-4 py-2.5 text-sm text-coral">{erro}</p>}
      {aviso && (
        <p className="mt-4 flex items-start gap-2 rounded-md bg-sucesso/10 px-4 py-2.5 text-sm text-sucesso">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> {aviso}
        </p>
      )}

      {membros.length === 0 ? (
        <p className="mt-4 text-sm text-cinza-suave">
          Ninguém acessa esta clínica ainda. Vincule a conta de quem já se cadastrou ou crie um
          acesso novo.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-border">
          {membros.map((u) => (
            <li key={u.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-azul-medico text-sm font-semibold text-white">
                  {(u.nome ?? "?").charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-medium text-cinza-texto">{u.nome ?? "Sem nome"}</p>
                  <p className="truncate text-xs text-cinza-suave">
                    {u.email ?? "e-mail indisponível"}
                    {" · "}
                    {u.aguardando_liberacao
                      ? "cadastro aguardando liberação"
                      : u.ultimo_acesso
                        ? `último acesso ${tempoRelativo(u.ultimo_acesso)}`
                        : "nunca entrou"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!u.ativo && !u.aguardando_liberacao && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-coral/12 px-2 py-0.5 text-[10px] font-semibold text-coral">
                    <Ban className="size-2.5" /> acesso cortado
                  </span>
                )}
                <span className="rounded-full bg-verde-menta px-3 py-1 text-xs font-semibold text-azul-medico">
                  {rotuloPapel(u.role)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-4 flex items-center gap-1.5 text-xs text-cinza-suave">
        <KeyRound className="size-3.5" /> Senha, papel e corte de acesso ficam em{" "}
        <Link href="/app/admin/usuarios" className="font-medium text-teal hover:underline">
          Usuários
        </Link>
        .
      </p>
    </section>
  );
}

function CampoPapel({
  id,
  valor,
  onChange,
}: {
  id: string;
  valor: PapelClinica;
  onChange: (p: PapelClinica) => void;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>Papel</Label>
      <Select id={id} value={valor} onChange={(e) => onChange(e.target.value as PapelClinica)}>
        {PAPEIS.map((p) => (
          <option key={p} value={p}>
            {rotuloPapel(p)}
          </option>
        ))}
      </Select>
    </div>
  );
}
