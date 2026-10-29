"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Loader2 } from "lucide-react";
import { arquivarPaciente } from "@/lib/actions/pacientes";
import { Button } from "@/components/ui/button";

export function BotaoArquivar({ id, ativo }: { id: string; ativo: boolean }) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setErro(null);
            const r = await arquivarPaciente(id, !ativo);
            if (!r.ok) setErro(r.erro);
            else router.refresh();
          })
        }
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : ativo ? <Archive className="size-4" /> : <ArchiveRestore className="size-4" />}
        {ativo ? "Arquivar" : "Reativar"}
      </Button>
      {erro && <p className="w-full text-xs text-coral">{erro}</p>}
    </>
  );
}
