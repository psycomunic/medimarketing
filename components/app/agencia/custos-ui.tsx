"use client";

import { useState } from "react";
import { Copy, Pencil, Plus, Trash2 } from "lucide-react";
import type { CustoAgencia } from "@/lib/supabase/types";
import { excluirCusto, repetirCustosRecorrentes, salvarCusto } from "@/lib/actions/agencia";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { reais } from "@/components/graficos/formato";
import { Campo, CampoReais, Erro, Girando, emTexto, numero, useAcao } from "@/components/app/financeiro/form-comum";
import type { Cliente } from "./contratos-ui";
import { useAcaoFlutuante } from "@/components/app/botao-flutuante";
import { CATEGORIAS_CUSTO, rotuloCusto } from "@/lib/financeiro/agencia";

export function ListaCustos({ custos, clientes, mes, demo }: { custos: CustoAgencia[]; clientes: Cliente[]; mes: string; demo: boolean }) {
  const [editar, setEditar] = useState<CustoAgencia | null>(null);
  const [novo, setNovo] = useState(false);
  const { pending, erro, executar } = useAcao();
  useAcaoFlutuante("fab:novo-custo", () => setNovo(true));
  const nome = (id: string | null) => (id ? clientes.find((c) => c.id === id)?.nome ?? "Clínica" : null);
  const lista = [...custos].sort((a, b) => Number(b.valor) - Number(a.valor));

  return (
    <div className="min-w-0 rounded-xl border border-border bg-white shadow-soft">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <h2 className="font-heading text-base font-semibold text-azul-medico">Custos do mês</h2>
          <p className="mt-0.5 text-sm text-cinza-suave">Ligue um custo a uma clínica para ele entrar na margem dela; os gerais são rateados.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" disabled={pending || demo} onClick={() => executar(() => repetirCustosRecorrentes(mes))}>
            {pending ? <Girando /> : <Copy />} Copiar recorrentes
          </Button>
          <Button type="button" variant="marca" size="sm" onClick={() => setNovo(true)}>
            <Plus /> Novo custo
          </Button>
        </div>
      </header>
      {erro && (
        <div className="px-5 pt-3">
          <Erro texto={erro} />
        </div>
      )}
      {lista.length === 0 ? (
        <p className="px-6 py-12 text-center text-sm text-cinza-suave">Nenhum custo lançado neste mês. Use “Copiar recorrentes” para trazer os do mês anterior.</p>
      ) : (
        <ul className="divide-y divide-border">
          {lista.map((c) => (
            <li key={c.id} className="flex items-center gap-3 px-5 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-cinza-texto">{c.descricao}</p>
                <p className="truncate text-xs text-cinza-suave">
                  {rotuloCusto(c.categoria)}
                  {nome(c.organization_id) ? ` · ${nome(c.organization_id)}` : " · geral"}
                  {c.recorrente ? " · recorrente" : ""}
                </p>
              </div>
              <p className="w-24 shrink-0 text-right text-sm font-semibold tabular-nums text-azul-medico">{reais(Number(c.valor))}</p>
              <div className="flex shrink-0 gap-1">
                <button type="button" onClick={() => setEditar(c)} className="grid size-8 place-items-center rounded-lg text-cinza-suave hover:bg-branco-clinico" aria-label="Editar">
                  <Pencil className="size-4" />
                </button>
                <button
                  type="button"
                  disabled={demo}
                  onClick={() => confirm("Excluir este custo?") && executar(() => excluirCusto(c.id))}
                  className="grid size-8 place-items-center rounded-lg text-cinza-suave hover:bg-[#FDECEC] hover:text-[#B91C1C]"
                  aria-label="Excluir"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center justify-between border-t border-border bg-branco-clinico px-5 py-3 text-sm">
        <span className="text-cinza-suave">{lista.length} custos</span>
        <span className="font-semibold tabular-nums text-azul-medico">{reais(lista.reduce((s, c) => s + Number(c.valor), 0))}</span>
      </div>
      {(novo || editar) && <CustoDialog key={editar?.id ?? "novo"} custo={editar} clientes={clientes} mes={mes} demo={demo} onFechar={() => { setNovo(false); setEditar(null); }} />}
    </div>
  );
}

function CustoDialog({ custo, clientes, mes, demo, onFechar }: { custo: CustoAgencia | null; clientes: Cliente[]; mes: string; demo: boolean; onFechar: () => void }) {
  const [v, setV] = useState({
    descricao: custo?.descricao ?? "",
    categoria: custo?.categoria ?? "ferramentas",
    valor: emTexto(custo ? Number(custo.valor) : null),
    competencia: custo?.competencia.slice(0, 7) ?? mes,
    recorrente: custo?.recorrente ?? true,
    org: custo?.organization_id ?? "",
  });
  const { pending, erro, executar } = useAcao();
  return (
    <Dialog open onOpenChange={(a) => !a && onFechar()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{custo ? "Editar custo" : "Novo custo"}</DialogTitle>
          <DialogDescription>Ferramentas, equipe, mídia própria e impostos da agência.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Campo id="cu-desc" rotulo="Descrição">
            <Input id="cu-desc" value={v.descricao} onChange={(e) => setV({ ...v, descricao: e.target.value })} placeholder="Ex.: Supabase" autoFocus />
          </Campo>
          <div className="grid grid-cols-2 gap-4">
            <Campo id="cu-cat" rotulo="Categoria">
              <Select id="cu-cat" value={v.categoria} onChange={(e) => setV({ ...v, categoria: e.target.value as CustoAgencia["categoria"] })}>
                {CATEGORIAS_CUSTO.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.rotulo}
                  </option>
                ))}
              </Select>
            </Campo>
            <Campo id="cu-valor" rotulo="Valor">
              <CampoReais id="cu-valor" valor={v.valor} onChange={(x) => setV({ ...v, valor: x })} />
            </Campo>
            <Campo id="cu-mes" rotulo="Mês">
              <Input id="cu-mes" type="month" value={v.competencia} onChange={(e) => setV({ ...v, competencia: e.target.value })} />
            </Campo>
            <Campo id="cu-org" rotulo="Clínica (opcional)">
              <Select id="cu-org" value={v.org} onChange={(e) => setV({ ...v, org: e.target.value })}>
                <option value="">Geral (rateado)</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </Select>
            </Campo>
          </div>
          <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-border px-3 py-2.5 text-sm">
            <input type="checkbox" className="size-4 accent-teal" checked={v.recorrente} onChange={(e) => setV({ ...v, recorrente: e.target.checked })} />
            Repete todo mês
          </label>
          <Erro texto={erro} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onFechar}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="marca"
              disabled={pending || demo || !v.descricao.trim()}
              onClick={() =>
                executar(
                  () =>
                    salvarCusto({
                      id: custo?.id,
                      descricao: v.descricao,
                      categoria: v.categoria,
                      valor: numero(v.valor),
                      competencia: v.competencia,
                      recorrente: v.recorrente,
                      organizationId: v.org,
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
