import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, Landmark, TrendingDown } from "lucide-react";
import { exigirModulo } from "@/lib/acesso";
import { getConfigFinanceira, getContasAbertas, getRecebiveis } from "@/lib/supabase/financeiro-dados";
import { dataDeEntrada, hojeIso, liquido, projecaoCaixa, somarDias } from "@/lib/financeiro/calculos";
import { rotuloCategoria } from "@/lib/financeiro/calculos";
import { BarrasAgrupadas, LinhaArea } from "@/components/graficos/graficos";
import { COR, reais } from "@/components/graficos/formato";
import { Indicador, Painel, Situacao } from "@/components/app/financeiro/ui";
import { FabLancamentos } from "@/components/app/botoes-flutuantes";
import { cn } from "@/lib/utils";

export const metadata = { title: "Fluxo de caixa · Financeiro" };

const curta = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

const HORIZONTES = [30, 60, 90, 180] as const;

export default async function CaixaPage({ searchParams }: { searchParams: { dias?: string } }) {
  const { organizacao } = await exigirModulo("financeiro");
  const orgId = organizacao?.id ?? null;
  const horizonte = HORIZONTES.find((h) => String(h) === searchParams.dias) ?? 90;
  const [recebiveis, contas, config] = await Promise.all([getRecebiveis(orgId), getContasAbertas(orgId), getConfigFinanceira(orgId)]);
  const saldoHoje = Number(config?.saldo_inicial ?? 0);
  const dias = projecaoCaixa(recebiveis, contas, saldoHoje, horizonte);
  const hoje = hojeIso();
  const menor = dias.reduce((m, d) => (d.saldo < m.saldo ? d : m), dias[0]);
  const negativo = dias.find((d) => d.saldo < 0);

  // Semanas: blocos de 7 dias até o fim do horizonte
  const semanas = Array.from({ length: Math.ceil(horizonte / 7) }, (_, i) => {
    const bloco = dias.slice(i * 7, i * 7 + 7);
    return {
      rotulo: curta(bloco[0]?.dia ?? hoje),
      entradas: bloco.reduce((s, d) => s + d.entradas, 0),
      saidas: bloco.reduce((s, d) => s + d.saidas, 0),
    };
  });

  // A lista vai até 60 dias: mais que isso vira lista longa demais
  const diasLista = Math.min(horizonte, 60);
  const ate30 = somarDias(hoje, diasLista - 1);
  const movimentos = [
    ...recebiveis
      .filter((l) => l.status === "previsto")
      .map((l) => ({ dia: dataDeEntrada(l) < hoje ? hoje : dataDeEntrada(l), tipo: "entrada" as const, texto: l.paciente_nome, detalhe: l.forma_pagamento === "convenio" ? l.convenio ?? "Convênio" : l.procedimento, valor: liquido(l) })),
    ...contas.map((c) => ({ dia: c.vencimento < hoje ? hoje : c.vencimento, tipo: "saida" as const, texto: c.descricao, detalhe: rotuloCategoria(c.categoria), valor: Number(c.valor), vencida: c.vencimento < hoje })),
  ]
    .filter((m) => m.dia <= ate30)
    .sort((a, b) => a.dia.localeCompare(b.dia) || (a.tipo === "saida" ? -1 : 1));

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-lg font-semibold text-azul-medico">Fluxo de caixa</h2>
          <p className="text-sm text-cinza-suave">O dinheiro dos próximos {horizonte} dias, pela data em que entra e sai.</p>
        </div>
        <nav aria-label="Horizonte" className="inline-flex rounded-full border border-border bg-white p-1 shadow-soft">
          {HORIZONTES.map((h) => (
            <Link
              key={h}
              href={h === 90 ? "/app/financeiro/caixa" : `/app/financeiro/caixa?dias=${h}`}
              scroll={false}
              aria-current={h === horizonte ? "page" : undefined}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors sm:text-sm",
                h === horizonte ? "bg-azul-medico text-white" : "text-cinza-suave hover:text-azul-medico"
              )}
            >
              {h} dias
            </Link>
          ))}
        </nav>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Indicador icone={Landmark} rotulo="Em caixa hoje" valor={reais(saldoHoje)} nota={<Link href="/app/financeiro/configuracoes" className="text-teal hover:underline">Atualizar saldo</Link>} />
        <Indicador icone={ArrowDownLeft} rotulo={`Entra em ${horizonte} dias`} valor={reais(dias.reduce((s, d) => s + d.entradas, 0))} nota="Agenda, parcelas e convênios" />
        <Indicador icone={ArrowUpRight} rotulo={`Sai em ${horizonte} dias`} valor={reais(dias.reduce((s, d) => s + d.saidas, 0))} nota={`${contas.length} contas em aberto`} />
        <Indicador
          icone={TrendingDown}
          rotulo="Menor saldo previsto"
          valor={reais(menor?.saldo ?? saldoHoje)}
          nota={menor ? `em ${new Date(`${menor.dia}T12:00:00`).toLocaleDateString("pt-BR")}` : undefined}
          destaque={!!negativo}
        />
      </div>

      <Painel
        titulo={`Saldo previsto para ${horizonte} dias`}
        descricao="Hoje em caixa, mais o que vai entrar, menos as contas a vencer. Recebíveis em atraso ficam de fora, por serem incertos."
        acao={negativo ? <Situacao tom="critico">Negativo a partir de {curta(negativo.dia)}</Situacao> : <Situacao tom="bom">Sempre positivo</Situacao>}
      >
        <LinhaArea
          rotulos={dias.map((d) => curta(d.dia))}
          series={[{ nome: "Saldo", cor: COR.lucro, valores: dias.map((d) => d.saldo), area: true }]}
          altura={280}
        />
      </Painel>

      <div className="grid gap-5 lg:grid-cols-5">
        <Painel className="lg:col-span-3" titulo="Entradas e saídas por semana" descricao={`Próximas ${semanas.length} semanas, pela data em que o dinheiro se move.`}>
          <BarrasAgrupadas
            categorias={semanas.map((s) => s.rotulo)}
            barras={[
              { nome: "Entradas", cor: COR.receita, valores: semanas.map((s) => s.entradas) },
              { nome: "Saídas", cor: COR.despesa, valores: semanas.map((s) => s.saidas) },
            ]}
            altura={250}
          />
        </Painel>
        <Painel className="lg:col-span-2" titulo={`Próximos ${diasLista} dias`} descricao="Cada movimento previsto." corpo="p-0">
          {movimentos.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-cinza-suave">Nada previsto para os próximos {diasLista} dias.</p>
          ) : (
            <ul className="max-h-[340px] divide-y divide-border overflow-y-auto">
              {movimentos.slice(0, 80).map((m, i) => (
                <li key={i} className="flex items-center gap-3 px-5 py-2.5">
                  <span className="w-11 shrink-0 text-xs font-semibold tabular-nums text-cinza-suave">{curta(m.dia)}</span>
                  <span
                    className={
                      m.tipo === "entrada"
                        ? "grid size-6 shrink-0 place-items-center rounded-full bg-[#E9F8EF] text-[#15803D]"
                        : "grid size-6 shrink-0 place-items-center rounded-full bg-[#FDEFE7] text-[#C2410C]"
                    }
                  >
                    {m.tipo === "entrada" ? <ArrowDownLeft className="size-3.5" /> : <ArrowUpRight className="size-3.5" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-cinza-texto">{m.texto}</span>
                    <span className="block truncate text-[11px] text-cinza-suave">
                      {m.detalhe}
                      {"vencida" in m && m.vencida ? " · vencida" : ""}
                    </span>
                  </span>
                  <span className={m.tipo === "entrada" ? "shrink-0 text-sm font-semibold tabular-nums text-[#15803D]" : "shrink-0 text-sm font-semibold tabular-nums text-[#C2410C]"}>
                    {m.tipo === "entrada" ? "+" : "−"}
                    {reais(m.valor)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Painel>
      </div>
      <FabLancamentos />
    </div>
  );
}
