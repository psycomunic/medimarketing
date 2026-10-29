"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, Loader2 } from "lucide-react";
import { cancelarDisparo } from "@/lib/actions/disparos";
import { Button } from "@/components/ui/button";

export function BotaoCancelarDisparo({ id }: { id: string }) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div className="grid justify-items-end gap-1">
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => {
          if (!confirm("Cancelar o disparo? Quem ainda não recebeu não recebe mais.")) return;
          startTransition(async () => {
            setErro(null);
            const r = await cancelarDisparo(id);
            if (!r.ok) setErro(r.erro);
            else router.refresh();
          });
        }}
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Ban className="size-4" />} Cancelar disparo
      </Button>
      {erro && <p className="text-xs text-coral">{erro}</p>}
    </div>
  );
}
