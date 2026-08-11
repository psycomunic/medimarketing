"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { marcarAula } from "@/lib/actions/academy";

/** Alterna a conclusão da aula e atualiza o progresso da trilha. */
export function BotaoConcluir({
  lessonId,
  concluida,
}: {
  lessonId: string;
  concluida: boolean;
}) {
  const router = useRouter();
  const [feito, setFeito] = useState(concluida);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function alternar() {
    setErro(null);
    const novo = !feito;
    // Resposta otimista: a marcação é reversível e barata
    setFeito(novo);
    startTransition(async () => {
      const res = await marcarAula(lessonId, novo);
      if (!res.ok) {
        setFeito(!novo);
        setErro(res.erro);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div>
      <Button
        type="button"
        onClick={alternar}
        disabled={pending}
        variant={feito ? "teal" : "outline"}
        className="w-full sm:w-auto"
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : feito ? (
          <CheckCircle2 className="size-4" />
        ) : (
          <Circle className="size-4" />
        )}
        {feito ? "Aula concluída" : "Marcar como concluída"}
      </Button>
      {erro && <p className="mt-2 text-xs text-coral">{erro}</p>}
    </div>
  );
}
