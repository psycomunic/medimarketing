import { ModuloPlaceholder } from "@/components/app/modulo-placeholder";
import { exigirModulo } from "@/lib/acesso";

export const metadata = { title: "Academy" };

export default async function AcademyPage() {
  await exigirModulo("academy");

  return (
    <ModuloPlaceholder
      id="academy"
      itens={[
        "Trilha Secretária Vendedora / Atendimento que Converte",
        "Contratação e gestão da secretária",
        "Reabordagem e reativação na prática",
        "Processo comercial da clínica",
        "Marketing para a clínica",
        "Onboarding da plataforma, por papel",
      ]}
      nota="Entra na Fase 5, com progresso por usuário e certificado ao final de cada trilha."
    />
  );
}
