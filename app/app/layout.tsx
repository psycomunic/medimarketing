import { Info } from "lucide-react";
import { BarraDemo } from "@/components/app/barra-demo";
import { Sidebar } from "@/components/app/sidebar";
import { exigirSessao } from "@/lib/acesso";
import { emModoDemo } from "@/lib/supabase/queries";
import { contarNaoLidas } from "@/lib/supabase/notificacoes";

export const metadata = {
  title: "Plataforma",
};

// Layout protegido: exige sessão (reforço além do middleware).
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile, organizacao, role } = await exigirSessao();
  const [demo, naoLidas] = await Promise.all([
    emModoDemo(),
    contarNaoLidas(profile),
  ]);

  return (
    <div className="flex min-h-screen flex-col bg-branco-clinico lg:flex-row">
      <Sidebar
        nome={profile.nome || "Usuário"}
        role={role}
        organizacao={organizacao?.nome ?? null}
        logoUrl={organizacao?.logo_url ?? null}
        naoLidas={naoLidas}
      />
      <main className="min-w-0 flex-1 overflow-x-hidden">
        {demo && (
          /* Um parágrafo só, e não três caixas flex: no celular cada
             trecho virava uma coluna e a frase quebrava no meio. */
          <p className="bg-azul-medico px-4 py-2 text-center text-xs font-medium text-white">
            <Info className="mr-1.5 inline size-4 align-text-bottom" />
            Você está no <strong>modo demonstração</strong>: dados fictícios,
            alterações não são salvas.
          </p>
        )}
        {children}
        {/* Espaço para a barra flutuante não cobrir o fim da página */}
        {demo && <div aria-hidden className="h-20" />}
      </main>

      {demo && <BarraDemo papelAtual={role} />}
    </div>
  );
}
