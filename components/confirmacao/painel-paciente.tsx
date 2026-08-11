"use client";

import { useState, useTransition } from "react";
import {
  CalendarClock,
  CheckCircle2,
  Loader2,
  MessageCircle,
  XCircle,
} from "lucide-react";
import { responderConfirmacao, type RespostaPaciente } from "@/lib/actions/confirmar";
import type { StatusConfirmacao } from "@/lib/supabase/types";
import { linkWhatsApp } from "@/lib/lembretes";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Como cada resposta aparece depois de registrada. */
const recibo: Record<
  string,
  { icone: typeof CheckCircle2; titulo: string; texto: string; cor: string; fundo: string }
> = {
  confirmado: {
    icone: CheckCircle2,
    titulo: "Presença confirmada",
    texto:
      "Tudo certo! Sua presença foi confirmada. Recomendamos chegar com 15 minutos de antecedência.",
    cor: "text-sucesso",
    fundo: "border-sucesso/30 bg-sucesso/8",
  },
  reagendar: {
    icone: CalendarClock,
    titulo: "Pedido de reagendamento registrado",
    texto:
      "Recebemos seu pedido. A clínica vai entrar em contato para combinar um novo horário. Seu horário atual segue reservado até lá.",
    cor: "text-alerta",
    fundo: "border-alerta/30 bg-alerta/8",
  },
  recusado: {
    icone: XCircle,
    titulo: "Consulta cancelada",
    texto:
      "Avisamos a clínica que você não poderá comparecer. Se mudar de ideia, é só entrar em contato.",
    cor: "text-coral",
    fundo: "border-coral/30 bg-coral/8",
  },
};

export function PainelPaciente({
  token,
  statusInicial,
  telefoneClinica,
  clinica,
  paciente,
  encerrada,
}: {
  token: string;
  statusInicial: StatusConfirmacao;
  telefoneClinica: string | null;
  clinica: string;
  paciente: string;
  encerrada: boolean;
}) {
  const [status, setStatus] = useState<StatusConfirmacao>(statusInicial);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function responder(resposta: RespostaPaciente) {
    setErro(null);
    startTransition(async () => {
      const res = await responderConfirmacao(token, resposta);
      if (!res.ok) {
        setErro(res.erro);
        return;
      }
      setStatus(res.status);
    });
  }

  const duvidaWhats = telefoneClinica
    ? linkWhatsApp(
        telefoneClinica,
        `Olá! Sou ${paciente} e tenho uma dúvida sobre minha consulta.`
      )
    : null;

  const jaRespondeu = ["confirmado", "reagendar", "recusado"].includes(status);

  if (encerrada && !jaRespondeu) {
    return (
      <div className="rounded-lg border border-border bg-branco-clinico px-5 py-6 text-center">
        <p className="font-semibold text-azul-medico">Este link não está mais ativo</p>
        <p className="mt-1.5 text-sm text-cinza-suave">
          O horário desta consulta já passou ou ela foi cancelada. Se precisar
          de ajuda, fale com a {clinica}.
        </p>
        {duvidaWhats && (
          <a
            href={duvidaWhats}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-teal hover:underline"
          >
            <MessageCircle className="size-4" /> Falar com a clínica
          </a>
        )}
      </div>
    );
  }

  if (jaRespondeu) {
    const r = recibo[status];
    const Icone = r.icone;

    return (
      <div className={cn("rounded-lg border px-5 py-6", r.fundo)}>
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white">
            <Icone className={cn("size-5", r.cor)} />
          </span>
          <div>
            <p className={cn("font-heading font-semibold", r.cor)}>{r.titulo}</p>
            <p className="mt-1 text-sm text-cinza-suave">{r.texto}</p>
          </div>
        </div>

        {/* Confirmar por engano acontece: deixamos corrigir */}
        {status === "confirmado" && (
          <div className="mt-4 flex flex-wrap gap-2 border-t border-white/60 pt-4">
            <Button
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() => responder("reagendar")}
            >
              Preciso remarcar
            </Button>
            {duvidaWhats && (
              <Button variant="ghost" size="sm" asChild>
                <a href={duvidaWhats} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="size-4" /> Tirar uma dúvida
                </a>
              </Button>
            )}
          </div>
        )}

        {erro && <p className="mt-3 text-sm text-coral">{erro}</p>}
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm font-medium text-cinza-texto">
        Você confirma sua presença?
      </p>

      <div className="mt-3 space-y-2.5">
        <Button
          variant="teal"
          size="lg"
          className="w-full"
          disabled={pending}
          onClick={() => responder("confirmado")}
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <CheckCircle2 className="size-4" />
          )}
          Sim, confirmo minha presença
        </Button>

        <Button
          variant="outline"
          size="lg"
          className="w-full"
          disabled={pending}
          onClick={() => responder("reagendar")}
        >
          <CalendarClock className="size-4" /> Preciso reagendar
        </Button>

        {duvidaWhats && (
          <Button variant="ghost" size="lg" className="w-full" asChild>
            <a href={duvidaWhats} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="size-4" /> Tenho uma dúvida
            </a>
          </Button>
        )}

        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (
              confirm(
                "Avisar a clínica que você não poderá comparecer? A consulta será cancelada."
              )
            ) {
              responder("recusado");
            }
          }}
          className="w-full py-2 text-center text-sm text-cinza-suave underline-offset-4 transition-colors hover:text-coral hover:underline disabled:opacity-50"
        >
          Não vou poder comparecer
        </button>
      </div>

      {erro && (
        <p className="mt-3 rounded-md bg-coral/10 px-3 py-2 text-sm text-coral">
          {erro}
        </p>
      )}
    </div>
  );
}
