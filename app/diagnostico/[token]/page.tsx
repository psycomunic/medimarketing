import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CheckCircle2 } from "lucide-react";
import { Logo } from "@/components/logo";
import { getFormularioPorToken } from "@/lib/supabase/formularios";
import { formatarData } from "@/lib/formularios/formato";
import { PreenchimentoFormulario } from "@/components/app/formularios/preenchimento";
import { LeituraFormulario } from "@/components/app/formularios/leitura";
import { BotaoImprimir } from "@/components/app/formularios/botao-imprimir";
import { CapaFormulario } from "@/components/app/formularios/comum";

// O rascunho muda a cada tecla: nada aqui pode vir de cache
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { token: string };
}): Promise<Metadata> {
  const f = await getFormularioPorToken(params.token);
  return {
    title: f ? `Diagnóstico · ${f.clinica}` : "Diagnóstico",
    // Respostas de faturamento e margem: nunca em busca
    robots: { index: false, follow: false },
  };
}

/**
 * O diagnóstico que a clínica abre pelo link.
 *
 * Sem sessão e fora da moldura do painel: quem recebe isto no WhatsApp
 * precisa conseguir responder no celular, sem criar conta nem saber que
 * existe um sistema por trás. O token do link é a autorização.
 */
export default async function DiagnosticoLinkPage({
  params,
}: {
  params: { token: string };
}) {
  const f = await getFormularioPorToken(params.token);
  if (!f) notFound();

  const { resposta, modelo, clinica } = f;

  return (
    <div className="min-h-screen bg-branco-clinico print:bg-white">
      <header className="border-b border-border bg-white print:hidden">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-4 md:px-8">
          <Logo href="/" altura={30} />
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-azul-medico">
            Diagnóstico inicial
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-5 py-8 md:px-8 md:py-12">
        {resposta.status === "rascunho" ? (
          <PreenchimentoFormulario
            resposta={resposta}
            schema={modelo.schema}
            clinica={clinica}
            demo={false}
            token={resposta.token}
          />
        ) : (
          <>
            <div className="mb-8 flex flex-col gap-4 rounded-[1.25rem] border border-teal/30 bg-verde-menta/60 p-5 sm:flex-row sm:items-start sm:justify-between md:p-6 print:hidden">
              <div className="flex gap-3">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-teal" />
                <div>
                  <p className="font-semibold text-azul-medico">
                    Enviado em {formatarData(resposta.enviado_em)}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-cinza-texto">
                    {modelo.schema.agradecimento}
                  </p>
                  <p className="mt-2 text-sm text-cinza-suave">
                    Para corrigir algo, fale com a MediMarketing: ela reabre o questionário.
                  </p>
                </div>
              </div>
              <BotaoImprimir />
            </div>

            <CapaFormulario schema={modelo.schema} clinica={clinica} />
            <p className="mt-6 text-sm text-cinza-suave">
              Respondido por{" "}
              <strong className="text-cinza-texto">{resposta.respondente_nome || "—"}</strong>
              {resposta.respondente_cargo && ` · ${resposta.respondente_cargo}`}
              {resposta.data_referencia && ` · ${formatarData(resposta.data_referencia)}`}
            </p>
            <div className="mt-8">
              <LeituraFormulario
                schema={modelo.schema}
                respostas={resposta.respostas}
                clinica={clinica}
                demo={false}
                token={resposta.token}
              />
            </div>
          </>
        )}
      </main>

      <footer className="mx-auto flex max-w-4xl flex-wrap justify-between gap-2 px-5 pb-10 text-xs text-cinza-suave md:px-8 print:hidden">
        <span>{clinica} · Questionário de diagnóstico</span>
        <span>MediMarketing</span>
      </footer>
    </div>
  );
}
