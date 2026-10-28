"use client";

import { useState } from "react";
import { CheckCircle2, Pencil, Plus, Trash2 } from "lucide-react";
import type { ConfigFinanceira, FormaPagamento, PrecoProcedimento } from "@/lib/supabase/types";
import { excluirPreco, salvarConfigFinanceira, salvarPreco } from "@/lib/actions/financeiro";
import { TAXAS_PADRAO } from "@/lib/financeiro/calculos";
import { rotuloFormaPagamento } from "@/lib/rotulos";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { reais } from "@/components/graficos/formato";
import { Campo, CampoReais, Erro, Girando, emTexto, numero, useAcao } from "./form-comum";

const FORMAS = Object.keys(rotuloFormaPagamento) as FormaPagamento[];

function CampoPct({ id, valor, onChange }: { id: string; valor: string; onChange: (v: string) => void }) {
  return (
    <div className="relative">
      <Input id={id} inputMode="decimal" value={valor} onChange={(e) => onChange(e.target.value.replace(/[^\d.,]/g, ""))} className="pr-9 tabular-nums" />
      <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-cinza-suave">%</span>
    </div>
  );
}

const pctTexto = (v: number) => String(v).replace(".", ",");
const pctNum = (v: string) => Number(v.replace(",", ".")) || 0;

export function FormConfig({ config, demo }: { config: ConfigFinanceira; demo: boolean }) {
  const [taxas, setTaxas] = useState<Record<string, string>>(
    Object.fromEntries(FORMAS.map((f) => [f, pctTexto(config.taxas?.[f] ?? TAXAS_PADRAO[f])]))
  );
  const [imposto, setImposto] = useState(pctTexto(Number(config.imposto)));
  const [reserva, setReserva] = useState(pctTexto(Number(config.reserva_glosa)));
  const [saldo, setSaldo] = useState(emTexto(Number(config.saldo_inicial)));
  const [meta, setMeta] = useState(emTexto(config.meta_lucro ? Number(config.meta_lucro) : null));
  const [salvo, setSalvo] = useState(false);
  const { pending, erro, executar } = useAcao();

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="rounded-xl border border-border bg-white p-5 shadow-soft">
        <h2 className="font-heading text-base font-semibold text-azul-medico">Taxas por forma de pagamento</h2>
        <p className="mt-0.5 text-sm text-cinza-suave">O que a maquininha ou o banco cobra. Entra sozinho em cada recebimento.</p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {FORMAS.map((f) => (
            <Campo key={f} id={`tx-${f}`} rotulo={rotuloFormaPagamento[f]}>
              <CampoPct id={`tx-${f}`} valor={taxas[f]} onChange={(v) => setTaxas({ ...taxas, [f]: v })} />
            </Campo>
          ))}
        </div>
      </section>
      <section className="rounded-xl border border-border bg-white p-5 shadow-soft">
        <h2 className="font-heading text-base font-semibold text-azul-medico">Caixa, impostos e metas</h2>
        <p className="mt-0.5 text-sm text-cinza-suave">Base do fluxo de caixa e do resultado do mês.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Campo id="cf-saldo" rotulo="Saldo em caixa hoje" dica="Bancos + dinheiro. Atualize de vez em quando.">
            <CampoReais id="cf-saldo" valor={saldo} onChange={setSaldo} />
          </Campo>
          <Campo id="cf-meta" rotulo="Meta de lucro mensal">
            <CampoReais id="cf-meta" valor={meta} onChange={setMeta} />
          </Campo>
          <Campo id="cf-imp" rotulo="Imposto sobre a receita" dica="Simples Nacional costuma ficar entre 6% e 15%.">
            <CampoPct id="cf-imp" valor={imposto} onChange={setImposto} />
          </Campo>
          <Campo id="cf-res" rotulo="Reserva para glosas" dica="Do faturamento de convênio. 5% a 10% é o usual.">
            <CampoPct id="cf-res" valor={reserva} onChange={setReserva} />
          </Campo>
        </div>
      </section>
      <div className="flex flex-wrap items-center justify-end gap-3 lg:col-span-2">
        <Erro texto={erro} />
        {salvo && !erro && (
          <span className="flex items-center gap-1.5 text-sm text-[#15803D]">
            <CheckCircle2 className="size-4" /> Configuração salva
          </span>
        )}
        <Button
          type="button"
          variant="marca"
          disabled={pending || demo}
          onClick={() => {
            setSalvo(false);
            executar(
              () =>
                salvarConfigFinanceira({
                  taxas: Object.fromEntries(FORMAS.map((f) => [f, pctNum(taxas[f])])),
                  imposto: pctNum(imposto),
                  reservaGlosa: pctNum(reserva),
                  saldoInicial: numero(saldo) || 0,
                  metaLucro: numero(meta) || null,
                }),
              () => setSalvo(true)
            );
          }}
        >
          {pending && <Girando />} Salvar configuração
        </Button>
      </div>
    </div>
  );
}

export function TabelaPrecos({ precos, demo }: { precos: PrecoProcedimento[]; demo: boolean }) {
  const [editar, setEditar] = useState<PrecoProcedimento | null>(null);
  const [novo, setNovo] = useState(false);
  const { erro, executar } = useAcao();
  const grupos = new Map<string, PrecoProcedimento[]>();
  for (const p of precos) grupos.set(p.procedimento, [...(grupos.get(p.procedimento) ?? []), p]);

  return (
    <section className="min-w-0 rounded-xl border border-border bg-white shadow-soft">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <h2 className="font-heading text-base font-semibold text-azul-medico">Tabela de preços</h2>
          <p className="mt-0.5 text-sm text-cinza-suave">Valor particular e por convênio de cada procedimento, com o custo direto para calcular a margem.</p>
        </div>
        <Button type="button" variant="marca" size="sm" onClick={() => setNovo(true)}>
          <Plus /> Novo preço
        </Button>
      </header>
      {erro && (
        <div className="px-5 pt-3">
          <Erro texto={erro} />
        </div>
      )}
      {precos.length === 0 ? (
        <p className="px-6 py-12 text-center text-sm text-cinza-suave">Nenhum preço cadastrado ainda.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-cinza-suave">
                <th className="px-5 py-2.5 font-semibold">Procedimento</th>
                <th className="px-2 py-2.5 font-semibold">Tabela</th>
                <th className="px-2 py-2.5 text-right font-semibold">Valor</th>
                <th className="px-2 py-2.5 text-right font-semibold">Custo</th>
                <th className="px-2 py-2.5 text-right font-semibold">Margem</th>
                <th className="w-20 px-5 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {[...grupos.entries()].map(([proc, lista]) =>
                lista
                  .sort((a, b) => (a.convenio ?? "").localeCompare(b.convenio ?? ""))
                  .map((p, i) => {
                    const margem = Number(p.valor) ? ((Number(p.valor) - Number(p.custo)) / Number(p.valor)) * 100 : 0;
                    return (
                      <tr key={p.id}>
                        <td className="px-5 py-2.5">
                          {i === 0 ? (
                            <>
                              <span className="font-medium text-cinza-texto">{proc}</span>
                              {p.categoria && <span className="block text-xs text-cinza-suave">{p.categoria}</span>}
                            </>
                          ) : null}
                        </td>
                        <td className="px-2 py-2.5 text-cinza-texto">{p.convenio ?? "Particular"}</td>
                        <td className="px-2 py-2.5 text-right font-semibold tabular-nums text-azul-medico">{reais(Number(p.valor), true)}</td>
                        <td className="px-2 py-2.5 text-right tabular-nums text-cinza-suave">{Number(p.custo) ? reais(Number(p.custo), true) : "—"}</td>
                        <td className="px-2 py-2.5 text-right tabular-nums text-cinza-suave">{Number(p.valor) ? `${Math.round(margem)}%` : "—"}</td>
                        <td className="px-5 py-2.5">
                          <div className="flex justify-end gap-1">
                            <button type="button" onClick={() => setEditar(p)} className="grid size-8 place-items-center rounded-lg text-cinza-suave hover:bg-branco-clinico hover:text-azul-medico" aria-label="Editar">
                              <Pencil className="size-4" />
                            </button>
                            <button
                              type="button"
                              disabled={demo}
                              onClick={() => confirm("Excluir este preço?") && executar(() => excluirPreco(p.id))}
                              className="grid size-8 place-items-center rounded-lg text-cinza-suave hover:bg-[#FDECEC] hover:text-[#B91C1C]"
                              aria-label="Excluir"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
              )}
            </tbody>
          </table>
        </div>
      )}
      {(novo || editar) && <PrecoDialog key={editar?.id ?? "novo"} preco={editar} demo={demo} onFechar={() => { setNovo(false); setEditar(null); }} />}
    </section>
  );
}

function PrecoDialog({ preco, demo, onFechar }: { preco: PrecoProcedimento | null; demo: boolean; onFechar: () => void }) {
  const [v, setV] = useState({
    procedimento: preco?.procedimento ?? "",
    categoria: preco?.categoria ?? "",
    convenio: preco?.convenio ?? "",
    valor: emTexto(preco ? Number(preco.valor) : null),
    custo: emTexto(preco ? Number(preco.custo) : null),
    duracao: preco?.duracao_min ? String(preco.duracao_min) : "",
  });
  const { pending, erro, executar } = useAcao();
  const set = <K extends keyof typeof v>(k: K, x: string) => setV({ ...v, [k]: x });
  return (
    <Dialog open onOpenChange={(a) => !a && onFechar()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{preco ? "Editar preço" : "Novo preço"}</DialogTitle>
          <DialogDescription>Deixe o convênio em branco para o valor particular.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo id="p-proc" rotulo="Procedimento">
              <Input id="p-proc" value={v.procedimento} onChange={(e) => set("procedimento", e.target.value)} autoFocus />
            </Campo>
            <Campo id="p-cat" rotulo="Categoria">
              <Input id="p-cat" value={v.categoria} onChange={(e) => set("categoria", e.target.value)} placeholder="Ex.: Consultas" />
            </Campo>
            <Campo id="p-conv" rotulo="Convênio">
              <Input id="p-conv" value={v.convenio} onChange={(e) => set("convenio", e.target.value)} placeholder="Particular" />
            </Campo>
            <Campo id="p-dur" rotulo="Duração (min)">
              <Input id="p-dur" inputMode="numeric" value={v.duracao} onChange={(e) => set("duracao", e.target.value.replace(/\D/g, ""))} />
            </Campo>
            <Campo id="p-valor" rotulo="Valor">
              <CampoReais id="p-valor" valor={v.valor} onChange={(x) => set("valor", x)} />
            </Campo>
            <Campo id="p-custo" rotulo="Custo direto">
              <CampoReais id="p-custo" valor={v.custo} onChange={(x) => set("custo", x)} />
            </Campo>
          </div>
          <Erro texto={erro} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onFechar}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="marca"
              disabled={pending || demo || !v.procedimento.trim()}
              onClick={() =>
                executar(
                  () =>
                    salvarPreco({
                      id: preco?.id,
                      procedimento: v.procedimento,
                      categoria: v.categoria,
                      convenio: v.convenio,
                      valor: numero(v.valor) || 0,
                      custo: numero(v.custo) || 0,
                      duracao: v.duracao ? Number(v.duracao) : undefined,
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
