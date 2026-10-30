"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, RefreshCw, TriangleAlert } from "lucide-react";
import { sincronizarContaAgora, vincularContaAnuncio } from "@/lib/actions/midia";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type LinhaConta = {
  plataforma: "meta" | "google";
  contaId: string;
  nome: string;
  bm: string | null;
  /** Conta ativa no Meta (account_status 1). */
  ativaNaPlataforma: boolean;
  /** Ainda aparece para o usuário do sistema. */
  acessivel: boolean;
  organizationId: string | null;
  ultimaSincronizacao: string | null;
  ultimoErro: string | null;
};

const quando = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

export function ContasAnuncio({ contas, clinicas, demo }: { contas: LinhaConta[]; clinicas: { id: string; nome: string }[]; demo: boolean }) {
  if (!contas.length) return <p className="px-5 py-8 text-center text-sm text-cinza-suave">Nenhuma conta de anúncio visível para o usuário do sistema.</p>;
  return (
    <ul className="divide-y divide-border">
      {contas.map((c) => (
        <LinhaContaAnuncio key={`${c.plataforma}-${c.contaId}`} c={c} clinicas={clinicas} demo={demo} />
      ))}
    </ul>
  );
}

function LinhaContaAnuncio({ c, clinicas, demo }: { c: LinhaConta; clinicas: { id: string; nome: string }[]; demo: boolean }) {
  const router = useRouter();
  const [clinica, setClinica] = useState(c.organizationId ?? "");
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [salvando, startSalvar] = useTransition();
  const [sincronizando, startSinc] = useTransition();

  function ligar(id: string) {
    setClinica(id);
    setMsg(null);
    startSalvar(async () => {
      const r = await vincularContaAnuncio({ plataforma: c.plataforma, contaId: c.contaId, nome: c.nome, organizationId: id || null });
      if (!r.ok) return setMsg({ ok: false, texto: r.erro });
      setMsg({ ok: true, texto: id ? "Ligada. Sincronize para trazer os 90 dias." : "Desligada da clínica." });
      router.refresh();
    });
  }

  function sincronizar() {
    setMsg(null);
    startSinc(async () => {
      const r = await sincronizarContaAgora(c.plataforma, c.contaId);
      setMsg(r.ok ? { ok: true, texto: `${r.linhas} linhas (campanha × dia) trazidas.` } : { ok: false, texto: r.erro });
      router.refresh();
    });
  }

  return (
    <li className="grid gap-3 px-5 py-4 lg:grid-cols-[minmax(0,1fr)_16rem_auto] lg:items-center">
      <div className="min-w-0">
        <p className="truncate font-medium text-cinza-texto">{c.nome}</p>
        <p className="text-xs text-cinza-suave">
          {[c.contaId, c.bm, !c.ativaNaPlataforma ? "inativa no Meta" : null, !c.acessivel ? "sem acesso do usuário do sistema" : null].filter(Boolean).join(" · ")}
        </p>
        <p className={cn("mt-0.5 text-xs", c.ultimoErro ? "text-coral" : "text-cinza-suave")}>
          {c.ultimoErro
            ? c.ultimoErro
            : c.ultimaSincronizacao
              ? `Atualizada em ${quando(c.ultimaSincronizacao)} · sozinha a cada 6 horas`
              : c.organizationId
                ? "Ainda não sincronizada"
                : "Não ligada a nenhuma clínica"}
        </p>
      </div>
      <select
        value={clinica}
        disabled={salvando || demo}
        onChange={(e) => ligar(e.target.value)}
        aria-label={`Clínica dona da conta ${c.nome}`}
        className={cn(
          "h-10 w-full rounded-lg border bg-white px-3 text-sm focus:border-teal focus:outline-none",
          clinica ? "border-teal/50 text-azul-medico" : "border-border text-cinza-suave"
        )}
      >
        <option value="">Nenhuma clínica</option>
        {clinicas.map((x) => (
          <option key={x.id} value={x.id}>
            {x.nome}
          </option>
        ))}
      </select>
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" disabled={!clinica || sincronizando || demo} onClick={sincronizar}>
          {sincronizando ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw />} Sincronizar agora
        </Button>
      </div>
      {msg && (
        <p className={cn("flex items-center gap-1.5 text-xs lg:col-span-3", msg.ok ? "text-[#15803D]" : "text-coral")}>
          {msg.ok ? <CheckCircle2 className="size-3.5" /> : <TriangleAlert className="size-3.5" />} {msg.texto}
        </p>
      )}
    </li>
  );
}
