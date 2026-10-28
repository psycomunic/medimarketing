import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  CalendarClock,
  CheckCircle2,
  HandCoins,
  Receipt,
  Scale,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { exigirModulo } from "@/lib/acesso";
import { getPlano } from "@/lib/supabase/evolucao";
import {
  getConfigFinanceira,
  getContasAbertas,
  getDespesas,
  getReceitas,
  getRecebiveis,
  getRegrasRepasse,
} from "@/lib/supabase/financeiro-dados";
import {
  calcularRepasses,
  faixasAtraso,
  hojeIso,
  mesAnterior,
  mesCurto,
  pontoEquilibrio,
  porCategoria,
  porConvenio,
  porForma,
  porProcedimento,
  projecaoCaixa,
  resumoMes,
  serieMensal,
  somarDias,
  ultimosMeses,
  variacao,
} from "@/lib/financeiro/calculos";
import { BarrasAgrupadas, LinhaArea, Medidor, Ranking, Rosca } from "@/components/graficos/graficos";
import { COR, SERIES, pct, reais } from "@/components/graficos/formato";
import { Indicador, Painel, Situacao, limites, mesDaUrl } from "@/components/app/financeiro/ui";
import { rotuloFormaPagamento } from "@/lib/rotulos";

export const metadata = { title: "Financeiro" };

const COR_FORMA: Record<string, string> = {
  pix: SERIES[0],
  cartao_credito: SERIES[1],
  convenio: SERIES[2],
  cartao_debito: SERIES[3],
  dinheiro: SERIES[4],
  boleto: SERIES[5],
};

export default async function VisaoGeralFinanceiro({ searchParams }: { searchParams: { mes?: string } }) {
  const { organizacao } = await exigirModulo("financeiro");
  const orgId = organizacao?.id ?? null;
  const mes = mesDaUrl(searchParams.mes);
  const meses = ultimosMeses(mes, 12);
  const { ate } = limites(mes);
  const de12 = `${meses[0]}-01`;

  const [receitas, despesas, config, recebiveis, contas, regras, plano] = await Promise.all([
    getReceitas(orgId, de12, ate),
    getDespesas(orgId, de12, ate),
    getConfigFinanceira(orgId),
    getRecebiveis(orgId),
    getContasAbertas(orgId),
    getRegrasRepasse(orgId),
    getPlano(orgId),
  ]);

  const doMes = (m: string) => ({
    r: receitas.filter((l) => l.data_competencia.startsWith(m)),
    d: despesas.filter((x) => x.vencimento.startsWith(m)),
  });
  const atual = doMes(mes);
  const ant = doMes(mesAnterior(mes));
  const repasse = calcularRepasses(atual.r, regras).reduce((s, x) => s + x.valor, 0);
  const r = resumoMes(atual.r, atual.d, config, repasse);
  const ra = resumoMes(ant.r, ant.d, config, calcularRepasses(ant.r, regras).reduce((s, x) => s + x.valor, 0));
  const serie = serieMensal(meses, receitas, despesas, config);
  const pe = pontoEquilibrio(r);

  const caixa = projecaoCaixa(recebiveis, contas, Number(config?.saldo_inicial ?? 0), 30);
  const menorSaldo = caixa.reduce((min, d) => (d.saldo < min.saldo ? d : min), caixa[0]);
  const hoje = hojeIso();
  const vencidas = contas.filter((c) => c.vencimento < hoje);
  const semana = contas.filter((c) => c.vencimento >= hoje && c.vencimento <= somarDias(hoje, 7));
  const atrasos = faixasAtraso(recebiveis);
  const totalAtraso = atrasos.reduce((s, f) => s + f.valor, 0);
  const convenios = porConvenio(receitas.filter((l) => l.data_competencia >= `${ultimosMeses(mes, 3)[0]}-01`));
  const glosaMedia =
    convenios.reduce((s, c) => s + c.faturado, 0) > 0
      ? (convenios.reduce((s, c) => s + c.glosado, 0) / convenios.reduce((s, c) => s + c.faturado, 0)) * 100
      : 0;

  const alertas: { tom: "critico" | "atencao" | "info"; texto: string; href: string }[] = [];
  if (vencidas.length)
    alertas.push({
      tom: "critico",
      texto: `${vencidas.length} conta${vencidas.length > 1 ? "s" : ""} vencida${vencidas.length > 1 ? "s" : ""} · ${reais(vencidas.reduce((s, c) => s + Number(c.valor), 0))}`,
      href: "/app/financeiro/despesas",
    });
  if (semana.length)
    alertas.push({
      tom: "atencao",
      texto: `${semana.length} conta${semana.length > 1 ? "s" : ""} vence${semana.length > 1 ? "m" : ""} nos próximos 7 dias · ${reais(semana.reduce((s, c) => s + Number(c.valor), 0))}`,
      href: "/app/financeiro/despesas",
    });
  if (totalAtraso > 0)
    alertas.push({
      tom: "atencao",
      texto: `${reais(totalAtraso)} a receber em atraso`,
      href: "/app/financeiro/receitas",
    });
  if (menorSaldo && menorSaldo.saldo < 0)
    alertas.push({
      tom: "critico",
      texto: `O caixa fica negativo em ${new Date(`${menorSaldo.dia}T12:00:00`).toLocaleDateString("pt-BR")}`,
      href: "/app/financeiro/caixa",
    });
  if (glosaMedia > Number(config?.reserva_glosa ?? 7))
    alertas.push({
      tom: "atencao",
      texto: `Glosa de ${pct(glosaMedia, 1)} nos convênios, acima da reserva de ${pct(Number(config?.reserva_glosa ?? 7))}`,
      href: "/app/financeiro/convenios",
    });

  const formas = porForma(atual.r);
  const categorias = porCategoria(atual.d);
  const procedimentos = porProcedimento(atual.r);
  const metaFat = plano?.meta_faturamento ? Number(plano.meta_faturamento) : null;
  const metaLucro = config?.meta_lucro ? Number(config.meta_lucro) : null;

  return (
    <div className="grid gap-5">
      {/* Indicadores do mês */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Indicador
          icone={Banknote}
          rotulo="Faturamento do mês"
          valor={reais(r.receitaBruta)}
          variacao={variacao(r.receitaBruta, ra.receitaBruta)}
          nota={`${r.atendimentos} atendimentos · ticket ${reais(r.ticketMedio)}`}
          serie={serie.map((p) => p.receita)}
          cor={COR.receita}
        />
        <Indicador
          icone={Wallet}
          rotulo="Já recebido"
          valor={reais(r.recebido)}
          variacao={variacao(r.recebido, ra.recebido)}
          nota={`${reais(r.aReceber + r.atrasado)} ainda a receber`}
        />
        <Indicador
          icone={Receipt}
          rotulo="Saídas do mês"
          valor={reais(r.despesas + r.custosDiretos + r.taxas + r.impostos + r.repasse)}
          variacao={variacao(
            r.despesas + r.custosDiretos + r.taxas + r.impostos + r.repasse,
            ra.despesas + ra.custosDiretos + ra.taxas + ra.impostos + ra.repasse
          )}
          inverter
          nota={`${reais(r.despesasAbertas)} em contas a pagar`}
          serie={serie.map((p) => p.despesas)}
          cor={COR.despesa}
        />
        <Indicador
          icone={TrendingUp}
          rotulo="Lucro do mês"
          valor={reais(r.lucro)}
          variacao={variacao(r.lucro, ra.lucro)}
          nota={`Margem de ${pct(r.margem, 1)}`}
          serie={serie.map((p) => p.lucro)}
          destaque
        />
      </div>

      {/* 12 meses + metas */}
      <div className="grid gap-5 lg:grid-cols-3">
        <Painel
          className="lg:col-span-2"
          titulo="Receita, saídas e lucro"
          descricao="Últimos 12 meses. Saídas somam despesas, custos dos procedimentos, taxas, impostos e glosas."
        >
          <BarrasAgrupadas
            categorias={serie.map((p) => mesCurto(p.mes))}
            barras={[
              { nome: "Receita", cor: COR.receita, valores: serie.map((p) => p.receita) },
              { nome: "Saídas", cor: COR.despesa, valores: serie.map((p) => p.despesas) },
            ]}
            linhas={[{ nome: "Lucro", cor: COR.lucro, valores: serie.map((p) => p.lucro) }]}
            destaque={serie.length - 1}
            altura={280}
          />
        </Painel>

        <div className="grid content-start gap-5">
          <Painel titulo="Metas do mês">
            <div className="grid gap-5">
              {metaFat ? (
                <Medidor rotulo="Faturamento" valor={r.receitaBruta} meta={metaFat} />
              ) : (
                <p className="text-sm text-cinza-suave">Meta de faturamento ainda não definida no plano da clínica.</p>
              )}
              {metaLucro ? (
                <Medidor rotulo="Lucro" valor={Math.max(r.lucro, 0)} meta={metaLucro} />
              ) : (
                <p className="text-sm text-cinza-suave">
                  Defina a meta de lucro em{" "}
                  <Link href="/app/financeiro/configuracoes" className="font-medium text-teal hover:underline">
                    Preços e taxas
                  </Link>
                  .
                </p>
              )}
            </div>
          </Painel>
          <Painel titulo="Ponto de equilíbrio">
            {pe.receitaNecessaria === null ? (
              <p className="text-sm text-cinza-suave">
                Com a margem atual não dá para calcular: os custos dos atendimentos superam a receita.
              </p>
            ) : (
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-verde-menta text-teal">
                  <Scale className="size-5" />
                </span>
                <div className="min-w-0 text-sm">
                  <p className="font-heading text-lg font-bold text-azul-medico">{reais(pe.receitaNecessaria)}</p>
                  <p className="text-cinza-suave">
                    de faturamento paga as despesas do mês
                    {pe.consultas ? ` (≈ ${pe.consultas} atendimentos)` : ""}.
                  </p>
                  <p className="mt-2">
                    {pe.falta && pe.falta > 0 ? (
                      <Situacao tom="atencao">Faltam {reais(pe.falta)}</Situacao>
                    ) : (
                      <Situacao tom="bom">Equilíbrio atingido</Situacao>
                    )}
                  </p>
                </div>
              </div>
            )}
          </Painel>
        </div>
      </div>

      {/* Caixa + alertas */}
      <div className="grid gap-5 lg:grid-cols-3">
        <Painel
          className="lg:col-span-2"
          titulo="Caixa dos próximos 30 dias"
          descricao={`Começa com ${reais(Number(config?.saldo_inicial ?? 0))} em caixa, soma o que vai entrar e desconta as contas a vencer.`}
          acao={
            <Link href="/app/financeiro/caixa" className="inline-flex items-center gap-1 text-sm font-medium text-teal hover:underline">
              Ver 90 dias <ArrowRight className="size-4" />
            </Link>
          }
        >
          <LinhaArea
            rotulos={caixa.map((d) => new Date(`${d.dia}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }))}
            series={[{ nome: "Saldo previsto", cor: COR.lucro, valores: caixa.map((d) => d.saldo), area: true }]}
            altura={230}
          />
          <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-border pt-4 text-sm">
            <div>
              <dt className="text-xs text-cinza-suave">Entra</dt>
              <dd className="font-semibold tabular-nums text-[#15803D]">{reais(caixa.reduce((s, d) => s + d.entradas, 0))}</dd>
            </div>
            <div>
              <dt className="text-xs text-cinza-suave">Sai</dt>
              <dd className="font-semibold tabular-nums text-[#C2410C]">{reais(caixa.reduce((s, d) => s + d.saidas, 0))}</dd>
            </div>
            <div>
              <dt className="text-xs text-cinza-suave">Saldo em 30 dias</dt>
              <dd className="font-semibold tabular-nums text-azul-medico">{reais(caixa[caixa.length - 1]?.saldo ?? 0)}</dd>
            </div>
          </dl>
        </Painel>

        <Painel titulo="O que pede atenção" corpo="p-2" className="self-start">
          {alertas.length === 0 ? (
            <div className="flex items-center gap-3 px-3 py-6">
              <CheckCircle2 className="size-6 shrink-0 text-sucesso" />
              <p className="text-sm text-cinza-suave">Nada atrasado, nenhuma conta vencendo e caixa positivo.</p>
            </div>
          ) : (
            <ul className="grid">
              {alertas.map((a) => (
                <li key={a.texto}>
                  <Link href={a.href} className="flex items-start gap-3 rounded-lg px-3 py-3 transition-colors hover:bg-branco-clinico">
                    <span
                      className={
                        a.tom === "critico"
                          ? "mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-[#FDECEC] text-[#B91C1C]"
                          : "mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-[#FEF4E2] text-[#B45309]"
                      }
                    >
                      {a.tom === "critico" ? <AlertTriangle className="size-4" /> : <CalendarClock className="size-4" />}
                    </span>
                    <span className="min-w-0 flex-1 text-sm leading-snug text-cinza-texto">{a.texto}</span>
                    <ArrowRight className="mt-1 size-4 shrink-0 text-cinza-suave/50" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Painel>
      </div>

      {/* Composição */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Painel titulo="Como os pacientes pagaram" descricao="Receita do mês por forma de pagamento.">
          <Rosca
            itens={formas.map((f) => ({ nome: rotuloFormaPagamento[f.forma], valor: f.valor, cor: COR_FORMA[f.forma] }))}
            centro={{ valor: reais(r.receitaBruta), rotulo: "no mês" }}
          />
        </Painel>
        <Painel titulo="Para onde foi o dinheiro" descricao="Despesas do mês por categoria.">
          <Rosca itens={categorias.map((c) => ({ nome: c.nome, valor: c.valor }))} centro={{ valor: reais(r.despesas), rotulo: "em despesas" }} />
        </Painel>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Painel className="lg:col-span-2" titulo="Procedimentos que mais faturam" descricao="No mês, com a quantidade realizada.">
          <Ranking itens={procedimentos.map((p) => ({ nome: p.nome, valor: p.valor, detalhe: `${p.quantidade}×` }))} />
        </Painel>
        <Painel titulo="Particular x convênio">
          <div className="grid gap-4">
            <div className="flex h-3 overflow-hidden rounded-full bg-[#EEF3F5]">
              <div style={{ width: `${r.receitaBruta ? (r.particular / r.receitaBruta) * 100 : 0}%`, background: COR.receita }} />
              <div className="border-l-2 border-white" style={{ width: `${r.receitaBruta ? (r.convenio / r.receitaBruta) * 100 : 0}%`, background: SERIES[2] }} />
            </div>
            <dl className="grid gap-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <dt className="flex items-center gap-2 text-cinza-texto">
                  <span className="size-2.5 rounded-[3px]" style={{ background: COR.receita }} /> Particular
                </dt>
                <dd className="font-semibold tabular-nums text-azul-medico">{reais(r.particular)}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="flex items-center gap-2 text-cinza-texto">
                  <span className="size-2.5 rounded-[3px]" style={{ background: SERIES[2] }} /> Convênio
                </dt>
                <dd className="font-semibold tabular-nums text-azul-medico">{reais(r.convenio)}</dd>
              </div>
            </dl>
            <div className="flex items-center gap-2 rounded-lg bg-branco-clinico px-3 py-2.5 text-xs text-cinza-suave">
              <HandCoins className="size-4 shrink-0 text-teal" />
              Taxas de cartão no mês: <strong className="text-cinza-texto">{reais(r.taxas)}</strong>
            </div>
          </div>
        </Painel>
      </div>
    </div>
  );
}
