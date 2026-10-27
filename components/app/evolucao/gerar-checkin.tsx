"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, Loader2 } from "lucide-react";
import { gerarCheckin } from "@/lib/actions/checkin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CopiarLink } from "@/components/app/formularios/copiar-link";

/**
 * Check-in na hora, para um mês à escolha. A rotina diária já cria o do
 * mês que fechou; isto é para quem quer mandar antes, ou recuperar um
 * mês que ficou para trás.
 */
export function GerarCheckin({
  organizationId,
  clinica,
  mesPadrao,
  demo,
}: {
  organizationId: string;
  clinica: string;
  /** "YYYY-MM" */
  mesPadrao: string;
  demo: boolean;
}) {
  const router = useRouter();
  const [mes, setMes] = useState(mesPadrao);
  const [url, setUrl] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function gerar() {
    setAviso(null);
    setUrl(null);
    startTransition(async () => {
      const res = await gerarCheckin(organizationId, mes);
      if (!res.ok) {
        setAviso(res.erro);
        return;
      }
      setUrl(res.url);
      if (!res.criado) setAviso("Este mês já tinha check-in: o link é o mesmo.");
      router.refresh();
    });
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className="grid gap-1 text-xs font-medium text-cinza-suave">
          Mês
          <Input type="month" value={mes} onChange={(e) => setMes(e.target.value)} className="h-9 w-44" />
        </label>
        <Button type="button" size="sm" onClick={gerar} disabled={pending || demo || !mes}>
          {pending ? <Loader2 className="animate-spin" /> : <CalendarPlus />}
          Gerar check-in
        </Button>
      </div>
      {aviso && <p className="text-sm text-cinza-suave">{aviso}</p>}
      {url && <CopiarLink url={url} clinica={clinica} assunto="o check-in do mês" />}
    </div>
  );
}
