import { ModuloPlaceholder } from "@/components/app/modulo-placeholder";
import { exigirModulo } from "@/lib/acesso";

export const metadata = { title: "Indicadores" };

export default async function IndicadoresPage() {
  await exigirModulo("indicadores");

  return (
    <ModuloPlaceholder
      id="indicadores"
      itens={[
        "A linha inteira: investimento → leads → agendamentos → comparecimento → faturamento",
        "Custo por paciente novo e retorno sobre o investimento",
        "Ticket médio e valor do paciente ao longo do tempo (LTV)",
        "Comparativo entre períodos",
        "Acompanhamento por etapa do método (30, 90, 180 e 360 dias)",
        "Metas definidas no diagnóstico e evolução real",
      ]}
    />
  );
}
