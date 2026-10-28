import { AlertTriangle, CheckCircle2, Clock, Receipt } from "lucide-react";
import { emModoDemo } from "@/lib/supabase/queries";
import { getAgencia } from "@/lib/supabase/financeiro-dados";
import { resumoFaturas } from "@/lib/financeiro/agencia";
import { hojeIso } from "@/lib/financeiro/calculos";
import { Indicador, mesDaUrl } from "@/components/app/financeiro/ui";
import { pct, reais } from "@/components/graficos/formato";
import { ListaFaturas } from "@/components/app/agencia/faturas-ui";

export const metadata = { title: "Faturas · Financeiro da agência" };

export default async function FaturasPage({ searchParams }: { searchParams: { mes?: string } }) {
  const mes = mesDaUrl(searchParams.mes);
  const [{ faturas, clientes }, demo] = await Promise.all([getAgencia(), emModoDemo()]);
  const r = resumoFaturas(faturas, mes);
  const hoje = hojeIso();
  // As do mês, mais as vencidas de meses anteriores: é a lista de cobrança
  const lista = faturas.filter((f) => f.competencia.startsWith(mes) || (f.status === "aberta" && f.vencimento < hoje));
  return (
    <div className="grid gap-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Indicador icone={Receipt} rotulo="Faturado no mês" valor={reais(r.faturado)} />
        <Indicador icone={CheckCircle2} rotulo="Recebido" valor={reais(r.recebido)} nota={r.faturado ? `${pct((r.recebido / r.faturado) * 100)} do faturado` : undefined} />
        <Indicador icone={Clock} rotulo="Em aberto, no prazo" valor={reais(r.aberto)} />
        <Indicador
          icone={AlertTriangle}
          rotulo="Vencido"
          valor={reais(r.vencido)}
          nota={`${r.clientesInadimplentes} cliente${r.clientesInadimplentes === 1 ? "" : "s"}`}
          destaque={r.vencido > 0}
        />
      </div>
      <ListaFaturas faturas={lista} clientes={clientes} mes={mes} demo={demo} />
      <p className="text-xs text-cinza-suave">
        As mensalidades do mês são geradas sozinhas no dia 1 para todo contrato ativo. A baixa é manual até a integração com o banco ou o gateway de cobrança.
      </p>
    </div>
  );
}
