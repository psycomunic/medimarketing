"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MessageCircle, Reply, Send, Trash2, BadgeCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { comentar, excluirComentario } from "@/lib/actions/academy";
import { rotuloPapel } from "@/lib/rbac";
import { cn } from "@/lib/utils";
import type { ComentarioComAutor, Role } from "@/lib/supabase/types";

function iniciais(nome: string) {
  return nome
    .replace(/^Dra?\.\s*/i, "")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function quando(iso: string) {
  const minutos = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutos < 1) return "agora";
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.round(minutos / 60);
  if (horas < 24) return `há ${horas} h`;
  const dias = Math.round(horas / 24);
  if (dias < 30) return `há ${dias} ${dias === 1 ? "dia" : "dias"}`;
  return new Date(iso).toLocaleDateString("pt-BR");
}

function Avatar({ nome, papel }: { nome: string; papel: Role }) {
  const daEquipe = papel === "super_admin";
  return (
    <span
      className={cn(
        "grid size-9 shrink-0 place-items-center rounded-full text-xs font-semibold text-white",
        daEquipe ? "bg-teal" : "bg-azul-medico"
      )}
    >
      {iniciais(nome)}
    </span>
  );
}

function Caixa({
  lessonId,
  parentId,
  placeholder,
  onPronto,
  compacto,
}: {
  lessonId: string;
  parentId?: string;
  placeholder: string;
  onPronto?: () => void;
  compacto?: boolean;
}) {
  const router = useRouter();
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function enviar() {
    setErro(null);
    startTransition(async () => {
      const res = await comentar({ lessonId, conteudo: texto, parentId });
      if (!res.ok) {
        setErro(res.erro);
        return;
      }
      setTexto("");
      onPronto?.();
      router.refresh();
    });
  }

  return (
    <div className={compacto ? "" : "rounded-lg border border-border bg-white p-4"}>
      <Textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder={placeholder}
        rows={compacto ? 2 : 3}
      />
      {erro && <p className="mt-2 text-xs text-coral">{erro}</p>}
      <div className="mt-3 flex justify-end">
        <Button
          type="button"
          size="sm"
          variant="teal"
          onClick={enviar}
          disabled={pending || texto.trim().length < 3}
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
          Enviar
        </Button>
      </div>
    </div>
  );
}

function Item({
  c,
  lessonId,
  usuarioId,
  podeModerar,
}: {
  c: ComentarioComAutor;
  lessonId: string;
  usuarioId: string;
  podeModerar: boolean;
}) {
  const router = useRouter();
  const [respondendo, setRespondendo] = useState(false);
  const [pending, startTransition] = useTransition();
  const daEquipe = c.autor_papel === "super_admin";

  function excluir() {
    startTransition(async () => {
      await excluirComentario(c.id);
      router.refresh();
    });
  }

  return (
    <article
      className={cn(
        "rounded-lg border p-4",
        daEquipe ? "border-teal/30 bg-teal/5" : "border-border bg-white"
      )}
    >
      <header className="flex items-start gap-3">
        <Avatar nome={c.autor_nome} papel={c.autor_papel} />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 text-sm font-semibold text-azul-medico">
            {c.autor_nome}
            {daEquipe && (
              <span className="inline-flex items-center gap-1 rounded-full bg-teal/12 px-2 py-0.5 text-[10px] font-semibold text-teal">
                <BadgeCheck className="size-3" />
                Equipe Medi Marketing
              </span>
            )}
          </p>
          <p className="text-xs text-cinza-suave">
            {rotuloPapel(c.autor_papel)} · {quando(c.created_at)}
          </p>
        </div>
        {(podeModerar || c.user_id === usuarioId) && (
          <button
            type="button"
            onClick={excluir}
            disabled={pending}
            className="shrink-0 rounded-md p-1.5 text-cinza-suave/70 transition-colors hover:bg-coral/10 hover:text-coral"
            aria-label="Excluir comentário"
          >
            <Trash2 className="size-4" />
          </button>
        )}
      </header>

      <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-cinza-texto">
        {c.conteudo}
      </p>

      {/* Respostas */}
      {!!c.respostas?.length && (
        <div className="mt-4 space-y-3 border-l-2 border-verde-menta pl-4">
          {c.respostas.map((r) => (
            <div key={r.id}>
              <div className="flex items-center gap-2">
                <Avatar nome={r.autor_nome} papel={r.autor_papel} />
                <div>
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-azul-medico">
                    {r.autor_nome}
                    {r.autor_papel === "super_admin" && (
                      <BadgeCheck className="size-3.5 text-teal" />
                    )}
                  </p>
                  <p className="text-xs text-cinza-suave">{quando(r.created_at)}</p>
                </div>
              </div>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-cinza-texto">
                {r.conteudo}
              </p>
            </div>
          ))}
        </div>
      )}

      {respondendo ? (
        <div className="mt-4">
          <Caixa
            lessonId={lessonId}
            parentId={c.id}
            placeholder="Escreva sua resposta..."
            compacto
            onPronto={() => setRespondendo(false)}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setRespondendo(true)}
          className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-teal hover:underline"
        >
          <Reply className="size-3.5" /> Responder
        </button>
      )}
    </article>
  );
}

/** Dúvidas da aula, com respostas da equipe. */
export function Comentarios({
  lessonId,
  comentarios,
  usuarioId,
  podeModerar = false,
}: {
  lessonId: string;
  comentarios: ComentarioComAutor[];
  usuarioId: string;
  podeModerar?: boolean;
}) {
  return (
    <section className="mt-10">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-azul-medico">
        <MessageCircle className="size-5 text-teal" />
        Dúvidas desta aula
        {comentarios.length > 0 && (
          <span className="rounded-full bg-verde-menta px-2 py-0.5 text-xs font-semibold text-azul-medico">
            {comentarios.length}
          </span>
        )}
      </h2>
      <p className="mt-1 text-sm text-cinza-suave">
        Só a sua equipe e a Medi Marketing enxergam o que é escrito aqui.
      </p>

      <div className="mt-5">
        <Caixa
          lessonId={lessonId}
          placeholder="Ficou com alguma dúvida? Pergunte aqui que a gente responde."
        />
      </div>

      <div className="mt-5 space-y-4">
        {comentarios.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border bg-white px-5 py-8 text-center text-sm text-cinza-suave">
            Nenhuma dúvida por enquanto. Seja o primeiro a perguntar.
          </p>
        ) : (
          comentarios.map((c) => (
            <Item
              key={c.id}
              c={c}
              lessonId={lessonId}
              usuarioId={usuarioId}
              podeModerar={podeModerar}
            />
          ))
        )}
      </div>
    </section>
  );
}
