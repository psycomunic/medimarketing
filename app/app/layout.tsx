import { redirect } from "next/navigation";
import { Sidebar } from "@/components/app/sidebar";
import { getSessao } from "@/lib/supabase/queries";

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

  return (
    <div className="flex min-h-screen flex-col bg-branco-clinico lg:flex-row">
      <Sidebar nome={nome} />
      <main className="flex-1 overflow-x-hidden">{children}</main>
    </div>
  );
}
