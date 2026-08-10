import { ModuloPlaceholder } from "@/components/app/modulo-placeholder";
import { exigirModulo } from "@/lib/acesso";

export const metadata = { title: "Marketing" };

export default async function MarketingPage() {
  await exigirModulo("marketing");

  return (
    <ModuloPlaceholder
      id="marketing"
      itens={[
        "Campanhas de Meta Ads e Google Ads num painel só",
        "Investimento, leads gerados e custo por lead",
        "Criativos ativos e desempenho de cada um",
        "Retorno sobre o investimento, em linguagem simples",
        "Dados do GA4 sobre o comportamento no site",
        "Exportar o relatório do período em PDF",
      ]}
      nota="Entra na Fase 4. Enquanto as integrações de Ads não estiverem conectadas, o módulo aceita lançamento manual dos números do período."
    />
  );
}
