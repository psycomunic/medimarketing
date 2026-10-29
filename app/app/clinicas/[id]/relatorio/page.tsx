import { notFound } from "next/navigation";
import { exigirModulo } from "@/lib/acesso";
import { getCliente, getIndicadores } from "@/lib/supabase/indicadores";
import { getPlano } from "@/lib/supabase/evolucao";
import { RelatorioMensal } from "@/components/app/evolucao/relatorio";

export const metadata = { title: "Relatório mensal" };

export default async function RelatorioClientePage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { mes?: string };
}) {
  await exigirModulo("clinicas");
  const cliente = await getCliente(params.id);
  if (!cliente) notFound();

  const [meses, plano] = await Promise.all([getIndicadores(cliente.id, 36), getPlano(cliente.id)]);
  const ultimo = meses[meses.length - 1]?.mes;
  const mes = /^\d{4}-\d{2}-01$/.test(searchParams.mes ?? "") ? searchParams.mes! : ultimo;

  if (!mes) {
    return <p className="mx-auto max-w-3xl px-5 py-10 text-cinza-suave">Ainda não há meses lançados para esta clínica.</p>;
  }
  return (
    <RelatorioMensal
      clinica={cliente.nome}
      logoUrl={cliente.logo_url ?? null}
      meses={meses}
      plano={plano}
      mes={mes}
      hrefMes={(m) => `/app/clinicas/${cliente.id}/relatorio?mes=${m}`}
      voltar={{ href: `/app/clinicas/${cliente.id}`, rotulo: cliente.nome }}
    />
  );
}
