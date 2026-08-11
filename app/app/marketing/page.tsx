import {
  Megaphone,
  Wallet,
  Users,
  CalendarCheck,
  MousePointerClick,
  Plug,
} from "lucide-react";
import Link from "next/link";
import { Campanhas } from "@/components/app/marketing/campanhas";
import { exigirModulo } from "@/lib/acesso";
import { emModoDemo } from "@/lib/supabase/queries";
import { calcularMetricas, getCampanhas, porPlataforma } from "@/lib/supabase/marketing";
import { getIntegracoes } from "@/lib/supabase/configuracoes";
import { rotuloPlataforma, corPlataforma } from "@/lib/rotulos";
import { formatarNumero, formatarPercentual, formatarReais } from "@/lib/indicadores";
import { cn } from "@/lib/utils";

export const metadata = { title: "Marketing" };

export default async function MarketingPage() {
  const { organizacao, role } = await exigirModulo("marketing");
  const orgId = organizacao?.id ?? null;
  const podeEditar = role === "gestor" || role === "super_admin";

  const [campanhas, integracoes, demo] = await Promise.all([
    getCampanhas(orgId),
    getIntegracoes(orgId),
    emModoDemo(),
  ]);

  // O painel olha o que está rodando; encerradas ficam só na tabela
  const emCurso = campanhas.filter((c) => c.status !== "encerrada");
  const m = calcularMetricas(emCurso);
  const plataformas = porPlataforma(emCurso);

  const adsDesconectado = integracoes.filter(
    (i) => (i.provedor === "meta_ads" || i.provedor === "google_ads") && !i.conectado
  );

  const cards = [
    { icone: Wallet, label: "investido no período", valor: formatarReais(m.investimento) },
    { icone: Users, label: "leads gerados", valor: formatarNumero(m.leads) },
    {
      icone: MousePointerClick,
      label: "custo por lead",
      valor: m.cpl ? formatarReais(m.cpl, true) : "—",
    },
    {
      icone: CalendarCheck,
      label: "custo por agendamento",
      valor: m.cpa ? formatarReais(m.cpa, true) : "—",
    },
  ];

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 md:px-8 md:py-10">
      <header className="flex items-start gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-verde-menta text-teal">
          <Megaphone className="size-6" />
        </span>
        <div>
          <h1 className="text-2xl md:text-3xl">Marketing</h1>
          <p className="mt-1 max-w-2xl text-cinza-suave">
            Meta Ads e Google Ads num painel só. O que você precisa saber não
            é quantos cliques teve, é quanto custou cada paciente na cadeira.
          </p>
        </div>
      </header>

      {adsDesconectado.length > 0 && (
        <p className="mt-6 flex flex-wrap items-center gap-2 rounded-md border border-dashed border-alerta/40 bg-alerta/5 px-4 py-3 text-sm text-cinza-suave">
          <Plug className="size-4 shrink-0 text-alerta" />
          <span>
            {adsDesconectado.map((i) => rotuloPlataforma[i.provedor === "meta_ads" ? "meta" : "google"]).join(" e ")}{" "}
            ainda {adsDesconectado.length === 1 ? "não está conectado" : "não estão conectados"}: os números
            abaixo são os que a equipe lançou à mão.
          </span>
          <Link
            href="/app/configuracoes"
            className="font-semibold text-teal hover:underline"
          >
            Conectar agora
          </Link>
        </p>
      )}

      {campanhas.length > 0 && (
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

          {/* Funil de mídia */}
          <section className="mt-6 rounded-lg border border-border bg-white p-6 shadow-soft">
            <h2 className="text-lg font-semibold text-azul-medico">Funil da mídia</h2>
            <p className="mt-1 text-sm text-cinza-suave">
              Das campanhas que estão no ar agora.
            </p>

            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { rotulo: "Impressões", valor: formatarNumero(m.impressoes), taxa: null },
                {
                  rotulo: "Cliques",
                  valor: formatarNumero(m.cliques),
                  taxa: `${formatarPercentual(m.ctr, 2)} de CTR`,
                },
                {
                  rotulo: "Leads",
                  valor: formatarNumero(m.leads),
                  taxa: `${formatarPercentual(m.taxaConversao, 1)} dos cliques`,
                },
                {
                  rotulo: "Agendamentos",
                  valor: formatarNumero(m.agendamentos),
                  taxa: `${formatarPercentual(m.taxaAgendamento, 1)} dos leads`,
                },
              ].map((e) => (
                <div
                  key={e.rotulo}
                  className="rounded-lg border border-border bg-branco-clinico p-4"
                >
                  <p className="text-xs uppercase tracking-wide text-cinza-suave">
                    {e.rotulo}
                  </p>
                  <p className="mt-1 font-heading text-xl font-bold text-azul-medico">
                    {e.valor}
                  </p>
                  {e.taxa && <p className="mt-0.5 text-xs text-teal">{e.taxa}</p>}
                </div>
              ))}
            </div>
          </section>

          {/* Comparação entre plataformas */}
          {plataformas.length > 1 && (
            <section className="mt-6 rounded-lg border border-border bg-white p-6 shadow-soft">
              <h2 className="text-lg font-semibold text-azul-medico">
                Onde o dinheiro rende mais
              </h2>
              <p className="mt-1 text-sm text-cinza-suave">
                Mesmo período, plataformas lado a lado.
              </p>

              <div className="mt-5 space-y-4">
                {plataformas.map((p) => {
                  const fatia = m.investimento
                    ? (p.metricas.investimento / m.investimento) * 100
                    : 0;
                  return (
                    <div key={p.plataforma}>
                      <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                        <span className="flex items-center gap-2">
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                              corPlataforma[p.plataforma]
                            )}
                          >
                            {rotuloPlataforma[p.plataforma]}
                          </span>
                          <span className="text-cinza-suave">
                            {p.quantidade} campanha{p.quantidade === 1 ? "" : "s"}
                          </span>
                        </span>
                        <span className="text-cinza-suave">
                          {formatarReais(p.metricas.investimento)} ·{" "}
                          <strong className="text-azul-medico">
                            {formatarNumero(p.metricas.leads)} leads
                          </strong>{" "}
                          a{" "}
                          <strong className="text-teal">
                            {p.metricas.cpl ? formatarReais(p.metricas.cpl, true) : "—"}
                          </strong>{" "}
                          cada
                        </span>
                      </div>
                      <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-verde-menta">
                        <div
                          className="h-full rounded-full bg-teal"
                          style={{ width: `${Math.max(fatia, 2)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </>
      )}

      <div className="mt-8">
        <Campanhas
          campanhas={campanhas}
          organizationId={orgId}
          podeEditar={podeEditar}
          demo={demo}
        />
      </div>
    </div>
  );
}
