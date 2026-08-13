"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Pencil, Power } from "lucide-react";
import { ativarClinica, salvarNomeClinica } from "@/lib/actions/identidade";
import type { ConexaoDisponivel } from "@/lib/actions/configuracoes";
import { FormLogo } from "@/components/app/configuracoes/form-logo";
import { ConexaoWhatsApp } from "@/components/app/configuracoes/conexao-whatsapp";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Edição da marca de uma clínica pela equipe Medi Marketing.
 *
 * O super admin não pertence a clínica nenhuma, então Configurações
 * não serve para ele — pedia "escolha uma clínica" e parava aí. Na
 * prática isso deixava a carteira inteira sem quem corrigisse um nome
 * digitado errado no cadastro.
 *
 * Aqui ele edita direto da carteira, uma clínica por vez, sem precisar
 * entrar na conta de ninguém.
 */
export function EditarMarca({
  organizationId,
  nome,
  logoUrl,
  ativa,
  conexaoEscolhida,
  conexoes,
  mergeDisponivel,
  demo,
}: {
  organizationId: string;
  nome: string;
  logoUrl: string | null;
  ativa: boolean;
  conexaoEscolhida: number | null;
  conexoes: ConexaoDisponivel[];
  mergeDisponivel: boolean;
  demo: boolean;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [valor, setValor] = useState(nome);
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);
  const [pending, startTransition] = useTransition();
  const [mudandoStatus, setMudandoStatus] = useState(false);

  const mudou = valor.trim() !== nome.trim();

  function alternarStatus() {
    setErro(null);
    setMudandoStatus(true);
    startTransition(async () => {
      const res = await ativarClinica(organizationId, !ativa);
      setMudandoStatus(false);
      if (!res.ok) {
        setErro(res.erro);
        return;
      }
      router.refresh();
    });
  }

  function salvar() {
    setErro(null);
    setSalvo(false);
    startTransition(async () => {
      const res = await salvarNomeClinica({ organizationId, nome: valor });
      if (!res.ok) {
        setErro(res.erro);
        return;
      }
      setSalvo(true);
      router.refresh();
    });
  }

  return (
    <Dialog
      open={aberto}
      onOpenChange={(v) => {
        setAberto(v);
        if (!v) {
          setValor(nome);
          setErro(null);
          setSalvo(false);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={`Editar ${nome}`}>
          <Pencil className="size-4" />
          Editar
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Configurar clínica</DialogTitle>
        </DialogHeader>

        {/* Status primeiro: é o que decide se a clínica opera */}
        <div
          className={cn(
            "flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3",
            ativa
              ? "border-teal/25 bg-verde-menta"
              : "border-dashed border-border bg-branco-clinico"
          )}
        >
          <div className="flex items-start gap-2.5">
            <Power
              className={cn(
                "mt-0.5 size-4 shrink-0",
                ativa ? "text-teal" : "text-cinza-suave"
              )}
            />
            <div>
              <p className="text-sm font-semibold text-azul-medico">
                {ativa ? "Clínica ativa" : "Cadastro ainda não liberado"}
              </p>
              <p className="text-xs text-cinza-suave">
                {ativa
                  ? "Entra na rotina diária de lembretes."
                  : "Enquanto inativa, nenhum lembrete de véspera é disparado."}
              </p>
            </div>
          </div>
          <Button
            variant={ativa ? "ghost" : "primary"}
            size="sm"
            disabled={demo || mudandoStatus}
            onClick={alternarStatus}
          >
            {mudandoStatus ? (
              <Loader2 className="size-4 animate-spin" />
            ) : ativa ? (
              "Desativar"
            ) : (
              "Ativar clínica"
            )}
          </Button>
        </div>

        <p className="mt-4 text-sm text-cinza-suave">
          O nome e a logo abaixo são o que o paciente vê no remetente do
          e-mail, na assinatura do WhatsApp e na página de confirmação.
        </p>

        <div className="mt-4 grid gap-2">
          <Label htmlFor={`nome-${organizationId}`}>Nome</Label>
          <Input
            id={`nome-${organizationId}`}
            value={valor}
            onChange={(e) => {
              setValor(e.target.value);
              setSalvo(false);
            }}
            disabled={demo}
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button onClick={salvar} disabled={demo || pending || !mudou}>
            {pending ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Salvando…
              </>
            ) : (
              "Salvar nome"
            )}
          </Button>
          {salvo && !mudou && (
            <span className="inline-flex items-center gap-1.5 text-sm text-teal">
              <CheckCircle2 className="size-4" /> Nome atualizado
            </span>
          )}
          {erro && <span className="text-sm text-vermelho-alerta">{erro}</span>}
        </div>

        <div className="mt-5 border-t border-border pt-5">
          <FormLogo
            organizationId={organizationId}
            nome={valor || nome}
            logoUrl={logoUrl}
            demo={demo}
          />
        </div>

        <div className="mt-5 border-t border-border pt-5">
          <ConexaoWhatsApp
            organizationId={organizationId}
            conexoes={conexoes}
            disponivel={mergeDisponivel}
            escolhida={conexaoEscolhida}
            demo={demo}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
