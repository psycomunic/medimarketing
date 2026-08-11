import { MessagesSquare, Inbox, UserX, Bell, Timer } from "lucide-react";
import { Inbox as CaixaEntrada } from "@/components/app/atendimento/inbox";
import { exigirModulo } from "@/lib/acesso";
import { emModoDemo } from "@/lib/supabase/queries";
import {
  getConversas,
  getTodasMensagens,
  resumirAtendimento,
} from "@/lib/supabase/atendimento";
import { getEquipe } from "@/lib/supabase/crm";
import { formatarNumero } from "@/lib/indicadores";

export const metadata = { title: "Atendimento" };

export default async function AtendimentoPage() {
  const { organizacao, profile } = await exigirModulo("atendimento");
  const orgId = organizacao?.id ?? null;

  const [conversas, equipe, demo] = await Promise.all([
    getConversas(orgId),
    getEquipe(orgId),
    emModoDemo(),
  ]);
  const mensagens = await getTodasMensagens(conversas);
  const resumo = resumirAtendimento(conversas, mensagens);

  const cards = [
    { icone: Inbox, label: "conversas em aberto", valor: formatarNumero(resumo.abertas) },
    { icone: Bell, label: "mensagens não lidas", valor: formatarNumero(resumo.naoLidas) },
    { icone: UserX, label: "sem responsável", valor: formatarNumero(resumo.semResponsavel) },
    {
      icone: Timer,
      label: "tempo médio de resposta",
      valor:
        resumo.tempoMedioRespostaMin > 90
          ? `${(resumo.tempoMedioRespostaMin / 60).toFixed(1).replace(".", ",")} h`
          : `${resumo.tempoMedioRespostaMin} min`,
    },
  ];

  return (
    <div className="mx-auto max-w-7xl px-5 py-8 md:px-8 md:py-10">
      <header className="flex items-start gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-verde-menta text-teal">
          <MessagesSquare className="size-6" />
        </span>
        <div>
          <h1 className="text-2xl md:text-3xl">Atendimento</h1>
          <p className="mt-1 max-w-xl text-cinza-suave">
            WhatsApp, Instagram e Facebook numa caixa de entrada só, ligada à
            ficha do paciente no CRM.
          </p>
        </div>
      </header>

      {conversas.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed border-border bg-white p-10 text-center shadow-soft">
          <Inbox className="mx-auto size-10 text-teal-claro" />
          <h2 className="mt-3 text-lg font-semibold text-azul-medico">
            Nenhuma conversa por aqui ainda
          </h2>
          <p className="mx-auto mt-2 max-w-md text-cinza-suave">
            Conecte o WhatsApp e o Instagram da clínica em Configurações →
            Integrações. A partir daí, tudo que chegar nesses canais aparece
            nesta tela.
          </p>
        </div>
      ) : (
        <>
          <dl className="mt-8 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
            {cards.map((c) => (
              <div key={c.label} className="bg-white px-6 py-5">
                <span className="grid size-9 place-items-center rounded-lg bg-verde-menta text-teal">
                  <c.icone className="size-5" />
                </span>
                <dd className="mt-3 font-heading text-2xl font-bold text-azul-medico">
                  {c.valor}
                </dd>
                <dt className="text-sm text-cinza-suave">{c.label}</dt>
              </div>
            ))}
          </dl>

          <div className="mt-8">
            <CaixaEntrada
              conversas={conversas}
              mensagens={mensagens}
              equipe={equipe}
              usuarioId={profile.id}
              demo={demo}
            />
          </div>
        </>
      )}
    </div>
  );
}
