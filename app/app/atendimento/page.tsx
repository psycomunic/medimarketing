import { ModuloPlaceholder } from "@/components/app/modulo-placeholder";
import { exigirModulo } from "@/lib/acesso";

export const metadata = { title: "Atendimento" };

export default async function AtendimentoPage() {
  await exigirModulo("atendimento");

  return (
    <ModuloPlaceholder
      id="atendimento"
      itens={[
        "Caixa de entrada única de WhatsApp, Instagram Direct e Facebook",
        "Conversa vinculada à ficha do lead ou do paciente no CRM",
        "Respostas rápidas e biblioteca de scripts por especialidade",
        "Distribuição de conversas entre as atendentes",
        "Marcar uma conversa como oportunidade comercial",
        "Histórico completo do que foi dito ao paciente",
      ]}
      nota="Entra na Fase 3. A conexão com o WhatsApp usa a API oficial (Cloud API). Falta definir o provedor antes da implementação."
    />
  );
}
