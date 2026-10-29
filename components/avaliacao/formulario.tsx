"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Loader2, Star } from "lucide-react";
import { responderAvaliacao } from "@/lib/actions/avaliacoes";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Cor de cada nota: vermelho (0–6), âmbar (7–8), verde (9–10). */
const tom = (n: number) =>
  n >= 9
    ? "border-[#16A34A] bg-[#16A34A] text-white"
    : n >= 7
      ? "border-[#D97706] bg-[#D97706] text-white"
      : "border-[#DC2626] bg-[#DC2626] text-white";

export function FormularioAvaliacao({
  token,
  paciente,
  clinica,
  medico,
  respondida,
  notaAnterior,
  linkAvaliacao,
}: {
  token: string;
  paciente: string;
  clinica: string;
  medico: string | null;
  respondida: boolean;
  notaAnterior: number | null;
  linkAvaliacao: string | null;
}) {
  const [nota, setNota] = useState<number | null>(null);
  const [comentario, setComentario] = useState("");
  const [enviada, setEnviada] = useState(respondida);
  const [notaFinal, setNotaFinal] = useState<number | null>(notaAnterior);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function enviar() {
    if (nota === null) return;
    setErro(null);
    startTransition(async () => {
      const r = await responderAvaliacao({ token, nota, comentario });
      if (r.ok) {
        setNotaFinal(nota);
        setEnviada(true);
      } else setErro(r.erro);
    });
  }

  if (enviada) {
    const promotor = notaFinal !== null && notaFinal >= 9;
    return (
      <div className="px-6 py-8 text-center">
        <CheckCircle2 className="mx-auto size-12 text-teal" />
        <p className="mt-4 font-heading text-lg font-semibold text-azul-medico">Obrigado, {paciente}!</p>
        <p className="mt-2 text-sm text-cinza-suave">
          {promotor
            ? "Que bom que você gostou! Sua opinião faz toda a diferença para a equipe."
            : "Recebemos sua opinião. A equipe vai usar o que você contou para melhorar o atendimento."}
        </p>
        {promotor && linkAvaliacao && (
          <div className="mt-6 rounded-lg bg-verde-menta px-4 py-4">
            <p className="text-sm text-cinza-texto">
              Pode contar isso também no Google? Ajuda outras pessoas a conhecer a {clinica}.
            </p>
            <a
              href={linkAvaliacao}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-2 rounded-full bg-teal px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal/90"
            >
              <Star className="size-4" /> Avaliar no Google
            </a>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <header className="border-b border-border bg-verde-menta px-6 py-5">
        <p className="font-heading text-lg font-semibold text-azul-medico">Olá, {paciente}!</p>
        <p className="mt-1 text-sm text-cinza-suave">
          Como foi o seu atendimento{medico ? ` com ${medico}` : ""}?
        </p>
      </header>

      <div className="px-6 py-6">
        <p id="pergunta" className="text-sm font-medium text-cinza-texto">
          De 0 a 10, o quanto você recomendaria a {clinica} a um amigo ou familiar?
        </p>
        <div role="radiogroup" aria-labelledby="pergunta" className="mt-4 grid grid-cols-6 gap-2 sm:grid-cols-11 sm:gap-1.5">
          {Array.from({ length: 11 }, (_, n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={nota === n}
              onClick={() => setNota(n)}
              className={cn(
                "h-11 rounded-lg border text-sm font-semibold tabular-nums transition-colors",
                nota === n ? tom(n) : "border-border bg-white text-cinza-texto hover:border-teal hover:text-teal"
              )}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="mt-2 flex justify-between text-[11px] text-cinza-suave">
          <span>Nada provável</span>
          <span>Muito provável</span>
        </div>

        {nota !== null && (
          <label className="mt-6 block">
            <span className="text-sm font-medium text-cinza-texto">
              {nota >= 9 ? "O que você mais gostou?" : nota >= 7 ? "O que faltou para ser nota 10?" : "O que não foi bom? Queremos corrigir."}
              <span className="font-normal text-cinza-suave"> (opcional)</span>
            </span>
            <textarea
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              maxLength={1000}
              rows={4}
              className="mt-2 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-cinza-texto outline-none focus:border-teal focus:ring-2 focus:ring-teal/20"
            />
          </label>
        )}

        {erro && <p className="mt-4 rounded-md bg-coral/10 px-3 py-2 text-sm text-coral">{erro}</p>}

        <Button variant="teal" className="mt-6 w-full" onClick={enviar} disabled={nota === null || pending}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          Enviar avaliação
        </Button>
      </div>
    </div>
  );
}
