"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, QrCode, Smartphone, TriangleAlert } from "lucide-react";
import { salvarConexaoMerge, type ConexaoDisponivel } from "@/lib/actions/configuracoes";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Escolha do número que envia as mensagens da clínica.
 *
 * As mensagens saem do WhatsApp da própria clínica, conectado no Merge
 * por QR code — o paciente responde no mesmo fio de sempre. Por isso a
 * escolha é explícita: enquanto ninguém marcar um número, o envio
 * automático fica desligado e a fila continua sendo disparada à mão
 * pela recepção. Mandar pelo número de outra clínica seria pior.
 */
export function ConexaoWhatsApp({
  organizationId,
  conexoes,
  disponivel,
  escolhida,
  demo,
}: {
  organizationId: string;
  conexoes: ConexaoDisponivel[];
  disponivel: boolean;
  escolhida: number | null;
  demo: boolean;
}) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState<number | null>(null);
  const [, startTransition] = useTransition();

  function escolher(conexaoId: number | null) {
    if (demo) return;
    setErro(null);
    setSalvando(conexaoId ?? -1);
    startTransition(async () => {
      const res = await salvarConexaoMerge({ organizationId, conexaoId });
      setSalvando(null);
      if (!res.ok) {
        setErro(res.erro);
        return;
      }
      router.refresh();
    });
  }

  return (
    <article className="rounded-lg border border-border bg-white p-5 shadow-soft">
      <div className="flex flex-wrap items-start gap-4">
        <span
          className={cn(
            "grid size-11 shrink-0 place-items-center rounded-xl",
            escolhida ? "bg-verde-menta text-teal" : "bg-branco-clinico text-cinza-suave"
          )}
        >
          <Smartphone className="size-5" />
        </span>

        <div className="min-w-[16rem] flex-1">
          <h3 className="font-semibold text-azul-medico">
            WhatsApp que fala com os pacientes
          </h3>
          <p className="mt-1 text-sm text-cinza-suave">
            Lembretes, confirmações e avisos saem deste número. É o mesmo
            aparelho que a recepção já usa — o paciente responde na conversa
            de sempre.
          </p>
        </div>
      </div>

      {!disponivel ? (
        <p className="mt-4 rounded-md border border-dashed border-border bg-branco-clinico px-4 py-3 text-sm text-cinza-suave">
          A integração com o Merge ainda não está ligada nesta instalação.
          Enquanto isso, os lembretes ficam na fila de Confirmações para
          envio em um clique.
        </p>
      ) : conexoes.length === 0 ? (
        <div className="mt-4 flex gap-3 rounded-md border border-dashed border-border bg-branco-clinico px-4 py-3">
          <QrCode className="mt-0.5 size-4 shrink-0 text-cinza-suave" />
          <p className="text-sm text-cinza-suave">
            Nenhum número conectado ainda. No painel do Merge, leia o QR code
            com o celular da clínica e volte aqui — ele aparece nesta lista.
          </p>
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {conexoes.map((c) => {
            const ativa = c.id === escolhida;
            return (
              <li key={c.id}>
                <button
                  type="button"
                  disabled={demo || salvando !== null}
                  onClick={() => escolher(ativa ? null : c.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-md border px-4 py-3 text-left transition-colors",
                    ativa
                      ? "border-teal bg-verde-menta"
                      : "border-border hover:bg-branco-clinico",
                    (demo || salvando !== null) && "cursor-not-allowed opacity-70"
                  )}
                >
                  <span className="flex-1">
                    <span className="block text-sm font-medium text-azul-medico">
                      {c.nome}
                    </span>
                    <span className="block text-xs text-cinza-suave">
                      {formatarNumero(c.numero)}
                      {c.provedor === "meta" && " · API oficial"}
                      {!c.conectada && " · aparelho desconectado"}
                    </span>
                  </span>

                  {salvando === c.id ? (
                    <Loader2 className="size-5 animate-spin text-teal" />
                  ) : ativa ? (
                    <CheckCircle2 className="size-5 text-teal" />
                  ) : !c.conectada ? (
                    <TriangleAlert className="size-4 text-ambar" />
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {escolhida !== null &&
        conexoes.find((c) => c.id === escolhida)?.provedor === "meta" && (
          <p className="mt-3 flex gap-2 rounded-md border border-dashed border-border bg-branco-clinico px-4 py-3 text-xs text-cinza-suave">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-ambar" />
            <span>
              Este é um número da API oficial da Meta. Ela só entrega mensagem
              escrita livremente até 24 horas depois da última mensagem do
              paciente — fora dessa janela, é preciso um modelo aprovado. Um
              número lido por QR code não tem essa limitação.
            </span>
          </p>
        )}

      {escolhida && (
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-xs text-cinza-suave">
            Envio automático ligado para esta clínica.
          </p>
          <Button
            variant="ghost"
            size="sm"
            disabled={demo || salvando !== null}
            onClick={() => escolher(null)}
          >
            Desligar
          </Button>
        </div>
      )}

      {erro && <p className="mt-3 text-sm text-vermelho-alerta">{erro}</p>}
    </article>
  );
}

/** (11) 99999-9999 a partir de 5511999999999. */
function formatarNumero(numero: string): string {
  const d = numero.replace(/\D/g, "").replace(/^55/, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return numero;
}
