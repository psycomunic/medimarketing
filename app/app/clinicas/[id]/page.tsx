import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, ClipboardCheck, Upload } from "lucide-react";
import { exigirModulo } from "@/lib/acesso";
import { getCliente, getIndicadores } from "@/lib/supabase/indicadores";
import { getPlano } from "@/lib/supabase/evolucao";
import { getFormulariosAdmin } from "@/lib/supabase/formularios";
import { PainelEvolucao } from "@/components/app/evolucao/painel-evolucao";
import { GraficoFunil, GraficoRetorno } from "@/components/app/indicadores/graficos";
import { StatusBadge } from "@/components/app/formularios/admin-lista";
import { Button } from "@/components/ui/button";
import { formatarData } from "@/lib/formularios/formato";
import { mesPorExtenso } from "@/lib/indicadores";
import { SLUG_DIAGNOSTICO } from "@/lib/formularios/diagnostico-clinica";
import { SLUG_CHECKIN } from "@/lib/formularios/checkin-mensal";
import { mesAnterior } from "@/lib/formularios/periodico";
import { GerarCheckin } from "@/components/app/evolucao/gerar-checkin";
import { emModoDemo } from "@/lib/supabase/queries";
import { FileText } from "lucide-react";

export const metadata = { title: "Cliente" };

/**
 * Uma clínica da carteira, pelo olhar da equipe: o diagnóstico, o marco
 * zero, a meta e a evolução mês a mês — o mesmo que a clínica vê nos
 * Indicadores dela, sem precisar entrar na conta de ninguém.
 */
export default async function ClientePage({ params }: { params: { id: string } }) {
  await exigirModulo("clinicas");
  const cliente = await getCliente(params.id);
  if (!cliente) notFound();

  const [meses, plano, diagnosticos, todosCheckins, demo] = await Promise.all([
    getIndicadores(cliente.id, 36),
    getPlano(cliente.id),
    getFormulariosAdmin(SLUG_DIAGNOSTICO),
    getFormulariosAdmin(SLUG_CHECKIN),
    emModoDemo(),
  ]);
  const diagnostico = diagnosticos.find((d) => d.organization_id === cliente.id) ?? null;
  const checkins = todosCheckins
    .filter((c) => c.organization_id === cliente.id)
    .sort((a, b) => (b.referencia ?? "").localeCompare(a.referencia ?? ""));

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 md:px-8 md:py-10">
      <Link
        href="/app/clinicas"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-cinza-suave hover:text-azul-medico"
      >
        <ArrowLeft className="size-4" /> Clientes
      </Link>

      <header className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-verde-menta text-teal">
            <Building2 className="size-6" />
          </span>
          <div>
            <h1 className="text-2xl md:text-3xl">{cliente.nome}</h1>
            <p className="mt-1 text-cinza-suave">
              {[cliente.especialidade, cliente.cidade].filter(Boolean).join(" · ") || "Clínica"}
            </p>
          </div>
        </div>
        {meses.length > 0 && (
          <Button asChild variant="outline" size="sm">
            <Link href={`/app/clinicas/${cliente.id}/relatorio`}>
              <FileText /> Relatório do mês
            </Link>
          </Button>
        )}
      </header>

      <section className="mt-6 flex flex-col gap-3 rounded-lg border border-border bg-white p-5 shadow-soft sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <ClipboardCheck className="mt-0.5 size-5 shrink-0 text-teal" />
          {diagnostico ? (
            <div>
              <p className="flex flex-wrap items-center gap-2 font-semibold text-azul-medico">
                Diagnóstico inicial <StatusBadge status={diagnostico.status} />
              </p>
              <p className="text-sm text-cinza-suave">
                {diagnostico.progresso}% preenchido
                {diagnostico.enviado_em && ` · enviado em ${formatarData(diagnostico.enviado_em)}`}
                {plano?.importado_em && ` · levado ao painel em ${formatarData(plano.importado_em)}`}
              </p>
            </div>
          ) : (
            <p className="text-sm text-cinza-suave">O diagnóstico ainda não foi liberado para esta clínica.</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {diagnostico ? (
            <>
              <Button asChild variant="outline" size="sm">
                <Link href={`/app/admin/diagnosticos/${diagnostico.id}`}>Ver respostas</Link>
              </Button>
              {diagnostico.status !== "rascunho" && (
                <Button asChild size="sm">
                  <Link href={`/app/admin/diagnosticos/${diagnostico.id}/importar`}>
                    <Upload /> {plano?.importado_em ? "Revisar plano e números" : "Levar para o painel"}
                  </Link>
                </Button>
              )}
            </>
          ) : (
            <Button asChild size="sm">
              <Link href="/app/admin/diagnosticos">Liberar diagnóstico</Link>
            </Button>
          )}
        </div>
      </section>

      <PainelEvolucao meses={meses} plano={plano} />

      {plano?.importado_em && (
        <section className="mt-6 grid gap-6 rounded-lg border border-border bg-white p-6 shadow-soft lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-azul-medico">Check-ins mensais</h2>
            <p className="mt-1 text-sm text-cinza-suave">
              Todo dia 1 a clínica recebe o check-in do mês que fechou. Quando ela envia, você revisa
              e leva os números para o painel.
            </p>
            {checkins.length === 0 ? (
              <p className="mt-4 text-sm text-cinza-suave">Nenhum check-in ainda.</p>
            ) : (
              <ul className="mt-4 divide-y divide-border">
                {checkins.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 font-medium text-azul-medico">
                        {c.referencia ? mesPorExtenso(`${c.referencia}-01`) : "Check-in"}
                        <StatusBadge status={c.status} />
                      </p>
                      <p className="text-xs text-cinza-suave">
                        {c.importado_em
                          ? `No painel desde ${formatarData(c.importado_em)}`
                          : c.enviado_em
                            ? `Enviado em ${formatarData(c.enviado_em)}, aguardando revisão`
                            : `${c.progresso}% preenchido`}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/app/admin/diagnosticos/${c.id}`}>Abrir</Link>
                      </Button>
                      {c.status !== "rascunho" && !c.importado_em && (
                        <Button asChild size="sm">
                          <Link href={`/app/admin/diagnosticos/${c.id}/importar`}>
                            <Upload /> Levar para o painel
                          </Link>
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="rounded-lg bg-branco-clinico p-4">
            <h3 className="text-sm font-semibold text-azul-medico">Mandar agora</h3>
            <p className="mb-3 mt-1 text-xs text-cinza-suave">
              Gera o check-in de um mês e o link para o WhatsApp, sem esperar a rotina.
            </p>
            <GerarCheckin
              organizationId={cliente.id}
              clinica={cliente.nome}
              mesPadrao={mesAnterior()}
              demo={demo}
            />
          </div>
        </section>
      )}

      {meses.length > 0 ? (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section className="rounded-lg border border-border bg-white p-6 shadow-soft">
            <h2 className="text-lg font-semibold text-azul-medico">Investimento e faturamento</h2>
            <p className="mb-4 mt-1 text-sm text-cinza-suave">Últimos {meses.length} meses.</p>
            <GraficoRetorno meses={meses} />
          </section>
          <section className="rounded-lg border border-border bg-white p-6 shadow-soft">
            <h2 className="text-lg font-semibold text-azul-medico">Evolução do funil</h2>
            <p className="mb-4 mt-1 text-sm text-cinza-suave">Leads, agendamentos e comparecimento.</p>
            <GraficoFunil meses={meses} />
          </section>
        </div>
      ) : (
        !plano && (
          <p className="mt-8 rounded-lg border border-dashed border-border bg-white p-8 text-center text-sm text-cinza-suave">
            Ainda não há números desta clínica. Eles chegam pelo diagnóstico ou pelos lançamentos
            mensais em Indicadores.
          </p>
        )
      )}
    </div>
  );
}
