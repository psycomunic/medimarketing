import Link from "next/link";
import {
  LibraryBig,
  PlayCircle,
  Eye,
  EyeOff,
  ArrowRight,
  Clock,
} from "lucide-react";
import { FormTrilha } from "@/components/app/admin/form-trilha";
import { exigirModulo } from "@/lib/acesso";
import { getTrilhasAdmin } from "@/lib/supabase/academy";
import { rotuloPapel } from "@/lib/rbac";
import { cn } from "@/lib/utils";

export const metadata = { title: "Conteúdo da Academy" };

const rotuloNivel: Record<string, string> = {
  essencial: "Essencial",
  intermediario: "Intermediário",
  avancado: "Avançado",
};

export default async function AdminAcademyPage() {
  await exigirModulo("admin-academy");
  const trilhas = await getTrilhasAdmin();

  const publicadas = trilhas.filter((t) => t.publicado).length;
  const totalAulas = trilhas.reduce((s, t) => s + t.aulas, 0);
  const proximaOrdem = trilhas.length
    ? Math.max(...trilhas.map((t) => t.ordem)) + 1
    : 1;

  return (
    <div className="mx-auto max-w-5xl px-5 py-8 md:px-8 md:py-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-verde-menta text-teal">
            <LibraryBig className="size-6" />
          </span>
          <div>
            <h1 className="text-2xl md:text-3xl">Conteúdo da Academy</h1>
            <p className="mt-1 max-w-xl text-cinza-suave">
              Crie trilhas, cadastre as aulas e publique os vídeos. As clínicas
              veem só o que estiver publicado e liberado para o papel delas.
            </p>
          </div>
        </div>
        <FormTrilha proximaOrdem={proximaOrdem} />
      </header>

      <div className="mt-8 flex flex-wrap gap-6 rounded-lg border border-border bg-white px-6 py-4 text-sm shadow-soft">
        <span className="text-cinza-suave">
          <strong className="text-azul-medico">{trilhas.length}</strong> trilhas
        </span>
        <span className="text-cinza-suave">
          <strong className="text-azul-medico">{publicadas}</strong> publicadas
        </span>
        <span className="text-cinza-suave">
          <strong className="text-azul-medico">{totalAulas}</strong> aulas no total
        </span>
      </div>

      {trilhas.length === 0 ? (
        <p className="mt-6 rounded-lg border border-dashed border-border bg-white px-6 py-16 text-center text-cinza-suave">
          Nenhuma trilha criada ainda. Comece pela primeira.
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {trilhas.map((t) => (
            <li
              key={t.id}
              className="rounded-lg border border-border bg-white p-5 shadow-soft transition-shadow hover:shadow-card"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide",
                        t.publicado
                          ? "bg-sucesso/12 text-sucesso"
                          : "bg-alerta/12 text-alerta"
                      )}
                    >
                      {t.publicado ? (
                        <Eye className="size-3" />
                      ) : (
                        <EyeOff className="size-3" />
                      )}
                      {t.publicado ? "Publicada" : "Rascunho"}
                    </span>
                    <span className="rounded-full bg-verde-menta px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-teal">
                      {rotuloNivel[t.nivel] ?? t.nivel}
                    </span>
                    <span className="text-xs text-cinza-suave">
                      ordem {t.ordem}
                    </span>
                  </div>

                  <h2 className="mt-2.5 text-lg font-semibold text-azul-medico">
                    {t.titulo}
                  </h2>
                  {t.resumo && (
                    <p className="mt-1 text-sm text-cinza-suave">{t.resumo}</p>
                  )}

                  <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-cinza-suave">
                    <span className="flex items-center gap-1.5">
                      <PlayCircle className="size-3.5 text-teal" />
                      {t.aulas} {t.aulas === 1 ? "aula" : "aulas"}
                    </span>
                    {t.duracao_total > 0 && (
                      <span className="flex items-center gap-1.5">
                        <Clock className="size-3.5 text-teal" />
                        {t.duracao_total} min
                      </span>
                    )}
                    <span>
                      Visível para: {t.papeis.map((p) => rotuloPapel(p)).join(", ")}
                    </span>
                    <span className="font-mono">/{t.slug}</span>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <FormTrilha trilha={t} />
                  <Link
                    href={`/app/admin/academy/${t.id}`}
                    className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-semibold text-teal transition-colors hover:bg-verde-menta"
                  >
                    Aulas
                    <ArrowRight className="size-4" />
                  </Link>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
