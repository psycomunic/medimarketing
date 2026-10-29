import { CalendarClock, FileSignature, Repeat, Users } from "lucide-react";
import { emModoDemo } from "@/lib/supabase/queries";
import { getAgencia } from "@/lib/supabase/financeiro-dados";
import { fimFidelidade } from "@/lib/financeiro/agencia";
import { hojeIso, somarDias } from "@/lib/financeiro/calculos";
import { Indicador } from "@/components/app/financeiro/ui";
import { reais } from "@/components/graficos/formato";
import { ListaContratos } from "@/components/app/agencia/contratos-ui";
import { FabNovoContrato } from "@/components/app/botoes-flutuantes";

export const metadata = { title: "Contratos · Financeiro da agência" };

export default async function ContratosPage() {
  const [{ contratos, clientes }, demo] = await Promise.all([getAgencia(), emModoDemo()]);
  const ativos = contratos.filter((c) => c.status === "ativo");
  const hoje = hojeIso();
  const em60 = somarDias(hoje, 60);
  const renovar = ativos.filter((c) => c.fidelidade_meses && fimFidelidade(c) >= hoje && fimFidelidade(c) <= em60);
  return (
    <div className="grid gap-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Indicador icone={FileSignature} rotulo="Contratos ativos" valor={String(ativos.length)} nota={`${contratos.filter((c) => c.status === "pausado").length} pausados`} />
        <Indicador icone={Repeat} rotulo="Mensalidades somadas" valor={reais(ativos.reduce((s, c) => s + Number(c.mensalidade), 0))} />
        <Indicador icone={Users} rotulo="Cancelados (histórico)" valor={String(contratos.filter((c) => c.status === "cancelado").length)} />
        <Indicador
          icone={CalendarClock}
          rotulo="Renovações em 60 dias"
          valor={String(renovar.length)}
          nota={renovar.length ? `${reais(renovar.reduce((s, c) => s + Number(c.mensalidade), 0))}/mês em jogo` : "Nenhuma fidelidade vencendo"}
          destaque={renovar.length > 0}
        />
      </div>
      <ListaContratos contratos={contratos} clientes={clientes} demo={demo} />
      <FabNovoContrato />
    </div>
  );
}
