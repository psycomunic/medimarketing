import { ModuloPlaceholder } from "@/components/app/modulo-placeholder";
import { exigirModulo } from "@/lib/acesso";

export const metadata = { title: "CRM e Funil" };

export default async function CrmPage() {
  await exigirModulo("crm");

  return (
    <ModuloPlaceholder
      id="crm"
      itens={[
        "Cadastro de leads e pacientes da clínica",
        "Funil visual: novo → em contato → agendado → compareceu → em tratamento",
        "Origem de cada lead ligada à campanha que o trouxe",
        "Histórico de interações por paciente",
        "Tarefas e follow-ups para a equipe de atendimento",
        "Tags e segmentação para as réguas de retenção",
      ]}
    />
  );
}
