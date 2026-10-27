import { ClipboardCheck } from "lucide-react";
import { exigirModulo } from "@/lib/acesso";
import { emModoDemo } from "@/lib/supabase/queries";
import { getClinicasParaLiberar, getFormulariosAdmin } from "@/lib/supabase/formularios";
import { SLUG_DIAGNOSTICO } from "@/lib/formularios/diagnostico-clinica";
import { ListaDiagnosticos } from "@/components/app/formularios/admin-lista";

export const metadata = { title: "Diagnósticos" };

export default async function DiagnosticosAdminPage() {
  await exigirModulo("admin-diagnosticos");
  const [linhas, clinicas, demo] = await Promise.all([
    getFormulariosAdmin(SLUG_DIAGNOSTICO),
    getClinicasParaLiberar(),
    emModoDemo(),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-5 py-8 md:px-8 md:py-10">
      <header className="flex items-start gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-verde-menta text-teal">
          <ClipboardCheck className="size-6" />
        </span>
        <div>
          <h1 className="text-2xl md:text-3xl">Diagnósticos</h1>
          <p className="mt-1 max-w-xl text-cinza-suave">
            O questionário inicial de cada clínica, salvo no painel. Os enviados aparecem
            primeiro; você é avisado quando chega um novo.
          </p>
        </div>
      </header>

      <ListaDiagnosticos linhas={linhas} clinicas={clinicas} slug={SLUG_DIAGNOSTICO} demo={demo} />
    </div>
  );
}
