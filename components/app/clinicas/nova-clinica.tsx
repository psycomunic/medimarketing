"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Loader2, Plus } from "lucide-react";
import { criarClinica, type NovaClinicaInput } from "@/lib/actions/clinicas";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { CopiarLink } from "@/components/app/formularios/copiar-link";

const VAZIO = {
  nome: "",
  especialidade: "",
  cidade: "",
  telefone: "",
  email: "",
  responsavel: "",
  plano: "performance" as NovaClinicaInput["plano"],
  liberarDiagnostico: true,
  criarAcesso: false,
  acessoNome: "",
  acessoEmail: "",
  acessoSenha: "",
  acessoPapel: "gestor" as "gestor" | "medico",
  acessoConvite: true,
};

type Resultado = { nome: string; link: string | null; avisos: string[] };

/**
 * Cadastro manual de clínica pela equipe.
 *
 * Um formulário só para o primeiro dia do cliente: a clínica, o acesso
 * de quem responde por ela e o link do diagnóstico, que já sai pronto
 * para mandar no WhatsApp.
 */
export function NovaClinica({ demo }: { demo: boolean }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [v, setV] = useState(VAZIO);
  const [erro, setErro] = useState<string | null>(null);
  const [feito, setFeito] = useState<Resultado | null>(null);
  const [pending, startTransition] = useTransition();

  function campo<K extends keyof typeof VAZIO>(k: K, valor: (typeof VAZIO)[K]) {
    setV((atual) => ({ ...atual, [k]: valor }));
  }

  function fechar(abrir: boolean) {
    setAberto(abrir);
    if (!abrir) {
      setV(VAZIO);
      setErro(null);
      setFeito(null);
    }
  }

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    startTransition(async () => {
      const res = await criarClinica({
        nome: v.nome,
        especialidade: v.especialidade,
        cidade: v.cidade,
        telefone: v.telefone,
        email: v.email,
        responsavel: v.responsavel,
        plano: v.plano,
        liberarDiagnostico: v.liberarDiagnostico,
        acesso: v.criarAcesso
          ? {
              nome: v.acessoNome || v.responsavel,
              email: v.acessoEmail,
              senha: v.acessoSenha,
              papel: v.acessoPapel,
              enviarConvite: v.acessoConvite,
            }
          : null,
      });
      if (!res.ok) {
        setErro(res.erro);
        return;
      }
      setFeito({ nome: v.nome, link: res.linkDiagnostico, avisos: res.avisos });
      router.refresh();
    });
  }

  return (
    <Dialog open={aberto} onOpenChange={fechar}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" disabled={demo}>
          <Plus /> Nova clínica
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        {feito ? (
          <div className="grid gap-4">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="size-5 text-teal" /> {feito.nome} cadastrada
              </DialogTitle>
              <DialogDescription>
                A clínica já aparece na carteira, ativa.
              </DialogDescription>
            </DialogHeader>
            {feito.avisos.map((a) => (
              <p key={a} className="flex gap-2 rounded-md bg-alerta/10 p-3 text-sm text-cinza-texto">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-alerta" /> {a}
              </p>
            ))}
            {feito.link && (
              <div>
                <p className="mb-2 text-sm font-semibold text-azul-medico">Link do diagnóstico</p>
                <CopiarLink url={feito.link} clinica={feito.nome} />
              </div>
            )}
            <Button type="button" variant="ghost" onClick={() => fechar(false)} className="justify-self-end">
              Fechar
            </Button>
          </div>
        ) : (
          <form onSubmit={salvar} className="grid gap-4">
            <DialogHeader>
              <DialogTitle>Nova clínica</DialogTitle>
              <DialogDescription>
                Para o cliente que fechou com a equipe. Entra ativa na carteira.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-1.5">
              <Label htmlFor="nc-nome">Nome da clínica</Label>
              <Input id="nc-nome" value={v.nome} onChange={(e) => campo("nome", e.target.value)} placeholder="Instituto Correr" required />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="nc-esp">Especialidade</Label>
                <Input id="nc-esp" value={v.especialidade} onChange={(e) => campo("especialidade", e.target.value)} placeholder="Quiropraxia" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="nc-cidade">Cidade</Label>
                <Input id="nc-cidade" value={v.cidade} onChange={(e) => campo("cidade", e.target.value)} placeholder="Curitiba, PR" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="nc-resp">Responsável</Label>
                <Input id="nc-resp" value={v.responsavel} onChange={(e) => campo("responsavel", e.target.value)} placeholder="Nome do dono ou gestor" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="nc-tel">Telefone</Label>
                <Input id="nc-tel" value={v.telefone} onChange={(e) => campo("telefone", e.target.value)} inputMode="tel" placeholder="(41) 99999-0000" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="nc-email">E-mail da clínica</Label>
                <Input id="nc-email" type="email" value={v.email} onChange={(e) => campo("email", e.target.value)} placeholder="contato@clinica.com.br" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="nc-plano">Plano</Label>
                <Select id="nc-plano" value={v.plano} onChange={(e) => campo("plano", e.target.value as NovaClinicaInput["plano"])}>
                  <option value="essencial">Essencial</option>
                  <option value="performance">Performance</option>
                  <option value="full">Full / Parceria</option>
                </Select>
              </div>
            </div>

            <label className="flex items-start gap-3 rounded-lg border border-border p-3 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 size-4 accent-teal"
                checked={v.liberarDiagnostico}
                onChange={(e) => campo("liberarDiagnostico", e.target.checked)}
              />
              <span>
                <span className="font-semibold text-azul-medico">Liberar o diagnóstico inicial</span>
                <span className="block text-cinza-suave">Gera o link para a clínica preencher pelo celular.</span>
              </span>
            </label>

            <div className="rounded-lg border border-border p-3">
              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 accent-teal"
                  checked={v.criarAcesso}
                  onChange={(e) => campo("criarAcesso", e.target.checked)}
                />
                <span>
                  <span className="font-semibold text-azul-medico">Criar acesso ao painel</span>
                  <span className="block text-cinza-suave">Login de quem responde pela clínica, com senha provisória.</span>
                </span>
              </label>
              {v.criarAcesso && (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-1.5">
                    <Label htmlFor="nc-a-nome">Nome</Label>
                    <Input id="nc-a-nome" value={v.acessoNome} onChange={(e) => campo("acessoNome", e.target.value)} placeholder={v.responsavel || "Nome da pessoa"} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="nc-a-papel">Papel</Label>
                    <Select id="nc-a-papel" value={v.acessoPapel} onChange={(e) => campo("acessoPapel", e.target.value as "gestor" | "medico")}>
                      <option value="gestor">Gestor(a) da clínica</option>
                      <option value="medico">Médico(a) / profissional</option>
                    </Select>
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="nc-a-email">E-mail de login</Label>
                    <Input id="nc-a-email" type="email" value={v.acessoEmail} onChange={(e) => campo("acessoEmail", e.target.value)} required />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="nc-a-senha">Senha provisória</Label>
                    <Input id="nc-a-senha" type="text" value={v.acessoSenha} onChange={(e) => campo("acessoSenha", e.target.value)} minLength={8} required placeholder="Mínimo 8 caracteres" />
                  </div>
                  <label className="flex items-start gap-2.5 rounded-md border border-border bg-white px-3 py-2.5 text-sm sm:col-span-2">
            <input
              type="checkbox"
              checked={v.acessoConvite}
              onChange={(e) => campo("acessoConvite", e.target.checked)}
              className="mt-0.5 size-4 accent-teal"
            />
            <span className="text-cinza-texto">
              Enviar convite por e-mail
              <span className="mt-0.5 block text-xs text-cinza-suave">
                Chega um link para a pessoa criar a própria senha. A provisória continua valendo.
              </span>
            </span>
          </label>
                </div>
              )}
            </div>

            {erro && <p className="text-sm text-coral">{erro}</p>}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => fechar(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={pending || !v.nome.trim()}>
                {pending && <Loader2 className="animate-spin" />}
                Cadastrar clínica
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
