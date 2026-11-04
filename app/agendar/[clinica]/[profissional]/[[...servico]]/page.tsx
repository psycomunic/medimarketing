import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { CalendarX2, MessageCircle } from "lucide-react";
import { carregarAgendaPublica } from "@/lib/agendar";
import { AgendarCliente } from "@/components/agendar/agendar-cliente";
import { MarcaClinica } from "@/components/marca-clinica";

// Horários mudam a cada consulta marcada: nada de cache
export const dynamic = "force-dynamic";

type Params = { clinica: string; profissional: string; servico?: string[] };

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // O campo de 16 px não dá zoom sozinho no iPhone; a pessoa ainda pode dar
  themeColor: "#0B4F6C",
};

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const r = await carregarAgendaPublica(params.clinica, params.profissional);
  if (!r.ok) return { title: "Agendar consulta", robots: { index: false, follow: false } };
  const { agenda } = r;
  const titulo = `Agendar com ${agenda.profissional.nome}`;
  const descricao = `Escolha o melhor horário para sua consulta na ${agenda.clinica.nome}.`;
  return {
    title: { absolute: `${titulo} · ${agenda.clinica.nome}` },
    description: descricao,
    // O link é para quem a clínica mandou, não para buscador
    robots: { index: false, follow: false },
    openGraph: { title: titulo, description: descricao, type: "website", locale: "pt_BR" },
  };
}

export default async function AgendarPage({ params }: { params: Params }) {
  const r = await carregarAgendaPublica(params.clinica, params.profissional);
  if (!r.ok && r.motivo === "nao_encontrado") notFound();

  return (
    <main className="min-h-dvh bg-branco-clinico">
      {r.ok ? (
        <AgendarCliente key={params.servico?.[0] ?? ""} agenda={r.agenda} servicoInicial={params.servico?.[0] ?? null} />
      ) : (
        r.motivo === "desligado" && (
          <div className="mx-auto w-full max-w-md px-4 py-12 sm:px-6">
            <div className="flex justify-center">
              <MarcaClinica nome={r.clinica.nome} logoUrl={r.clinica.logoUrl} tamanho="lg" soImagem={!!r.clinica.logoUrl} />
            </div>
            <div className="mt-8 rounded-2xl border border-border bg-white p-6 text-center shadow-card">
              <CalendarX2 className="mx-auto size-10 text-teal-claro" />
              <h1 className="mt-3 font-heading text-xl font-semibold text-azul-medico">Agenda online fechada</h1>
              <p className="mt-1 text-sm text-cinza-suave">
                {r.profissional ? `A agenda de ${r.profissional}` : "Esta agenda"} não está recebendo agendamentos pelo
                link agora. Fale com a clínica que marcamos para você.
              </p>
              {r.clinica.telefone && (
                <a
                  href={`https://wa.me/55${r.clinica.telefone.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-5 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-sucesso px-5 font-semibold text-white"
                >
                  <MessageCircle className="size-5" /> Falar com a clínica
                </a>
              )}
            </div>
          </div>
        )
      )}
    </main>
  );
}
