"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2, Pencil, Plus, Search, Trash2 } from "lucide-react";
import type {
  FormaPagamento,
  Lancamento,
  StatusLancamento,
} from "@/lib/supabase/types";
import {
  baixarLancamento,
  excluirLancamento,
  salvarLancamento,
} from "@/lib/actions/financeiro";
import {
  corStatusLancamento,
  dataBr,
  rotuloFormaPagamento,
  rotuloStatusLancamento,
} from "@/lib/rotulos";
import { formatarReais } from "@/lib/indicadores";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export function Lancamentos({
  lancamentos,
  meses,
  mesAtual,
  organizationId,
  podeEditar,
  demo,
}: {
  lancamentos: Lancamento[];
  meses: string[];
  mesAtual: string;
  organizationId: string | null;
  podeEditar: boolean;
  demo: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [status, setStatus] = useState<StatusLancamento | "todos">("todos");
  const [busca, setBusca] = useState("");
  const [editando, setEditando] = useState<Lancamento | "novo" | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return lancamentos.filter((l) => {
      if (status !== "todos" && l.status !== status) return false;
      if (termo) {
        const alvo = `${l.paciente_nome} ${l.procedimento} ${l.categoria ?? ""}`;
        if (!alvo.toLowerCase().includes(termo)) return false;
      }
      return true;
    });
  }, [lancamentos, status, busca]);

  /** Troca o mês pela URL para o servidor recarregar o período. */
  function trocarMes(mes: string) {
    const q = new URLSearchParams(params.toString());
    q.set("mes", mes);
    router.push(`/app/financeiro?${q.toString()}`);
  }

  function agir(fn: () => Promise<{ ok: boolean; erro?: string }>) {
    setErro(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        setErro(res.erro ?? "Não foi possível concluir.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <>
      <div className="rounded-lg border border-border bg-white p-4 shadow-soft">
        <div className="flex flex-wrap items-center gap-3">
          <Select
            value={mesAtual}
            onChange={(e) => trocarMes(e.target.value)}
            className="h-10 w-auto min-w-[160px]"
            aria-label="Mês de competência"
          >
            {meses.map((m) => (
              <option key={m} value={m}>
                {rotuloMes(m)}
              </option>
            ))}
          </Select>

          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-cinza-suave" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar paciente ou procedimento"
              className="h-10 pl-9"
              aria-label="Buscar lançamento"
            />
          </div>

          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusLancamento | "todos")}
            className="h-10 w-auto min-w-[150px]"
            aria-label="Filtrar por status"
          >
            <option value="todos">Todos os status</option>
            {(Object.keys(rotuloStatusLancamento) as StatusLancamento[]).map((s) => (
              <option key={s} value={s}>
                {rotuloStatusLancamento[s]}
              </option>
            ))}
          </Select>

          {podeEditar && (
            <Button variant="primary" size="sm" onClick={() => setEditando("novo")}>
              <Plus className="size-4" /> Novo lançamento
            </Button>
          )}
        </div>
      </div>

      {erro && (
        <p className="mt-4 rounded-md bg-coral/10 px-4 py-2.5 text-sm text-coral">{erro}</p>
      )}
      {demo && podeEditar && (
        <p className="mt-4 rounded-md border border-dashed border-border bg-white px-4 py-2.5 text-xs text-cinza-suave">
          Modo demonstração: os lançamentos não são salvos.
        </p>
      )}

      <div className="mt-5 overflow-hidden rounded-lg border border-border bg-white shadow-soft">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="text-sm font-semibold text-azul-medico">
            {lista.length} lançamento{lista.length === 1 ? "" : "s"}
          </h2>
        </div>

        {lista.length === 0 ? (
          <p className="px-6 py-16 text-center text-cinza-suave">
            Nenhum lançamento com esses filtros.
          </p>
        ) : (
          <div className="max-h-[560px] overflow-y-auto">
            <table className="hidden w-full text-sm md:table">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-cinza-suave">
                  <th className="px-5 py-3 font-semibold">Data</th>
                  <th className="px-3 py-3 font-semibold">Paciente</th>
                  <th className="px-3 py-3 font-semibold">Procedimento</th>
                  <th className="px-3 py-3 font-semibold">Pagamento</th>
                  <th className="px-3 py-3 text-right font-semibold">Valor</th>
                  <th className="px-3 py-3 font-semibold">Status</th>
                  {podeEditar && <th className="w-24 px-5 py-3" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {lista.map((l) => (
                  <tr key={l.id} className="transition-colors hover:bg-branco-clinico">
                    <td className="whitespace-nowrap px-5 py-3 text-cinza-suave">
                      {dataBr(l.data_competencia)}
                    </td>
                    <td className="px-3 py-3 font-medium text-cinza-texto">
                      {l.paciente_nome}
                    </td>
                    <td className="px-3 py-3">
                      <p className="text-cinza-texto">{l.procedimento}</p>
                      {l.categoria && (
                        <p className="text-xs text-cinza-suave">{l.categoria}</p>
                      )}
                    </td>
                    <td className="px-3 py-3 text-cinza-suave">
                      {rotuloFormaPagamento[l.forma_pagamento]}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right font-semibold text-azul-medico">
                      {Number(l.valor) === 0 ? "—" : formatarReais(Number(l.valor), true)}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={cn(
                          "whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-semibold",
                          corStatusLancamento[l.status]
                        )}
                      >
                        {rotuloStatusLancamento[l.status]}
                      </span>
                    </td>
                    {podeEditar && (
                      <td className="px-5 py-3">
                        <div className="flex justify-end gap-1">
                          {(l.status === "previsto" || l.status === "atrasado") && (
                            <button
                              disabled={pending}
                              onClick={() => agir(() => baixarLancamento(l.id))}
                              className="grid size-8 place-items-center rounded-md text-cinza-suave hover:text-sucesso disabled:opacity-50"
                              aria-label="Dar baixa"
                              title="Marcar como recebido"
                            >
                              <CheckCircle2 className="size-4" />
                            </button>
                          )}
                          <button
                            onClick={() => setEditando(l)}
                            className="grid size-8 place-items-center rounded-md text-cinza-suave hover:text-teal"
                            aria-label="Editar lançamento"
                          >
                            <Pencil className="size-4" />
                          </button>
                          <button
                            disabled={pending}
                            onClick={() => {
                              if (confirm("Excluir este lançamento?")) {
                                agir(() => excluirLancamento(l.id));
                              }
                            }}
                            className="grid size-8 place-items-center rounded-md text-cinza-suave hover:text-coral disabled:opacity-50"
                            aria-label="Excluir lançamento"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Cartões no mobile */}
            <ul className="divide-y divide-border md:hidden">
              {lista.map((l) => (
                <li key={l.id} className="px-5 py-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-cinza-texto">
                        {l.paciente_nome}
                      </p>
                      <p className="truncate text-xs text-cinza-suave">
                        {l.procedimento} · {dataBr(l.data_competencia)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-semibold text-azul-medico">
                        {Number(l.valor) === 0 ? "—" : formatarReais(Number(l.valor))}
                      </p>
                      <span
                        className={cn(
                          "mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold",
                          corStatusLancamento[l.status]
                        )}
                      >
                        {rotuloStatusLancamento[l.status]}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {editando && (
        <EditorLancamento
          lancamento={editando === "novo" ? null : editando}
          organizationId={organizationId}
          mes={mesAtual}
          onFechar={() => setEditando(null)}
          onSalvo={() => {
            setEditando(null);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

/** "2026-08" vira "Agosto de 2026". */
function rotuloMes(mes: string): string {
  const nomes = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ];
  const [ano, m] = mes.split("-");
  return `${nomes[Number(m) - 1]} de ${ano}`;
}

/* ---------------------------- Editor ---------------------------- */

function EditorLancamento({
  lancamento,
  organizationId,
  mes,
  onFechar,
  onSalvo,
}: {
  lancamento: Lancamento | null;
  organizationId: string | null;
  mes: string;
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const [v, setV] = useState({
    pacienteNome: lancamento?.paciente_nome ?? "",
    procedimento: lancamento?.procedimento ?? "",
    categoria: lancamento?.categoria ?? "",
    valor: lancamento ? String(lancamento.valor) : "",
    custo: lancamento ? String(lancamento.custo) : "0",
    formaPagamento: (lancamento?.forma_pagamento ?? "pix") as FormaPagamento,
    status: (lancamento?.status ?? "recebido") as StatusLancamento,
    dataCompetencia: lancamento?.data_competencia ?? `${mes}-01`,
    dataRecebimento: lancamento?.data_recebimento ?? "",
    observacao: lancamento?.observacao ?? "",
  });
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function enviar() {
    setErro(null);
    startTransition(async () => {
      const res = await salvarLancamento({
        id: lancamento?.id,
        organizationId: organizationId ?? undefined,
        pacienteNome: v.pacienteNome,
        procedimento: v.procedimento,
        categoria: v.categoria,
        valor: Number(v.valor || 0),
        custo: Number(v.custo || 0),
        formaPagamento: v.formaPagamento,
        status: v.status,
        dataCompetencia: v.dataCompetencia,
        dataRecebimento: v.dataRecebimento,
        observacao: v.observacao,
      });
      if (!res.ok) {
        setErro(res.erro);
        return;
      }
      onSalvo();
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {lancamento ? "Editar lançamento" : "Novo lançamento"}
          </DialogTitle>
          <DialogDescription>
            O custo direto (material, laboratório, repasse) entra para o
            painel calcular a margem real do procedimento.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="paciente">Paciente</Label>
            <Input
              id="paciente"
              value={v.pacienteNome}
              onChange={(e) => setV({ ...v, pacienteNome: e.target.value })}
              placeholder="Nome do paciente"
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="proc">Procedimento</Label>
            <Input
              id="proc"
              value={v.procedimento}
              onChange={(e) => setV({ ...v, procedimento: e.target.value })}
              placeholder="Consulta dermatológica"
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="categoria">Categoria (opcional)</Label>
            <Input
              id="categoria"
              value={v.categoria}
              onChange={(e) => setV({ ...v, categoria: e.target.value })}
              placeholder="Consultas, Estética, Procedimentos"
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="competencia">Data do atendimento</Label>
            <Input
              id="competencia"
              type="date"
              value={v.dataCompetencia}
              onChange={(e) => setV({ ...v, dataCompetencia: e.target.value })}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="valor">Valor cobrado (R$)</Label>
            <Input
              id="valor"
              inputMode="decimal"
              value={v.valor}
              onChange={(e) => setV({ ...v, valor: e.target.value.replace(",", ".") })}
              placeholder="0"
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="custo">Custo direto (R$)</Label>
            <Input
              id="custo"
              inputMode="decimal"
              value={v.custo}
              onChange={(e) => setV({ ...v, custo: e.target.value.replace(",", ".") })}
              placeholder="0"
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="forma">Forma de pagamento</Label>
            <Select
              id="forma"
              value={v.formaPagamento}
              onChange={(e) =>
                setV({ ...v, formaPagamento: e.target.value as FormaPagamento })
              }
            >
              {(Object.keys(rotuloFormaPagamento) as FormaPagamento[]).map((f) => (
                <option key={f} value={f}>
                  {rotuloFormaPagamento[f]}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="status-lanc">Status</Label>
            <Select
              id="status-lanc"
              value={v.status}
              onChange={(e) => setV({ ...v, status: e.target.value as StatusLancamento })}
            >
              {(Object.keys(rotuloStatusLancamento) as StatusLancamento[]).map((s) => (
                <option key={s} value={s}>
                  {rotuloStatusLancamento[s]}
                </option>
              ))}
            </Select>
          </div>

          {v.status === "recebido" && (
            <div className="grid gap-1.5">
              <Label htmlFor="recebimento">Data do recebimento</Label>
              <Input
                id="recebimento"
                type="date"
                value={v.dataRecebimento}
                onChange={(e) => setV({ ...v, dataRecebimento: e.target.value })}
              />
            </div>
          )}

          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="obs-lanc">Observação (opcional)</Label>
            <Textarea
              id="obs-lanc"
              rows={2}
              value={v.observacao}
              onChange={(e) => setV({ ...v, observacao: e.target.value })}
            />
          </div>
        </div>

        {erro && (
          <p className="rounded-md bg-coral/10 px-3 py-2 text-sm text-coral">{erro}</p>
        )}

        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onFechar}>
            Cancelar
          </Button>
          <Button variant="marca" onClick={enviar} disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            Salvar lançamento
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
