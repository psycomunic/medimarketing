import { exigirModulo } from "@/lib/acesso";
import { emModoDemo } from "@/lib/supabase/queries";
import { getHistorico } from "@/lib/supabase/financeiro-dados";
import { lerHistorico } from "@/lib/financeiro/historico";
import { HistoricoCaixa } from "@/components/app/financeiro/historico";

export const metadata = { title: "Histórico de caixa · Financeiro" };

export default async function HistoricoPage() {
  const { organizacao, role } = await exigirModulo("financeiro");
  const [{ fechamentos, composicoes }, demo] = await Promise.all([getHistorico(organizacao?.id ?? null), emModoDemo()]);
  return (
    <HistoricoCaixa
      h={lerHistorico(fechamentos, composicoes)}
      fechamentos={fechamentos}
      composicoes={composicoes}
      podeEditar={role === "gestor" || role === "super_admin"}
      demo={demo}
      relatorioHref="/app/financeiro/relatorio-historico"
    />
  );
}
