import { CheckCircle2, ClipboardList } from "lucide-react";
import { exigirModulo } from "@/lib/acesso";
import { emModoDemo } from "@/lib/supabase/queries";
import { getMeuFormulario } from "@/lib/supabase/formularios";
import { SLUG_DIAGNOSTICO } from "@/lib/formularios/diagnostico-clinica";
import { PreenchimentoFormulario } from "@/components/app/formularios/preenchimento";
import { LeituraFormulario } from "@/components/app/formularios/leitura";
import { BotaoImprimir } from "@/components/app/formularios/botao-imprimir";
import { CapaFormulario } from "@/components/app/formularios/comum";
import { formatarData } from "@/lib/formularios/formato";

export const metadata = { title: "Diagnóstico inicial" };

export default async function DiagnosticoPage() {
  const { profile, organizacao } = await exigirModulo("diagnostico");
  const [formulario, demo] = await Promise.all([
    getMeuFormulario(profile, SLUG_DIAGNOSTICO),
    emModoDemo(),
  ]);
  const clinica = organizacao?.nome ?? "sua clínica";

  if (!formulario) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-16 md:px-8">
        <div className="rounded-[1.25rem] border border-border bg-white p-8 text-center shadow-soft">
          <span className="mx-auto grid size-12 place-items-center rounded-xl bg-verde-menta text-teal">
            <ClipboardList className="size-6" />
          </span>
          <h1 className="mt-4 text-2xl">Diagnóstico inicial</h1>
          <p className="mx-auto mt-2 max-w-md text-cinza-suave">
            Quando a MediMarketing liberar o questionário de diagnóstico da {clinica}, ele
            aparece aqui para ser preenchido.
          </p>
        </div>
      </div>
    );
  }

  const { resposta, modelo } = formulario;

  if (resposta.status === "rascunho") {
    return (
      <div className="mx-auto max-w-4xl px-5 py-8 md:px-8 md:py-12">
        <PreenchimentoFormulario
          resposta={resposta}
          schema={modelo.schema}
          clinica={clinica}
          demo={demo}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-5 py-8 md:px-8 md:py-12">
      <div className="mb-8 flex flex-col gap-4 rounded-[1.25rem] border border-teal/30 bg-verde-menta/60 p-5 sm:flex-row sm:items-start sm:justify-between md:p-6 print:hidden">
        <div className="flex gap-3">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-teal" />
          <div>
            <p className="font-semibold text-azul-medico">
              Enviado em {formatarData(resposta.enviado_em)}
              {resposta.status === "revisado" && " · revisado pela MediMarketing"}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-cinza-texto">
              {modelo.schema.agradecimento}
            </p>
            <p className="mt-2 text-sm text-cinza-suave">
              Para corrigir algo, fale com a MediMarketing: ela reabre o questionário para vocês.
            </p>
          </div>
        </div>
        <BotaoImprimir />
      </div>

      <CapaFormulario schema={modelo.schema} clinica={clinica} />
      <p className="mt-6 text-sm text-cinza-suave">
        Respondido por <strong className="text-cinza-texto">{resposta.respondente_nome || "—"}</strong>
        {resposta.respondente_cargo && ` · ${resposta.respondente_cargo}`}
        {resposta.data_referencia && ` · ${formatarData(resposta.data_referencia)}`}
      </p>
      <div className="mt-8">
        <LeituraFormulario
          schema={modelo.schema}
          respostas={resposta.respostas}
          clinica={clinica}
          demo={demo}
        />
      </div>
    </div>
  );
}
