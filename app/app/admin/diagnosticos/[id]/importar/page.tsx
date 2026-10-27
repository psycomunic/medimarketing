import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Upload } from "lucide-react";
import { exigirModulo } from "@/lib/acesso";
import { emModoDemo } from "@/lib/supabase/queries";
import { getFormularioAdmin } from "@/lib/supabase/formularios";
import { getIndicadores } from "@/lib/supabase/indicadores";
import { getPlano } from "@/lib/supabase/evolucao";
import { planoSugerido, propostaImportacao } from "@/lib/evolucao";
import { ImportarDiagnostico } from "@/components/app/evolucao/importar";

export const metadata = { title: "Levar diagnóstico para o painel" };

const fmt = (n: number | null | undefined) =>
  n == null ? "" : new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(Number(n));

export default async function ImportarPage({ params }: { params: { id: string } }) {
  await exigirModulo("admin-diagnosticos");
  const [d, demo] = await Promise.all([getFormularioAdmin(params.id), emModoDemo()]);
  if (!d) notFound();

  const { resposta, modelo } = d;
  const [indicadores, plano] = await Promise.all([
    getIndicadores(demo ? null : resposta.organization_id, 36),
    getPlano(resposta.organization_id),
  ]);

  const meses = propostaImportacao(modelo.schema, resposta.respostas);
  const sugerido = planoSugerido(resposta.respostas);
  const existentes: Record<string, string> = {};
  for (const m of indicadores) existentes[m.mes] = m.origem ?? "manual";

  // Reimportação parte do plano já gravado; a primeira, do que a clínica escreveu
  const planoInicial = {
    metaFaturamento: fmt(plano?.meta_faturamento ?? sugerido.metaSugerida),
    metaLeads: fmt(plano?.meta_leads),
    metaConsultas: fmt(plano?.meta_consultas),
    prazo: plano?.prazo?.slice(0, 7) ?? "",
    criterio: plano?.criterio_financeiro ?? sugerido.criterio,
    prioridades: plano?.prioridades ?? sugerido.prioridades,
    obstaculo: plano?.obstaculo ?? sugerido.obstaculo,
    observacoes: plano?.observacoes ?? "",
  };

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 md:px-8 md:py-10">
      <Link
        href={`/app/admin/diagnosticos/${resposta.id}`}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-cinza-suave hover:text-azul-medico"
      >
        <ArrowLeft className="size-4" /> Diagnóstico
      </Link>
      <header className="mt-4 flex items-start gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-verde-menta text-teal">
          <Upload className="size-6" />
        </span>
        <div>
          <h1 className="text-2xl md:text-3xl">Levar para o painel · {d.clinica}</h1>
          <p className="mt-1 max-w-2xl text-cinza-suave">
            Os números do diagnóstico viram os primeiros meses dos Indicadores da clínica e o marco
            zero do acompanhamento. Nada é gravado antes de você confirmar.
          </p>
        </div>
      </header>

      <ImportarDiagnostico
        respostaId={resposta.id}
        clinica={d.clinica}
        meses={meses}
        existentes={existentes}
        planoInicial={planoInicial}
        metaTexto={sugerido.metaTexto}
        demo={demo}
      />
    </div>
  );
}
