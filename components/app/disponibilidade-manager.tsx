"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2, Save, Plus, Trash2, CheckCircle2, CalendarOff } from "lucide-react";
import type { Bloqueio, Disponibilidade } from "@/lib/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DIAS_SEMANA } from "@/lib/agenda";
import { cn } from "@/lib/utils";
import {
  salvarDisponibilidade,
  adicionarBloqueio,
  removerBloqueio,
} from "@/lib/actions/disponibilidade";

type DiaConfig = { ativo: boolean; inicio: string; fim: string };

export function DisponibilidadeManager({
  disponibilidadeInicial,
  bloqueiosIniciais,
}: {
  disponibilidadeInicial: Disponibilidade[];
  bloqueiosIniciais: Bloqueio[];
}) {
  const router = useRouter();

  // Monta a configuração dos 7 dias a partir dos dados existentes
  const [dias, setDias] = useState<DiaConfig[]>(() =>
    Array.from({ length: 7 }, (_, i) => {
      const existente = disponibilidadeInicial.find((d) => d.dia_semana === i);
      return existente
        ? {
            ativo: true,
            inicio: existente.hora_inicio.slice(0, 5),
            fim: existente.hora_fim.slice(0, 5),
          }
        : { ativo: false, inicio: "08:00", fim: "18:00" };
    })
  );

  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  function atualizarDia(i: number, patch: Partial<DiaConfig>) {
    setDias((atual) => atual.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
  }

  async function onSalvar() {
    setSalvando(true);
    setMsg(null);
    setErro(null);
    const itens = dias
      .map((d, i) => ({ ...d, dia_semana: i }))
      .filter((d) => d.ativo)
      .map((d) => ({ dia_semana: d.dia_semana, hora_inicio: d.inicio, hora_fim: d.fim }));

    const res = await salvarDisponibilidade(itens);
    setSalvando(false);
    if (res.ok) {
      setMsg("Disponibilidade salva!");
      router.refresh();
    } else setErro(res.erro);
  }

  return (
    <div className="mt-8 space-y-8">
      {/* Horários semanais */}
      <section className="rounded-lg border border-border bg-white shadow-soft">
        <div className="border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold text-azul-medico">
            Horários de atendimento
          </h2>
          <p className="text-sm text-cinza-suave">
            Marque os dias em que você atende e ajuste os horários.
          </p>
        </div>

        <div className="divide-y divide-border">
          {dias.map((d, i) => (
            <div
              key={i}
              className="flex flex-wrap items-center gap-4 px-6 py-3.5"
            >
              <label className="flex w-40 cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={d.ativo}
                  onChange={(e) => atualizarDia(i, { ativo: e.target.checked })}
                  className="size-4 accent-teal"
                />
                <span
                  className={cn(
                    "font-medium",
                    d.ativo ? "text-cinza-texto" : "text-cinza-suave"
                  )}
                >
                  {DIAS_SEMANA[i]}
                </span>
              </label>

              {d.ativo ? (
                <div className="flex items-center gap-2">
                  <Input
                    type="time"
                    value={d.inicio}
                    onChange={(e) => atualizarDia(i, { inicio: e.target.value })}
                    className="h-9 w-28"
                  />
                  <span className="text-cinza-suave">às</span>
                  <Input
                    type="time"
                    value={d.fim}
                    onChange={(e) => atualizarDia(i, { fim: e.target.value })}
                    className="h-9 w-28"
                  />
                </div>
              ) : (
                <span className="text-sm text-cinza-suave/70">Fechado</span>
              )}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border px-6 py-4">
          <div className="text-sm">
            {msg && (
              <span className="flex items-center gap-1.5 text-sucesso">
                <CheckCircle2 className="size-4" /> {msg}
              </span>
            )}
            {erro && <span className="text-coral">{erro}</span>}
          </div>
          <Button variant="marca" onClick={onSalvar} disabled={salvando}>
            {salvando ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            Salvar horários
          </Button>
        </div>
      </section>

      {/* Bloqueios */}
      <Bloqueios bloqueios={bloqueiosIniciais} />
    </div>
  );
}

/* ---------------------- Bloqueios de período ---------------------- */
function Bloqueios({ bloqueios }: { bloqueios: Bloqueio[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  function onAdicionar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!inicio || !fim) {
      setErro("Informe as datas de início e fim.");
      return;
    }
    startTransition(async () => {
      const res = await adicionarBloqueio({
        data_inicio: new Date(inicio).toISOString(),
        data_fim: new Date(fim).toISOString(),
        motivo,
      });
      if (res.ok) {
        setInicio("");
        setFim("");
        setMotivo("");
        router.refresh();
      } else setErro(res.erro);
    });
  }

  function onRemover(id: string) {
    startTransition(async () => {
      await removerBloqueio(id);
      router.refresh();
    });
  }

  return (
    <section className="rounded-lg border border-border bg-white shadow-soft">
      <div className="border-b border-border px-6 py-4">
        <h2 className="text-lg font-semibold text-azul-medico">
          Bloqueios de período
        </h2>
        <p className="text-sm text-cinza-suave">
          Férias, congressos ou folgas em que você não atende.
        </p>
      </div>

      <form
        onSubmit={onAdicionar}
        className="grid gap-4 border-b border-border px-6 py-4 sm:grid-cols-[1fr_1fr_1.4fr_auto] sm:items-end"
      >
        <div className="grid gap-1.5">
          <Label htmlFor="ini">Início</Label>
          <Input id="ini" type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="fim">Fim</Label>
          <Input id="fim" type="date" value={fim} onChange={(e) => setFim(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="mot">Motivo (opcional)</Label>
          <Input
            id="mot"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ex.: Férias"
          />
        </div>
        <Button type="submit" variant="teal" disabled={pending}>
          <Plus className="size-4" /> Adicionar
        </Button>
      </form>

      {erro && (
        <p className="px-6 pt-3 text-sm text-coral">{erro}</p>
      )}

      {bloqueios.length === 0 ? (
        <div className="px-6 py-10 text-center text-cinza-suave">
          <CalendarOff className="mx-auto mb-2 size-8 text-teal-claro" />
          <p className="text-sm">Nenhum bloqueio cadastrado.</p>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {bloqueios.map((b) => (
            <li key={b.id} className="flex items-center gap-3 px-6 py-3.5">
              <div className="grid size-10 place-items-center rounded-lg bg-coral/10 text-coral">
                <CalendarOff className="size-5" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-cinza-texto">
                  {format(new Date(b.data_inicio), "dd 'de' MMM", { locale: ptBR })} –{" "}
                  {format(new Date(b.data_fim), "dd 'de' MMM 'de' yyyy", { locale: ptBR })}
                </p>
                {b.motivo && <p className="text-sm text-cinza-suave">{b.motivo}</p>}
              </div>
              <button
                onClick={() => onRemover(b.id)}
                disabled={pending}
                className="grid size-9 place-items-center rounded-md text-cinza-suave transition-colors hover:bg-coral/10 hover:text-coral"
                aria-label="Remover bloqueio"
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
