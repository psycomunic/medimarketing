import { Settings, Building2 } from "lucide-react";
import { PainelConfiguracoes } from "@/components/app/configuracoes/painel";
import { exigirModulo } from "@/lib/acesso";
import { emModoDemo } from "@/lib/supabase/queries";
import { getEquipe } from "@/lib/supabase/crm";
import { getIntegracoes } from "@/lib/supabase/configuracoes";

export const metadata = { title: "Configurações" };

export default async function ConfiguracoesPage() {
  const { organizacao, profile } = await exigirModulo("configuracoes");

  const [equipe, integracoes, demo] = await Promise.all([
    getEquipe(organizacao?.id ?? null),
    getIntegracoes(organizacao?.id ?? null),
    emModoDemo(),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-5 py-8 md:px-8 md:py-10">
      <header className="flex items-start gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-verde-menta text-teal">
          <Settings className="size-6" />
        </span>
        <div>
          <h1 className="text-2xl md:text-3xl">Configurações</h1>
          <p className="mt-1 max-w-xl text-cinza-suave">
            Dados da clínica, quem tem acesso a quê e as conexões com Meta,
            Google e WhatsApp.
          </p>
        </div>
      </header>

      {/* Super admin não pertence a uma clínica: não há o que configurar */}
      {!organizacao ? (
        <div className="mt-8 rounded-lg border border-dashed border-border bg-white p-10 text-center shadow-soft">
          <Building2 className="mx-auto size-10 text-teal-claro" />
          <h2 className="mt-3 text-lg font-semibold text-azul-medico">
            Escolha uma clínica para configurar
          </h2>
          <p className="mx-auto mt-2 max-w-md text-cinza-suave">
            Sua conta é da equipe Medi Marketing e não pertence a nenhuma
            clínica. As configurações são por cliente — acesse pelo cadastro
            da clínica em Clientes.
          </p>
        </div>
      ) : (
        <PainelConfiguracoes
          organizacao={organizacao}
          equipe={equipe}
          integracoes={integracoes}
          usuarioId={profile.id}
          demo={demo}
        />
      )}
    </div>
  );
}
