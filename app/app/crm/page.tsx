import {
  Users,
  Target,
  Banknote,
  TrendingUp,
  AlertTriangle,
  UserPlus,
} from "lucide-react";
import { Funil } from "@/components/app/crm/funil";
import { exigirModulo } from "@/lib/acesso";
import { emModoDemo } from "@/lib/supabase/queries";
import {
  getEquipe,
  getLeads,
  getTodasInteracoes,
  resumirFunil,
} from "@/lib/supabase/crm";
import { formatarNumero, formatarPercentual, formatarReais } from "@/lib/indicadores";

export const metadata = { title: "CRM e Funil" };

export default async function CrmPage() {
  const { organizacao } = await exigirModulo("crm");
  const orgId = organizacao?.id ?? null;

  const [leads, interacoes, equipe, demo] = await Promise.all([
    getLeads(orgId),
    getTodasInteracoes(orgId),
    getEquipe(orgId),
    emModoDemo(),
  ]);

  const resumo = resumirFunil(leads);

  const cards = [
    {
      icone: Users,
      label: "leads em aberto",
      valor: formatarNumero(resumo.emAberto),
      detalhe: `${resumo.novos30d} novos em 30 dias`,
    },
    {
      icone: Banknote,
      label: "em negociação",
      valor: formatarReais(resumo.valorEmAberto),
      detalhe: "soma dos valores estimados",
    },
    {
      icone: TrendingUp,
      label: "taxa de conversão",
      valor: formatarPercentual(resumo.taxaConversao),
      detalhe: `${resumo.ganhos} ganhos · ${resumo.perdidos} perdidos`,
    },
    {
      icone: Target,
      label: "fechado na carteira",
      valor: formatarReais(resumo.valorGanho),
      detalhe: "leads que viraram tratamento",
    },
  ];

  return (
    <div className="mx-auto max-w-7xl px-5 py-8 md:px-8 md:py-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-verde-menta text-teal">
            <Users className="size-6" />
          </span>
          <div>
            <h1 className="text-2xl md:text-3xl">CRM e Funil</h1>
            <p className="mt-1 max-w-xl text-cinza-suave">
              Do primeiro contato ao tratamento: onde cada paciente está e o
              que precisa acontecer para ele avançar.
            </p>
          </div>
        </div>
        {resumo.tarefasAtrasadas > 0 && (
          <span className="inline-flex items-center gap-2 rounded-full bg-alerta/12 px-3 py-1.5 text-sm font-semibold text-alerta">
            <AlertTriangle className="size-4" />
            {resumo.tarefasAtrasadas} tarefa
            {resumo.tarefasAtrasadas === 1 ? "" : "s"} em aberto
          </span>
        )}
      </header>

      {leads.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed border-border bg-white p-10 text-center shadow-soft">
          <UserPlus className="mx-auto size-10 text-teal-claro" />
          <h2 className="mt-3 text-lg font-semibold text-azul-medico">
            O funil está vazio
          </h2>
          <p className="mx-auto mt-2 max-w-md text-cinza-suave">
            Leads das campanhas de Meta e Google entram aqui automaticamente.
            Quem chega por indicação, telefone ou balcão você cadastra à mão.
          </p>
          <div className="mt-6">
            <Funil
              leads={[]}
              interacoes={[]}
              equipe={equipe}
              organizationId={orgId}
              demo={demo}
            />
          </div>
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
                <p className="mt-1 text-xs text-cinza-suave/80">{c.detalhe}</p>
              </div>
            ))}
          </dl>

          <div className="mt-8">
            <Funil
              leads={leads}
              interacoes={interacoes}
              equipe={equipe}
              organizationId={orgId}
              demo={demo}
            />
          </div>
        </>
      )}
    </div>
  );
}
