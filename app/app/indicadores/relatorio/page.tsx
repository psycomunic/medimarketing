import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { exigirModulo } from "@/lib/acesso";
import { getIndicadores } from "@/lib/supabase/indicadores";
import { getPlano } from "@/lib/supabase/evolucao";
import { RelatorioMensal } from "@/components/app/evolucao/relatorio";

export const metadata = { title: "Relatório mensal" };

/** O relatório do mês pelo lado da clínica: o mesmo que a equipe apresenta. */
export default async function RelatorioIndicadoresPage({
  searchParams,
}: {
  searchParams: { mes?: string };
}) {
  const { organizacao } = await exigirModulo("indicadores");
  const [meses, plano] = await Promise.all([
    getIndicadores(organizacao?.id ?? null, 36),
    getPlano(organizacao?.id ?? null),
  ]);
  const ultimo = meses[meses.length - 1]?.mes;
  const mes = /^\d{4}-\d{2}-01$/.test(searchParams.mes ?? "") ? searchParams.mes! : ultimo;

  return (
    <div className="mx-auto max-w-5xl px-5 py-8 md:px-8 md:py-10 print:p-0">
      <Link
        href="/app/indicadores"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-cinza-suave hover:text-azul-medico print:hidden"
      >
        <ArrowLeft className="size-4" /> Indicadores
      </Link>
      {mes ? (
        <RelatorioMensal
          clinica={organizacao?.nome ?? "Clínica"}
          meses={meses}
          plano={plano}
          mes={mes}
          hrefMes={(m) => `/app/indicadores/relatorio?mes=${m}`}
        />
      ) : (
        <p className="mt-8 text-cinza-suave">Ainda não há meses lançados.</p>
      )}
    </div>
  );
}
