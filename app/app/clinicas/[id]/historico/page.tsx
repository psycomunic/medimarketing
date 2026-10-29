import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Wallet } from "lucide-react";
import { exigirModulo } from "@/lib/acesso";
import { emModoDemo } from "@/lib/supabase/queries";
import { getCliente } from "@/lib/supabase/indicadores";
import { getHistorico } from "@/lib/supabase/financeiro-dados";
import { lerHistorico } from "@/lib/financeiro/historico";
import { HistoricoCaixa } from "@/components/app/financeiro/historico";

export const metadata = { title: "Histórico de caixa" };

/** A equipe Medi vê e alimenta o histórico de caixa de cada cliente. */
export default async function HistoricoClientePage({ params }: { params: { id: string } }) {
  await exigirModulo("clinicas");
  const cliente = await getCliente(params.id);
  if (!cliente) notFound();
  const [{ fechamentos, composicoes }, demo] = await Promise.all([getHistorico(cliente.id), emModoDemo()]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-5 md:px-8 md:py-10">
      <Link href={`/app/clinicas/${cliente.id}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-cinza-suave hover:text-azul-medico">
        <ArrowLeft className="size-4" /> {cliente.nome}
      </Link>
      <header className="mt-4 flex items-start gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-verde-menta text-teal">
          <Wallet className="size-6" />
        </span>
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl">Histórico de caixa</h1>
          <p className="mt-1 text-cinza-suave">{cliente.nome} · fechamentos mensais e composição do período.</p>
        </div>
      </header>
      <div className="mt-6">
        <HistoricoCaixa
          h={lerHistorico(fechamentos, composicoes)}
          fechamentos={fechamentos}
          composicoes={composicoes}
          organizationId={cliente.id}
          podeEditar
          demo={demo}
          relatorioHref={`/app/financeiro/relatorio-historico?clinica=${cliente.id}`}
        />
      </div>
    </div>
  );
}
