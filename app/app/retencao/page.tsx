import { ModuloPlaceholder } from "@/components/app/modulo-placeholder";
import { exigirModulo } from "@/lib/acesso";

export const metadata = { title: "Retenção" };

export default async function RetencaoPage() {
  await exigirModulo("retencao");

  return (
    <ModuloPlaceholder
      id="retencao"
      itens={[
        "Régua de reabordagem para quem não fechou",
        "Régua de no-show para quem faltou",
        "Reativação da base parada há muito tempo",
        "Recall de retorno e revisão",
        "Editor de cadência: mensagens e intervalos",
        "Alerta de paciente parado há X dias e métricas de recuperação",
      ]}
    />
  );
}
