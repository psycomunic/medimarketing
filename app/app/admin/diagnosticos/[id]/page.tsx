import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download } from "lucide-react";
import { exigirModulo } from "@/lib/acesso";
import { emModoDemo } from "@/lib/supabase/queries";
import { getFormularioAdmin } from "@/lib/supabase/formularios";
import type { TipoEventoFormulario } from "@/lib/supabase/types";
import { LeituraFormulario } from "@/components/app/formularios/leitura";
import { BotaoImprimir } from "@/components/app/formularios/botao-imprimir";
import { StatusBadge } from "@/components/app/formularios/admin-lista";
import { AcoesStatus, NovaNota } from "@/components/app/formularios/admin-acoes";
import { CopiarLink } from "@/components/app/formularios/copiar-link";
import { urlBase } from "@/lib/lembretes";
import { CapaFormulario } from "@/components/app/formularios/comum";
import { formatarData, formatarDataHora } from "@/lib/formularios/formato";

export const metadata = { title: "Diagnóstico" };

const EVENTO: Record<TipoEventoFormulario, string> = {
  liberado: "Liberado para a clínica",
  enviado: "Enviado pela clínica",
  reaberto: "Reaberto para edição",
  revisado: "Marcado como revisado",
};

export default async function DiagnosticoAdminPage({
  params,
}: {
  params: { id: string };
}) {
  await exigirModulo("admin-diagnosticos");
  const [d, demo] = await Promise.all([getFormularioAdmin(params.id), emModoDemo()]);
  if (!d) notFound();

  const { resposta, modelo } = d;

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 md:px-8 md:py-10">
      <div className="print:hidden">
        <Link
          href="/app/admin/diagnosticos"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-cinza-suave hover:text-azul-medico"
        >
          <ArrowLeft className="size-4" /> Diagnósticos
        </Link>

        <header className="mt-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl md:text-3xl">{d.clinica}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-cinza-suave">
              <StatusBadge status={resposta.status} />
              <span>{resposta.progresso}% preenchido</span>
              <span>Atualizado em {formatarDataHora(resposta.updated_at)}</span>
            </div>
          </div>
        </header>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] print:mt-0 print:block">
        <div className="min-w-0">
          <div className="hidden print:block">
            <CapaFormulario schema={modelo.schema} clinica={d.clinica} />
          </div>
          <p className="mb-6 text-sm text-cinza-suave print:mt-6">
            Respondido por{" "}
            <strong className="text-cinza-texto">{resposta.respondente_nome || "—"}</strong>
            {resposta.respondente_cargo && ` · ${resposta.respondente_cargo}`}
            {resposta.data_referencia && ` · ${formatarData(resposta.data_referencia)}`}
          </p>
          <LeituraFormulario
            schema={modelo.schema}
            respostas={resposta.respostas}
            clinica={d.clinica}
            demo={demo}
          />
        </div>

        <aside className="grid content-start gap-4 print:hidden lg:sticky lg:top-6">
          <section className="rounded-lg border border-border bg-white p-5 shadow-soft">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-teal">Status</h2>
            <dl className="mt-3 grid gap-1.5 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-cinza-suave">Enviado</dt>
                <dd>{formatarData(resposta.enviado_em)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-cinza-suave">Revisado</dt>
                <dd className="text-right">
                  {formatarData(resposta.revisado_em)}
                  {d.revisor && <span className="block text-xs text-cinza-suave">{d.revisor}</span>}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-cinza-suave">Modelo</dt>
                <dd>
                  {modelo.titulo} · v{modelo.versao}
                </dd>
              </div>
            </dl>
            <div className="mt-4">
              <AcoesStatus id={resposta.id} status={resposta.status} demo={demo} />
            </div>
            {resposta.status !== "rascunho" && (
              <div className="mt-3 grid gap-2 border-t border-border pt-3">
                <Link
                  href={`/app/admin/diagnosticos/${resposta.id}/importar`}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-coral px-6 text-sm font-semibold text-white shadow-cta hover:bg-[#ff5252]"
                >
                  Levar para o painel
                </Link>
                <Link
                  href={`/app/clinicas/${resposta.organization_id}`}
                  className="text-center text-sm font-medium text-teal hover:underline"
                >
                  Ver evolução da clínica
                </Link>
              </div>
            )}
          </section>

          <section className="rounded-lg border border-border bg-white p-5 shadow-soft">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-teal">
              Link para a clínica
            </h2>
            <div className="mt-3">
              <CopiarLink url={`${urlBase()}/diagnostico/${resposta.token}`} clinica={d.clinica} />
            </div>
          </section>

          <section className="rounded-lg border border-border bg-white p-5 shadow-soft">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-teal">Exportar</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <BotaoImprimir />
              <a
                href={`/app/admin/diagnosticos/${resposta.id}/exportar?formato=csv`}
                className="inline-flex h-9 items-center gap-2 rounded-full border-2 border-azul-medico/20 bg-white px-4 text-sm font-semibold text-azul-medico hover:border-teal hover:text-teal"
              >
                <Download className="size-4" /> CSV
              </a>
              <a
                href={`/app/admin/diagnosticos/${resposta.id}/exportar?formato=json`}
                className="inline-flex h-9 items-center gap-2 rounded-full border-2 border-azul-medico/20 bg-white px-4 text-sm font-semibold text-azul-medico hover:border-teal hover:text-teal"
              >
                <Download className="size-4" /> JSON
              </a>
            </div>
          </section>

          <section className="rounded-lg border border-border bg-white p-5 shadow-soft">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-teal">Notas internas</h2>
            <p className="mt-1 text-xs text-cinza-suave">Só a equipe Medi Marketing vê.</p>
            <div className="mt-3">
              <NovaNota id={resposta.id} demo={demo} />
            </div>
            {d.notas.length > 0 && (
              <ul className="mt-4 grid gap-3">
                {d.notas.map((n) => (
                  <li key={n.id} className="rounded-md bg-branco-clinico p-3 text-sm">
                    <p className="whitespace-pre-wrap break-words text-cinza-texto">{n.texto}</p>
                    <p className="mt-1.5 text-xs text-cinza-suave">
                      {n.autor ?? "Equipe"} · {formatarDataHora(n.created_at)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {d.eventos.length > 0 && (
            <section className="rounded-lg border border-border bg-white p-5 shadow-soft">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-teal">Histórico</h2>
              <ol className="mt-3 grid gap-2 text-sm">
                {d.eventos.map((e) => (
                  <li key={e.id}>
                    <span className="text-cinza-texto">{EVENTO[e.tipo]}</span>
                    <span className="block text-xs text-cinza-suave">
                      {formatarDataHora(e.created_at)}
                      {e.autor && ` · ${e.autor}`}
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
