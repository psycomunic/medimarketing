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

  if (!mes) {
    return <p className="mx-auto max-w-3xl px-5 py-10 text-cinza-suave">Ainda não há meses lançados.</p>;
  }
  return (
    <RelatorioMensal
      clinica={organizacao?.nome ?? "Clínica"}
      logoUrl={organizacao?.logo_url ?? null}
      meses={meses}
      plano={plano}
      mes={mes}
      hrefMes={(m) => `/app/indicadores/relatorio?mes=${m}`}
      voltar={{ href: "/app/indicadores", rotulo: "Indicadores" }}
    />
  );
}
