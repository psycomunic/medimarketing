import { redirect } from "next/navigation";
import { Info } from "lucide-react";
import { Sidebar } from "@/components/app/sidebar";
import { getSessao, emModoDemo } from "@/lib/supabase/queries";

export const metadata = {
  title: "Área do Médico",
};

// Layout protegido: exige sessão (reforço além do middleware).
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId, profile } = await getSessao();
  if (!userId) redirect("/login");

  const nome = profile?.nome || "Médico(a)";
  const demo = await emModoDemo();

  return (
    <div className="flex min-h-screen flex-col bg-branco-clinico lg:flex-row">
      <Sidebar nome={nome} />
      <main className="flex-1 overflow-x-hidden">
        {demo && (
          <div className="flex items-center justify-center gap-2 bg-azul-medico px-4 py-2 text-center text-xs font-medium text-white">
            <Info className="size-4 shrink-0" />
            Você está no <strong>modo demonstração</strong> — dados fictícios,
            alterações não são salvas.
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
