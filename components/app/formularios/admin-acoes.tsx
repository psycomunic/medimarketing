"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck, Loader2, RotateCcw } from "lucide-react";
import { adicionarNota, marcarRevisado, reabrirFormulario } from "@/lib/actions/formularios";
import type { StatusFormulario } from "@/lib/supabase/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function AcoesStatus({
  id,
  status,
  demo,
}: {
  id: string;
  status: StatusFormulario;
  demo: boolean;
}) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [acao, setAcao] = useState<"revisar" | "reabrir" | null>(null);

  function executar(qual: "revisar" | "reabrir") {
    if (
      qual === "reabrir" &&
      !window.confirm(
        "Reabrir o diagnóstico? A clínica volta a poder editar e precisará enviar de novo."
      )
    ) {
      return;
    }
    setErro(null);
    setAcao(qual);
    startTransition(async () => {
      const res = qual === "revisar" ? await marcarRevisado(id) : await reabrirFormulario(id);
      setAcao(null);
      if (!res.ok) setErro(res.erro);
      else router.refresh();
    });
  }

  return (
    <div className="grid gap-2">
      {status === "enviado" && (
        <Button type="button" variant="teal" onClick={() => executar("revisar")} disabled={pending || demo}>
          {acao === "revisar" ? <Loader2 className="animate-spin" /> : <CheckCheck />}
          Marcar como revisado
        </Button>
      )}
      {status !== "rascunho" && (
        <Button type="button" variant="outline" onClick={() => executar("reabrir")} disabled={pending || demo}>
          {acao === "reabrir" ? <Loader2 className="animate-spin" /> : <RotateCcw />}
          Reabrir para a clínica
        </Button>
      )}
      {status === "rascunho" && (
        <p className="text-sm text-cinza-suave">
          A clínica ainda está preenchendo. As respostas abaixo são o rascunho salvo até agora.
        </p>
      )}
      {erro && <p className="text-sm text-coral">{erro}</p>}
    </div>
  );
}

export function NovaNota({ id, demo }: { id: string; demo: boolean }) {
  const router = useRouter();
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function salvar() {
    setErro(null);
    startTransition(async () => {
      const res = await adicionarNota(id, texto);
      if (!res.ok) {
        setErro(res.erro);
        return;
      }
      setTexto("");
      router.refresh();
    });
  }

  return (
    <div className="grid gap-2">
      <Textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Observação para a equipe. A clínica não vê."
        aria-label="Nova nota interna"
        rows={3}
      />
      <Button
        type="button"
        size="sm"
        onClick={salvar}
        disabled={!texto.trim() || pending || demo}
        className="justify-self-start"
      >
        {pending && <Loader2 className="animate-spin" />}
        Adicionar nota
      </Button>
      {erro && <p className="text-sm text-coral">{erro}</p>}
    </div>
  );
}
