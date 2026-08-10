import { ModuloPlaceholder } from "@/components/app/modulo-placeholder";
import { exigirModulo } from "@/lib/acesso";

export const metadata = { title: "Configurações" };

export default async function ConfiguracoesPage() {
  await exigirModulo("configuracoes");

  return (
    <ModuloPlaceholder
      id="configuracoes"
      itens={[
        "Dados da clínica e plano contratado",
        "Usuários da equipe e papéis de acesso",
        "Integrações: Meta Ads, Google Ads, GA4 e WhatsApp",
        "Disponibilidade padrão da agenda",
        "Personalização de mensagens e lembretes",
      ]}
    />
  );
}
