import Link from "next/link";
import { ArrowLeft, Info } from "lucide-react";
import { exigirModulo } from "@/lib/acesso";
import { emModoDemo, getConsultas } from "@/lib/supabase/queries";
import { getPrecos, getReceitas } from "@/lib/supabase/financeiro-dados";
import { agruparSemServico } from "@/lib/financeiro/classificar";
import { ClassificarLista } from "@/components/app/financeiro/classificar-ui";

export const metadata = { title: "Classificar atendimentos · Financeiro" };

/** Até onde olhar para trás. */
const MESES = 12;

export default async function ClassificarPage() {
  const { organizacao } = await exigirModulo("financeiro");
  const orgId = organizacao?.id ?? null;
  const agora = new Date();
  const desde = new Date(agora.getFullYear(), agora.getMonth() - MESES, 1);
  const iso = (d: Date) => d.toLocaleDateString("sv-SE");

  const [precos, consultasTodas, receitas, demo] = await Promise.all([
    getPrecos(orgId),
    getConsultas(desde.toISOString(), agora.toISOString()),
    getReceitas(orgId, iso(desde), iso(agora)),
    emModoDemo(),
  ]);
  const consultas = orgId ? consultasTodas.filter((c) => c.organization_id === orgId) : consultasTodas;
  // Sem a coluna, o banco ainda não tem o SQL da Fase 1
  const semSql = consultas.length > 0 && !("servico_id" in consultas[0]);
  const { grupos, catalogo } = agruparSemServico({ precos, consultas, receitas });

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <Link href="/app/financeiro/servicos" className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-cinza-suave hover:text-azul-medico">
        <ArrowLeft className="size-4" /> Serviços
      </Link>
      <header>
        <h2 className="font-heading text-lg font-semibold text-azul-medico">Classificar atendimentos antigos</h2>
        <p className="mt-1 max-w-3xl text-sm text-cinza-suave">
          Consultas e receitas dos últimos {MESES} meses que ainda não têm serviço, agrupadas por texto parecido. Confira a sugestão de cada
          grupo e aplique: as métricas de Serviços passam a contar esse histórico. Valores e descrições não mudam.
        </p>
      </header>

      {semSql ? (
        <p className="flex items-start gap-2 rounded-lg border border-alerta/40 bg-alerta/8 px-4 py-3 text-sm text-cinza-texto">
          <Info className="mt-0.5 size-4 shrink-0 text-alerta" />
          Rode antes o SQL dos serviços (Fase 1) no Supabase.
        </p>
      ) : !catalogo.length ? (
        <p className="flex items-start gap-2 rounded-lg border border-alerta/40 bg-alerta/8 px-4 py-3 text-sm text-cinza-texto">
          <Info className="mt-0.5 size-4 shrink-0 text-alerta" />
          <span>
            Cadastre antes os serviços na{" "}
            <Link href="/app/financeiro/configuracoes" className="font-medium text-teal hover:underline">
              Tabela de preços
            </Link>
            .
          </span>
        </p>
      ) : (
        <ClassificarLista
          grupos={grupos}
          servicos={catalogo.map((s) => ({ id: s.id, nome: s.nome, categoria: s.categoria }))}
          demo={demo}
        />
      )}
    </div>
  );
}
