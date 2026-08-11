"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  CheckCircle2,
  Clock,
  Copy,
  Link2,
  Loader2,
  MessageCircle,
  Phone,
  Send,
  XCircle,
} from "lucide-react";
import type { ConfirmacaoComConsulta, StatusConfirmacao } from "@/lib/supabase/types";
import {
  enviarAgora,
  marcarEnviado,
  registrarResposta,
} from "@/lib/actions/confirmacoes";
import { diaDaSemana, formatarData, formatarHora, linkWhatsApp } from "@/lib/lembretes";
import { tempoRelativo } from "@/lib/rotulos";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const rotuloStatus: Record<StatusConfirmacao, string> = {
  pendente: "Aguardando envio",
  enviado: "Enviado, sem resposta",
  confirmado: "Presença confirmada",
  reagendar: "Pediu para reagendar",
  recusado: "Não vai comparecer",
  cancelado: "Consulta cancelada",
};

const corStatus: Record<StatusConfirmacao, string> = {
  pendente: "bg-cinza-suave/12 text-cinza-suave",
  enviado: "bg-alerta/12 text-alerta",
  confirmado: "bg-sucesso/12 text-sucesso",
  reagendar: "bg-azul-medico/12 text-azul-medico",
  recusado: "bg-coral/12 text-coral",
  cancelado: "bg-cinza-suave/12 text-cinza-suave",
};

type Filtro = StatusConfirmacao | "todos" | "acao";

export function FilaConfirmacoes({
  confirmacoes,
  mensagens,
  envioAutomatico,
  demo,
}: {
  confirmacoes: ConfirmacaoComConsulta[];
  /** Texto pronto por confirmação, montado no servidor. */
  mensagens: Record<string, string>;
  envioAutomatico: boolean;
  demo: boolean;
}) {
  const router = useRouter();
  const [filtro, setFiltro] = useState<Filtro>("acao");
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const agora = new Date().toISOString();

  const lista = useMemo(() => {
    if (filtro === "todos") return confirmacoes;
    // "Precisa de ação" junta o que a recepção resolve hoje: o que já
    // deveria ter saído e quem pediu para remarcar.
    if (filtro === "acao") {
      return confirmacoes.filter(
        (c) =>
          (c.status === "pendente" && c.agendado_para <= agora) ||
          c.status === "reagendar"
      );
    }
    return confirmacoes.filter((c) => c.status === filtro);
  }, [confirmacoes, filtro, agora]);

  function agir(fn: () => Promise<{ ok: boolean; erro?: string }>, sucesso?: string) {
    setErro(null);
    setAviso(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        setErro(res.erro ?? "Não foi possível concluir.");
        return;
      }
      if (sucesso) setAviso(sucesso);
      router.refresh();
    });
  }

  async function copiarLink(id: string, texto: string) {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(id);
      setTimeout(() => setCopiado(null), 2000);
    } catch {
      setErro("Não foi possível copiar. Selecione o texto manualmente.");
    }
  }

  const abas: { id: Filtro; label: string }[] = [
    { id: "acao", label: "Precisam de ação" },
    { id: "pendente", label: "Aguardando envio" },
    { id: "enviado", label: "Sem resposta" },
    { id: "confirmado", label: "Confirmados" },
    { id: "todos", label: "Todos" },
  ];

  return (
    <>
      {!envioAutomatico && (
        <p className="rounded-md border border-dashed border-border bg-white px-4 py-3 text-sm text-cinza-suave">
          <MessageCircle className="mr-1.5 inline size-4 text-teal" />
          O WhatsApp oficial ainda não está conectado, então o envio é manual:
          o botão abre a conversa com a mensagem pronta, você aperta enviar e
          marca aqui. Quando a API entrar, isso passa a sair sozinho no
          horário.
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-1 rounded-lg border border-border bg-white p-1">
        {abas.map((a) => {
          const n =
            a.id === "todos"
              ? confirmacoes.length
              : a.id === "acao"
                ? confirmacoes.filter(
                    (c) =>
                      (c.status === "pendente" && c.agendado_para <= agora) ||
                      c.status === "reagendar"
                  ).length
                : confirmacoes.filter((c) => c.status === a.id).length;

          return (
            <button
              key={a.id}
              onClick={() => setFiltro(a.id)}
              className={cn(
                "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                filtro === a.id
                  ? "bg-azul-medico text-white"
                  : "text-cinza-suave hover:bg-verde-menta hover:text-azul-medico"
              )}
            >
              {a.label}
              <span className="ml-1.5 opacity-70">{n}</span>
            </button>
          );
        })}
      </div>

      {erro && (
        <p className="mt-4 rounded-md bg-coral/10 px-4 py-2.5 text-sm text-coral">{erro}</p>
      )}
      {aviso && (
        <p className="mt-4 flex items-center gap-2 rounded-md bg-sucesso/10 px-4 py-2.5 text-sm text-sucesso">
          <CheckCircle2 className="size-4" /> {aviso}
        </p>
      )}
      {demo && (
        <p className="mt-4 rounded-md border border-dashed border-border bg-white px-4 py-2.5 text-xs text-cinza-suave">
          Modo demonstração: os envios e as respostas não são salvos.
        </p>
      )}

      <div className="mt-5 space-y-3">
        {lista.length === 0 && (
          <p className="rounded-lg border border-dashed border-border bg-white px-6 py-14 text-center text-cinza-suave">
            {filtro === "acao"
              ? "Nada pendente. Todos os lembretes do período estão em dia."
              : "Nenhuma confirmação com esse filtro."}
          </p>
        )}

        {lista.map((c) => {
          const atrasado = c.status === "pendente" && c.agendado_para <= agora;
          const texto = mensagens[c.id] ?? "";
          const whats = c.paciente_telefone
            ? linkWhatsApp(c.paciente_telefone, texto)
            : null;

          return (
            <article
              key={c.id}
              className={cn(
                "rounded-lg border bg-white p-4 shadow-soft",
                atrasado ? "border-alerta/40" : "border-border"
              )}
            >
              <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-azul-medico">
                      {c.paciente_nome}
                    </p>
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-[10px] font-semibold",
                        corStatus[c.status]
                      )}
                    >
                      {rotuloStatus[c.status]}
                    </span>
                  </div>

                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-cinza-suave">
                    <span className="flex items-center gap-1">
                      <CalendarClock className="size-3.5 text-teal" />
                      {formatarData(c.data_hora)} ({diaDaSemana(c.data_hora)}) às{" "}
                      {formatarHora(c.data_hora)}
                    </span>
                    {c.medico_nome && <span>· {c.medico_nome}</span>}
                    {c.paciente_telefone && (
                      <span className="flex items-center gap-1">
                        <Phone className="size-3.5 text-teal" />
                        {c.paciente_telefone}
                      </span>
                    )}
                  </p>

                  <p className="mt-1 text-xs text-cinza-suave/80">
                    {c.status === "pendente" ? (
                      <span className={cn(atrasado && "font-semibold text-alerta")}>
                        <Clock className="mr-1 inline size-3" />
                        {atrasado ? "Deveria ter saído " : "Envio programado para "}
                        {formatarData(c.agendado_para)} às{" "}
                        {formatarHora(c.agendado_para)}
                      </span>
                    ) : c.respondido_em ? (
                      `Respondeu ${tempoRelativo(c.respondido_em)}`
                    ) : c.enviado_em ? (
                      `Enviado ${tempoRelativo(c.enviado_em)}${c.canal === "manual" ? " (manual)" : ""}`
                    ) : null}
                  </p>

                  {c.observacao && (
                    <p className="mt-1.5 rounded bg-branco-clinico px-2.5 py-1.5 text-xs text-cinza-suave">
                      {c.observacao}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                {!c.paciente_telefone ? (
                  <span className="text-xs text-coral">
                    Sem telefone cadastrado — não dá para enviar.
                  </span>
                ) : (
                  <>
                    {envioAutomatico ? (
                      <Button
                        variant="teal"
                        size="sm"
                        disabled={pending || demo}
                        onClick={() =>
                          agir(() => enviarAgora(c.id), `Mensagem enviada para ${c.paciente_nome}.`)
                        }
                      >
                        {pending ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Send className="size-4" />
                        )}
                        Enviar agora
                      </Button>
                    ) : (
                      whats && (
                        <Button variant="teal" size="sm" asChild>
                          <a href={whats} target="_blank" rel="noopener noreferrer">
                            <MessageCircle className="size-4" /> Abrir no WhatsApp
                          </a>
                        </Button>
                      )
                    )}

                    {c.status === "pendente" && !envioAutomatico && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={pending || demo}
                        onClick={() =>
                          agir(() => marcarEnviado(c.id), "Marcado como enviado.")
                        }
                      >
                        <CheckCircle2 className="size-4" /> Já enviei
                      </Button>
                    )}

                    <button
                      type="button"
                      onClick={() => copiarLink(c.id, texto)}
                      className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-cinza-suave transition-colors hover:border-teal hover:text-teal"
                    >
                      {copiado === c.id ? (
                        <>
                          <CheckCircle2 className="size-3.5 text-sucesso" /> Copiado
                        </>
                      ) : (
                        <>
                          <Copy className="size-3.5" /> Copiar mensagem
                        </>
                      )}
                    </button>
                  </>
                )}

                <a
                  href={`/confirmar/${c.token}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-cinza-suave transition-colors hover:border-teal hover:text-teal"
                  title="Ver a página como o paciente vê"
                >
                  <Link2 className="size-3.5" /> Ver o link
                </a>

                {/* Resposta que chegou por telefone ou no balcão */}
                <Select
                  value=""
                  disabled={pending || demo}
                  onChange={(e) => {
                    if (!e.target.value) return;
                    agir(
                      () =>
                        registrarResposta(
                          c.id,
                          e.target.value as StatusConfirmacao
                        ),
                      "Resposta registrada."
                    );
                  }}
                  className="ml-auto h-9 w-auto min-w-[180px] text-xs"
                  aria-label={`Registrar resposta de ${c.paciente_nome}`}
                >
                  <option value="">Registrar resposta…</option>
                  <option value="confirmado">Confirmou por telefone</option>
                  <option value="reagendar">Quer reagendar</option>
                  <option value="recusado">Não vai comparecer</option>
                  <option value="pendente">Voltar para pendente</option>
                </Select>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}

/** Ícone por status, exportado para a página reaproveitar nos cartões. */
export const iconeStatus = {
  confirmado: CheckCircle2,
  reagendar: CalendarClock,
  recusado: XCircle,
} as const;
