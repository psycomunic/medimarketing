import { DisponibilidadeManager } from "@/components/app/disponibilidade-manager";
import { getDisponibilidade, getBloqueios } from "@/lib/supabase/queries";

export const metadata = { title: "Disponibilidade" };

export default async function DisponibilidadePage() {
  const [disponibilidade, bloqueios] = await Promise.all([
    getDisponibilidade(),
    getBloqueios(),
  ]);

  return (
    <div className="mx-auto max-w-4xl px-5 py-8 md:px-8 md:py-10">
      <header>
        <h1 className="text-2xl md:text-3xl">Disponibilidade</h1>
        <p className="mt-1 text-cinza-suave">
          Defina seus horários de atendimento e bloqueie períodos de folga.
        </p>
      </header>

      <DisponibilidadeManager
        disponibilidadeInicial={disponibilidade}
        bloqueiosIniciais={bloqueios}
      />
    </div>
  );
}
