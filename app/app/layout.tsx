import { Info } from "lucide-react";
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
          <div className="flex items-center justify-center gap-2 bg-azul-medico px-4 py-2 text-center text-xs font-medium text-white">
            <Info className="size-4 shrink-0" />
            Você está no <strong>modo demonstração</strong>: dados fictícios,
            alterações não são salvas.
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
