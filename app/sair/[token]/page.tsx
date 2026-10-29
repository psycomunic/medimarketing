import { notFound } from "next/navigation";
import { MarcaClinica } from "@/components/marca-clinica";
import { ConfirmarSaida } from "@/components/disparos/confirmar-saida";
import { createAdminClient, adminDisponivel } from "@/lib/supabase/admin";

export const metadata = {
  title: "Parar de receber mensagens",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Link do rodapé de cada disparo. Abrir não descadastra: o WhatsApp
 * visita os links para montar a prévia, e isso não pode tirar ninguém
 * da lista. O paciente confirma com um clique.
 */
export default async function SairPage({ params }: { params: { token: string } }) {
  if (!adminDisponivel() || !/^[\w-]{16,64}$/.test(params.token)) notFound();
  const admin = createAdminClient();
  const { data: dest } = await admin
    .from("disparo_destinatarios")
    .select("paciente_id,organization_id,nome")
    .eq("token", params.token)
    .maybeSingle();
  if (!dest) notFound();
  const [{ data: org }, { data: paciente }] = await Promise.all([
    admin.from("organizations").select("nome,logo_url").eq("id", dest.organization_id).maybeSingle(),
    admin.from("pacientes").select("descadastrado_em").eq("id", dest.paciente_id).maybeSingle(),
  ]);
  const clinica = org?.nome ?? "Clínica";

  return (
    <main className="min-h-screen bg-branco-clinico px-5 py-10">
      <div className="mx-auto w-full max-w-md">
        <div className="flex justify-center">
          <MarcaClinica nome={clinica} logoUrl={org?.logo_url ?? null} tamanho="lg" soImagem={!!org?.logo_url} />
        </div>
        <div className="mt-8 rounded-lg border border-border bg-white p-6 shadow-card">
          <ConfirmarSaida
            token={params.token}
            paciente={dest.nome.trim().split(/\s+/)[0] ?? dest.nome}
            clinica={clinica}
            jaSaiu={!!paciente?.descadastrado_em}
          />
        </div>
        <p className="mt-6 text-center text-xs text-cinza-suave">
          Lembretes de consulta e avisos sobre o seu atendimento continuam chegando normalmente.
        </p>
      </div>
    </main>
  );
}
