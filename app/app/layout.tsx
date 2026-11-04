import { cookies } from "next/headers";
import { Info } from "lucide-react";
import { SCRIPT_TEMA, TemaDoPainel } from "@/components/app/tema";
import { BarraDemo } from "@/components/app/barra-demo";
import { Sidebar } from "@/components/app/sidebar";
import { exigirSessao } from "@/lib/acesso";
import { emModoDemo } from "@/lib/supabase/queries";
import { contarNaoLidas } from "@/lib/supabase/notificacoes";
import { NotificacoesAoVivo } from "@/components/app/notificacoes/ao-vivo";
import { AppInstalavel } from "@/components/app/app-instalavel";
import { metadataApp, viewportApp } from "@/lib/app-instalavel";

export const metadata = {
  ...metadataApp,
  title: "Plataforma",
};
export const viewport = viewportApp;

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

  const menuRecolhido = (await cookies()).get("medi_menu")?.value === "recolhido";

  return (
    <div className="flex min-h-screen flex-col bg-branco-clinico lg:flex-row print:bg-white">
      {/* Antes de tudo: aplica o tema escolhido sem piscar a tela */}
      <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA }} />
      <TemaDoPainel />
      <Sidebar
        recolhidoInicial={menuRecolhido}
        nome={profile.nome || "Usuário"}
        fotoUrl={profile.foto_url}
        role={role}
        organizacao={organizacao?.nome ?? null}
        logoUrl={organizacao?.logo_url ?? null}
        naoLidas={naoLidas}
      />
      {/* No celular, folga para a barra inferior (e a barra de gestos do iPhone) */}
      <main className="min-w-0 flex-1 overflow-x-hidden pb-[calc(3.5rem+env(safe-area-inset-bottom))] lg:pb-0">
        {demo && (
          /* Um parágrafo só, e não três caixas flex: no celular cada
             trecho virava uma coluna e a frase quebrava no meio. */
          <p className="bg-azul-medico px-4 py-2 text-center text-xs font-medium text-white print:hidden">
            <Info className="mr-1.5 inline size-4 align-text-bottom" />
            Você está no <strong>modo demonstração</strong>: dados fictícios,
            alterações não são salvas.
          </p>
        )}
        {children}
        {!demo && <NotificacoesAoVivo />}
        <AppInstalavel naoLidas={naoLidas} versao={process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? "local"} />
        {/* Espaço para a barra flutuante não cobrir o fim da página */}
        {demo && <div aria-hidden className="h-20" />}
      </main>

      {demo && (
        <div className="print:hidden">
          <BarraDemo papelAtual={role} />
        </div>
      )}
    </div>
  );
}
