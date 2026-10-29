"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import type { FechamentoFinanceiro } from "@/lib/supabase/types";
import { excluirFechamento, salvarFechamento } from "@/lib/actions/financeiro";
import { mesLongo } from "@/lib/financeiro/calculos";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { reais } from "@/components/graficos/formato";
import { Campo, CampoReais, Erro, Girando, emTexto, numero, useAcao } from "./form-comum";

const txt = (v: number | null) => (v === null ? "" : emTexto(Number(v)) || "0,00");
const valorOuNulo = (v: string) => (v.trim() ? numero(v) : null);

/** Tabela mês a mês, com lançar e corrigir fechamentos. */
export function TabelaFechamentos({
  fechamentos,
  organizationId,
  podeEditar,
  demo,
}: {
  fechamentos: FechamentoFinanceiro[];
  organizationId?: string;
  podeEditar: boolean;
  demo: boolean;
}) {
  const [editar, setEditar] = useState<FechamentoFinanceiro | null>(null);
  const [novo, setNovo] = useState(false);
  const { erro, executar } = useAcao();
  const lista = [...fechamentos].sort((a, b) => b.mes.localeCompare(a.mes));

  return (
    <section className="min-w-0 rounded-xl border border-border bg-white shadow-soft">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <h2 className="font-heading text-base font-semibold text-azul-medico">Fechamentos mês a mês</h2>
          <p className="mt-0.5 text-sm text-cinza-suave">Entradas, saídas e saldo no fim de cada mês, como vieram do extrato ou do sistema anterior.</p>
        </div>
        {podeEditar && (
          <Button type="button" variant="marca" size="sm" onClick={() => setNovo(true)}>
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
                    {mesLongo(f.mes.slice(0, 7)).replace(/^./, (c) => c.toUpperCase())}
                    {f.observacao && <span className="block text-xs font-normal normal-case text-cinza-suave">{f.observacao}</span>}
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
                        <button type="button" onClick={() => setEditar(f)} className="grid size-8 place-items-center rounded-lg text-cinza-suave hover:bg-branco-clinico hover:text-azul-medico" aria-label="Editar">
                          <Pencil className="size-4" />
                        </button>
                        <button
                          type="button"
                          disabled={demo}
                          onClick={() => confirm("Excluir este fechamento?") && executar(() => excluirFechamento(f.id))}
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
      {(novo || editar) && (
        <FechamentoDialog key={editar?.id ?? "novo"} fechamento={editar} organizationId={organizationId} demo={demo} onFechar={() => { setNovo(false); setEditar(null); }} />
      )}
    </section>
  );
}

function FechamentoDialog({
  fechamento,
  organizationId,
  demo,
  onFechar,
}: {
  fechamento: FechamentoFinanceiro | null;
  organizationId?: string;
  demo: boolean;
  onFechar: () => void;
}) {
  const [v, setV] = useState({
    mes: fechamento?.mes.slice(0, 7) ?? new Date().toISOString().slice(0, 7),
    entradas: fechamento ? txt(fechamento.entradas) : "",
    saidas: fechamento ? txt(fechamento.saidas) : "",
    saldo: fechamento ? txt(fechamento.saldo_final) : "",
    operacional: fechamento ? txt(fechamento.receita_operacional) : "",
    observacao: fechamento?.observacao ?? "",
  });
  const { pending, erro, executar } = useAcao();
  const set = <K extends keyof typeof v>(k: K, x: string) => setV({ ...v, [k]: x });
  return (
    <Dialog open onOpenChange={(a) => !a && onFechar()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{fechamento ? "Corrigir fechamento" : "Lançar fechamento do mês"}</DialogTitle>
          <DialogDescription>Os valores do extrato: o que entrou, o que saiu e o saldo no último dia do mês.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Campo id="fc-mes" rotulo="Mês">
            <Input id="fc-mes" type="month" value={v.mes} onChange={(e) => set("mes", e.target.value)} disabled={!!fechamento} />
          </Campo>
          <div className="grid grid-cols-2 gap-4">
            <Campo id="fc-ent" rotulo="Entradas">
              <CampoReais id="fc-ent" valor={v.entradas} onChange={(x) => set("entradas", x)} />
            </Campo>
            <Campo id="fc-sai" rotulo="Saídas">
              <CampoReais id="fc-sai" valor={v.saidas} onChange={(x) => set("saidas", x)} />
            </Campo>
            <Campo id="fc-sal" rotulo="Saldo no fim do mês">
              <CampoReais id="fc-sal" valor={v.saldo} onChange={(x) => set("saldo", x)} />
            </Campo>
            <Campo id="fc-op" rotulo="Receita operacional" dica="Só atendimentos (opcional).">
              <CampoReais id="fc-op" valor={v.operacional} onChange={(x) => set("operacional", x)} />
            </Campo>
          </div>
          <Campo id="fc-obs" rotulo="Observação">
            <Input id="fc-obs" value={v.observacao} onChange={(e) => set("observacao", e.target.value)} />
          </Campo>
          <Erro texto={erro} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onFechar}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="marca"
              disabled={pending || demo}
              onClick={() =>
                executar(
                  () =>
                    salvarFechamento({
                      organizationId,
                      mes: v.mes,
                      entradas: valorOuNulo(v.entradas),
                      saidas: valorOuNulo(v.saidas),
                      saldoFinal: valorOuNulo(v.saldo),
                      receitaOperacional: valorOuNulo(v.operacional),
                      observacao: v.observacao,
                    }),
                  onFechar
                )
              }
            >
              {pending && <Girando />} Salvar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
