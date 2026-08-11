import { notFound } from "next/navigation";
import { CalendarDays, Clock, MapPin, Stethoscope, UserRound } from "lucide-react";
import { Logo } from "@/components/logo";
import { PainelPaciente } from "@/components/confirmacao/painel-paciente";
import { getConfirmacaoPorToken } from "@/lib/supabase/confirmacoes";
import { diaDaSemana, formatarData, formatarHora } from "@/lib/lembretes";
import { rotuloTipo } from "@/lib/agenda";
import type { TipoConsulta } from "@/lib/supabase/types";

export const metadata = {
  title: "Confirmar consulta",
  // Link privado do paciente: não deve ser indexado nem seguido
  robots: { index: false, follow: false },
};

// O status muda quando o paciente responde: nada de cache
export const dynamic = "force-dynamic";

export default async function ConfirmarPage({
  params,
}: {
  params: { token: string };
}) {
  const c = await getConfirmacaoPorToken(params.token);
  if (!c) notFound();

  const linhas = [
    { icone: CalendarDays, rotulo: "Data", valor: `${formatarData(c.dataHora)} · ${diaDaSemana(c.dataHora)}` },
    { icone: Clock, rotulo: "Horário", valor: formatarHora(c.dataHora) },
    { icone: UserRound, rotulo: "Profissional", valor: c.medico },
    { icone: Stethoscope, rotulo: "Tipo", valor: rotuloTipo[c.tipo as TipoConsulta] },
    { icone: MapPin, rotulo: "Local", valor: c.endereco },
  ].filter((l) => l.valor);

  return (
    <main className="min-h-screen bg-branco-clinico px-5 py-10">
      <div className="mx-auto w-full max-w-md">
        <div className="flex justify-center">
          <Logo />
        </div>

        <div className="mt-8 overflow-hidden rounded-lg border border-border bg-white shadow-card">
          <header className="border-b border-border bg-verde-menta px-6 py-5">
            <p className="font-heading text-lg font-semibold text-azul-medico">
              Olá, {c.paciente}! 👋
            </p>
            <p className="mt-1 text-sm text-cinza-suave">
              Sua consulta na {c.clinica} está agendada para:
            </p>
          </header>

          <dl className="divide-y divide-border">
            {linhas.map((l) => (
              <div key={l.rotulo} className="flex items-start gap-3 px-6 py-3.5">
                <l.icone className="mt-0.5 size-4 shrink-0 text-teal" />
                <div className="min-w-0">
                  <dt className="text-xs text-cinza-suave">{l.rotulo}</dt>
                  <dd className="font-medium text-cinza-texto">{l.valor}</dd>
                </div>
              </div>
            ))}
          </dl>

          <div className="border-t border-border px-6 py-5">
            <PainelPaciente
              token={c.token}
              statusInicial={c.status}
              telefoneClinica={c.telefoneClinica}
              clinica={c.clinica}
              paciente={c.paciente}
              encerrada={c.encerrada}
            />
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-cinza-suave">
          Este link é pessoal e vale só para esta consulta.
        </p>
      </div>
    </main>
  );
}
