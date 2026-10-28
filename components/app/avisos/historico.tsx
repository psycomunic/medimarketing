"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCircle2, Clock, Loader2, Mail, MessageCircle, RotateCw, TriangleAlert, XCircle } from "lucide-react";
import type { Envio, StatusEnvio } from "@/lib/supabase/types";
import { reenviarEnvio } from "@/lib/actions/avisos";
import { tempoRelativo } from "@/lib/rotulos";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const ROTULO_EVENTO: Record<string, string> = {
  lembrete_paciente: "Lembrete",
  consulta_nova: "Consulta marcada",
  consulta_cancelada: "Cancelamento",
  consulta_remarcada: "Remarcação",
  paciente_confirmou: "Confirmação",
  paciente_remarcar: "Pedido de remarcação",
  paciente_cancelou: "Cancelamento pelo paciente",
  agenda_do_dia: "Agenda do dia",
  pendentes_vespera: "Sem confirmação",
  envio_falhou: "Falha de envio",
  teste: "Teste",
};

const STATUS: Record<StatusEnvio, { rotulo: string; cor: string; icone: typeof Clock }> = {
  pendente: { rotulo: "Na fila", cor: "bg-alerta/12 text-alerta", icone: Clock },
  enviando: { rotulo: "Enviando", cor: "bg-alerta/12 text-alerta", icone: Loader2 },
  enviado: { rotulo: "Enviado", cor: "bg-sucesso/12 text-sucesso", icone: CheckCircle2 },
  falhou: { rotulo: "Falhou", cor: "bg-coral/12 text-coral", icone: TriangleAlert },
  ignorado: { rotulo: "Não enviado", cor: "bg-cinza-suave/15 text-cinza-suave", icone: XCircle },
  cancelado: { rotulo: "Cancelado", cor: "bg-cinza-suave/15 text-cinza-suave", icone: XCircle },
};

const ICONE_CANAL = { whatsapp: MessageCircle, email: Mail, painel: Bell };

type Filtro = "todos" | "problemas" | "paciente" | "equipe";

/**
 * Tudo que a plataforma mandou em nome da clínica: para quem, por onde,
 * e se chegou. É onde a recepção descobre que o lembrete de alguém não
 * saiu — e manda de novo com um clique.
 */
export function HistoricoEnvios({ envios, demo }: { envios: Envio[]; demo: boolean }) {
  const router = useRouter();
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [aberto, setAberto] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [reenviando, setReenviando] = useState<string | null>(null);

  const lista = useMemo(
    () =>
      envios.filter((e) => {
        // Avisos no painel entram só quando falham: o resto é ruído aqui
        if (e.canal === "painel" && e.status === "enviado") return false;
        if (filtro === "problemas") return e.status === "falhou" || e.status === "ignorado";
        if (filtro === "paciente") return e.publico === "paciente";
        if (filtro === "equipe") return e.publico !== "paciente";
        return true;
      }),
    [envios, filtro]
  );

  const problemas = envios.filter((e) => e.status === "falhou").length;

  function reenviar(id: string) {
    setErro(null);
    setReenviando(id);
    startTransition(async () => {
      const res = await reenviarEnvio(id);
      setReenviando(null);
      if (!res.ok) setErro(res.erro);
      router.refresh();
    });
  }

  return (
    <section className="rounded-lg border border-border bg-white shadow-soft">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <h2 className="text-lg font-semibold text-azul-medico">Mensagens enviadas</h2>
          <p className="mt-1 text-sm text-cinza-suave">
            WhatsApp e e-mail que saíram para pacientes e equipe.
            {problemas > 0 && <strong className="text-coral"> {problemas} falharam.</strong>}
          </p>
        </div>
        <Select
          value={filtro}
          onChange={(e) => setFiltro(e.target.value as Filtro)}
          className="h-9 w-auto min-w-[160px] text-sm"
          aria-label="Filtrar mensagens"
        >
          <option value="todos">Todas</option>
          <option value="problemas">Com problema</option>
          <option value="paciente">Para pacientes</option>
          <option value="equipe">Para a equipe</option>
        </Select>
      </header>

      {erro && <p className="mx-5 mt-4 rounded-md bg-coral/10 px-4 py-2.5 text-sm text-coral">{erro}</p>}

      {lista.length === 0 ? (
        <p className="px-6 py-12 text-center text-sm text-cinza-suave">
          {envios.length ? "Nenhuma mensagem com esse filtro." : "Nenhuma mensagem ainda. Elas aparecem aqui assim que a agenda começar a ser usada."}
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {lista.map((e) => {
            const s = STATUS[e.status];
            const Canal = ICONE_CANAL[e.canal];
            const podeReenviar = ["falhou", "ignorado", "cancelado"].includes(e.status) && e.canal !== "painel";
            return (
              <li key={e.id} className="px-5 py-3">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-branco-clinico text-teal">
                    <Canal className="size-4" />
                  </span>
                  <button
                    type="button"
                    onClick={() => setAberto(aberto === e.id ? null : e.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="truncate text-sm font-medium text-cinza-texto">
                      {ROTULO_EVENTO[e.evento] ?? e.evento} · {e.destino_nome ?? e.destino ?? "—"}
                    </p>
                    <p className="truncate text-xs text-cinza-suave">
                      {e.publico === "paciente" ? "Paciente" : e.publico === "clinica" ? "Caixa da clínica" : "Equipe"}
                      {e.destino && ` · ${e.destino}`} · {tempoRelativo(e.enviado_em ?? e.created_at)}
                    </p>
                  </button>
                  <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold", s.cor)}>
                    <s.icone className={cn("size-3.5", e.status === "enviando" && "animate-spin")} /> {s.rotulo}
                  </span>
                  {podeReenviar && (
                    <Button type="button" variant="outline" size="sm" disabled={demo || pending} onClick={() => reenviar(e.id)}>
                      {reenviando === e.id ? <Loader2 className="animate-spin" /> : <RotateCw />} Reenviar
                    </Button>
                  )}
                </div>
                {aberto === e.id && (
                  <div className="mt-3 rounded-md bg-branco-clinico p-3 text-xs text-cinza-texto">
                    {e.assunto && <p className="font-semibold">{e.assunto}</p>}
                    {e.conteudo && <p className="mt-1 whitespace-pre-line">{e.conteudo}</p>}
                    {e.erro && <p className="mt-2 text-coral">Motivo: {e.erro}</p>}
                    <p className="mt-2 text-cinza-suave">
                      {e.tentativas} tentativa{e.tentativas === 1 ? "" : "s"}
                    </p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
