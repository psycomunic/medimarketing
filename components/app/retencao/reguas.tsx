"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  Clock,
  Loader2,
  MessageSquare,
  Pencil,
  Plus,
  Power,
  Trash2,
  X,
} from "lucide-react";
import type {
  CanalContato,
  ReguaComDesempenho,
  TipoRegua,
} from "@/lib/supabase/types";
import { alternarRegua, excluirRegua, salvarRegua } from "@/lib/actions/retencao";
import {
  gatilhoRegua,
  rotuloCanal,
  rotuloTipoRegua,
} from "@/lib/rotulos";
import { formatarNumero, formatarPercentual } from "@/lib/indicadores";
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

type PassoEditavel = {
  atrasoHoras: number;
  canal: CanalContato;
  mensagem: string;
};

/** "48 h" vira "2 dias depois"; 0 vira "imediatamente". */
function descreverAtraso(horas: number): string {
  if (horas === 0) return "imediatamente";
  if (horas < 24) return `${horas} h depois`;
  const dias = Math.round(horas / 24);
  return `${dias} ${dias === 1 ? "dia" : "dias"} depois`;
}

const MODELO: Record<TipoRegua, PassoEditavel[]> = {
  reabordagem: [
    { atrasoHoras: 48, canal: "whatsapp", mensagem: "Oi, {paciente}! Ficou alguma dúvida sobre o que conversamos?" },
  ],
  no_show: [
    { atrasoHoras: 2, canal: "whatsapp", mensagem: "Oi, {paciente}! Senti sua falta hoje. Consigo te encaixar ainda esta semana?" },
  ],
  reativacao: [
    { atrasoHoras: 0, canal: "whatsapp", mensagem: "Oi, {paciente}! Faz um tempo que você não aparece por aqui. Como você está?" },
  ],
  recall: [
    { atrasoHoras: 168, canal: "whatsapp", mensagem: "Oi, {paciente}! Chegou a hora da sua revisão. Qual dia fica melhor?" },
  ],
  pos_consulta: [
    { atrasoHoras: 24, canal: "whatsapp", mensagem: "Oi, {paciente}! Tudo certo depois da consulta de ontem?" },
  ],
};

export function Reguas({
  reguas,
  organizationId,
  demo,
}: {
  reguas: ReguaComDesempenho[];
  organizationId: string | null;
  demo: boolean;
}) {
  const router = useRouter();
  const [editando, setEditando] = useState<ReguaComDesempenho | "nova" | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-cinza-suave">
          {reguas.filter((r) => r.ativa).length} de {reguas.length} réguas ligadas.
        </p>
        <Button variant="primary" size="sm" onClick={() => setEditando("nova")}>
          <Plus className="size-4" /> Nova régua
        </Button>
      </div>

      {erro && (
        <p className="mt-4 rounded-md bg-coral/10 px-4 py-2.5 text-sm text-coral">{erro}</p>
      )}
      {demo && (
        <p className="mt-4 rounded-md border border-dashed border-border bg-white px-4 py-2.5 text-xs text-cinza-suave">
          Modo demonstração: ligar, desligar ou editar não altera nada de verdade.
        </p>
      )}

      <div className="mt-5 space-y-4">
        {reguas.length === 0 && (
          <p className="rounded-lg border border-dashed border-border bg-white px-6 py-12 text-center text-cinza-suave">
            Nenhuma régua criada. Comece por uma de reabordagem: é a que
            costuma dar retorno mais rápido.
          </p>
        )}

        {reguas.map((r) => (
          <article
            key={r.id}
            className={cn(
              "overflow-hidden rounded-lg border bg-white shadow-soft",
              r.ativa ? "border-border" : "border-dashed border-border opacity-80"
            )}
          >
            <header className="flex flex-wrap items-start gap-3 border-b border-border px-5 py-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-heading font-semibold text-azul-medico">
                    {r.nome}
                  </h3>
                  <span className="rounded-full bg-verde-menta px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-azul-medico">
                    {rotuloTipoRegua[r.tipo]}
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-[10px] font-semibold",
                      r.ativa
                        ? "bg-sucesso/12 text-sucesso"
                        : "bg-cinza-suave/12 text-cinza-suave"
                    )}
                  >
                    {r.ativa ? "Ligada" : "Desligada"}
                  </span>
                </div>
                <p className="mt-1 text-sm text-cinza-suave">
                  {r.descricao ?? gatilhoRegua[r.tipo]}
                </p>
                <p className="mt-1 text-xs text-cinza-suave/80">
                  <strong>Dispara quando:</strong> {gatilhoRegua[r.tipo].toLowerCase()}
                </p>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  disabled={pending}
                  onClick={() => agir(() => alternarRegua(r.id, !r.ativa))}
                  className={cn(
                    "grid size-9 place-items-center rounded-md border transition-colors disabled:opacity-50",
                    r.ativa
                      ? "border-sucesso/30 text-sucesso hover:bg-sucesso/10"
                      : "border-border text-cinza-suave hover:text-azul-medico"
                  )}
                  aria-label={r.ativa ? "Desligar régua" : "Ligar régua"}
                  title={r.ativa ? "Desligar" : "Ligar"}
                >
                  <Power className="size-4" />
                </button>
                <button
                  onClick={() => setEditando(r)}
                  className="grid size-9 place-items-center rounded-md border border-border text-cinza-suave transition-colors hover:text-teal"
                  aria-label="Editar régua"
                  title="Editar"
                >
                  <Pencil className="size-4" />
                </button>
                <button
                  disabled={pending}
                  onClick={() => {
                    if (confirm(`Excluir a régua "${r.nome}"?`)) {
                      agir(() => excluirRegua(r.id));
                    }
                  }}
                  className="grid size-9 place-items-center rounded-md border border-border text-cinza-suave transition-colors hover:border-coral hover:text-coral disabled:opacity-50"
                  aria-label="Excluir régua"
                  title="Excluir"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </header>

            <div className="grid gap-5 px-5 py-4 lg:grid-cols-[1fr_240px]">
              {/* Cadência */}
              <ol className="space-y-2">
                {r.passos.map((p, i) => (
                  <li key={p.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-verde-menta text-xs font-bold text-teal">
                        {i + 1}
                      </span>
                      {i < r.passos.length - 1 && (
                        <ArrowDown className="my-0.5 size-3 text-border" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1 rounded-md border border-border bg-branco-clinico px-3 py-2">
                      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-medium text-cinza-suave">
                        <span className="flex items-center gap-1">
                          <Clock className="size-3 text-teal" />
                          {descreverAtraso(p.atraso_horas)}
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageSquare className="size-3 text-teal" />
                          {rotuloCanal[p.canal]}
                        </span>
                      </p>
                      <p className="mt-1 text-sm text-cinza-texto">{p.mensagem}</p>
                    </div>
                  </li>
                ))}
              </ol>

              {/* Desempenho */}
              <div className="rounded-lg border border-border bg-branco-clinico p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-teal">
                  Últimos 90 dias
                </p>
                {r.enviados === 0 ? (
                  <p className="mt-3 text-sm text-cinza-suave">
                    Ainda sem disparos nesta janela.
                  </p>
                ) : (
                  <dl className="mt-3 space-y-2 text-sm">
                    <Linha rotulo="Disparos" valor={formatarNumero(r.enviados)} />
                    <Linha
                      rotulo="Responderam"
                      valor={`${formatarNumero(r.respondidos)} · ${formatarPercentual((r.respondidos / r.enviados) * 100)}`}
                    />
                    <Linha
                      rotulo="Recuperados"
                      valor={`${formatarNumero(r.convertidos)} · ${formatarPercentual((r.convertidos / r.enviados) * 100)}`}
                      destaque
                    />
                  </dl>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>

      {editando && (
        <EditorRegua
          regua={editando === "nova" ? null : editando}
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

function Linha({
  rotulo,
  valor,
  destaque,
}: {
  rotulo: string;
  valor: string;
  destaque?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-cinza-suave">{rotulo}</dt>
      <dd
        className={cn(
          "font-semibold",
          destaque ? "text-teal" : "text-azul-medico"
        )}
      >
        {valor}
      </dd>
    </div>
  );
}

/* ---------------------------- Editor ---------------------------- */

function EditorRegua({
  regua,
  organizationId,
  onFechar,
  onSalvo,
}: {
  regua: ReguaComDesempenho | null;
  organizationId: string | null;
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const [tipo, setTipo] = useState<TipoRegua>(regua?.tipo ?? "reabordagem");
  const [nome, setNome] = useState(regua?.nome ?? "");
  const [descricao, setDescricao] = useState(regua?.descricao ?? "");
  const [ativa, setAtiva] = useState(regua?.ativa ?? false);
  const [passos, setPassos] = useState<PassoEditavel[]>(
    regua?.passos.map((p) => ({
      atrasoHoras: p.atraso_horas,
      canal: p.canal,
      mensagem: p.mensagem,
    })) ?? MODELO.reabordagem
  );
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function trocarTipo(novo: TipoRegua) {
    setTipo(novo);
    // Régua nova ganha o passo modelo do tipo escolhido
    if (!regua && passos.length <= 1) setPassos(MODELO[novo]);
  }

  function atualizar(i: number, campo: keyof PassoEditavel, valor: string | number) {
    setPassos((ps) => ps.map((p, j) => (j === i ? { ...p, [campo]: valor } : p)));
  }

  function enviar() {
    setErro(null);
    startTransition(async () => {
      const res = await salvarRegua({
        id: regua?.id,
        organizationId: organizationId ?? undefined,
        tipo,
        nome,
        descricao,
        ativa,
        passos,
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
          <DialogTitle>{regua ? "Editar régua" : "Nova régua"}</DialogTitle>
          <DialogDescription>
            Use <code className="rounded bg-verde-menta px-1">{"{paciente}"}</code> no
            texto para inserir o nome de quem vai receber.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="tipo-regua">Tipo</Label>
            <Select
              id="tipo-regua"
              value={tipo}
              onChange={(e) => trocarTipo(e.target.value as TipoRegua)}
            >
              {(Object.keys(rotuloTipoRegua) as TipoRegua[]).map((t) => (
                <option key={t} value={t}>
                  {rotuloTipoRegua[t]}
                </option>
              ))}
            </Select>
            <p className="text-xs text-cinza-suave">{gatilhoRegua[tipo]}</p>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="nome-regua">Nome</Label>
            <Input
              id="nome-regua"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Reabordagem de orçamento parado"
            />
          </div>

          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="desc-regua">Descrição (opcional)</Label>
            <Textarea
              id="desc-regua"
              rows={2}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Para quem serve e qual a lógica da cadência."
            />
          </div>
        </div>

        {/* Passos */}
        <section>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-azul-medico">
              Cadência ({passos.length} passo{passos.length === 1 ? "" : "s"})
            </h3>
            {passos.length < 8 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setPassos((ps) => [
                    ...ps,
                    { atrasoHoras: 48, canal: "whatsapp", mensagem: "" },
                  ])
                }
              >
                <Plus className="size-4" /> Adicionar passo
              </Button>
            )}
          </div>

          <ol className="mt-3 space-y-3">
            {passos.map((p, i) => (
              <li
                key={i}
                className="rounded-lg border border-border bg-branco-clinico p-3"
              >
                <div className="flex items-center gap-2">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-verde-menta text-xs font-bold text-teal">
                    {i + 1}
                  </span>
                  <span className="text-xs font-medium text-cinza-suave">
                    Passo {i + 1}
                  </span>
                  {passos.length > 1 && (
                    <button
                      onClick={() => setPassos((ps) => ps.filter((_, j) => j !== i))}
                      className="ml-auto grid size-7 place-items-center rounded-md text-cinza-suave hover:text-coral"
                      aria-label={`Remover passo ${i + 1}`}
                    >
                      <X className="size-4" />
                    </button>
                  )}
                </div>

                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <label className="grid gap-1">
                    <span className="text-xs text-cinza-suave">
                      Disparar depois de (horas)
                    </span>
                    <Input
                      type="number"
                      min={0}
                      value={p.atrasoHoras}
                      onChange={(e) =>
                        atualizar(i, "atrasoHoras", Number(e.target.value) || 0)
                      }
                      className="h-10"
                    />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-xs text-cinza-suave">Canal</span>
                    <Select
                      value={p.canal}
                      onChange={(e) => atualizar(i, "canal", e.target.value)}
                      className="h-10"
                    >
                      {(
                        ["whatsapp", "telefone", "email", "instagram"] as CanalContato[]
                      ).map((c) => (
                        <option key={c} value={c}>
                          {rotuloCanal[c]}
                        </option>
                      ))}
                    </Select>
                  </label>
                </div>

                <Textarea
                  rows={2}
                  className="mt-2"
                  value={p.mensagem}
                  onChange={(e) => atualizar(i, "mensagem", e.target.value)}
                  placeholder="Oi, {paciente}! ..."
                />
              </li>
            ))}
          </ol>
        </section>

        <label className="flex items-center gap-2.5 rounded-md border border-border bg-branco-clinico px-4 py-3">
          <input
            type="checkbox"
            checked={ativa}
            onChange={(e) => setAtiva(e.target.checked)}
            className="size-4 accent-teal"
          />
          <span className="text-sm text-cinza-texto">
            Ligar a régua agora (começa a disparar no próximo gatilho)
          </span>
        </label>

        {erro && (
          <p className="rounded-md bg-coral/10 px-3 py-2 text-sm text-coral">{erro}</p>
        )}

        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onFechar}>
            Cancelar
          </Button>
          <Button variant="marca" onClick={enviar} disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            Salvar régua
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
