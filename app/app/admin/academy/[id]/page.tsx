import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  ExternalLink,
  Video,
  VideoOff,
  FileText,
} from "lucide-react";
import { FormAula } from "@/components/app/admin/form-aula";
import { FormTrilha } from "@/components/app/admin/form-trilha";
import { exigirModulo } from "@/lib/acesso";
import { getTrilhasAdmin, getTrilha } from "@/lib/supabase/academy";
import { cn } from "@/lib/utils";

export async function generateMetadata({ params }: { params: { id: string } }) {
  const trilhas = await getTrilhasAdmin();
  const t = trilhas.find((x) => x.id === params.id);
  return { title: t ? `Aulas: ${t.titulo}` : "Aulas" };
}

export default async function AdminAulasPage({
  params,
}: {
  params: { id: string };
}) {
  await exigirModulo("admin-academy");

  // A lista administrativa traz todas as trilhas, inclusive rascunhos
  const trilhas = await getTrilhasAdmin();
  const resumo = trilhas.find((t) => t.id === params.id);
  if (!resumo) notFound();

  const completa = await getTrilha(resumo.slug);
  const aulas = completa?.aulas ?? [];
  const proximaOrdem = aulas.length
    ? Math.max(...aulas.map((a) => a.ordem)) + 1
    : 1;

  return (
    <div className="mx-auto max-w-5xl px-5 py-8 md:px-8 md:py-10">
      <Link
        href="/app/admin/academy"
        className="inline-flex items-center gap-1.5 text-sm text-cinza-suave transition-colors hover:text-teal"
      >
        <ArrowLeft className="size-4" /> Conteúdo da Academy
      </Link>

      <header className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide",
                resumo.publicado
                  ? "bg-sucesso/12 text-sucesso"
                  : "bg-alerta/12 text-alerta"
              )}
            >
              {resumo.publicado ? (
                <Eye className="size-3" />
              ) : (
                <EyeOff className="size-3" />
              )}
              {resumo.publicado ? "Publicada" : "Rascunho"}
            </span>
            <FormTrilha trilha={resumo} />
          </div>
          <h1 className="mt-2 text-2xl md:text-3xl">{resumo.titulo}</h1>
          <p className="mt-1 text-cinza-suave">
            {aulas.length} {aulas.length === 1 ? "aula cadastrada" : "aulas cadastradas"}
            {" · "}
            {aulas.filter((a) => a.video_url).length} com vídeo
          </p>
        </div>

        <div className="flex items-center gap-2">
          {resumo.publicado && (
            <Link
              href={`/app/academy/${resumo.slug}`}
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-semibold text-cinza-suave transition-colors hover:bg-verde-menta hover:text-azul-medico"
            >
              Ver como aluno
              <ExternalLink className="size-3.5" />
            </Link>
          )}
          <FormAula courseId={resumo.id} proximaOrdem={proximaOrdem} />
        </div>
      </header>

      {aulas.length === 0 ? (
        <p className="mt-8 rounded-lg border border-dashed border-border bg-white px-6 py-16 text-center text-cinza-suave">
          Nenhuma aula cadastrada. Adicione a primeira e cole o link do vídeo.
        </p>
      ) : (
        <ol className="mt-8 space-y-2">
          {aulas.map((a, i) => (
            <li
              key={a.id}
              className="flex items-center gap-4 rounded-lg border border-border bg-white p-4 shadow-soft"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-branco-clinico text-xs font-semibold text-cinza-suave">
                {String(i + 1).padStart(2, "0")}
              </span>

              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-medium text-azul-medico">
                  {a.titulo}
                  {!a.publicado && (
                    <span className="rounded-full bg-alerta/12 px-2 py-0.5 text-[10px] font-semibold text-alerta">
                      rascunho
                    </span>
                  )}
                </p>
                {a.descricao && (
                  <p className="mt-0.5 truncate text-sm text-cinza-suave">
                    {a.descricao}
                  </p>
                )}
                <p className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-cinza-suave">
                  <span
                    className={cn(
                      "flex items-center gap-1.5",
                      a.video_url ? "text-sucesso" : "text-alerta"
                    )}
                  >
                    {a.video_url ? (
                      <Video className="size-3.5" />
                    ) : (
                      <VideoOff className="size-3.5" />
                    )}
                    {a.video_url ? "vídeo publicado" : "sem vídeo"}
                  </span>
                  {a.material_url && (
                    <span className="flex items-center gap-1.5">
                      <FileText className="size-3.5 text-teal" />
                      material
                    </span>
                  )}
                  {a.duracao_min ? <span>{a.duracao_min} min</span> : null}
                  <span className="font-mono">/{a.slug}</span>
                </p>
              </div>

              <FormAula courseId={resumo.id} aula={a} />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
