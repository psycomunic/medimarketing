import { notFound } from "next/navigation";
import { MarcaClinica } from "@/components/marca-clinica";
import { FormularioAvaliacao } from "@/components/avaliacao/formulario";
import { getAvaliacaoPorToken } from "@/lib/avaliacoes";

export const metadata = {
  title: "Avaliar atendimento",
  // Link privado do paciente: não deve ser indexado nem seguido
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AvaliarPage({ params }: { params: { token: string } }) {
  const a = await getAvaliacaoPorToken(params.token);
  if (!a) notFound();

  return (
    <main className="min-h-screen bg-branco-clinico px-5 py-10">
      <div className="mx-auto w-full max-w-md">
        {/* Para o paciente, quem pergunta é a clínica */}
        <div className="flex justify-center">
          <MarcaClinica nome={a.clinica} logoUrl={a.logoClinica} tamanho="lg" soImagem={!!a.logoClinica} />
        </div>

        <div className="mt-8 overflow-hidden rounded-lg border border-border bg-white shadow-card">
          <FormularioAvaliacao
            token={a.token}
            paciente={a.paciente}
            clinica={a.clinica}
            medico={a.medico}
            respondida={a.respondida}
            notaAnterior={a.nota}
            linkAvaliacao={a.linkAvaliacao}
          />
        </div>

        <p className="mt-6 text-center text-xs text-cinza-suave">Sua resposta vai direto para a equipe da {a.clinica}.</p>
        <p className="mt-1 text-center text-[11px] text-cinza-suave/70">Pesquisa feita com Medi Marketing</p>
      </div>
    </main>
  );
}
