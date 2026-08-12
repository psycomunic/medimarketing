"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Pencil } from "lucide-react";
import { salvarNomeClinica } from "@/lib/actions/identidade";
import { FormLogo } from "@/components/app/configuracoes/form-logo";
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
  demo,
}: {
  organizationId: string;
  nome: string;
  logoUrl: string | null;
  demo: boolean;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [valor, setValor] = useState(nome);
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);
  const [pending, startTransition] = useTransition();

  const mudou = valor.trim() !== nome.trim();

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
          <DialogTitle>Marca da clínica</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-cinza-suave">
          É o que o paciente vê no remetente do e-mail, na assinatura do
          WhatsApp e na página de confirmação.
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
      </DialogContent>
    </Dialog>
  );
}
