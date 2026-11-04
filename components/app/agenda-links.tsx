"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Copy, ExternalLink, Link2, MessageCircle, Settings2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type LinkDaAgenda = {
  medicoId: string;
  nome: string;
  /** Endereço completo; nulo enquanto ninguém criou o link. */
  url: string | null;
  ativo: boolean;
};

/**
 * Atalho da Agenda para o link de agendamento: é aqui que a recepção
 * está quando o paciente pede "me manda um horário". A configuração
 * continua em Disponibilidade; aqui é só pegar e mandar.
 */
export function AgendaLinks({ links }: { links: LinkDaAgenda[] }) {
  const [aberto, setAberto] = useState(false);
  const [copiado, setCopiado] = useState<string | null>(null);
  if (!links.length) return null;

  async function copiar(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(url);
      setTimeout(() => setCopiado(null), 2000);
    } catch {
      /* sem permissão de área de transferência: o link segue à vista para copiar à mão */
    }
  }

  const so = links.length === 1;

  return (
    <>
      <Button variant="outline" onClick={() => setAberto(true)}>
        <Link2 className="size-4" /> {so ? "Meu link de agendamento" : "Links de agendamento"}
      </Button>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{so ? "Link de agendamento" : "Links de agendamento"}</DialogTitle>
            <DialogDescription>
              Mande para o paciente: ele vê os horários livres e marca sozinho. A consulta entra na agenda como
              pendente, com a etiqueta &quot;via link&quot;.
            </DialogDescription>
          </DialogHeader>

          <ul className="space-y-2.5">
            {links.map((l) => (
              <li key={l.medicoId} className="rounded-lg border border-border bg-branco-clinico px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-azul-medico">{l.nome}</p>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                      !l.url
                        ? "bg-cinza-suave/15 text-cinza-suave"
                        : l.ativo
                          ? "bg-sucesso/12 text-sucesso"
                          : "bg-alerta/12 text-alerta"
                    )}
                  >
                    {!l.url ? "Sem link" : l.ativo ? "No ar" : "Desligado"}
                  </span>
                </div>

                {l.url && l.ativo ? (
                  <>
                    <p className="mt-1 text-xs text-cinza-suave [overflow-wrap:anywhere]">{l.url}</p>
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      <Button size="sm" variant="outline" onClick={() => copiar(l.url!)}>
                        {copiado === l.url ? <Check className="size-4 text-sucesso" /> : <Copy className="size-4" />}
                        {copiado === l.url ? "Copiado" : "Copiar"}
                      </Button>
                      <a
                        href={`https://wa.me/?text=${encodeURIComponent(
                          `Olá! Para agendar sua consulta com ${l.nome}, escolha o melhor horário por aqui: ${l.url}`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-8 items-center gap-1.5 rounded-md bg-sucesso/12 px-3 text-sm font-medium text-sucesso transition-colors hover:bg-sucesso/20"
                      >
                        <MessageCircle className="size-4" /> WhatsApp
                      </a>
                      <a
                        href={l.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-medium text-teal transition-colors hover:bg-verde-menta"
                      >
                        <ExternalLink className="size-4" /> Abrir
                      </a>
                      <Link
                        href={`/app/disponibilidade?profissional=${l.medicoId}`}
                        className="inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-medium text-cinza-suave transition-colors hover:bg-verde-menta hover:text-azul-medico"
                      >
                        <Settings2 className="size-4" /> Links por serviço e QR Code
                      </Link>
                    </div>
                  </>
                ) : (
                  <p className="mt-1 text-sm text-cinza-suave">
                    {l.url ? "O link está desligado." : "Ainda não tem link."}{" "}
                    <Link
                      href={`/app/disponibilidade?profissional=${l.medicoId}`}
                      className="font-semibold text-teal hover:underline"
                    >
                      {l.url ? "Ligar em Disponibilidade" : "Criar em Disponibilidade"}
                    </Link>
                  </p>
                )}
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}
