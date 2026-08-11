import Link from "next/link";
import { GraduationCap, PlayCircle, Clock, Award, ArrowRight } from "lucide-react";
import { exigirModulo } from "@/lib/acesso";
import { getTrilhas } from "@/lib/supabase/academy";
import { cn } from "@/lib/utils";

export const metadata = { title: "Academy" };

const rotuloNivel: Record<string, string> = {
  essencial: "Essencial",
  intermediario: "Intermediário",
  avancado: "Avançado",
};

export default async function AcademyPage() {
  const { profile, role } = await exigirModulo("academy");
  const trilhas = await getTrilhas(role, profile.id);

  const aulasTotal = trilhas.reduce((s, t) => s + t.aulas, 0);
  const aulasFeitas = trilhas.reduce((s, t) => s + t.concluidas, 0);
  const concluidas = trilhas.filter((t) => t.aulas > 0 && t.percentual === 100).length;
  const geral = aulasTotal ? Math.round((aulasFeitas / aulasTotal) * 100) : 0;

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 md:px-8 md:py-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-verde-menta text-teal">
            <GraduationCap className="size-6" />
          </span>
          <div>
            <h1 className="text-2xl md:text-3xl">Medi Academy</h1>
            <p className="mt-1 max-w-xl text-cinza-suave">
              Trilhas curtas e práticas para a sua equipe. Assista no seu ritmo,
              tire dúvidas na própria aula e receba o certificado ao concluir.
            </p>
          </div>
        </div>
      </header>

      {/* Progresso geral */}
      <section className="mt-8 rounded-lg border border-border bg-white p-6 shadow-soft">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-cinza-suave">Seu progresso</p>
            <p className="mt-1 font-heading text-3xl font-bold text-azul-medico">
              {geral}%
            </p>
          </div>
          <div className="flex gap-6 text-sm text-cinza-suave">
            <span>
              <strong className="text-azul-medico">{aulasFeitas}</strong> de{" "}
              {aulasTotal} aulas
            </span>
            <span>
              <strong className="text-azul-medico">{concluidas}</strong>{" "}
              {concluidas === 1 ? "trilha concluída" : "trilhas concluídas"}
            </span>
          </div>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-verde-menta">
          <div
            className="h-full rounded-full bg-teal transition-all"
            style={{ width: `${geral}%` }}
          />
        </div>
      </section>

      {/* Trilhas */}
      {trilhas.length === 0 ? (
        <p className="mt-8 rounded-lg border border-dashed border-border bg-white px-6 py-16 text-center text-cinza-suave">
          Nenhuma trilha liberada para o seu perfil ainda.
        </p>
      ) : (
        <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {trilhas.map((t) => {
            const completa = t.aulas > 0 && t.percentual === 100;
            return (
              <Link
                key={t.id}
                href={`/app/academy/${t.slug}`}
                className="group flex flex-col rounded-lg border border-border bg-white p-6 shadow-soft transition-all hover:-translate-y-1 hover:border-teal/40 hover:shadow-card"
              >
                <div className="flex items-start justify-between gap-3">
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide",
                      completa
                        ? "bg-sucesso/12 text-sucesso"
                        : "bg-verde-menta text-teal"
                    )}
                  >
                    {completa ? "Concluída" : rotuloNivel[t.nivel] ?? t.nivel}
                  </span>
                  {completa && <Award className="size-5 text-sucesso" />}
                </div>

                <h2 className="mt-4 text-lg font-semibold leading-snug text-azul-medico">
                  {t.titulo}
                </h2>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-cinza-suave">
                  {t.resumo}
                </p>

                <div className="mt-5 flex items-center gap-4 text-xs text-cinza-suave">
                  <span className="flex items-center gap-1.5">
                    <PlayCircle className="size-4 text-teal" />
                    {t.aulas} {t.aulas === 1 ? "aula" : "aulas"}
                  </span>
                  {t.duracao_total > 0 && (
                    <span className="flex items-center gap-1.5">
                      <Clock className="size-4 text-teal" />
                      {t.duracao_total} min
                    </span>
                  )}
                </div>

                <div className="mt-3">
                  <div className="h-1.5 overflow-hidden rounded-full bg-verde-menta">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        completa ? "bg-sucesso" : "bg-teal"
                      )}
                      style={{ width: `${t.percentual}%` }}
                    />
                  </div>
                  <p className="mt-2 flex items-center justify-between text-xs text-cinza-suave">
                    <span>
                      {t.concluidas}/{t.aulas} concluídas
                    </span>
                    <span className="flex items-center gap-1 font-semibold text-teal opacity-0 transition-opacity group-hover:opacity-100">
                      {t.concluidas > 0 ? "Continuar" : "Começar"}
                      <ArrowRight className="size-3.5" />
                    </span>
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
