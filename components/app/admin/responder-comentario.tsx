"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { comentar } from "@/lib/actions/academy";

/** Caixa de resposta usada na fila de dúvidas do painel administrativo. */
export function ResponderComentario({
  lessonId,
  parentId,
}: {
  lessonId: string;
  parentId: string;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);
  const [pending, startTransition] = useTransition();

  function enviar() {
    setErro(null);
    startTransition(async () => {
      const res = await comentar({ lessonId, conteudo: texto, parentId });
      if (!res.ok) {
        setErro(res.erro);
        return;
      }
      setTexto("");
      setEnviado(true);
      setAberto(false);
      router.refresh();
    });
  }

  if (enviado) {
    return (
      <p className="mt-3 flex items-center gap-2 text-sm text-sucesso">
        <CheckCircle2 className="size-4" /> Resposta enviada.
      </p>
    );
  }

  if (!aberto) {
    return (
      <Button
        type="button"
        size="sm"
        variant="teal"
        className="mt-3"
        onClick={() => setAberto(true)}
      >
        Responder
      </Button>
    );
  }

  return (
    <div className="mt-3">
      <Textarea
        autoFocus
        rows={3}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Escreva a resposta. Ela aparece na aula, dentro do ambiente da clínica que perguntou."
      />
      {erro && <p className="mt-2 text-xs text-coral">{erro}</p>}
      <div className="mt-2 flex justify-end gap-2">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setAberto(false)}
        >
          Cancelar
        </Button>
        <Button
          type="button"
          size="sm"
          variant="teal"
          onClick={enviar}
          disabled={pending || texto.trim().length < 3}
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
          Enviar resposta
        </Button>
      </div>
    </div>
  );
}
