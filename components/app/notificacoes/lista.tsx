"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Ban,
  Bell,
  CalendarClock,
  CheckCheck,
  CheckCircle2,
  Clock,
  Loader2,
  MessageCircle,
  UserPlus,
  Users,
} from "lucide-react";
import type { NotificacaoComLeitura, TipoNotificacao } from "@/lib/supabase/types";
import { marcarLida, marcarTodasLidas } from "@/lib/actions/notificacoes";
import { tempoRelativo } from "@/lib/rotulos";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const icone: Record<TipoNotificacao, typeof Bell> = {
  reagendamento: CalendarClock,
  confirmacao: CheckCircle2,
  cancelamento: Ban,
  lembrete_atrasado: Clock,
  lead_novo: Users,
  mensagem_nova: MessageCircle,
  cadastro_pendente: UserPlus,
  sistema: Bell,
};

const corTipo: Record<TipoNotificacao, string> = {
  reagendamento: "bg-alerta/15 text-alerta",
  confirmacao: "bg-sucesso/15 text-sucesso",
  cancelamento: "bg-coral/15 text-coral",
  lembrete_atrasado: "bg-alerta/15 text-alerta",
  lead_novo: "bg-teal/15 text-teal",
  mensagem_nova: "bg-azul-medico/15 text-azul-medico",
  cadastro_pendente: "bg-teal/15 text-teal",
  sistema: "bg-verde-menta text-cinza-suave",
};

type Filtro = "nao_lidas" | "urgentes" | "todas";

export function ListaNotificacoes({
  notificacoes,
  demo,
}: {
  notificacoes: NotificacaoComLeitura[];
  demo: boolean;
}) {
  const router = useRouter();
  const [filtro, setFiltro] = useState<Filtro>("nao_lidas");
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const naoLidas = notificacoes.filter((n) => !n.lida);
  const urgentes = naoLidas.filter((n) => n.prioridade === "alta");

  const lista = useMemo(() => {
    if (filtro === "nao_lidas") return naoLidas;
    if (filtro === "urgentes") return urgentes;
    return notificacoes;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notificacoes, filtro]);

  function agir(fn: () => Promise<{ ok: boolean; erro?: string }>) {
    setErro(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        setErro(res.erro ?? "Não foi possível concluir.");
        return;
      }
      router.refresh();
    });
  }

  const abas: { id: Filtro; label: string; n: number }[] = [
    { id: "nao_lidas", label: "Não lidas", n: naoLidas.length },
    { id: "urgentes", label: "Urgentes", n: urgentes.length },
    { id: "todas", label: "Todas", n: notificacoes.length },
  ];

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-lg border border-border bg-white p-1">
          {abas.map((a) => (
            <button
              key={a.id}
              onClick={() => setFiltro(a.id)}
              className={cn(
                "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                filtro === a.id
                  ? "bg-azul-medico text-white"
                  : "text-cinza-suave hover:text-azul-medico"
              )}
            >
              {a.label}
              <span className="ml-1.5 opacity-70">{a.n}</span>
            </button>
          ))}
        </div>

        {naoLidas.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            disabled={pending || demo}
            onClick={() => agir(() => marcarTodasLidas())}
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <CheckCheck className="size-4" />
            )}
            Marcar todas como lidas
          </Button>
        )}
      </div>

      {erro && (
        <p className="mt-4 rounded-md bg-coral/10 px-4 py-2.5 text-sm text-coral">{erro}</p>
      )}
      {demo && (
        <p className="mt-4 rounded-md border border-dashed border-border bg-white px-4 py-2.5 text-xs text-cinza-suave">
          Modo demonstração: marcar como lida não é salvo.
        </p>
      )}

      <div className="mt-5 space-y-2">
        {lista.length === 0 && (
          <div className="rounded-lg border border-dashed border-border bg-white px-6 py-14 text-center">
            <CheckCircle2 className="mx-auto size-10 text-sucesso/60" />
            <p className="mt-3 font-semibold text-azul-medico">
              {filtro === "todas" ? "Nenhuma notificação" : "Tudo em dia"}
            </p>
            <p className="mt-1 text-sm text-cinza-suave">
              {filtro === "urgentes"
                ? "Nada urgente esperando você."
                : filtro === "nao_lidas"
                  ? "Você já viu tudo que chegou."
                  : "Os avisos aparecem aqui conforme as coisas acontecem."}
            </p>
          </div>
        )}

        {lista.map((n) => {
          const Icone = icone[n.tipo];
          const urgente = n.prioridade === "alta" && !n.lida;

          const conteudo = (
            <>
              <span
                className={cn(
                  "mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg",
                  corTipo[n.tipo]
                )}
              >
                <Icone className="size-4" />
              </span>

              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "font-semibold",
                      n.lida ? "text-cinza-texto" : "text-azul-medico"
                    )}
                  >
                    {n.titulo}
                  </span>
                  {urgente && (
                    <span className="rounded-full bg-coral px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                      urgente
                    </span>
                  )}
                  {!n.lida && !urgente && (
                    <span className="size-2 rounded-full bg-teal" aria-label="não lida" />
                  )}
                </span>

                {n.descricao && (
                  <span className="mt-0.5 block text-sm leading-snug text-cinza-suave">
                    {n.descricao}
                  </span>
                )}

                <span className="mt-1 block text-xs text-cinza-suave/80">
                  {tempoRelativo(n.created_at)}
                </span>
              </span>
            </>
          );

          return (
            <article
              key={n.id}
              className={cn(
                "rounded-lg border bg-white shadow-soft transition-colors",
                urgente ? "border-coral/40" : "border-border",
                n.lida && "opacity-70"
              )}
            >
              {n.href ? (
                <Link
                  href={n.href}
                  onClick={() => {
                    if (!n.lida && !demo) void marcarLida(n.id);
                  }}
                  className="flex gap-3 p-4 hover:bg-branco-clinico"
                >
                  {conteudo}
                </Link>
              ) : (
                <div className="flex gap-3 p-4">{conteudo}</div>
              )}

              {!n.lida && (
                <div className="flex justify-end border-t border-border px-4 py-2">
                  <button
                    type="button"
                    disabled={pending || demo}
                    onClick={() => agir(() => marcarLida(n.id))}
                    className="text-xs font-medium text-cinza-suave transition-colors hover:text-teal disabled:opacity-50"
                  >
                    Marcar como lida
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </>
  );
}
