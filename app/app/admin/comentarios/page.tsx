import Link from "next/link";
import {
  MessageSquareReply,
  Building2,
  PlayCircle,
  ExternalLink,
  BadgeCheck,
  CheckCircle2,
} from "lucide-react";
import { ResponderComentario } from "@/components/app/admin/responder-comentario";
import { exigirModulo } from "@/lib/acesso";
import { getFilaComentarios } from "@/lib/supabase/academy";
import { rotuloPapel } from "@/lib/rbac";
import { cn } from "@/lib/utils";

export const metadata = { title: "Dúvidas dos alunos" };

function quando(iso: string) {
  const horas = Math.round((Date.now() - new Date(iso).getTime()) / 3600000);
  if (horas < 1) return "há menos de 1 hora";
  if (horas < 24) return `há ${horas} h`;
  const dias = Math.round(horas / 24);
  return `há ${dias} ${dias === 1 ? "dia" : "dias"}`;
}

export default async function AdminComentariosPage() {
  await exigirModulo("admin-comentarios");
  const fila = await getFilaComentarios();

  const pendentes = fila.filter((c) => !c.respondido);
  const respondidos = fila.filter((c) => c.respondido);

  return (
    <div className="mx-auto max-w-4xl px-5 py-8 md:px-8 md:py-10">
      <header className="flex items-start gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-verde-menta text-teal">
          <MessageSquareReply className="size-6" />
        </span>
        <div>
          <h1 className="text-2xl md:text-3xl">Dúvidas dos alunos</h1>
          <p className="mt-1 max-w-xl text-cinza-suave">
            Tudo que foi perguntado nas aulas da Academy. A resposta aparece na
            própria aula, visível apenas para a clínica que perguntou.
          </p>
        </div>
      </header>

      <div className="mt-8 flex flex-wrap gap-6 rounded-lg border border-border bg-white px-6 py-4 text-sm shadow-soft">
        <span className="text-cinza-suave">
          <strong className={pendentes.length ? "text-coral" : "text-sucesso"}>
            {pendentes.length}
          </strong>{" "}
          aguardando resposta
        </span>
        <span className="text-cinza-suave">
          <strong className="text-azul-medico">{respondidos.length}</strong>{" "}
          já respondidas
        </span>
      </div>

      {fila.length === 0 ? (
        <p className="mt-6 rounded-lg border border-dashed border-border bg-white px-6 py-16 text-center text-cinza-suave">
          Ninguém perguntou nada ainda.
        </p>
      ) : (
        <div className="mt-6 space-y-4">
          {fila.map((c) => (
            <article
              key={c.id}
              className={cn(
                "rounded-lg border bg-white p-5 shadow-soft",
                c.respondido ? "border-border" : "border-coral/30"
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-azul-medico">
                    {c.autor_nome}
                    <span className="font-normal text-cinza-suave">
                      {rotuloPapel(c.autor_papel)}
                    </span>
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-cinza-suave">
                    <span className="flex items-center gap-1.5">
                      <Building2 className="size-3.5 text-teal" />
                      {c.clinica}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <PlayCircle className="size-3.5 text-teal" />
                      {c.curso_titulo} · {c.aula_titulo}
                    </span>
                    <span>{quando(c.created_at)}</span>
                  </p>
                </div>

                <span
                  className={cn(
                    "shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide",
                    c.respondido
                      ? "bg-sucesso/12 text-sucesso"
                      : "bg-coral/12 text-coral"
                  )}
                >
                  {c.respondido ? "Respondida" : "Aguardando"}
                </span>
              </div>

              <blockquote className="mt-4 border-l-2 border-verde-menta pl-4 text-sm leading-relaxed text-cinza-texto">
                {c.conteudo}
              </blockquote>

              {/* Respostas já dadas */}
              {!!c.respostas?.length && (
                <div className="mt-4 space-y-3">
                  {c.respostas.map((r) => (
                    <div
                      key={r.id}
                      className="rounded-md border border-teal/20 bg-teal/5 p-3"
                    >
                      <p className="flex items-center gap-1.5 text-xs font-semibold text-teal">
                        {r.autor_papel === "super_admin" && (
                          <BadgeCheck className="size-3.5" />
                        )}
                        {r.autor_nome} · {quando(r.created_at)}
                      </p>
                      <p className="mt-1.5 text-sm leading-relaxed text-cinza-texto">
                        {r.conteudo}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
                <ResponderComentario lessonId={c.lesson_id} parentId={c.id} />
                {c.curso_slug && c.aula_slug && (
                  <Link
                    href={`/app/academy/${c.curso_slug}/${c.aula_slug}`}
                    className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-cinza-suave transition-colors hover:text-teal"
                  >
                    Abrir a aula
                    <ExternalLink className="size-3.5" />
                  </Link>
                )}
              </div>

              {c.respondido && !c.respostas?.length && (
                <p className="mt-3 flex items-center gap-1.5 text-xs text-sucesso">
                  <CheckCircle2 className="size-3.5" /> Já respondida.
                </p>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
