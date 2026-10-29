import Link from "next/link";
import { ArrowRight, Building2, FilePlus2, FileSignature, Gauge, Repeat, TrendingDown, Users, Wallet } from "lucide-react";
import type { Profile } from "@/lib/supabase/types";
import type { DadosAgencia } from "@/lib/inicio/dados";
import { ROTULO_PLANO } from "@/lib/financeiro/agencia";
import { mesCurto, variacao } from "@/lib/financeiro/calculos";
import { BarrasAgrupadas } from "@/components/graficos/graficos";
import { COR, SERIES, pct, reais } from "@/components/graficos/formato";
import { Indicador, Painel, Situacao } from "@/components/app/financeiro/ui";
import { Cabecalho, PedeAtencao } from "./blocos";

export function InicioAgencia({ profile, dados }: { profile: Profile; dados: DadosAgencia }) {
  const r = dados.resultado;
  const ultimoFat = r.faturamento[r.faturamento.length - 2] ?? 0; // mês fechado mais recente
  const anteriorFat = r.faturamento[r.faturamento.length - 3] ?? 0;
  const inv = r.investimento[r.investimento.length - 2] ?? 0;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <Cabecalho
        nome={profile.nome}
        contexto={`Equipe Medi Marketing · ${dados.carteira.length} clínica${dados.carteira.length === 1 ? "" : "s"} na carteira`}
        atalhos={[
          { href: "/app/clinicas", rotulo: "Clientes", icone: Building2, principal: true },
          { href: "/app/admin/financeiro/contratos?novo=1", rotulo: "Novo contrato", icone: FileSignature },
          { href: "/app/admin/propostas", rotulo: "Propostas", icone: FilePlus2 },
        ]}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Indicador
          icone={Repeat}
          rotulo="MRR"
          valor={reais(dados.ind.mrr)}
          variacao={variacao(dados.serieMrr[dados.serieMrr.length - 1] ?? 0, dados.serieMrr[dados.serieMrr.length - 2] ?? 0)}
          nota={`ARR de ${reais(dados.ind.arr)}`}
          serie={dados.serieMrr}
          destaque
        />
        <Indicador icone={Users} rotulo="Clientes ativos" valor={String(dados.ind.clientes)} nota={`Ticket médio ${reais(dados.ind.arpa)}`} />
        <Indicador
          icone={Wallet}
          rotulo="Inadimplência"
          valor={reais(dados.inadimplencia)}
          nota={dados.inadimplentes ? `${dados.inadimplentes} cliente${dados.inadimplentes > 1 ? "s" : ""} em atraso` : "Ninguém em atraso"}
        />
        <Indicador
          icone={TrendingDown}
          rotulo="Churn médio · 6 meses"
          valor={pct(dados.ind.churnMedio, 1)}
          nota={dados.ind.nrr === null ? "Retenção ainda sem histórico" : `Retenção de receita ${pct(dados.ind.nrr)}`}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-5">
        <div className="min-w-0 lg:col-span-2">
          <PedeAtencao itens={dados.pendencias} titulo="Precisa de você" vazio="Carteira em dia: sem faturas vencidas, check-ins atrasados ou clientes em risco." />
        </div>
        <Painel
          className="lg:col-span-3"
          titulo="Resultado gerado para a carteira"
          descricao="Faturamento somado das clínicas atendidas e o investimento em anúncios, mês a mês."
          acao={
            <Link href="/app/indicadores" className="inline-flex items-center gap-1 text-sm font-medium text-teal hover:underline">
              Indicadores <ArrowRight className="size-4" />
            </Link>
          }
        >
          <div className="mb-4 grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-branco-clinico px-3 py-2.5">
              <p className="text-[11px] text-cinza-suave">Faturamento (mês fechado)</p>
              <p className="font-heading text-base font-bold tabular-nums text-azul-medico">{reais(ultimoFat)}</p>
              {anteriorFat > 0 && (
                <p className={ultimoFat >= anteriorFat ? "text-[11px] font-semibold text-[#15803D]" : "text-[11px] font-semibold text-[#B91C1C]"}>
                  {ultimoFat >= anteriorFat ? "▲" : "▼"} {pct(Math.abs(variacao(ultimoFat, anteriorFat) ?? 0), 1)}
                </p>
              )}
            </div>
            <div className="rounded-lg bg-branco-clinico px-3 py-2.5">
              <p className="text-[11px] text-cinza-suave">Retorno médio</p>
              <p className="font-heading text-base font-bold tabular-nums text-azul-medico">
                {inv > 0 ? `${(ultimoFat / inv).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}x` : "—"}
              </p>
            </div>
            <div className="rounded-lg bg-branco-clinico px-3 py-2.5">
              <p className="text-[11px] text-cinza-suave">Leads entregues</p>
              <p className="font-heading text-base font-bold tabular-nums text-azul-medico">
                {(r.leads[r.leads.length - 2] ?? 0).toLocaleString("pt-BR")}
              </p>
            </div>
          </div>
          <BarrasAgrupadas
            categorias={r.meses.map(mesCurto)}
            barras={[
              { nome: "Investimento", cor: COR.despesa, valores: r.investimento },
              { nome: "Faturamento das clínicas", cor: COR.receita, valores: r.faturamento },
            ]}
            destaque={r.meses.length - 1}
            altura={220}
          />
        </Painel>
      </div>

      <Painel
        titulo="Carteira de clientes"
        descricao="Ordenada por risco: quem pede atenção aparece primeiro."
        acao={
          <Link href="/app/admin/financeiro/clientes" className="inline-flex items-center gap-1 text-sm font-medium text-teal hover:underline">
            Saúde dos clientes <ArrowRight className="size-4" />
          </Link>
        }
        corpo="p-0"
      >
        {dados.carteira.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-cinza-suave">Nenhuma clínica ativa ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-cinza-suave">
                  <th className="px-5 py-2.5 font-semibold">Clínica</th>
                  <th className="px-2 py-2.5 text-right font-semibold">Mensalidade</th>
                  <th className="px-2 py-2.5 text-right font-semibold">Faturamento no mês</th>
                  <th className="px-2 py-2.5 text-right font-semibold">Leads</th>
                  <th className="px-2 py-2.5 text-right font-semibold">Consultas</th>
                  <th className="px-2 py-2.5 font-semibold">Último acesso</th>
                  <th className="px-5 py-2.5 text-right font-semibold">Saúde</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {dados.carteira.map((c, i) => (
                  <tr key={c.id} className="transition-colors hover:bg-branco-clinico">
                    <td className="px-5 py-3">
                      <Link href={`/app/clinicas/${c.id}`} className="flex items-center gap-3">
                        {c.logo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={c.logo} alt="" className="logo-clinica size-8 shrink-0 rounded-lg object-contain" />
                        ) : (
                          <span
                            className="grid size-8 shrink-0 place-items-center rounded-lg font-heading text-sm font-bold text-white"
                            style={{ background: SERIES[i % SERIES.length] }}
                          >
                            {c.nome.charAt(0).toUpperCase()}
                          </span>
                        )}
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-cinza-texto hover:text-teal">{c.nome}</span>
                          <span className="block text-xs text-cinza-suave">
                            {ROTULO_PLANO[c.plano] ?? c.plano}
                            {c.checkinPendente ? " · check-in pendente" : ""}
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td className="px-2 py-3 text-right tabular-nums text-cinza-texto">{c.mensalidade === null ? "—" : reais(c.mensalidade)}</td>
                    <td className="px-2 py-3 text-right font-semibold tabular-nums text-azul-medico">{reais(c.faturamento)}</td>
                    <td className="px-2 py-3 text-right tabular-nums">{c.leads}</td>
                    <td className="px-2 py-3 text-right tabular-nums">{c.consultas}</td>
                    <td className="px-2 py-3 text-xs text-cinza-suave">
                      {c.ultimoAcesso ? new Date(c.ultimoAcesso).toLocaleDateString("pt-BR") : "Nunca entrou"}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {c.risco ? (
                        <span title={c.risco.motivos.join(" · ") || undefined}>
                          <Situacao tom={c.risco.nivel === "alto" ? "critico" : c.risco.nivel === "medio" ? "atencao" : "bom"}>
                            {c.risco.nivel === "alto" ? "Risco alto" : c.risco.nivel === "medio" ? "Atenção" : "Saudável"}
                          </Situacao>
                        </span>
                      ) : (
                        <Situacao tom="neutro">Sem contrato</Situacao>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Painel>

      <div className="grid gap-5 lg:grid-cols-3">
        <Painel titulo="Comercial">
          <dl className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-branco-clinico px-3 py-3">
              <dt className="text-xs text-cinza-suave">Propostas abertas</dt>
              <dd className="font-heading text-xl font-bold text-azul-medico">{dados.propostas.abertas}</dd>
              <dd className="text-[11px] text-cinza-suave">{dados.propostas.vistas} já vista(s)</dd>
            </div>
            <div className="rounded-lg bg-branco-clinico px-3 py-3">
              <dt className="text-xs text-cinza-suave">Em negociação</dt>
              <dd className="font-heading text-xl font-bold text-azul-medico">{reais(dados.propostas.valor)}</dd>
              <dd className="text-[11px] text-cinza-suave">por mês, no plano sugerido</dd>
            </div>
          </dl>
          <Link href="/app/admin/propostas" className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-teal hover:underline">
            Ver propostas <ArrowRight className="size-4" />
          </Link>
        </Painel>
        <Painel titulo="Garantido por contrato">
          <p className="font-heading text-2xl font-bold tabular-nums text-azul-medico">{reais(dados.ind.contratado12)}</p>
          <p className="mt-1 text-sm text-cinza-suave">Mensalidades até o fim das fidelidades (12 meses).</p>
          <Link href="/app/admin/financeiro/contratos" className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-teal hover:underline">
            Contratos <ArrowRight className="size-4" />
          </Link>
        </Painel>
        <Painel titulo="Faturamento da carteira hoje">
          <p className="font-heading text-2xl font-bold tabular-nums text-azul-medico">{reais(dados.faturamentoCarteira)}</p>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-cinza-suave">
            <Gauge className="size-4 text-teal" /> Registrado no mês corrente pelas clínicas.
          </p>
          <Link href="/app/admin/financeiro" className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-teal hover:underline">
            Financeiro da agência <ArrowRight className="size-4" />
          </Link>
        </Painel>
      </div>
    </div>
  );
}
