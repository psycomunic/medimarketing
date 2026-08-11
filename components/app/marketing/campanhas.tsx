"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import type { Campanha, PlataformaAds, StatusCampanha } from "@/lib/supabase/types";
import { excluirCampanha, salvarCampanha } from "@/lib/actions/marketing";
import {
  corPlataforma,
  dataBr,
  rotuloPlataforma,
  rotuloStatusCampanha,
} from "@/lib/rotulos";
import { formatarNumero, formatarPercentual, formatarReais } from "@/lib/indicadores";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const corStatus: Record<StatusCampanha, string> = {
  ativa: "bg-sucesso/12 text-sucesso",
  pausada: "bg-alerta/12 text-alerta",
  encerrada: "bg-cinza-suave/12 text-cinza-suave",
};

export function Campanhas({
  campanhas,
  organizationId,
  podeEditar,
  demo,
}: {
  campanhas: Campanha[];
  organizationId: string | null;
  podeEditar: boolean;
  demo: boolean;
}) {
  const router = useRouter();
  const [filtro, setFiltro] = useState<StatusCampanha | "todas">("todas");
  const [editando, setEditando] = useState<Campanha | "nova" | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const lista = useMemo(
    () => (filtro === "todas" ? campanhas : campanhas.filter((c) => c.status === filtro)),
    [campanhas, filtro]
  );

  function apagar(c: Campanha) {
    if (!confirm(`Excluir a campanha "${c.nome}"?`)) return;
    setErro(null);
    startTransition(async () => {
      const res = await excluirCampanha(c.id);
      if (!res.ok) {
        setErro(res.erro);
        return;
      }
      router.refresh();
    });
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-lg border border-border bg-white p-1">
          {(["todas", "ativa", "pausada", "encerrada"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFiltro(s)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                filtro === s
                  ? "bg-azul-medico text-white"
                  : "text-cinza-suave hover:text-azul-medico"
              )}
            >
              {s === "todas" ? "Todas" : rotuloStatusCampanha[s]}
            </button>
          ))}
        </div>

        {podeEditar && (
          <Button variant="primary" size="sm" onClick={() => setEditando("nova")}>
            <Plus className="size-4" /> Nova campanha
          </Button>
        )}
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
        {lista.length === 0 ? (
          <p className="px-6 py-16 text-center text-cinza-suave">
            Nenhuma campanha com esse filtro.
          </p>
        ) : (
          <>
            {/* Tabela no desktop */}
            <table className="hidden w-full text-sm lg:table">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-cinza-suave">
                  <th className="px-5 py-3 font-semibold">Campanha</th>
                  <th className="px-3 py-3 text-right font-semibold">Investido</th>
                  <th className="px-3 py-3 text-right font-semibold">Leads</th>
                  <th className="px-3 py-3 text-right font-semibold">CPL</th>
                  <th className="px-3 py-3 text-right font-semibold">Agendou</th>
                  <th className="px-3 py-3 text-right font-semibold">Custo/agend.</th>
                  <th className="px-5 py-3 text-right font-semibold">CTR</th>
                  {podeEditar && <th className="w-20 px-3 py-3" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {lista.map((c) => {
                  const inv = Number(c.investimento);
                  const cpl = c.leads ? inv / c.leads : 0;
                  const cpa = c.agendamentos ? inv / c.agendamentos : 0;
                  const ctr = Number(c.impressoes)
                    ? (c.cliques / Number(c.impressoes)) * 100
                    : 0;

                  return (
                    <tr key={c.id} className="transition-colors hover:bg-branco-clinico">
                      <td className="px-5 py-3.5">
                        <p className="font-semibold text-azul-medico">{c.nome}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                              corPlataforma[c.plataforma]
                            )}
                          >
                            {rotuloPlataforma[c.plataforma]}
                          </span>
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                              corStatus[c.status]
                            )}
                          >
                            {rotuloStatusCampanha[c.status]}
                          </span>
                          <span className="text-[11px] text-cinza-suave">
                            desde {dataBr(c.inicio)}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-3.5 text-right text-cinza-texto">
                        {formatarReais(inv)}
                      </td>
                      <td className="px-3 py-3.5 text-right text-cinza-texto">
                        {formatarNumero(c.leads)}
                      </td>
                      <td className="px-3 py-3.5 text-right font-semibold text-azul-medico">
                        {cpl ? formatarReais(cpl, true) : "—"}
                      </td>
                      <td className="px-3 py-3.5 text-right text-cinza-texto">
                        {formatarNumero(c.agendamentos)}
                      </td>
                      <td className="px-3 py-3.5 text-right font-semibold text-teal">
                        {cpa ? formatarReais(cpa, true) : "—"}
                      </td>
                      <td className="px-5 py-3.5 text-right text-cinza-texto">
                        {ctr ? formatarPercentual(ctr, 1) : "—"}
                      </td>
                      {podeEditar && (
                        <td className="px-3 py-3.5">
                          <div className="flex justify-end gap-1">
                            <button
                              onClick={() => setEditando(c)}
                              className="grid size-8 place-items-center rounded-md text-cinza-suave hover:text-teal"
                              aria-label={`Editar ${c.nome}`}
                            >
                              <Pencil className="size-4" />
                            </button>
                            <button
                              disabled={pending}
                              onClick={() => apagar(c)}
                              className="grid size-8 place-items-center rounded-md text-cinza-suave hover:text-coral disabled:opacity-50"
                              aria-label={`Excluir ${c.nome}`}
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Cartões no mobile */}
            <ul className="divide-y divide-border lg:hidden">
              {lista.map((c) => {
                const inv = Number(c.investimento);
                const cpl = c.leads ? inv / c.leads : 0;
                return (
                  <li key={c.id} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-azul-medico">
                          {c.nome}
                        </p>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                              corPlataforma[c.plataforma]
                            )}
                          >
                            {rotuloPlataforma[c.plataforma]}
                          </span>
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                              corStatus[c.status]
                            )}
                          >
                            {rotuloStatusCampanha[c.status]}
                          </span>
                        </div>
                      </div>
                      {podeEditar && (
                        <button
                          onClick={() => setEditando(c)}
                          className="grid size-8 shrink-0 place-items-center rounded-md text-cinza-suave hover:text-teal"
                          aria-label={`Editar ${c.nome}`}
                        >
                          <Pencil className="size-4" />
                        </button>
                      )}
                    </div>
                    <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs">
                      {[
                        { l: "Investido", v: formatarReais(inv) },
                        { l: "Leads", v: formatarNumero(c.leads) },
                        { l: "CPL", v: cpl ? formatarReais(cpl) : "—" },
                        { l: "Agendou", v: formatarNumero(c.agendamentos) },
                      ].map((m) => (
                        <div key={m.l} className="rounded-md bg-branco-clinico py-2">
                          <p className="font-semibold text-azul-medico">{m.v}</p>
                          <p className="text-[10px] text-cinza-suave">{m.l}</p>
                        </div>
                      ))}
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>

      {editando && (
        <EditorCampanha
          campanha={editando === "nova" ? null : editando}
          organizationId={organizationId}
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

/* ---------------------------- Editor ---------------------------- */

function hoje(): string {
  return new Date().toISOString().slice(0, 10);
}

function EditorCampanha({
  campanha,
  organizationId,
  onFechar,
  onSalvo,
}: {
  campanha: Campanha | null;
  organizationId: string | null;
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const [v, setV] = useState({
    plataforma: (campanha?.plataforma ?? "meta") as PlataformaAds,
    nome: campanha?.nome ?? "",
    objetivo: campanha?.objetivo ?? "",
    status: (campanha?.status ?? "ativa") as StatusCampanha,
    inicio: campanha?.inicio ?? hoje(),
    fim: campanha?.fim ?? "",
    investimento: campanha ? String(campanha.investimento) : "",
    impressoes: campanha ? String(campanha.impressoes) : "",
    cliques: campanha ? String(campanha.cliques) : "",
    leads: campanha ? String(campanha.leads) : "",
    agendamentos: campanha ? String(campanha.agendamentos) : "",
  });
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function enviar() {
    setErro(null);
    startTransition(async () => {
      const res = await salvarCampanha({
        id: campanha?.id,
        organizationId: organizationId ?? undefined,
        plataforma: v.plataforma,
        nome: v.nome,
        objetivo: v.objetivo,
        status: v.status,
        inicio: v.inicio,
        fim: v.fim,
        investimento: Number(v.investimento || 0),
        impressoes: Number(v.impressoes || 0),
        cliques: Number(v.cliques || 0),
        leads: Number(v.leads || 0),
        agendamentos: Number(v.agendamentos || 0),
      });
      if (!res.ok) {
        setErro(res.erro);
        return;
      }
      onSalvo();
    });
  }

  const numeros = [
    { chave: "investimento", label: "Investimento (R$)" },
    { chave: "impressoes", label: "Impressões" },
    { chave: "cliques", label: "Cliques" },
    { chave: "leads", label: "Leads gerados" },
    { chave: "agendamentos", label: "Consultas agendadas" },
  ] as const;

  return (
    <Dialog open onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{campanha ? "Editar campanha" : "Nova campanha"}</DialogTitle>
          <DialogDescription>
            Lance os números do período. Quando as integrações de Meta e
            Google entrarem, elas preenchem estes mesmos campos sozinhas.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="nome-camp">Nome da campanha</Label>
            <Input
              id="nome-camp"
              value={v.nome}
              onChange={(e) => setV({ ...v, nome: e.target.value })}
              placeholder="Melasma — público frio SP"
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="plataforma">Plataforma</Label>
            <Select
              id="plataforma"
              value={v.plataforma}
              onChange={(e) => setV({ ...v, plataforma: e.target.value as PlataformaAds })}
            >
              {(Object.keys(rotuloPlataforma) as PlataformaAds[]).map((p) => (
                <option key={p} value={p}>
                  {rotuloPlataforma[p]}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="status-camp">Status</Label>
            <Select
              id="status-camp"
              value={v.status}
              onChange={(e) => setV({ ...v, status: e.target.value as StatusCampanha })}
            >
              {(Object.keys(rotuloStatusCampanha) as StatusCampanha[]).map((s) => (
                <option key={s} value={s}>
                  {rotuloStatusCampanha[s]}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="objetivo">Objetivo (opcional)</Label>
            <Input
              id="objetivo"
              value={v.objetivo}
              onChange={(e) => setV({ ...v, objetivo: e.target.value })}
              placeholder="Geração de leads"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="inicio">Início</Label>
              <Input
                id="inicio"
                type="date"
                value={v.inicio}
                onChange={(e) => setV({ ...v, inicio: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="fim">Término</Label>
              <Input
                id="fim"
                type="date"
                value={v.fim}
                onChange={(e) => setV({ ...v, fim: e.target.value })}
              />
            </div>
          </div>

          {numeros.map((n) => (
            <div key={n.chave} className="grid gap-1.5">
              <Label htmlFor={n.chave}>{n.label}</Label>
              <Input
                id={n.chave}
                inputMode="decimal"
                value={v[n.chave]}
                onChange={(e) =>
                  setV({ ...v, [n.chave]: e.target.value.replace(",", ".") })
                }
                placeholder="0"
              />
            </div>
          ))}
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
            Salvar campanha
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
