import { ModuloPlaceholder } from "@/components/app/modulo-placeholder";
import { exigirModulo } from "@/lib/acesso";

export const metadata = { title: "Clínicas" };

// Uso interno da Medi Marketing — só o super admin acessa.
export default async function ClinicasPage() {
  await exigirModulo("clinicas");

  return (
    <ModuloPlaceholder
      id="clinicas"
      itens={[
        "Todas as clínicas atendidas, com plano e status",
        "Leads comerciais vindos do site",
        "Criar clínica e convidar a equipe dela",
        "Entrar no painel de uma clínica para dar suporte",
        "Visão consolidada de resultados da carteira",
      ]}
      nota="Entra na Fase 2, junto com o CRM. O isolamento entre clínicas já está garantido no banco: só o super admin enxerga mais de uma organização."
    />
  );
}
