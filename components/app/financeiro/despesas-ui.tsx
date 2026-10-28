"use client";

import { useMemo, useState } from "react";
import { Check, MoreHorizontal, Pencil, Plus, Repeat, RotateCcw, Search, Trash2 } from "lucide-react";
import type { Despesa } from "@/lib/supabase/types";
import { CATEGORIAS_DESPESA, rotuloCategoria } from "@/lib/financeiro/calculos";
import { excluirDespesa, pagarDespesa, reabrirDespesa, salvarDespesa } from "@/lib/actions/financeiro";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { reais } from "@/components/graficos/formato";
import { Campo, CampoReais, Erro, Girando, emTexto, hojeLocal, numero, useAcao } from "./form-comum";
import { Situacao } from "./ui";
import { cn } from "@/lib/utils";

const dataBr = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR");

/* ------------------------------ Formulário ------------------------------ */

export function DespesaDialog({
  aberto,
  onFechar,
  despesa,
  demo,
}: {
  aberto: boolean;
  onFechar: () => void;
  despesa?: Despesa | null;
  demo: boolean;
}) {
  const editando = !!despesa;
  const [v, setV] = useState(() => ({
    descricao: despesa?.descricao ?? "",
    categoria: despesa?.categoria ?? "aluguel",
    fornecedor: despesa?.fornecedor ?? "",
    valor: emTexto(despesa ? Number(despesa.valor) : null),
    vencimento: despesa?.vencimento ?? hojeLocal(),
    paga: despesa?.status === "paga",
    fixa: despesa?.fixa ?? true,
    modo: "unica" as "unica" | "recorrente" | "parcelada",
    parcelas: "2",
    observacao: despesa?.observacao ?? "",
  }));
  const { pending, erro, setErro, executar } = useAcao();
  const set = <K extends keyof typeof v>(k: K, valor: (typeof v)[K]) => setV({ ...v, [k]: valor });

  function salvar() {
    const valor = numero(v.valor);
    if (!(valor > 0)) return setErro("Informe o valor.");
    executar(
      () =>
        salvarDespesa({
          id: despesa?.id,
          descricao: v.descricao,
          categoria: v.categoria,
          fornecedor: v.fornecedor,
          valor,
          vencimento: v.vencimento,
          paga: v.paga,
          fixa: v.fixa,
          recorrente: !editando && v.modo === "recorrente",
          parcelas: !editando && v.modo === "parcelada" ? Number(v.parcelas) : 1,
          observacao: v.observacao,
        }),
      onFechar
    );
  }

  return (
    <Dialog open={aberto} onOpenChange={(a) => !a && onFechar()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{editando ? "Editar despesa" : "Nova despesa"}</DialogTitle>
          <DialogDescription>Contas da clínica: aluguel, equipe, insumos, impostos e o que mais sair do caixa.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Campo id="d-desc" rotulo="Descrição">
            <Input id="d-desc" value={v.descricao} onChange={(e) => set("descricao", e.target.value)} placeholder="Ex.: Aluguel da sala" autoFocus />
          </Campo>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo id="d-cat" rotulo="Categoria">
              <Select
                id="d-cat"
                value={v.categoria}
                onChange={(e) => {
                  const c = CATEGORIAS_DESPESA.find((x) => x.id === e.target.value);
                  setV({ ...v, categoria: e.target.value as Despesa["categoria"], fixa: c?.fixaPadrao ?? v.fixa });
                }}
              >
                {CATEGORIAS_DESPESA.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.rotulo}
                  </option>
                ))}
              </Select>
            </Campo>
            <Campo id="d-forn" rotulo="Fornecedor (opcional)">
              <Input id="d-forn" value={v.fornecedor} onChange={(e) => set("fornecedor", e.target.value)} placeholder="Ex.: Imobiliária" />
            </Campo>
            <Campo id="d-valor" rotulo={!editando && v.modo === "parcelada" ? "Valor total" : "Valor"}>
              <CampoReais id="d-valor" valor={v.valor} onChange={(x) => set("valor", x)} />
            </Campo>
            <Campo id="d-venc" rotulo={!editando && v.modo !== "unica" ? "Primeiro vencimento" : "Vencimento"}>
              <Input id="d-venc" type="date" value={v.vencimento} onChange={(e) => set("vencimento", e.target.value)} />
            </Campo>
          </div>

          {!editando && (
            <div className="grid gap-2">
              <span className="text-sm font-medium text-cinza-texto">Repetição</span>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    ["unica", "Só esta"],
                    ["recorrente", "Todo mês"],
                    ["parcelada", "Parcelada"],
                  ] as const
                ).map(([id, r]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => set("modo", id)}
                    className={cn(
                      "rounded-lg border px-2 py-2.5 text-sm font-medium transition-colors",
                      v.modo === id ? "border-teal bg-verde-menta text-azul-medico ring-1 ring-teal" : "border-border text-cinza-suave hover:text-azul-medico"
                    )}
                  >
                    {r}
                  </button>
                ))}
              </div>
              {v.modo === "recorrente" && (
                <p className="text-xs text-cinza-suave">Cria as contas dos próximos 12 meses, no mesmo dia.</p>
              )}
              {v.modo === "parcelada" && (
                <div className="flex items-center gap-2 text-sm text-cinza-suave">
                  Em
                  <Select value={v.parcelas} onChange={(e) => set("parcelas", e.target.value)} className="h-9 w-20 pr-8">
                    {Array.from({ length: 23 }, (_, i) => i + 2).map((n) => (
                      <option key={n} value={n}>
                        {n}x
                      </option>
                    ))}
                  </Select>
                  {numero(v.valor) > 0 && <span>de {reais(numero(v.valor) / Number(v.parcelas), true)}</span>}
                </div>
              )}
            </div>
          )}

          <div className="grid gap-2 sm:grid-cols-2">
            <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border px-3 py-2.5 text-sm">
              <input type="checkbox" className="mt-0.5 size-4 accent-teal" checked={v.fixa} onChange={(e) => set("fixa", e.target.checked)} />
              <span>
                <span className="font-medium text-cinza-texto">Despesa fixa</span>
                <span className="block text-xs text-cinza-suave">Existe todo mês, com ou sem paciente.</span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border px-3 py-2.5 text-sm">
              <input type="checkbox" className="mt-0.5 size-4 accent-teal" checked={v.paga} onChange={(e) => set("paga", e.target.checked)} />
              <span>
                <span className="font-medium text-cinza-texto">Já está paga</span>
                <span className="block text-xs text-cinza-suave">Sai do contas a pagar.</span>
              </span>
            </label>
          </div>

          <Campo id="d-obs" rotulo="Observação (opcional)">
            <Textarea id="d-obs" value={v.observacao} onChange={(e) => set("observacao", e.target.value)} className="min-h-[60px]" />
          </Campo>

          <Erro texto={erro} />
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" onClick={onFechar}>
              Cancelar
            </Button>
            <Button type="button" variant="marca" onClick={salvar} disabled={pending || demo || !v.descricao.trim()}>
              {pending && <Girando />} {editando ? "Salvar" : "Adicionar despesa"}
            </Button>
          </div>
          {demo && <p className="text-center text-xs text-cinza-suave">Modo demonstração: nada é salvo.</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------- Lista -------------------------------- */

type Filtro = "todas" | "abertas" | "vencidas" | "pagas";

export function ListaDespesas({ despesas, demo }: { despesas: Despesa[]; demo: boolean }) {
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState("");
  const [editar, setEditar] = useState<Despesa | null>(null);
  const [nova, setNova] = useState(false);
  const [menu, setMenu] = useState<string | null>(null);
  const { pending, erro, executar } = useAcao();
  const hoje = hojeLocal();

  const lista = useMemo(
    () =>
      despesas
        .filter((d) => d.status !== "cancelada")
        .filter((d) =>
          filtro === "abertas"
            ? d.status === "aberta"
            : filtro === "vencidas"
              ? d.status === "aberta" && d.vencimento < hoje
              : filtro === "pagas"
                ? d.status === "paga"
                : true
        )
        .filter((d) => !categoria || d.categoria === categoria)
        .filter((d) => {
          const t = busca.trim().toLowerCase();
          return !t || d.descricao.toLowerCase().includes(t) || (d.fornecedor ?? "").toLowerCase().includes(t);
        })
        .sort((a, b) => a.vencimento.localeCompare(b.vencimento)),
    [despesas, filtro, busca, categoria, hoje]
  );

  const contagem = (f: Filtro) =>
    despesas.filter((d) =>
      d.status === "cancelada"
        ? false
        : f === "abertas"
          ? d.status === "aberta"
          : f === "vencidas"
            ? d.status === "aberta" && d.vencimento < hoje
            : f === "pagas"
              ? d.status === "paga"
              : true
    ).length;

  const total = lista.reduce((s, d) => s + Number(d.valor), 0);

  return (
    <div className="min-w-0 rounded-xl border border-border bg-white shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["todas", "Todas"],
              ["abertas", "A pagar"],
              ["vencidas", "Vencidas"],
              ["pagas", "Pagas"],
            ] as const
          ).map(([id, r]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFiltro(id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                filtro === id ? "bg-azul-medico text-white" : "bg-branco-clinico text-cinza-suave hover:text-azul-medico"
              )}
            >
              {r}
              <span className={cn("rounded-full px-1.5 tabular-nums", filtro === id ? "bg-white/20" : "bg-white")}>{contagem(id)}</span>
            </button>
          ))}
        </div>
        <Button type="button" variant="marca" size="sm" onClick={() => setNova(true)}>
          <Plus /> Nova despesa
        </Button>
      </div>

      <div className="flex flex-col gap-2 border-b border-border px-4 py-3 sm:flex-row sm:px-5">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-cinza-suave" />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar descrição ou fornecedor" className="h-10 pl-9" />
        </div>
        <div className="sm:w-56">
          <Select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="h-10" aria-label="Categoria">
            <option value="">Todas as categorias</option>
            {CATEGORIAS_DESPESA.map((c) => (
              <option key={c.id} value={c.id}>
                {c.rotulo}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {erro && (
        <div className="px-5 pt-3">
          <Erro texto={erro} />
        </div>
      )}

      {lista.length === 0 ? (
        <p className="px-6 py-12 text-center text-sm text-cinza-suave">Nenhuma despesa com esses filtros neste mês.</p>
      ) : (
        <ul className="divide-y divide-border">
          {lista.map((d) => {
            const vencida = d.status === "aberta" && d.vencimento < hoje;
            const venceHoje = d.status === "aberta" && d.vencimento === hoje;
            return (
              <li key={d.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                <div className="hidden w-14 shrink-0 text-center sm:block">
                  <p className="font-heading text-lg font-bold leading-none text-azul-medico">{d.vencimento.slice(8, 10)}</p>
                  <p className="mt-0.5 text-[10px] uppercase tracking-wide text-cinza-suave">
                    {new Date(`${d.vencimento}T12:00:00`).toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}
                  </p>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate text-sm font-medium text-cinza-texto">
                    <span className="truncate">{d.descricao}</span>
                    {d.recorrente && <Repeat className="size-3.5 shrink-0 text-cinza-suave" aria-label="Recorrente" />}
                    {d.parcela && (
                      <span className="shrink-0 text-xs text-cinza-suave">
                        {d.parcela}/{d.parcelas}
                      </span>
                    )}
                  </p>
                  <p className="truncate text-xs text-cinza-suave">
                    {rotuloCategoria(d.categoria)}
                    {d.fornecedor ? ` · ${d.fornecedor}` : ""}
                    <span className="sm:hidden"> · vence {dataBr(d.vencimento)}</span>
                    {d.fixa ? " · fixa" : ""}
                  </p>
                </div>
                <div className="hidden shrink-0 md:block">
                  {d.status === "paga" ? (
                    <Situacao tom="bom">Paga{d.pago_em ? ` ${dataBr(d.pago_em).slice(0, 5)}` : ""}</Situacao>
                  ) : vencida ? (
                    <Situacao tom="critico">Vencida</Situacao>
                  ) : venceHoje ? (
                    <Situacao tom="atencao">Vence hoje</Situacao>
                  ) : (
                    <Situacao tom="neutro">A pagar</Situacao>
                  )}
                </div>
                <p className={cn("w-24 shrink-0 text-right text-sm font-semibold tabular-nums", vencida ? "text-[#B91C1C]" : "text-azul-medico")}>
                  {reais(Number(d.valor), true)}
                </p>
                <div className="relative flex shrink-0 items-center gap-1">
                  {d.status === "aberta" && (
                    <button
                      type="button"
                      disabled={pending || demo}
                      onClick={() => executar(() => pagarDespesa(d.id))}
                      className="hidden h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-xs font-semibold text-[#15803D] hover:border-[#15803D] hover:bg-[#E9F8EF] sm:inline-flex"
                    >
                      <Check className="size-3.5" /> Pagar
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setMenu(menu === d.id ? null : d.id)}
                    className="grid size-8 place-items-center rounded-lg text-cinza-suave hover:bg-branco-clinico hover:text-azul-medico"
                    aria-label="Mais ações"
                  >
                    <MoreHorizontal className="size-4" />
                  </button>
                  {menu === d.id && (
                    <div className="absolute right-0 top-9 z-30 w-48 overflow-hidden rounded-lg border border-border bg-white py-1 shadow-card" onMouseLeave={() => setMenu(null)}>
                      {d.status === "aberta" ? (
                        <ItemMenu icone={Check} onClick={() => { setMenu(null); executar(() => pagarDespesa(d.id)); }} disabled={demo}>
                          Marcar como paga
                        </ItemMenu>
                      ) : (
                        <ItemMenu icone={RotateCcw} onClick={() => { setMenu(null); executar(() => reabrirDespesa(d.id)); }} disabled={demo}>
                          Reabrir
                        </ItemMenu>
                      )}
                      <ItemMenu icone={Pencil} onClick={() => { setMenu(null); setEditar(d); }}>
                        Editar
                      </ItemMenu>
                      <ItemMenu icone={Trash2} perigo onClick={() => { setMenu(null); if (confirm("Excluir esta despesa?")) executar(() => excluirDespesa(d.id)); }} disabled={demo}>
                        Excluir
                      </ItemMenu>
                      {d.grupo && d.status !== "paga" && (
                        <ItemMenu icone={Trash2} perigo onClick={() => { setMenu(null); if (confirm("Excluir esta e as próximas em aberto?")) executar(() => excluirDespesa(d.id, true)); }} disabled={demo}>
                          Excluir esta e as próximas
                        </ItemMenu>
                      )}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <div className="flex items-center justify-between border-t border-border bg-branco-clinico px-5 py-3 text-sm">
        <span className="text-cinza-suave">
          {lista.length} despesa{lista.length === 1 ? "" : "s"}
        </span>
        <span className="font-semibold tabular-nums text-azul-medico">{reais(total, true)}</span>
      </div>

      {(nova || editar) && (
        <DespesaDialog
          key={editar?.id ?? "nova"}
          aberto
          despesa={editar}
          demo={demo}
          onFechar={() => {
            setNova(false);
            setEditar(null);
          }}
        />
      )}
    </div>
  );
}

function ItemMenu({
  icone: Icone,
  children,
  onClick,
  perigo,
  disabled,
}: {
  icone: typeof Check;
  children: React.ReactNode;
  onClick: () => void;
  perigo?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex w-full items-center gap-2 px-3 py-2 text-left text-sm disabled:opacity-50",
        perigo ? "text-[#B91C1C] hover:bg-[#FDECEC]" : "text-cinza-texto hover:bg-branco-clinico"
      )}
    >
      <Icone className="size-4 shrink-0" /> {children}
    </button>
  );
}
