import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Clock,
  PlayCircle,
  Award,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { exigirModulo } from "@/lib/acesso";
import { getAulasConcluidas, getTrilha } from "@/lib/supabase/academy";
import { cn } from "@/lib/utils";

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}) {
  const trilha = await getTrilha(params.slug);
  return { title: trilha?.curso.titulo ?? "Trilha" };
}

export default async function TrilhaPage({
  params,
}: {
  params: { slug: string };
}) {
  const { profile, role } = await exigirModulo("academy");
  const trilha = await getTrilha(params.slug);
  if (!trilha) notFound();

  const { curso, aulas } = trilha;

  // A RLS já bloqueia no banco; aqui evitamos a tela de erro feia
  if (!curso.publicado && role !== "super_admin") notFound();
  if (role !== "super_admin" && !curso.papeis.includes(role)) notFound();

  const publicadas = aulas.filter((a) => a.publicado);
  const concluidas = await getAulasConcluidas(profile.id);
  const feitas = publicadas.filter((a) => concluidas.has(a.id)).length;
  const percentual = publicadas.length
    ? Math.round((feitas / publicadas.length) * 100)
    : 0;
  const completa = publicadas.length > 0 && feitas === publicadas.length;

  // Retomar de onde parou: primeira aula ainda não concluída
  const proxima = publicadas.find((a) => !concluidas.has(a.id)) ?? publicadas[0];

  return (
    <div className="mx-auto max-w-4xl px-5 py-8 md:px-8 md:py-10">
      <Link
        href="/app/academy"
        className="inline-flex items-center gap-1.5 text-sm text-cinza-suave transition-colors hover:text-teal"
      >
        <ArrowLeft className="size-4" /> Todas as trilhas
      </Link>

      <header className="mt-6">
        <h1 className="text-2xl md:text-3xl">{curso.titulo}</h1>
        {curso.descricao && (
          <p className="mt-3 max-w-2xl leading-relaxed text-cinza-suave">
            {curso.descricao}
          </p>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-cinza-suave">
          <span className="flex items-center gap-1.5">
            <PlayCircle className="size-4 text-teal" />
            {publicadas.length} aulas
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="size-4 text-teal" />
            {publicadas.reduce((s, a) => s + (a.duracao_min ?? 0), 0)} min no total
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="size-4 text-teal" />
            {feitas} concluídas
          </span>
        </div>

        <div className="mt-4 h-2 max-w-md overflow-hidden rounded-full bg-verde-menta">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              completa ? "bg-sucesso" : "bg-teal"
            )}
            style={{ width: `${percentual}%` }}
          />
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          {proxima && (
            <Button asChild variant="marca">
              <Link href={`/app/academy/${curso.slug}/${proxima.slug}`}>
                {feitas === 0
                  ? "Começar a trilha"
                  : completa
                    ? "Rever as aulas"
                    : "Continuar de onde parei"}
              </Link>
            </Button>
          )}
          {completa && (
            <Button asChild variant="teal">
              <Link href={`/app/academy/${curso.slug}/certificado`}>
                <Award className="size-4" />
                Ver certificado
              </Link>
            </Button>
          )}
        </div>
      </header>

      {/* Lista de aulas */}
      <ol className="mt-10 space-y-2">
        {aulas.map((a, i) => {
          const feita = concluidas.has(a.id);
          const bloqueada = !a.publicado;

          const conteudo = (
            <>
              <span className="grid size-9 shrink-0 place-items-center rounded-full border border-border bg-branco-clinico text-xs font-semibold text-cinza-suave">
                {bloqueada ? (
                  <Lock className="size-3.5" />
                ) : feita ? (
                  <CheckCircle2 className="size-5 text-sucesso" />
                ) : (
                  String(i + 1).padStart(2, "0")
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-azul-medico">
                  {a.titulo}
                </span>
                {a.descricao && (
                  <span className="mt-0.5 block text-sm text-cinza-suave">
                    {a.descricao}
                  </span>
                )}
              </span>
              <span className="flex shrink-0 items-center gap-3 text-xs text-cinza-suave">
                {a.duracao_min ? `${a.duracao_min} min` : null}
                {!bloqueada && !a.video_url && (
                  <span className="rounded-full bg-alerta/12 px-2 py-0.5 font-semibold text-alerta">
                    sem vídeo
                  </span>
                )}
              </span>
            </>
          );

          return (
            <li key={a.id}>
              {bloqueada ? (
                <div className="flex items-center gap-4 rounded-lg border border-dashed border-border bg-white/60 p-4 opacity-60">
                  {conteudo}
                </div>
              ) : (
                <Link
                  href={`/app/academy/${curso.slug}/${a.slug}`}
                  className="flex items-center gap-4 rounded-lg border border-border bg-white p-4 shadow-soft transition-all hover:border-teal/40 hover:shadow-card"
                >
                  {conteudo}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
