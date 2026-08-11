"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  Building2,
  CheckCircle2,
  Instagram,
  Loader2,
  MessageCircle,
  Plug,
  Search,
  Sparkles,
  UserCog,
  Users,
} from "lucide-react";
import type {
  Integracao,
  Organization,
  ProvedorIntegracao,
} from "@/lib/supabase/types";
import type { UsuarioGerenciavel } from "@/lib/supabase/usuarios";
import { salvarClinica, salvarIntegracao } from "@/lib/actions/configuracoes";
import { descricaoProvedor, rotuloProvedor } from "@/lib/rotulos";
import { GestaoUsuarios } from "@/components/app/admin/gestao-usuarios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const iconeProvedor: Record<ProvedorIntegracao, typeof Plug> = {
  meta_ads: Sparkles,
  google_ads: Search,
  ga4: BarChart3,
  whatsapp: MessageCircle,
  instagram: Instagram,
};

const placeholderProvedor: Record<ProvedorIntegracao, string> = {
  meta_ads: "act_000000000",
  google_ads: "000-000-0000",
  ga4: "G-XXXXXXXXXX",
  whatsapp: "(11) 99999-9999",
  instagram: "@suaclinica",
};

type Aba = "clinica" | "equipe" | "integracoes";

export function PainelConfiguracoes({
  organizacao,
  equipe,
  integracoes,
  usuarioId,
  adminDisponivel,
  demo,
}: {
  organizacao: Organization;
  equipe: UsuarioGerenciavel[];
  integracoes: Integracao[];
  usuarioId: string;
  adminDisponivel: boolean;
  demo: boolean;
}) {
  const [aba, setAba] = useState<Aba>("clinica");

  const abas: { id: Aba; label: string; icone: typeof Building2 }[] = [
    { id: "clinica", label: "Dados da clínica", icone: Building2 },
    { id: "equipe", label: `Equipe (${equipe.length})`, icone: Users },
    {
      id: "integracoes",
      label: `Integrações (${integracoes.filter((i) => i.conectado).length}/${integracoes.length})`,
      icone: Plug,
    },
  ];

  return (
    <>
      {demo && (
        <p className="mt-6 rounded-md border border-dashed border-border bg-white px-4 py-2.5 text-xs text-cinza-suave">
          Modo demonstração: nada do que você alterar aqui é salvo.
        </p>
      )}

      <div className="mt-6 flex flex-wrap gap-1 rounded-lg border border-border bg-white p-1">
        {abas.map((a) => (
          <button
            key={a.id}
            onClick={() => setAba(a.id)}
            className={cn(
              "inline-flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium transition-colors",
              aba === a.id
                ? "bg-azul-medico text-white"
                : "text-cinza-suave hover:bg-verde-menta hover:text-azul-medico"
            )}
          >
            <a.icone className="size-4" />
            <span className="truncate">{a.label}</span>
          </button>
        ))}
      </div>

      <div className="mt-6">
        {aba === "clinica" && <FormClinica organizacao={organizacao} />}
        {aba === "equipe" && (
          <GestaoUsuarios
            usuarios={equipe}
            clinicas={[{ id: organizacao.id, nome: organizacao.nome }]}
            usuarioId={usuarioId}
            ehSuperAdmin={false}
            organizationId={organizacao.id}
            adminDisponivel={adminDisponivel}
            demo={demo}
          />
        )}
        {aba === "integracoes" && (
          <Integracoes integracoes={integracoes} organizationId={organizacao.id} />
        )}
      </div>
    </>
  );
}

/* --------------------------- Dados da clínica --------------------------- */

function FormClinica({ organizacao: o }: { organizacao: Organization }) {
  const router = useRouter();
  const [v, setV] = useState({
    nome: o.nome,
    especialidade: o.especialidade ?? "",
    cnpj: o.cnpj ?? "",
    telefone: o.telefone ?? "",
    email: o.email ?? "",
    cidade: o.cidade ?? "",
    endereco: o.endereco ?? "",
    responsavel: o.responsavel ?? "",
    site: o.site ?? "",
    instagram: o.instagram ?? "",
    mensagemLembrete: o.mensagem_lembrete ?? "",
    antecedenciaLembreteH: String(o.antecedencia_lembrete_h),
  });
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);
  const [pending, startTransition] = useTransition();

  function enviar() {
    setErro(null);
    setSalvo(false);
    startTransition(async () => {
      const res = await salvarClinica({
        organizationId: o.id,
        ...v,
        antecedenciaLembreteH: Number(v.antecedenciaLembreteH || 24),
      });
      if (!res.ok) {
        setErro(res.erro);
        return;
      }
      setSalvo(true);
      router.refresh();
    });
  }

  const campos = [
    { chave: "nome", label: "Nome da clínica", ph: "Clínica Vida Derma" },
    { chave: "especialidade", label: "Especialidade", ph: "Dermatologia" },
    { chave: "cnpj", label: "CNPJ", ph: "00.000.000/0001-00" },
    { chave: "responsavel", label: "Responsável técnico", ph: "Dr(a). Nome" },
    { chave: "telefone", label: "Telefone", ph: "(11) 3333-4444" },
    { chave: "email", label: "E-mail", ph: "contato@clinica.com.br" },
    { chave: "cidade", label: "Cidade", ph: "São Paulo, SP" },
    { chave: "endereco", label: "Endereço", ph: "Rua, número — bairro" },
    { chave: "site", label: "Site", ph: "https://suaclinica.com.br" },
    { chave: "instagram", label: "Instagram", ph: "@suaclinica" },
  ] as const;

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-border bg-white p-6 shadow-soft">
        <h2 className="text-lg font-semibold text-azul-medico">Dados cadastrais</h2>
        <p className="mt-1 text-sm text-cinza-suave">
          Aparecem nos lembretes enviados ao paciente e nos relatórios.
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {campos.map((c) => (
            <div key={c.chave} className="grid gap-1.5">
              <Label htmlFor={c.chave}>{c.label}</Label>
              <Input
                id={c.chave}
                value={v[c.chave]}
                onChange={(e) => setV({ ...v, [c.chave]: e.target.value })}
                placeholder={c.ph}
              />
            </div>
          ))}
        </div>

        <div className="mt-5 rounded-md border border-dashed border-border bg-branco-clinico px-4 py-3">
          <p className="text-sm text-cinza-suave">
            <strong className="text-azul-medico">Plano contratado:</strong>{" "}
            {o.plano === "full"
              ? "Full / Parceria"
              : o.plano === "performance"
                ? "Performance"
                : "Essencial"}
            . Para mudar de plano, fale com a equipe da Medi Marketing.
          </p>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-white p-6 shadow-soft">
        <h2 className="text-lg font-semibold text-azul-medico">
          Lembrete de consulta
        </h2>
        <p className="mt-1 text-sm text-cinza-suave">
          Use{" "}
          <code className="rounded bg-verde-menta px-1">{"{paciente}"}</code>,{" "}
          <code className="rounded bg-verde-menta px-1">{"{data}"}</code>,{" "}
          <code className="rounded bg-verde-menta px-1">{"{hora}"}</code> e{" "}
          <code className="rounded bg-verde-menta px-1">{"{clinica}"}</code> para
          preencher automaticamente.
        </p>

        <div className="mt-5 grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="msg-lembrete">Mensagem</Label>
            <Textarea
              id="msg-lembrete"
              rows={3}
              value={v.mensagemLembrete}
              onChange={(e) => setV({ ...v, mensagemLembrete: e.target.value })}
              placeholder="Olá, {paciente}! Confirmando sua consulta em {data} às {hora}."
            />
          </div>
          <div className="grid max-w-xs gap-1.5">
            <Label htmlFor="antecedencia">Enviar quantas horas antes</Label>
            <Input
              id="antecedencia"
              type="number"
              min={1}
              max={168}
              value={v.antecedenciaLembreteH}
              onChange={(e) => setV({ ...v, antecedenciaLembreteH: e.target.value })}
            />
          </div>
        </div>
      </section>

      {erro && (
        <p className="rounded-md bg-coral/10 px-4 py-2.5 text-sm text-coral">{erro}</p>
      )}
      {salvo && (
        <p className="flex items-center gap-2 rounded-md bg-sucesso/10 px-4 py-2.5 text-sm text-sucesso">
          <CheckCircle2 className="size-4" /> Dados salvos.
        </p>
      )}

      <div className="flex justify-end">
        <Button variant="marca" onClick={enviar} disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          Salvar alterações
        </Button>
      </div>
    </div>
  );
}


/* ----------------------------- Integrações ----------------------------- */

function Integracoes({
  integracoes,
  organizationId,
}: {
  integracoes: Integracao[];
  organizationId: string;
}) {
  return (
    <div className="space-y-4">
      {integracoes.map((i) => (
        <CartaoIntegracao
          key={i.provedor}
          integracao={i}
          organizationId={organizationId}
        />
      ))}
    </div>
  );
}

function CartaoIntegracao({
  integracao: i,
  organizationId,
}: {
  integracao: Integracao;
  organizationId: string;
}) {
  const router = useRouter();
  const [identificador, setIdentificador] = useState(i.identificador ?? "");
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const Icone = iconeProvedor[i.provedor];

  function salvar(conectado: boolean) {
    setErro(null);
    startTransition(async () => {
      const res = await salvarIntegracao({
        organizationId,
        provedor: i.provedor,
        conectado,
        identificador,
      });
      if (!res.ok) {
        setErro(res.erro);
        return;
      }
      router.refresh();
    });
  }

  return (
    <article
      className={cn(
        "rounded-lg border bg-white p-5 shadow-soft",
        i.conectado ? "border-border" : "border-dashed border-border"
      )}
    >
      <div className="flex flex-wrap items-start gap-4">
        <span
          className={cn(
            "grid size-11 shrink-0 place-items-center rounded-xl",
            i.conectado ? "bg-verde-menta text-teal" : "bg-branco-clinico text-cinza-suave"
          )}
        >
          <Icone className="size-5" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-heading font-semibold text-azul-medico">
              {rotuloProvedor[i.provedor]}
            </h3>
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-[10px] font-semibold",
                i.conectado
                  ? "bg-sucesso/12 text-sucesso"
                  : "bg-cinza-suave/12 text-cinza-suave"
              )}
            >
              {i.conectado ? "Conectado" : "Não conectado"}
            </span>
          </div>
          <p className="mt-1 text-sm text-cinza-suave">
            {descricaoProvedor[i.provedor]}
          </p>

          <div className="mt-3 flex flex-wrap items-end gap-3">
            <div className="grid min-w-[200px] flex-1 gap-1.5">
              <Label htmlFor={`id-${i.provedor}`} className="text-xs">
                {i.provedor === "whatsapp"
                  ? "Número conectado"
                  : i.provedor === "instagram"
                    ? "Perfil"
                    : "Identificador da conta"}
              </Label>
              <Input
                id={`id-${i.provedor}`}
                value={identificador}
                onChange={(e) => setIdentificador(e.target.value)}
                placeholder={placeholderProvedor[i.provedor]}
                className="h-10"
              />
            </div>

            {i.conectado ? (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() => salvar(true)}
                >
                  {pending && <Loader2 className="size-4 animate-spin" />}
                  Atualizar
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  onClick={() => salvar(false)}
                  className="text-coral hover:bg-coral/10"
                >
                  Desconectar
                </Button>
              </div>
            ) : (
              <Button
                variant="teal"
                size="sm"
                disabled={pending}
                onClick={() => salvar(true)}
              >
                {pending && <Loader2 className="size-4 animate-spin" />}
                Conectar
              </Button>
            )}
          </div>

          {erro && <p className="mt-2 text-sm text-coral">{erro}</p>}
        </div>
      </div>
    </article>
  );
}
