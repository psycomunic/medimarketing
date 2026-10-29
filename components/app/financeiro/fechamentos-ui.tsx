"use client";

import { useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Check, CheckCircle2, ListPlus, Pencil, Plus, Scale, Trash2, TriangleAlert, X } from "lucide-react";
import type { ComposicaoFinanceira, FechamentoFinanceiro, NaturezaComposicao } from "@/lib/supabase/types";
import { excluirFechamento, salvarFechamento } from "@/lib/actions/financeiro";
import { itensConhecidos, ROTULO_NATUREZA } from "@/lib/financeiro/historico";
import { mesLongo } from "@/lib/financeiro/calculos";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { reais } from "@/components/graficos/formato";
import { CampoReais, Erro, Girando, emTexto, numero, useAcao } from "./form-comum";
import { cn } from "@/lib/utils";

const nomeMes = (m: string) => mesLongo(m).replace(/^./, (c) => c.toUpperCase());
const mesCurtoBr = (m: string) => {
  const [a, mm] = m.split("-").map(Number);
  return `${["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"][mm - 1]}/${String(a).slice(2)}`;
};
const somarMes = (m: string, k: number) => {
  const [a, mm] = m.split("-").map(Number);
  const d = new Date(a, mm - 1 + k, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
const fimDoMes = (m: string) => {
  const [a, mm] = m.split("-").map(Number);
  return `${m}-${String(new Date(a, mm, 0).getDate()).padStart(2, "0")}`;
};
const valorOuNulo = (v: string) => (v.trim() ? numero(v) : null);

const NATUREZAS_RECEITA: NaturezaComposicao[] = ["convenio", "particular", "outras"];
const NATUREZAS_SAIDA: NaturezaComposicao[] = ["operacional", "socios", "financeiro", "investimento"];

/* ------------------------------- Tabela ------------------------------- */

/** Tabela mês a mês, com lançar e corrigir fechamentos. */
export function TabelaFechamentos({
  fechamentos,
  composicoes,
  organizationId,
  podeEditar,
  demo,
}: {
  fechamentos: FechamentoFinanceiro[];
  composicoes: ComposicaoFinanceira[];
  organizationId?: string;
  podeEditar: boolean;
  demo: boolean;
}) {
  const [aberto, setAberto] = useState<{ mes: string } | null>(null);
  const { erro, executar } = useAcao();
  const lista = [...fechamentos].sort((a, b) => b.mes.localeCompare(a.mes));
  const detalhados = new Set(
    composicoes.filter((c) => c.inicio.slice(0, 7) === c.fim.slice(0, 7)).map((c) => c.inicio.slice(0, 7))
  );

  return (
    <section className="min-w-0 rounded-xl border border-border bg-white shadow-soft">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <h2 className="font-heading text-base font-semibold text-azul-medico">Fechamentos mês a mês</h2>
          <p className="mt-0.5 text-sm text-cinza-suave">Entradas, saídas e saldo no fim de cada mês, como vieram do extrato ou do sistema anterior.</p>
        </div>
        {podeEditar && (
          <Button type="button" variant="marca" size="sm" onClick={() => setAberto({ mes: "" })}>
            <Plus /> Lançar mês
          </Button>
        )}
      </header>
      {erro && (
        <div className="px-5 pt-3">
          <Erro texto={erro} />
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-cinza-suave">
              <th className="px-5 py-2.5 font-semibold">Mês</th>
              <th className="px-2 py-2.5 text-right font-semibold">Entradas</th>
              <th className="px-2 py-2.5 text-right font-semibold">Saídas</th>
              <th className="px-2 py-2.5 text-right font-semibold">Resultado</th>
              <th className="px-2 py-2.5 text-right font-semibold">Saldo final</th>
              {podeEditar && <th className="w-20 px-5 py-2.5" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {lista.map((f) => {
              const tem = f.entradas !== null || f.saidas !== null;
              const res = Number(f.entradas ?? 0) - Number(f.saidas ?? 0);
              return (
                <tr key={f.id}>
                  <td className="px-5 py-2.5 font-medium text-cinza-texto">
                    {nomeMes(f.mes.slice(0, 7))}
                    {detalhados.has(f.mes.slice(0, 7)) && (
                      <span className="ml-2 rounded-full bg-verde-menta px-1.5 py-0.5 text-[10px] font-semibold text-teal">detalhado</span>
                    )}
                    {f.observacao && <span className="block text-xs font-normal text-cinza-suave">{f.observacao}</span>}
                  </td>
                  <td className="px-2 py-2.5 text-right tabular-nums">{f.entradas === null ? "—" : reais(Number(f.entradas), true)}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums">{f.saidas === null ? "—" : reais(Number(f.saidas), true)}</td>
                  <td className={tem ? (res >= 0 ? "px-2 py-2.5 text-right font-semibold tabular-nums text-[#15803D]" : "px-2 py-2.5 text-right font-semibold tabular-nums text-[#B91C1C]") : "px-2 py-2.5 text-right text-cinza-suave"}>
                    {tem ? `${res >= 0 ? "+" : "−"}${reais(Math.abs(res), true)}` : "—"}
                  </td>
                  <td className="px-2 py-2.5 text-right font-semibold tabular-nums text-azul-medico">{f.saldo_final === null ? "—" : reais(Number(f.saldo_final), true)}</td>
                  {podeEditar && (
                    <td className="px-5 py-2.5">
                      <div className="flex justify-end gap-1">
                        <button type="button" onClick={() => setAberto({ mes: f.mes.slice(0, 7) })} className="grid size-8 place-items-center rounded-lg text-cinza-suave hover:bg-branco-clinico hover:text-azul-medico" aria-label="Editar">
                          <Pencil className="size-4" />
                        </button>
                        <button
                          type="button"
                          disabled={demo}
                          onClick={() => confirm("Excluir este fechamento e o detalhamento dele?") && executar(() => excluirFechamento(f.id))}
                          className="grid size-8 place-items-center rounded-lg text-cinza-suave hover:bg-[#FDECEC] hover:text-[#B91C1C]"
                          aria-label="Excluir"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
            {!lista.length && (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-cinza-suave">
                  Nenhum fechamento lançado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {aberto && (
        <FechamentoDialog
          key={aberto.mes || "novo"}
          mesInicial={aberto.mes}
          fechamentos={fechamentos}
          composicoes={composicoes}
          organizationId={organizationId}
          demo={demo}
          onTrocarMes={(m) => setAberto({ mes: m })}
          onFechar={() => setAberto(null)}
        />
      )}
    </section>
  );
}

/* ------------------------------ Formulário ------------------------------ */

type Linha = { id: number; item: string; valor: string; natureza: NaturezaComposicao };
let seq = 0;
const nova = (item = "", natureza: NaturezaComposicao = "operacional", valor = ""): Linha => ({ id: ++seq, item, valor, natureza });

/**
 * Fechamento do mês: escolhe o mês, informa o que entrou e o que saiu
 * (no total ou por fonte e categoria) e o painel calcula o saldo a
 * partir do mês anterior. O saldo do extrato, se informado, confere a
 * conta e aponta a diferença.
 */
function FechamentoDialog({
  mesInicial,
  fechamentos,
  composicoes,
  organizationId,
  demo,
  onTrocarMes,
  onFechar,
}: {
  mesInicial: string;
  fechamentos: FechamentoFinanceiro[];
  composicoes: ComposicaoFinanceira[];
  organizationId?: string;
  demo: boolean;
  onTrocarMes: (mes: string) => void;
  onFechar: () => void;
}) {
  const porMes = useMemo(() => new Map(fechamentos.map((f) => [f.mes.slice(0, 7), f])), [fechamentos]);
  const lancados = [...porMes.keys()].sort();
  const ultimo = lancados[lancados.length - 1];
  const hojeMes = new Date().toISOString().slice(0, 7);
  // Sugestão: o mês seguinte ao último lançado (sem passar do atual)
  const sugerido = ultimo ? (somarMes(ultimo, 1) <= hojeMes ? somarMes(ultimo, 1) : ultimo) : somarMes(hojeMes, -1);
  const mes = mesInicial || sugerido;
  const existente = porMes.get(mes) ?? null;
  const anterior = porMes.get(somarMes(mes, -1)) ?? null;

  // Detalhe já lançado deste mês, e as fontes/categorias que a clínica usa
  const doMes = composicoes.filter((c) => c.inicio === `${mes}-01` && c.fim === fimDoMes(mes));
  const conhecidos = itensConhecidos(composicoes);

  const [detEntradas, setDetEntradas] = useState(doMes.some((c) => c.tipo === "receita"));
  const [detSaidas, setDetSaidas] = useState(doMes.some((c) => c.tipo === "saida"));
  const [linhasE, setLinhasE] = useState<Linha[]>(() => {
    const ja = doMes.filter((c) => c.tipo === "receita");
    if (ja.length) return ja.map((c) => nova(c.item, c.natureza, emTexto(Number(c.valor))));
    const base = conhecidos.filter((c) => c.tipo === "receita").slice(0, 8);
    return base.length ? base.map((c) => nova(c.item, c.natureza)) : [nova("", "particular")];
  });
  const [linhasS, setLinhasS] = useState<Linha[]>(() => {
    const ja = doMes.filter((c) => c.tipo === "saida");
    if (ja.length) return ja.map((c) => nova(c.item, c.natureza, emTexto(Number(c.valor))));
    const base = conhecidos.filter((c) => c.tipo === "saida").slice(0, 8);
    return base.length ? base.map((c) => nova(c.item, c.natureza)) : [nova("", "operacional")];
  });
  const [entradas, setEntradas] = useState(existente?.entradas != null ? emTexto(Number(existente.entradas)) : "");
  const [saidas, setSaidas] = useState(existente?.saidas != null ? emTexto(Number(existente.saidas)) : "");
  const [saldoInicial, setSaldoInicial] = useState(anterior?.saldo_final != null ? emTexto(Number(anterior.saldo_final)) : "");
  const [saldoExtrato, setSaldoExtrato] = useState(existente?.saldo_final != null ? emTexto(Number(existente.saldo_final)) : "");
  const [operacional, setOperacional] = useState(existente?.receita_operacional != null ? emTexto(Number(existente.receita_operacional)) : "");
  const [observacao, setObservacao] = useState(existente?.observacao ?? "");
  const [salvo, setSalvo] = useState(false);
  const { pending, erro, setErro, executar } = useAcao();

  const soma = (l: Linha[]) => l.reduce((s, x) => s + (numero(x.valor) || 0), 0);
  const totalE = detEntradas ? soma(linhasE) : numero(entradas) || 0;
  const totalS = detSaidas ? soma(linhasS) : numero(saidas) || 0;
  const resultado = totalE - totalS;
  const inicial = valorOuNulo(saldoInicial);
  const calculado = inicial === null ? null : inicial + resultado;
  const extrato = valorOuNulo(saldoExtrato);
  const diferenca = calculado !== null && extrato !== null ? extrato - calculado : null;
  const operacionalSugerido = detEntradas
    ? linhasE.filter((l) => l.natureza !== "outras").reduce((s, x) => s + (numero(x.valor) || 0), 0)
    : null;
  const varEntradas = anterior?.entradas && totalE ? ((totalE - Number(anterior.entradas)) / Number(anterior.entradas)) * 100 : null;
  const varSaidas = anterior?.saidas && totalS ? ((totalS - Number(anterior.saidas)) / Number(anterior.saidas)) * 100 : null;

  // Chips: últimos 12 meses até o atual, mais o que já existe
  const chips = Array.from({ length: 12 }, (_, i) => somarMes(hojeMes, i - 11));

  function salvar(proximo: boolean) {
    if (!totalE && !totalS) return setErro("Informe as entradas ou as saídas do mês.");
    const saldoFinal = extrato ?? calculado;
    const itens = [
      ...(detEntradas ? linhasE.filter((l) => l.item.trim() && numero(l.valor) > 0).map((l) => ({ tipo: "receita" as const, item: l.item.trim(), valor: numero(l.valor), natureza: l.natureza })) : []),
      ...(detSaidas ? linhasS.filter((l) => l.item.trim() && numero(l.valor) > 0).map((l) => ({ tipo: "saida" as const, item: l.item.trim(), valor: numero(l.valor), natureza: l.natureza })) : []),
    ];
    executar(
      () =>
        salvarFechamento({
          organizationId,
          mes,
          entradas: totalE,
          saidas: totalS,
          saldoFinal: saldoFinal === null ? null : Math.round(saldoFinal * 100) / 100,
          receitaOperacional: valorOuNulo(operacional) ?? (operacionalSugerido || null),
          observacao,
          itens: detEntradas || detSaidas || doMes.length ? itens : undefined,
        }),
      () => {
        setSalvo(true);
        if (proximo) onTrocarMes(somarMes(mes, 1));
        else onFechar();
      }
    );
  }

  return (
    <Dialog open onOpenChange={(a) => !a && onFechar()}>
      <DialogContent className="max-w-4xl gap-0 p-0" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader className="border-b border-border py-4 pl-5 pr-12 sm:pl-6">
          <DialogTitle>Fechamento de {nomeMes(mes)}</DialogTitle>
          <DialogDescription>
            {existente ? "Corrigindo um mês já lançado." : "O painel calcula o saldo a partir do mês anterior e confere com o extrato."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 px-5 py-5 sm:px-6">
          {/* Mês */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-cinza-suave">Mês</p>
            <div className="flex flex-wrap gap-1.5">
              {chips.map((m) => {
                const feito = porMes.has(m);
                const atual = m === mes;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => onTrocarMes(m)}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors",
                      atual
                        ? "border-azul-medico bg-azul-medico text-white"
                        : feito
                          ? "border-teal/40 bg-verde-menta text-teal hover:border-teal"
                          : "border-dashed border-border text-cinza-suave hover:border-teal hover:text-teal"
                    )}
                    title={feito ? "Já lançado: clique para corrigir" : "Ainda não lançado"}
                  >
                    {feito && !atual && <Check className="size-3" />}
                    {mesCurtoBr(m)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_17rem]">
            <div className="grid min-w-0 gap-5">
              {/* Entradas */}
              <Bloco
                titulo="Entradas"
                icone={ArrowDownLeft}
                cor="text-[#15803D]"
                detalhado={detEntradas}
                onDetalhar={setDetEntradas}
                rotuloDetalhe="por fonte"
                total={totalE}
              >
                {detEntradas ? (
                  <Linhas
                    linhas={linhasE}
                    onChange={setLinhasE}
                    naturezas={NATUREZAS_RECEITA}
                    sugestoes={conhecidos.filter((c) => c.tipo === "receita").map((c) => c.item)}
                    lista="fontes-receita"
                    placeholder="Ex.: Unimed, Particular"
                  />
                ) : (
                  <CampoReais id="fc-ent" valor={entradas} onChange={setEntradas} placeholder="Total que entrou na conta" />
                )}
              </Bloco>

              {/* Saídas */}
              <Bloco
                titulo="Saídas"
                icone={ArrowUpRight}
                cor="text-[#B91C1C]"
                detalhado={detSaidas}
                onDetalhar={setDetSaidas}
                rotuloDetalhe="por categoria"
                total={totalS}
              >
                {detSaidas ? (
                  <Linhas
                    linhas={linhasS}
                    onChange={setLinhasS}
                    naturezas={NATUREZAS_SAIDA}
                    sugestoes={conhecidos.filter((c) => c.tipo === "saida").map((c) => c.item)}
                    lista="categorias-saida"
                    placeholder="Ex.: Salários, Aluguel"
                  />
                ) : (
                  <CampoReais id="fc-sai" valor={saidas} onChange={setSaidas} placeholder="Total que saiu da conta" />
                )}
              </Bloco>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <label htmlFor="fc-op" className="text-sm font-medium text-cinza-texto">
                    Receita operacional <span className="font-normal text-cinza-suave">(opcional)</span>
                  </label>
                  <CampoReais
                    id="fc-op"
                    valor={operacional}
                    onChange={setOperacional}
                    placeholder={operacionalSugerido ? emTexto(operacionalSugerido) : "Só atendimentos"}
                  />
                  <p className="text-xs text-cinza-suave">
                    {operacionalSugerido ? "Sugerido: entradas de convênio e particular." : "Sem entradas que não são de atendimento."}
                  </p>
                </div>
                <div className="grid gap-1.5">
                  <label htmlFor="fc-obs" className="text-sm font-medium text-cinza-texto">
                    Observação
                  </label>
                  <Input id="fc-obs" value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Ex.: mês com férias coletivas" />
                </div>
              </div>
            </div>

            {/* Resumo e conferência */}
            <aside className="grid min-w-0 content-start gap-4">
              <div className="overflow-hidden rounded-xl border border-border">
                <div className="bg-azul-medico px-4 py-3 text-white">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-white/70">Resultado do mês</p>
                  <p className="mt-1 font-heading text-2xl font-bold tabular-nums">
                    {resultado >= 0 ? "+" : "−"}
                    {reais(Math.abs(resultado), true)}
                  </p>
                </div>
                <dl className="grid gap-2 px-4 py-3 text-sm">
                  <Linha2 rotulo="Entradas" valor={reais(totalE, true)} nota={varEntradas} />
                  <Linha2 rotulo="Saídas" valor={reais(totalS, true)} nota={varSaidas} inverter />
                </dl>
              </div>

              <div className="rounded-xl border border-border p-4">
                <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-azul-medico">
                  <Scale className="size-4 text-teal" /> Saldo
                </p>
                <div className="grid gap-3">
                  <div className="grid gap-1.5">
                    <label htmlFor="fc-ini" className="text-xs text-cinza-suave">
                      No início do mês {anterior?.saldo_final != null && <span className="text-teal">(fechamento anterior)</span>}
                    </label>
                    <CampoReais id="fc-ini" valor={saldoInicial} onChange={setSaldoInicial} />
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-branco-clinico px-3 py-2 text-sm">
                    <span className="text-cinza-suave">Calculado no fim</span>
                    <strong className="tabular-nums text-azul-medico">{calculado === null ? "—" : reais(calculado, true)}</strong>
                  </div>
                  <div className="grid gap-1.5">
                    <label htmlFor="fc-ext" className="text-xs text-cinza-suave">
                      Saldo do extrato no fim do mês (para conferir)
                    </label>
                    <CampoReais id="fc-ext" valor={saldoExtrato} onChange={setSaldoExtrato} />
                  </div>
                  {diferenca !== null &&
                    (Math.abs(diferenca) < 0.01 ? (
                      <p className="flex items-center gap-1.5 rounded-lg bg-[#E9F8EF] px-3 py-2 text-xs font-medium text-[#15803D]">
                        <CheckCircle2 className="size-4 shrink-0" /> Bate com o extrato.
                      </p>
                    ) : (
                      <p className="flex items-start gap-1.5 rounded-lg bg-[#FEF4E2] px-3 py-2 text-xs text-cinza-texto">
                        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-[#B45309]" />
                        <span>
                          Diferença de <strong>{reais(Math.abs(diferenca), true)}</strong> entre o extrato e a conta. Vale conferir tarifas, estornos ou lançamentos de outro mês. Salvamos o saldo do extrato.
                        </span>
                      </p>
                    ))}
                </div>
              </div>
            </aside>
          </div>
        </div>

        <div className="sticky bottom-0 flex flex-col-reverse gap-2 border-t border-border bg-white px-5 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="min-h-5 text-sm">
            {erro ? <Erro texto={erro} /> : salvo ? <span className="text-[#15803D]">Fechamento salvo.</span> : null}
          </div>
          <div className="flex flex-wrap gap-2 sm:justify-end">
            <Button type="button" variant="ghost" onClick={onFechar}>
              Cancelar
            </Button>
            {somarMes(mes, 1) <= hojeMes && (
              <Button type="button" variant="outline" disabled={pending || demo} onClick={() => salvar(true)}>
                Salvar e lançar {mesCurtoBr(somarMes(mes, 1))}
              </Button>
            )}
            <Button type="button" variant="marca" disabled={pending || demo} onClick={() => salvar(false)}>
              {pending && <Girando />} Salvar fechamento
            </Button>
          </div>
        </div>
        {demo && <p className="pb-3 text-center text-xs text-cinza-suave">Modo demonstração: nada é salvo.</p>}
      </DialogContent>
    </Dialog>
  );
}

function Bloco({
  titulo,
  icone: Icone,
  cor,
  detalhado,
  onDetalhar,
  rotuloDetalhe,
  total,
  children,
}: {
  titulo: string;
  icone: typeof ArrowDownLeft;
  cor: string;
  detalhado: boolean;
  onDetalhar: (v: boolean) => void;
  rotuloDetalhe: string;
  total: number;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className={cn("flex items-center gap-1.5 text-sm font-semibold", cor)}>
          <Icone className="size-4" /> {titulo}
          {detalhado && <span className="ml-1 font-heading tabular-nums text-azul-medico">{reais(total, true)}</span>}
        </p>
        <div className="flex rounded-lg bg-branco-clinico p-0.5 text-xs font-medium">
          <button type="button" onClick={() => onDetalhar(false)} className={cn("rounded-md px-2.5 py-1", !detalhado ? "bg-white text-azul-medico shadow-sm" : "text-cinza-suave")}>
            Total
          </button>
          <button type="button" onClick={() => onDetalhar(true)} className={cn("rounded-md px-2.5 py-1", detalhado ? "bg-white text-azul-medico shadow-sm" : "text-cinza-suave")}>
            Detalhar {rotuloDetalhe}
          </button>
        </div>
      </div>
      {children}
    </section>
  );
}

function Linhas({
  linhas,
  onChange,
  naturezas,
  sugestoes,
  lista,
  placeholder,
}: {
  linhas: Linha[];
  onChange: (l: Linha[]) => void;
  naturezas: NaturezaComposicao[];
  sugestoes: string[];
  lista: string;
  placeholder: string;
}) {
  const set = (id: number, campo: keyof Linha, v: string) => onChange(linhas.map((l) => (l.id === id ? { ...l, [campo]: v } : l)));
  return (
    <div className="grid gap-2">
      <datalist id={lista}>
        {sugestoes.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      {linhas.map((l) => (
        <div
          key={l.id}
          className="grid grid-cols-[minmax(0,1fr)_2rem] items-center gap-2 border-b border-border pb-2 last-of-type:border-0 sm:grid-cols-[minmax(0,1fr)_8.5rem_8rem_2rem] sm:border-0 sm:pb-0"
        >
          <Input list={lista} value={l.item} onChange={(e) => set(l.id, "item", e.target.value)} placeholder={placeholder} className="h-10" aria-label="Fonte ou categoria" />
          <select
            value={l.natureza}
            onChange={(e) => set(l.id, "natureza", e.target.value)}
            className="hidden h-10 rounded-md border border-input bg-white px-2 text-xs text-cinza-texto sm:block"
            aria-label="Natureza"
          >
            {naturezas.map((n) => (
              <option key={n} value={n}>
                {ROTULO_NATUREZA[n]}
              </option>
            ))}
          </select>
          {/* No celular o valor desce para a linha de baixo, depois do X */}
          <div className="order-last sm:order-none">
            <CampoReais id={`l-${l.id}`} valor={l.valor} onChange={(v) => set(l.id, "valor", v)} />
          </div>
          <button type="button" onClick={() => onChange(linhas.filter((x) => x.id !== l.id))} className="grid size-8 place-items-center rounded-lg text-cinza-suave hover:bg-[#FDECEC] hover:text-[#B91C1C]" aria-label="Tirar linha">
            <X className="size-4" />
          </button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...linhas, nova("", naturezas[0])])} className="inline-flex w-fit items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-teal hover:bg-verde-menta">
        <ListPlus className="size-4" /> Adicionar linha
      </button>
    </div>
  );
}

function Linha2({ rotulo, valor, nota, inverter }: { rotulo: string; valor: string; nota: number | null; inverter?: boolean }) {
  const bom = nota === null ? null : inverter ? nota <= 0 : nota >= 0;
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-cinza-suave">{rotulo}</dt>
      <dd className="text-right">
        <span className="font-semibold tabular-nums text-cinza-texto">{valor}</span>
        {nota !== null && (
          <span className={cn("block text-[11px] font-semibold", bom ? "text-[#15803D]" : "text-[#B91C1C]")}>
            {nota >= 0 ? "▲" : "▼"} {Math.abs(nota).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% vs mês anterior
          </span>
        )}
      </dd>
    </div>
  );
}
