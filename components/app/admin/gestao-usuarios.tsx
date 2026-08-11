"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Ban,
  Building2,
  CheckCircle2,
  KeyRound,
  Loader2,
  Mail,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserPlus,
} from "lucide-react";
import type { Organization, Role } from "@/lib/supabase/types";
import type { UsuarioGerenciavel } from "@/lib/supabase/usuarios";
import {
  atualizarUsuario,
  criarUsuario,
  definirAcesso,
  definirPapel,
  definirSenhaDe,
  enviarRedefinicao,
  excluirUsuario,
  liberarAcesso,
  recusarCadastro,
  transferirClinica,
} from "@/lib/actions/usuarios";
import { rotuloPapel } from "@/lib/rbac";
import { tempoRelativo } from "@/lib/rotulos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type Clinica = Pick<Organization, "id" | "nome">;

const corPapel: Record<Role, string> = {
  super_admin: "bg-teal/12 text-teal",
  gestor: "bg-azul-medico/12 text-azul-medico",
  secretaria: "bg-alerta/12 text-alerta",
  medico: "bg-verde-menta text-azul-medico",
};

/** O que cada papel enxerga, em uma linha — ajuda na hora de escolher. */
const resumoPapel: Record<Role, string> = {
  super_admin: "Equipe Medi Marketing: todas as clínicas, sem pertencer a nenhuma",
  gestor: "Acesso total à clínica, incluindo financeiro e configurações",
  secretaria: "Agenda, CRM, atendimento e retenção. Não vê financeiro",
  medico: "A própria agenda, os indicadores e a Academy",
};

/** Senha provisória legível, para ditar por telefone sem confusão. */
function senhaProvisoria(): string {
  const letras = "abcdefghijkmnpqrstuvwxyz";
  const numeros = "23456789";
  const parte = (fonte: string, n: number) =>
    Array.from({ length: n }, () => fonte[Math.floor(Math.random() * fonte.length)]).join("");
  return `${parte(letras, 4)}-${parte(numeros, 4)}-${parte(letras, 3)}`;
}

export function GestaoUsuarios({
  usuarios,
  clinicas,
  usuarioId,
  ehSuperAdmin,
  organizationId,
  adminDisponivel,
  demo,
}: {
  usuarios: UsuarioGerenciavel[];
  clinicas: Clinica[];
  usuarioId: string;
  ehSuperAdmin: boolean;
  organizationId: string | null;
  adminDisponivel: boolean;
  demo: boolean;
}) {
  const router = useRouter();
  const [busca, setBusca] = useState("");
  const [filtroPapel, setFiltroPapel] = useState<Role | "">("");
  const [filtroClinica, setFiltroClinica] = useState("");
  const [criando, setCriando] = useState(false);
  const [editando, setEditando] = useState<UsuarioGerenciavel | null>(null);
  const [senhaDe, setSenhaDe] = useState<UsuarioGerenciavel | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // A fila sai da lista principal e ganha um bloco próprio no topo: é a
  // única parte da tela que pede uma decisão, não só consulta.
  const fila = useMemo(
    () => usuarios.filter((u) => u.aguardando_liberacao),
    [usuarios]
  );

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return usuarios.filter((u) => {
      if (u.aguardando_liberacao) return false;
      if (filtroPapel && u.role !== filtroPapel) return false;
      if (filtroClinica && u.organization_id !== filtroClinica) return false;
      if (termo) {
        const alvo = `${u.nome ?? ""} ${u.email ?? ""} ${u.organizacao_nome ?? ""}`;
        if (!alvo.toLowerCase().includes(termo)) return false;
      }
      return true;
    });
  }, [usuarios, busca, filtroPapel, filtroClinica]);

  function agir(
    fn: () => Promise<{ ok: boolean; erro?: string }>,
    sucesso?: string
  ) {
    setErro(null);
    setAviso(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        setErro(res.erro ?? "Não foi possível concluir.");
        return;
      }
      if (sucesso) setAviso(sucesso);
      router.refresh();
    });
  }

  const bloqueado = !adminDisponivel || demo;

  return (
    <>
      {demo ? (
        <p className="rounded-md border border-dashed border-border bg-white px-4 py-3 text-sm text-cinza-suave">
          Modo demonstração: a lista abaixo é fictícia e as ações não são salvas.
        </p>
      ) : !adminDisponivel ? (
        <div className="rounded-lg border border-alerta/40 bg-alerta/5 px-4 py-3.5 text-sm">
          <p className="flex items-center gap-2 font-semibold text-alerta">
            <AlertTriangle className="size-4" />
            Falta a chave de serviço
          </p>
          <p className="mt-1.5 text-cinza-suave">
            Criar contas, trocar senha e cortar acesso exigem a{" "}
            <code className="rounded bg-white px-1">SUPABASE_SERVICE_ROLE_KEY</code>,
            que é a única chave com poder de administrar o Auth. Pegue em{" "}
            <strong>Project Settings → API keys</strong> e adicione como variável
            de ambiente — <strong>sem</strong> o prefixo{" "}
            <code className="rounded bg-white px-1">NEXT_PUBLIC_</code>, senão ela
            iria parar no navegador de quem abrir o site.
          </p>
          <p className="mt-1.5 text-cinza-suave">
            Até lá a lista aparece, mas sem e-mail e sem último acesso, e os
            botões ficam desligados.
          </p>
        </div>
      ) : null}

      {/* Fila de liberação — cadastros que chegaram pela tela pública */}
      {fila.length > 0 && (
        <section className="mt-4 overflow-hidden rounded-lg border-2 border-alerta/40 bg-white shadow-soft">
          <header className="border-b border-border bg-alerta/8 px-5 py-3.5">
            <h2 className="flex items-center gap-2 font-heading font-semibold text-azul-medico">
              <UserPlus className="size-4 text-alerta" />
              {fila.length} cadastro{fila.length === 1 ? "" : "s"} aguardando
              liberação
            </h2>
            <p className="mt-1 text-sm text-cinza-suave">
              Chegaram pela tela pública. A conta existe, mas não entra até
              você definir o papel.
            </p>
          </header>

          <ul className="divide-y divide-border">
            {fila.map((u) => (
              <li key={u.id} className="px-5 py-4">
                <div className="flex flex-wrap items-start gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-alerta/15 text-sm font-semibold text-alerta">
                    {(u.nome ?? "?").charAt(0).toUpperCase()}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-cinza-texto">
                      {u.nome ?? "Sem nome"}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-cinza-suave">
                      {u.email ?? "e-mail indisponível"}
                      {u.telefone && ` · ${u.telefone}`}
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-cinza-suave/80">
                      <span className="inline-flex items-center gap-1">
                        <Building2 className="size-3 text-teal" />
                        {u.organizacao_nome ?? "clínica não informada"}
                      </span>
                      <span>· cadastrou-se {tempoRelativo(u.created_at)}</span>
                      {u.email && !u.email_confirmado && (
                        <span className="font-semibold text-alerta">
                          · e-mail ainda não confirmado
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-cinza-suave">Liberar como:</span>
                  {(ehSuperAdmin
                    ? (["gestor", "secretaria", "medico"] as Role[])
                    : (["gestor", "secretaria", "medico"] as Role[])
                  ).map((p) => (
                    <Button
                      key={p}
                      variant={p === "gestor" ? "teal" : "outline"}
                      size="sm"
                      disabled={pending || bloqueado}
                      onClick={() =>
                        agir(
                          () => liberarAcesso(u.id, p),
                          `${u.nome} liberado como ${rotuloPapel(p)}.`
                        )
                      }
                    >
                      {rotuloPapel(p)}
                    </Button>
                  ))}

                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={pending || bloqueado}
                    onClick={() => {
                      if (confirm(`Recusar o cadastro de ${u.nome}?`)) {
                        agir(
                          () => recusarCadastro(u.id),
                          "Cadastro recusado."
                        );
                      }
                    }}
                    className="ml-auto text-coral hover:bg-coral/10"
                  >
                    <Ban className="size-4" /> Recusar
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Filtros */}
      <div className="mt-4 rounded-lg border border-border bg-white p-4 shadow-soft">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-cinza-suave" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome, e-mail ou clínica"
              className="h-10 pl-9"
              aria-label="Buscar usuário"
            />
          </div>

          <Select
            value={filtroPapel}
            onChange={(e) => setFiltroPapel(e.target.value as Role | "")}
            className="h-10 w-auto min-w-[170px]"
            aria-label="Filtrar por papel"
          >
            <option value="">Todos os papéis</option>
            {(["super_admin", "gestor", "secretaria", "medico"] as Role[]).map((p) => (
              <option key={p} value={p}>
                {rotuloPapel(p)}
              </option>
            ))}
          </Select>

          {ehSuperAdmin && clinicas.length > 1 && (
            <Select
              value={filtroClinica}
              onChange={(e) => setFiltroClinica(e.target.value)}
              className="h-10 w-auto min-w-[170px]"
              aria-label="Filtrar por clínica"
            >
              <option value="">Todas as clínicas</option>
              {clinicas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </Select>
          )}

          <Button
            variant="primary"
            size="sm"
            disabled={bloqueado}
            onClick={() => setCriando(true)}
          >
            <UserPlus className="size-4" /> Novo usuário
          </Button>
        </div>
      </div>

      {erro && (
        <p className="mt-4 rounded-md bg-coral/10 px-4 py-2.5 text-sm text-coral">{erro}</p>
      )}
      {aviso && (
        <p className="mt-4 flex items-center gap-2 rounded-md bg-sucesso/10 px-4 py-2.5 text-sm text-sucesso">
          <CheckCircle2 className="size-4" /> {aviso}
        </p>
      )}

      {/* Lista */}
      <div className="mt-5 overflow-hidden rounded-lg border border-border bg-white shadow-soft">
        <div className="border-b border-border px-5 py-3">
          <h2 className="text-sm font-semibold text-azul-medico">
            {lista.length} usuário{lista.length === 1 ? "" : "s"}
          </h2>
        </div>

        {lista.length === 0 ? (
          <p className="px-6 py-16 text-center text-cinza-suave">
            Nenhum usuário com esses filtros.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {lista.map((u) => {
              const souEu = u.id === usuarioId;
              // Gestor não mexe em super admin; ninguém mexe em si mesmo
              const protegido =
                souEu || (!ehSuperAdmin && u.role === "super_admin");

              return (
                <li key={u.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-start gap-3">
                    <span
                      className={cn(
                        "grid size-10 shrink-0 place-items-center rounded-full text-sm font-semibold text-white",
                        u.ativo ? "bg-azul-medico" : "bg-cinza-suave/60"
                      )}
                    >
                      {(u.nome ?? "?").charAt(0).toUpperCase()}
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2">
                        <span className="truncate font-medium text-cinza-texto">
                          {u.nome ?? "Sem nome"}
                        </span>
                        {souEu && (
                          <span className="rounded-full bg-verde-menta px-2 py-0.5 text-[10px] font-semibold text-azul-medico">
                            você
                          </span>
                        )}
                        {!u.ativo && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-coral/12 px-2 py-0.5 text-[10px] font-semibold text-coral">
                            <Ban className="size-2.5" /> acesso cortado
                          </span>
                        )}
                        {u.email && !u.email_confirmado && (
                          <span className="rounded-full bg-alerta/12 px-2 py-0.5 text-[10px] font-semibold text-alerta">
                            e-mail não confirmado
                          </span>
                        )}
                      </p>

                      <p className="mt-0.5 truncate text-xs text-cinza-suave">
                        {u.email ?? "e-mail indisponível"}
                        {u.organizacao_nome && ` · ${u.organizacao_nome}`}
                      </p>

                      <p className="mt-0.5 text-xs text-cinza-suave/80">
                        {u.ultimo_acesso
                          ? `Último acesso ${tempoRelativo(u.ultimo_acesso)}`
                          : adminDisponivel
                            ? "Nunca entrou"
                            : "Último acesso indisponível"}
                      </p>
                    </div>

                    {/* Papel */}
                    {protegido ? (
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold",
                          corPapel[u.role]
                        )}
                      >
                        {rotuloPapel(u.role)}
                      </span>
                    ) : (
                      <Select
                        value={u.role}
                        disabled={pending || bloqueado}
                        onChange={(e) =>
                          agir(
                            () => definirPapel(u.id, e.target.value as Role),
                            "Papel atualizado."
                          )
                        }
                        className="h-9 w-auto min-w-[160px] text-xs"
                        aria-label={`Papel de ${u.nome}`}
                      >
                        {ehSuperAdmin && <option value="super_admin">Equipe Medi Marketing</option>}
                        <option value="gestor">Gestor(a) da clínica</option>
                        <option value="secretaria">Atendimento</option>
                        <option value="medico">Médico(a)</option>
                      </Select>
                    )}

                    {/* Clínica (só super admin transfere) */}
                    {ehSuperAdmin && !protegido && u.role !== "super_admin" && (
                      <Select
                        value={u.organization_id ?? ""}
                        disabled={pending || bloqueado}
                        onChange={(e) =>
                          agir(
                            () => transferirClinica(u.id, e.target.value),
                            "Usuário transferido."
                          )
                        }
                        className="h-9 w-auto min-w-[160px] text-xs"
                        aria-label={`Clínica de ${u.nome}`}
                      >
                        <option value="" disabled>
                          Sem clínica
                        </option>
                        {clinicas.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.nome}
                          </option>
                        ))}
                      </Select>
                    )}
                  </div>

                  {/* Ações */}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <Acao
                      icone={Pencil}
                      rotulo="Editar dados"
                      disabled={bloqueado}
                      onClick={() => setEditando(u)}
                    />
                    <Acao
                      icone={KeyRound}
                      rotulo="Definir senha"
                      disabled={protegido || bloqueado || pending}
                      onClick={() => setSenhaDe(u)}
                    />
                    <Acao
                      icone={Mail}
                      rotulo="Enviar redefinição"
                      disabled={bloqueado || pending || !u.email}
                      onClick={() =>
                        agir(
                          () => enviarRedefinicao(u.id),
                          `E-mail de redefinição enviado para ${u.email}.`
                        )
                      }
                    />
                    <Acao
                      icone={u.ativo ? Ban : UserCheck}
                      rotulo={u.ativo ? "Cortar acesso" : "Devolver acesso"}
                      perigo={u.ativo}
                      disabled={protegido || bloqueado || pending}
                      onClick={() =>
                        agir(
                          () => definirAcesso(u.id, !u.ativo),
                          u.ativo
                            ? `${u.nome} não consegue mais entrar.`
                            : `${u.nome} voltou a ter acesso.`
                        )
                      }
                    />
                    <Acao
                      icone={Trash2}
                      rotulo="Excluir"
                      perigo
                      disabled={protegido || bloqueado || pending}
                      onClick={() => {
                        if (
                          confirm(
                            `Excluir a conta de ${u.nome} em definitivo?\n\nPara desligamento, prefira "Cortar acesso": preserva o histórico do que essa pessoa registrou.`
                          )
                        ) {
                          agir(() => excluirUsuario(u.id), "Conta excluída.");
                        }
                      }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {criando && (
        <DialogNovoUsuario
          clinicas={clinicas}
          ehSuperAdmin={ehSuperAdmin}
          organizationId={organizationId}
          onFechar={() => setCriando(false)}
          onCriado={(msg) => {
            setCriando(false);
            setAviso(msg);
            router.refresh();
          }}
        />
      )}

      {editando && (
        <DialogEditar
          usuario={editando}
          onFechar={() => setEditando(null)}
          onSalvo={() => {
            setEditando(null);
            setAviso("Dados atualizados.");
            router.refresh();
          }}
        />
      )}

      {senhaDe && (
        <DialogSenha
          usuario={senhaDe}
          onFechar={() => setSenhaDe(null)}
          onSalvo={(msg) => {
            setSenhaDe(null);
            setAviso(msg);
          }}
        />
      )}
    </>
  );
}

function Acao({
  icone: Icone,
  rotulo,
  onClick,
  disabled,
  perigo,
}: {
  icone: typeof Pencil;
  rotulo: string;
  onClick: () => void;
  disabled?: boolean;
  perigo?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40",
        perigo
          ? "text-cinza-suave hover:border-coral hover:text-coral"
          : "text-cinza-suave hover:border-teal hover:text-teal"
      )}
    >
      <Icone className="size-3.5" />
      {rotulo}
    </button>
  );
}

/* --------------------------- Novo usuário --------------------------- */

function DialogNovoUsuario({
  clinicas,
  ehSuperAdmin,
  organizationId,
  onFechar,
  onCriado,
}: {
  clinicas: Clinica[];
  ehSuperAdmin: boolean;
  organizationId: string | null;
  onFechar: () => void;
  onCriado: (mensagem: string) => void;
}) {
  const [v, setV] = useState({
    nome: "",
    email: "",
    senha: senhaProvisoria(),
    papel: "secretaria" as Role,
    organizationId: organizationId ?? clinicas[0]?.id ?? "",
    especialidade: "",
    crm: "",
    telefone: "",
  });
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const precisaClinica = v.papel !== "super_admin";
  const ehMedico = v.papel === "medico";

  function enviar() {
    setErro(null);
    startTransition(async () => {
      const res = await criarUsuario({
        nome: v.nome,
        email: v.email,
        senha: v.senha,
        papel: v.papel,
        organizationId: precisaClinica ? v.organizationId : "",
        especialidade: v.especialidade,
        crm: v.crm,
        telefone: v.telefone,
      });
      if (!res.ok) {
        setErro(res.erro);
        return;
      }
      onCriado(
        `Acesso criado para ${v.nome}. Passe a senha provisória: ${v.senha}`
      );
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo usuário</DialogTitle>
          <DialogDescription>
            A conta já nasce confirmada e pronta para usar. Passe a senha
            provisória para a pessoa e peça que ela troque no Meu Perfil.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="nu-nome">Nome</Label>
            <Input
              id="nu-nome"
              value={v.nome}
              onChange={(e) => setV({ ...v, nome: e.target.value })}
              placeholder="Nome completo"
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="nu-email">E-mail (é o login)</Label>
            <Input
              id="nu-email"
              type="email"
              value={v.email}
              onChange={(e) => setV({ ...v, email: e.target.value })}
              placeholder="pessoa@clinica.com.br"
            />
          </div>

          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="nu-senha">Senha provisória</Label>
            <div className="flex gap-2">
              <Input
                id="nu-senha"
                value={v.senha}
                onChange={(e) => setV({ ...v, senha: e.target.value })}
                className="font-mono"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => setV({ ...v, senha: senhaProvisoria() })}
              >
                Gerar outra
              </Button>
            </div>
            <p className="text-xs text-cinza-suave">
              Formato fácil de ditar por telefone. Anote antes de salvar: por
              segurança, ela não fica guardada em lugar nenhum.
            </p>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="nu-papel">Papel</Label>
            <Select
              id="nu-papel"
              value={v.papel}
              onChange={(e) => setV({ ...v, papel: e.target.value as Role })}
            >
              {ehSuperAdmin && <option value="super_admin">Equipe Medi Marketing</option>}
              <option value="gestor">Gestor(a) da clínica</option>
              <option value="secretaria">Atendimento</option>
              <option value="medico">Médico(a)</option>
            </Select>
            <p className="text-xs text-cinza-suave">{resumoPapel[v.papel]}</p>
          </div>

          {precisaClinica && (
            <div className="grid gap-1.5">
              <Label htmlFor="nu-clinica">Clínica</Label>
              <Select
                id="nu-clinica"
                value={v.organizationId}
                disabled={!ehSuperAdmin}
                onChange={(e) => setV({ ...v, organizationId: e.target.value })}
              >
                {clinicas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </Select>
            </div>
          )}

          <div className="grid gap-1.5">
            <Label htmlFor="nu-telefone">Telefone (opcional)</Label>
            <Input
              id="nu-telefone"
              value={v.telefone}
              onChange={(e) => setV({ ...v, telefone: e.target.value })}
              placeholder="(11) 99999-9999"
            />
          </div>

          {ehMedico && (
            <>
              <div className="grid gap-1.5">
                <Label htmlFor="nu-esp">Especialidade</Label>
                <Input
                  id="nu-esp"
                  value={v.especialidade}
                  onChange={(e) => setV({ ...v, especialidade: e.target.value })}
                  placeholder="Dermatologia"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="nu-crm">CRM</Label>
                <Input
                  id="nu-crm"
                  value={v.crm}
                  onChange={(e) => setV({ ...v, crm: e.target.value })}
                  placeholder="CRM/SP 000000"
                />
              </div>
            </>
          )}
        </div>

        {erro && (
          <p className="rounded-md bg-coral/10 px-3 py-2 text-sm text-coral">{erro}</p>
        )}

        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onFechar}>
            Cancelar
          </Button>
          <Button variant="marca" onClick={enviar} disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            <Plus className="size-4" /> Criar acesso
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------------------- Editar dados ---------------------------- */

function DialogEditar({
  usuario,
  onFechar,
  onSalvo,
}: {
  usuario: UsuarioGerenciavel;
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const [v, setV] = useState({
    nome: usuario.nome ?? "",
    especialidade: usuario.especialidade ?? "",
    crm: usuario.crm ?? "",
    telefone: usuario.telefone ?? "",
  });
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function enviar() {
    setErro(null);
    startTransition(async () => {
      const res = await atualizarUsuario({ id: usuario.id, ...v });
      if (!res.ok) {
        setErro(res.erro);
        return;
      }
      onSalvo();
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar dados</DialogTitle>
          <DialogDescription>
            {usuario.email ?? "Conta sem e-mail"} — o e-mail de login não muda
            por aqui.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="ed-nome">Nome</Label>
            <Input
              id="ed-nome"
              value={v.nome}
              onChange={(e) => setV({ ...v, nome: e.target.value })}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ed-esp">Especialidade</Label>
            <Input
              id="ed-esp"
              value={v.especialidade}
              onChange={(e) => setV({ ...v, especialidade: e.target.value })}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ed-crm">CRM</Label>
            <Input
              id="ed-crm"
              value={v.crm}
              onChange={(e) => setV({ ...v, crm: e.target.value })}
            />
          </div>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="ed-tel">Telefone</Label>
            <Input
              id="ed-tel"
              value={v.telefone}
              onChange={(e) => setV({ ...v, telefone: e.target.value })}
            />
          </div>
        </div>

        {erro && (
          <p className="rounded-md bg-coral/10 px-3 py-2 text-sm text-coral">{erro}</p>
        )}

        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onFechar}>
            Cancelar
          </Button>
          <Button variant="marca" onClick={enviar} disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            Salvar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------------------- Definir senha ---------------------------- */

function DialogSenha({
  usuario,
  onFechar,
  onSalvo,
}: {
  usuario: UsuarioGerenciavel;
  onFechar: () => void;
  onSalvo: (mensagem: string) => void;
}) {
  const [senha, setSenha] = useState(senhaProvisoria());
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function enviar() {
    setErro(null);
    startTransition(async () => {
      const res = await definirSenhaDe({ id: usuario.id, senha });
      if (!res.ok) {
        setErro(res.erro);
        return;
      }
      onSalvo(`Senha de ${usuario.nome} definida: ${senha}`);
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Definir senha</DialogTitle>
          <DialogDescription>
            Para {usuario.nome}. Use quando a pessoa precisa entrar hoje e não
            dá para esperar o e-mail de redefinição.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-1.5">
          <Label htmlFor="ds-senha">Nova senha</Label>
          <div className="flex gap-2">
            <Input
              id="ds-senha"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="font-mono"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => setSenha(senhaProvisoria())}
            >
              Gerar
            </Button>
          </div>
        </div>

        <p className="flex items-start gap-2 rounded-md border border-dashed border-border bg-branco-clinico px-3 py-2.5 text-xs text-cinza-suave">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-teal" />
          Anote antes de confirmar: a senha aparece uma vez e não fica salva.
          Peça que a pessoa troque no Meu Perfil assim que entrar.
        </p>

        {erro && (
          <p className="rounded-md bg-coral/10 px-3 py-2 text-sm text-coral">{erro}</p>
        )}

        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onFechar}>
            Cancelar
          </Button>
          <Button variant="marca" onClick={enviar} disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            Definir senha
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
