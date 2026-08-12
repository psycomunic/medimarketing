"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  CheckCircle2,
  Copy,
  Link2,
  Loader2,
  MessageCircle,
  Send,
  XCircle,
} from "lucide-react";
import type { StatusConfirmacao } from "@/lib/supabase/types";
import {
  criarParaConsulta,
  enviarAgora,
  marcarEnviado,
  reagendarConsulta,
} from "@/lib/actions/confirmacoes";
import { formatarData, formatarHora, linkWhatsApp } from "@/lib/lembretes";
import { tempoRelativo } from "@/lib/rotulos";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** O que a ficha da consulta precisa saber sobre a confirmação. */
export type ConfirmacaoDaConsulta = {
  id: string;
  token: string;
  status: StatusConfirmacao;
  agendadoPara: string;
  enviadoEm: string | null;
  respondidoEm: string | null;
  canal: string | null;
  observacao: string | null;
  /** Texto do lembrete, montado no servidor. */
  mensagem: string;
  /** Aviso do novo horário, para usar logo depois de remarcar. */
  mensagemReagendada: string;
  url: string;
};

const rotulo: Record<StatusConfirmacao, { texto: string; cor: string; icone: typeof CheckCircle2 }> = {
  pendente: { texto: "Aguardando envio", cor: "text-cinza-suave", icone: CalendarClock },
  enviado: { texto: "Enviado, sem resposta", cor: "text-alerta", icone: Send },
  confirmado: { texto: "Presença confirmada pelo paciente", cor: "text-sucesso", icone: CheckCircle2 },
  reagendar: { texto: "Paciente pediu para reagendar", cor: "text-azul-medico", icone: CalendarClock },
  recusado: { texto: "Paciente avisou que não vem", cor: "text-coral", icone: XCircle },
  cancelado: { texto: "Confirmação cancelada", cor: "text-cinza-suave", icone: XCircle },
};

/**
 * Bloco de confirmação dentro da ficha da consulta.
 *
 * Fica aqui porque é onde a recepção já está quando pensa no assunto:
 * abriu o horário do paciente, quer saber se ele confirmou e, se ainda
 * não saiu nada, mandar na hora.
 */
export function BlocoConfirmacao({
  consultaId,
  confirmacao,
  telefone,
  envioAutomatico,
  semClinica,
  demo,
}: {
  consultaId: string;
  confirmacao: ConfirmacaoDaConsulta | null;
  telefone: string | null;
  envioAutomatico: boolean;
  /** Consulta órfã: sem clínica, nenhum lembrete é gerado para ela. */
  semClinica: boolean;
  demo: boolean;
}) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [novoHorario, setNovoHorario] = useState("");
  const [pending, startTransition] = useTransition();

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

  async function copiar(texto: string) {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setErro("Não foi possível copiar.");
    }
  }

  const titulo = (
    <div className="flex items-center gap-2">
      <CalendarClock className="size-4 text-teal" />
      <h3 className="font-heading text-sm font-semibold text-azul-medico">
        Confirmação do paciente
      </h3>
    </div>
  );

  if (semClinica) {
    return (
      <div className="border-t border-border pt-4">
        {titulo}
        <p className="mt-2 rounded-md border border-dashed border-alerta/40 bg-alerta/5 px-3 py-2.5 text-xs text-cinza-suave">
          Esta consulta não está vinculada a nenhuma clínica, então o
          lembrete não é gerado para ela. Isso acontecia em consultas
          criadas antes da correção. Refaça o agendamento escolhendo a
          clínica e o profissional.
        </p>
      </div>
    );
  }

  if (!confirmacao) {
    return (
      <div className="border-t border-border pt-4">
        {titulo}
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-cinza-suave">
            Ainda não há pedido de confirmação para esta consulta.
          </p>
          <Button
            variant="outline"
            size="sm"
            disabled={pending || demo}
            onClick={() => agir(() => criarParaConsulta(consultaId))}
          >
            {pending && <Loader2 className="size-4 animate-spin" />}
            Gerar link de confirmação
          </Button>
        </div>
        {erro && <p className="mt-2 text-xs text-coral">{erro}</p>}
      </div>
    );
  }

  const r = rotulo[confirmacao.status];
  const Icone = r.icone;
  const whats = telefone ? linkWhatsApp(telefone, confirmacao.mensagem) : null;
  const aguardando = confirmacao.status === "pendente";
  const pediuReagendar = confirmacao.status === "reagendar";

  // Quanto tempo o paciente está esperando retorno. Vira urgência real
  // depois de duas horas: a chance de salvar o horário cai rápido.
  const esperandoHa = confirmacao.respondidoEm
    ? (Date.now() - new Date(confirmacao.respondidoEm).getTime()) / 3600_000
    : 0;
  const urgente = pediuReagendar && esperandoHa >= 2;

  return (
    <div className="border-t border-border pt-4">
      {titulo}

      <div
        className={cn(
          "mt-2 rounded-lg border p-3",
          pediuReagendar
            ? urgente
              ? "border-coral/50 bg-coral/5"
              : "border-alerta/50 bg-alerta/5"
            : "border-border bg-branco-clinico"
        )}
      >
        <p className={cn("flex items-center gap-2 text-sm font-semibold", r.cor)}>
          <Icone className="size-4" />
          {r.texto}
        </p>

        {pediuReagendar && (
          <p
            className={cn(
              "mt-1 text-xs font-medium",
              urgente ? "text-coral" : "text-alerta"
            )}
          >
            {urgente
              ? `Esperando retorno há ${Math.round(esperandoHa)} h — ligue agora para não perder o horário.`
              : "Entre em contato para combinar o novo horário. A vaga segue reservada."}
          </p>
        )}

        <p className="mt-1 text-xs text-cinza-suave">
          {aguardando
            ? `Envio programado para ${formatarData(confirmacao.agendadoPara)} às ${formatarHora(confirmacao.agendadoPara)}`
            : confirmacao.respondidoEm
              ? `Respondeu ${tempoRelativo(confirmacao.respondidoEm)}`
              : confirmacao.enviadoEm
                ? `Enviado ${tempoRelativo(confirmacao.enviadoEm)}${confirmacao.canal === "manual" ? " (manual)" : ""}`
                : null}
        </p>

        {confirmacao.observacao && (
          <p className="mt-1.5 text-xs text-cinza-suave">{confirmacao.observacao}</p>
        )}

        {/* Reagendar sem sair da ficha: é o que resolve o pedido */}
        {pediuReagendar && (
          <div className="mt-3 rounded-md border border-border bg-white p-3">
            <p className="text-xs font-semibold text-azul-medico">
              Novo horário
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input
                type="datetime-local"
                value={novoHorario}
                onChange={(e) => setNovoHorario(e.target.value)}
                className="h-10 flex-1 rounded-md border border-input bg-white px-3 text-sm text-cinza-texto shadow-sm focus-visible:border-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              />
              <Button
                variant="marca"
                size="sm"
                disabled={pending || demo || !novoHorario}
                onClick={() =>
                  agir(() => reagendarConsulta(confirmacao.id, novoHorario))
                }
              >
                {pending && <Loader2 className="size-4 animate-spin" />}
                Reagendar
              </Button>
            </div>
            <p className="mt-1.5 text-xs text-cinza-suave">
              Muda o horário da consulta e reprograma o lembrete. O paciente
              pode reabrir o mesmo link para ver a data nova.
            </p>
          </div>
        )}

        {/* Depois de remarcar, avisar é o passo que fecha o ciclo */}
        {telefone && confirmacao.status === "pendente" && confirmacao.observacao?.includes("Reagendada") && (
          <a
            href={linkWhatsApp(telefone, confirmacao.mensagemReagendada)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-2 rounded-md bg-sucesso/12 px-3 py-2 text-xs font-semibold text-sucesso transition-colors hover:bg-sucesso/20"
          >
            <MessageCircle className="size-4" />
            Avisar o paciente do novo horário
          </a>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {!telefone ? (
            <span className="text-xs text-coral">
              Sem telefone cadastrado — não dá para enviar.
            </span>
          ) : envioAutomatico ? (
            <Button
              variant="teal"
              size="sm"
              disabled={pending || demo}
              onClick={() => agir(() => enviarAgora(confirmacao.id))}
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
              {aguardando ? "Enviar agora" : "Reenviar"}
            </Button>
          ) : (
            whats && (
              <Button variant="teal" size="sm" asChild>
                <a href={whats} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="size-4" />
                  {aguardando ? "Enviar pelo WhatsApp" : "Reenviar pelo WhatsApp"}
                </a>
              </Button>
            )
          )}

          {aguardando && telefone && !envioAutomatico && (
            <Button
              variant="outline"
              size="sm"
              disabled={pending || demo}
              onClick={() => agir(() => marcarEnviado(confirmacao.id))}
            >
              <CheckCircle2 className="size-4" /> Já enviei
            </Button>
          )}

          <button
            type="button"
            onClick={() => copiar(confirmacao.url)}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-white px-2.5 py-1.5 text-xs font-medium text-cinza-suave transition-colors hover:border-teal hover:text-teal"
          >
            {copiado ? (
              <>
                <CheckCircle2 className="size-3.5 text-sucesso" /> Copiado
              </>
            ) : (
              <>
                <Copy className="size-3.5" /> Copiar link
              </>
            )}
          </button>

          <a
            href={confirmacao.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-white px-2.5 py-1.5 text-xs font-medium text-cinza-suave transition-colors hover:border-teal hover:text-teal"
            title="Abrir a página como o paciente vê"
          >
            <Link2 className="size-3.5" /> Ver como o paciente
          </a>
        </div>

        {erro && <p className="mt-2 text-xs text-coral">{erro}</p>}
      </div>
    </div>
  );
}
