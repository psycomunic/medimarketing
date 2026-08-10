import { ModuloPlaceholder } from "@/components/app/modulo-placeholder";
import { exigirModulo } from "@/lib/acesso";

export const metadata = { title: "Financeiro" };

export default async function FinanceiroPage() {
  await exigirModulo("financeiro");

  return (
    <ModuloPlaceholder
      id="financeiro"
      itens={[
        "Faturamento por procedimento e por especialidade",
        "Ticket médio por tipo de consulta",
        "Valor do paciente ao longo do tempo (LTV)",
        "Receita do período comparada à meta",
      ]}
      nota="Entra na Fase 5, de propósito enxuto: acompanha faturamento e ticket sem virar um ERP. O escopo final ainda precisa de confirmação."
    />
  );
}
