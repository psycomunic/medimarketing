import { Repeat, Send, MessageCircleReply, UserRoundCheck, Percent } from "lucide-react";
import { Reguas } from "@/components/app/retencao/reguas";
import { exigirModulo } from "@/lib/acesso";
import { emModoDemo } from "@/lib/supabase/queries";
import { getReguas, resumirRetencao, JANELA_DIAS } from "@/lib/supabase/retencao";
import { formatarNumero, formatarPercentual } from "@/lib/indicadores";

export const metadata = { title: "Retenção" };

export default async function RetencaoPage() {
  const { organizacao } = await exigirModulo("retencao");
  const orgId = organizacao?.id ?? null;

  const [reguas, demo] = await Promise.all([getReguas(orgId), emModoDemo()]);
  const resumo = resumirRetencao(reguas);

  const cards = [
    { icone: Send, label: "mensagens disparadas", valor: formatarNumero(resumo.enviados) },
    {
      icone: MessageCircleReply,
      label: "responderam",
      valor: `${formatarNumero(resumo.respondidos)} · ${formatarPercentual(resumo.taxaResposta)}`,
    },
    {
      icone: UserRoundCheck,
      label: "pacientes recuperados",
      valor: formatarNumero(resumo.recuperados),
    },
    {
      icone: Percent,
      label: "taxa de recuperação",
      valor: formatarPercentual(resumo.taxaRecuperacao, 1),
    },
  ];

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 md:px-8 md:py-10">
      <header className="flex items-start gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-verde-menta text-teal">
          <Repeat className="size-6" />
        </span>
        <div>
          <h1 className="text-2xl md:text-3xl">Retenção</h1>
          <p className="mt-1 max-w-2xl text-cinza-suave">
            Dinheiro que já está na sua base. Cada régua é uma cadência
            automática: quem não fechou, quem faltou, quem sumiu e quem
            precisa voltar para revisão.
          </p>
        </div>
      </header>

      {resumo.enviados > 0 && (
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
          <p className="mt-2 text-xs text-cinza-suave">
            Números dos últimos {JANELA_DIAS} dias, somando todas as réguas.
          </p>
        </>
      )}

      <div className="mt-8">
        <Reguas reguas={reguas} organizationId={orgId} demo={demo} />
      </div>
    </div>
  );
}
