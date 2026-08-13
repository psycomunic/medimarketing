import { FileSignature } from "lucide-react";
import { PropostasPainel } from "@/components/app/admin/propostas-painel";
import { exigirModulo } from "@/lib/acesso";
import { emModoDemo } from "@/lib/supabase/queries";
import { getPropostas } from "@/lib/supabase/propostas";
import { urlBase } from "@/lib/lembretes";

export const metadata = { title: "Propostas" };

export default async function PropostasPage() {
  await exigirModulo("admin-propostas");
  const [propostas, demo] = await Promise.all([getPropostas(), emModoDemo()]);

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 md:px-8 md:py-10">
      <header className="flex items-start gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-verde-menta text-teal">
          <FileSignature className="size-6" />
        </span>
        <div>
          <h1 className="text-2xl md:text-3xl">Propostas</h1>
          <p className="mt-1 max-w-xl text-cinza-suave">
            Gere um link com a marca e o preço de cada cliente. Você vê quando
            ele abre e é avisado por e-mail quando ele aceita.
          </p>
        </div>
      </header>

      <PropostasPainel propostas={propostas} base={urlBase()} demo={demo} />
    </div>
  );
}
