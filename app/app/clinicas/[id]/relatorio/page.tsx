import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
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

  return (
    <div className="mx-auto max-w-5xl px-5 py-8 md:px-8 md:py-10 print:p-0">
      <Link
        href={`/app/clinicas/${cliente.id}`}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-cinza-suave hover:text-azul-medico print:hidden"
      >
        <ArrowLeft className="size-4" /> {cliente.nome}
      </Link>
      {mes ? (
        <RelatorioMensal
          clinica={cliente.nome}
          meses={meses}
          plano={plano}
          mes={mes}
          hrefMes={(m) => `/app/clinicas/${cliente.id}/relatorio?mes=${m}`}
        />
      ) : (
        <p className="mt-8 text-cinza-suave">Ainda não há meses lançados para esta clínica.</p>
      )}
    </div>
  );
}
