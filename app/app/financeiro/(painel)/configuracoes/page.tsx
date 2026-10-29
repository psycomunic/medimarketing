import { exigirModulo } from "@/lib/acesso";
import { emModoDemo } from "@/lib/supabase/queries";
import { getConfigFinanceira, getMinhasFaturas, getPrecos } from "@/lib/supabase/financeiro-dados";
import { MinhasFaturas } from "@/components/app/financeiro/listas-simples";
import { CONFIG_PADRAO } from "@/lib/financeiro/calculos";
import { FormConfig, TabelaPrecos } from "@/components/app/financeiro/config-ui";

export const metadata = { title: "Preços e taxas · Financeiro" };

export default async function ConfigFinanceiroPage() {
  const { organizacao } = await exigirModulo("financeiro");
  const orgId = organizacao?.id ?? null;
  const [config, precos, demo, faturas] = await Promise.all([
    getConfigFinanceira(orgId),
    getPrecos(orgId),
    emModoDemo(),
    getMinhasFaturas(orgId),
  ]);
  return (
    <div className="grid gap-5">
      <FormConfig config={config ?? CONFIG_PADRAO(orgId ?? "")} demo={demo} />
      <TabelaPrecos precos={precos} demo={demo} />
      {orgId && <MinhasFaturas faturas={faturas} />}
    </div>
  );
}
