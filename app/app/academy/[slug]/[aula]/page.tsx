import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Clock, Download, ListVideo } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Player } from "@/components/app/academy/player";
import { BotaoConcluir } from "@/components/app/academy/botao-concluir";
import { Comentarios } from "@/components/app/academy/comentarios";
import { exigirModulo } from "@/lib/acesso";
import {
  getAulasConcluidas,
  getComentarios,
  getTrilha,
} from "@/lib/supabase/academy";

export async function generateMetadata({
  params,
}: {
  params: { slug: string; aula: string };
}) {
  const trilha = await getTrilha(params.slug);
  const aula = trilha?.aulas.find((a) => a.slug === params.aula);
  return { title: aula?.titulo ?? "Aula" };
}

export default async function AulaPage({
  params,
}: {
  params: { slug: string; aula: string };
}) {
  const { profile, role } = await exigirModulo("academy");

  const trilha = await getTrilha(params.slug);
  if (!trilha) notFound();
  const { curso, aulas } = trilha;

  if (role !== "super_admin" && (!curso.publicado || !curso.papeis.includes(role))) {
    notFound();
  }

  const publicadas = aulas.filter((a) => a.publicado || role === "super_admin");
  const indice = publicadas.findIndex((a) => a.slug === params.aula);
  if (indice === -1) notFound();

  const aula = publicadas[indice];
  const anterior = indice > 0 ? publicadas[indice - 1] : null;
  const proxima = indice < publicadas.length - 1 ? publicadas[indice + 1] : null;

  const [concluidas, comentarios] = await Promise.all([
    getAulasConcluidas(profile.id),
    getComentarios(aula.id),
  ]);

  const feitas = publicadas.filter((a) => concluidas.has(a.id)).length;
  const percentual = publicadas.length
    ? Math.round((feitas / publicadas.length) * 100)
    : 0;

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 md:px-8 md:py-10">
      <Link
        href={`/app/academy/${curso.slug}`}
        className="inline-flex items-center gap-1.5 text-sm text-cinza-suave transition-colors hover:text-teal"
      >
        <ArrowLeft className="size-4" /> {curso.titulo}
      </Link>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_20rem]">
        {/* Aula */}
        <div className="min-w-0">
          <Player url={aula.video_url} titulo={aula.titulo} />

          <header className="mt-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-teal">
              Aula {indice + 1} de {publicadas.length}
            </p>
            <h1 className="mt-1.5 text-2xl md:text-3xl">{aula.titulo}</h1>
            {aula.duracao_min && (
              <p className="mt-2 flex items-center gap-1.5 text-sm text-cinza-suave">
                <Clock className="size-4 text-teal" />
                {aula.duracao_min} minutos
              </p>
            )}
          </header>

          {aula.descricao && (
            <p className="mt-4 whitespace-pre-line leading-relaxed text-cinza-suave">
              {aula.descricao}
            </p>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <BotaoConcluir lessonId={aula.id} concluida={concluidas.has(aula.id)} />
            {aula.material_url && (
              <Button asChild variant="outline">
                <a href={aula.material_url} target="_blank" rel="noopener noreferrer">
                  <Download className="size-4" />
                  Material da aula
                </a>
              </Button>
            )}
          </div>

          {/* Navegação entre aulas */}
          <nav className="mt-8 flex items-center justify-between gap-4 border-t border-border pt-6">
            {anterior ? (
              <Button asChild variant="ghost" size="sm">
                <Link href={`/app/academy/${curso.slug}/${anterior.slug}`}>
                  <ArrowLeft className="size-4" />
                  Aula anterior
                </Link>
              </Button>
            ) : (
              <span />
            )}
            {proxima && (
              <Button asChild variant="marca" size="sm">
                <Link href={`/app/academy/${curso.slug}/${proxima.slug}`}>
                  Próxima aula
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            )}
          </nav>

          <Comentarios
            lessonId={aula.id}
            comentarios={comentarios}
            usuarioId={profile.id}
            podeModerar={role === "super_admin"}
          />
        </div>

        {/* Índice da trilha */}
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-lg border border-border bg-white shadow-soft">
            <div className="border-b border-border p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-azul-medico">
                <ListVideo className="size-4 text-teal" />
                Conteúdo da trilha
              </p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-verde-menta">
                <div
                  className="h-full rounded-full bg-teal"
                  style={{ width: `${percentual}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-cinza-suave">
                {feitas} de {publicadas.length} aulas concluídas
              </p>
            </div>

            <ol className="max-h-[28rem] overflow-y-auto p-2">
              {publicadas.map((a, i) => {
                const atual = a.id === aula.id;
                const feita = concluidas.has(a.id);
                return (
                  <li key={a.id}>
                    <Link
                      href={`/app/academy/${curso.slug}/${a.slug}`}
                      className={
                        "flex gap-3 rounded-md px-3 py-2.5 text-sm transition-colors " +
                        (atual
                          ? "bg-verde-menta font-semibold text-azul-medico"
                          : "text-cinza-suave hover:bg-verde-menta/50")
                      }
                    >
                      <span
                        className={
                          "mt-0.5 size-2 shrink-0 rounded-full " +
                          (feita ? "bg-sucesso" : atual ? "bg-teal" : "bg-border")
                        }
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block leading-snug">{a.titulo}</span>
                        {a.duracao_min && (
                          <span className="text-xs text-cinza-suave/80">
                            {a.duracao_min} min
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 text-xs text-cinza-suave/70">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          </div>
        </aside>
      </div>
    </div>
  );
}
