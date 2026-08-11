"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  Ban,
  CircleUser,
  Clock,
  Plus,
  Search,
  Tag,
  X,
} from "lucide-react";
import type {
  EtapaFunil,
  LeadComContexto,
  LeadInteracao,
  Profile,
} from "@/lib/supabase/types";
import { moverEtapa } from "@/lib/actions/crm";
import {
  ETAPAS_FUNIL,
  corEtapa,
  dicaEtapa,
  nomeOrigem,
  prazoRelativo,
  rotuloEtapa,
  tempoRelativo,
} from "@/lib/rotulos";
import { formatarReais } from "@/lib/indicadores";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LeadDialog } from "@/components/app/crm/lead-dialog";
import { LeadForm } from "@/components/app/crm/lead-form";

type Filtros = {
  busca: string;
  responsavel: string;
  origem: string;
  /** "atrasados" isola quem tem tarefa vencida ou contato em atraso. */
  atencao: boolean;
};

const VAZIOS: Filtros = { busca: "", responsavel: "", origem: "", atencao: false };

/** Lead precisa de atenção: tarefa aberta ou próximo contato já vencido. */
function precisaAtencao(l: LeadComContexto): boolean {
  if (l.status !== "aberto") return false;
  if (l.tarefas_abertas > 0) return true;
  return !!l.proximo_contato && new Date(l.proximo_contato).getTime() < Date.now();
}

export function Funil({
  leads,
  interacoes,
  equipe,
  organizationId,
  demo,
}: {
  leads: LeadComContexto[];
  interacoes: LeadInteracao[];
  equipe: Profile[];
  organizationId: string | null;
  demo: boolean;
}) {
  const router = useRouter();
  const [filtros, setFiltros] = useState<Filtros>(VAZIOS);
  const [aberto, setAberto] = useState<LeadComContexto | null>(null);
  const [novoAberto, setNovoAberto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const origens = useMemo(
    () => [...new Set(leads.map((l) => l.origem).filter(Boolean))] as string[],
    [leads]
  );

  const filtrados = useMemo(() => {
    const busca = filtros.busca.trim().toLowerCase();
    return leads.filter((l) => {
      if (filtros.responsavel && l.responsavel_id !== filtros.responsavel) return false;
      if (filtros.origem && l.origem !== filtros.origem) return false;
      if (filtros.atencao && !precisaAtencao(l)) return false;
      if (busca) {
        const alvo = `${l.nome} ${l.whatsapp} ${l.email ?? ""} ${l.tags.join(" ")}`.toLowerCase();
        if (!alvo.includes(busca)) return false;
      }
      return true;
    });
  }, [leads, filtros]);

  const perdidos = filtrados.filter((l) => l.etapa_funil === "perdido");
  const ativos = filtros.busca || filtros.responsavel || filtros.origem || filtros.atencao;

  async function mover(lead: LeadComContexto, etapa: EtapaFunil) {
    setErro(null);
    const res = await moverEtapa(lead.id, etapa);
    if (!res.ok) {
      setErro(res.erro);
      return;
    }
    router.refresh();
  }

  return (
    <>
      {/* Filtros */}
      <div className="rounded-lg border border-border bg-white p-4 shadow-soft">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-cinza-suave" />
            <Input
              value={filtros.busca}
              onChange={(e) => setFiltros((f) => ({ ...f, busca: e.target.value }))}
              placeholder="Buscar por nome, WhatsApp ou tag"
              className="h-10 pl-9"
              aria-label="Buscar lead"
            />
          </div>

          <Select
            value={filtros.responsavel}
            onChange={(e) => setFiltros((f) => ({ ...f, responsavel: e.target.value }))}
            className="h-10 w-auto min-w-[170px]"
            aria-label="Filtrar por responsável"
          >
            <option value="">Todos os responsáveis</option>
            {equipe.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </Select>

          <Select
            value={filtros.origem}
            onChange={(e) => setFiltros((f) => ({ ...f, origem: e.target.value }))}
            className="h-10 w-auto min-w-[150px]"
            aria-label="Filtrar por origem"
          >
            <option value="">Todas as origens</option>
            {origens.map((o) => (
              <option key={o} value={o}>
                {nomeOrigem(o)}
              </option>
            ))}
          </Select>

          <button
            type="button"
            onClick={() => setFiltros((f) => ({ ...f, atencao: !f.atencao }))}
            className={cn(
              "inline-flex h-10 items-center gap-1.5 rounded-md border px-3 text-sm font-medium transition-colors",
              filtros.atencao
                ? "border-coral bg-coral/10 text-coral"
                : "border-border bg-white text-cinza-suave hover:text-azul-medico"
            )}
          >
            <AlertTriangle className="size-4" />
            Precisam de atenção
          </button>

          {ativos && (
            <button
              type="button"
              onClick={() => setFiltros(VAZIOS)}
              className="inline-flex items-center gap-1.5 rounded-full bg-verde-menta px-3 py-1.5 text-xs font-semibold text-azul-medico hover:bg-teal-claro/40"
            >
              <X className="size-3.5" /> Limpar
            </button>
          )}

          <Button variant="primary" size="sm" onClick={() => setNovoAberto(true)}>
            <Plus className="size-4" /> Novo lead
          </Button>
        </div>
      </div>

      {erro && (
        <p className="mt-4 rounded-md bg-coral/10 px-4 py-2.5 text-sm text-coral">{erro}</p>
      )}

      {/* Colunas do funil */}
      <div className="mt-5 grid gap-4 lg:grid-cols-5">
        {ETAPAS_FUNIL.map((etapa) => {
          const daEtapa = filtrados.filter((l) => l.etapa_funil === etapa);
          const valor = daEtapa.reduce((s, l) => s + Number(l.valor_estimado ?? 0), 0);

          return (
            <section
              key={etapa}
              className="flex min-w-0 flex-col rounded-lg border border-border bg-branco-clinico"
            >
              <header className="border-b border-border px-3 py-3">
                <div className="flex items-center gap-2">
                  <span className={cn("size-2.5 shrink-0 rounded-full", corEtapa[etapa])} />
                  <h2 className="truncate text-sm font-semibold text-azul-medico">
                    {rotuloEtapa[etapa]}
                  </h2>
                  <span className="ml-auto shrink-0 rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-cinza-suave">
                    {daEtapa.length}
                  </span>
                </div>
                <p className="mt-1 truncate text-[11px] text-cinza-suave">
                  {dicaEtapa[etapa]}
                </p>
                {valor > 0 && (
                  <p className="mt-1 text-xs font-semibold text-teal">
                    {formatarReais(valor)} em jogo
                  </p>
                )}
              </header>

              <div className="flex-1 space-y-2 p-2">
                {daEtapa.length === 0 && (
                  <p className="py-6 text-center text-xs text-cinza-suave/70">
                    Nenhum lead aqui.
                  </p>
                )}
                {daEtapa.map((l) => (
                  <CardLead
                    key={l.id}
                    lead={l}
                    onAbrir={() => setAberto(l)}
                    onAvancar={() => {
                      const i = ETAPAS_FUNIL.indexOf(etapa);
                      const proxima = ETAPAS_FUNIL[i + 1];
                      if (proxima) void mover(l, proxima);
                    }}
                    temProxima={ETAPAS_FUNIL.indexOf(etapa) < ETAPAS_FUNIL.length - 1}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {/* Perdidos ficam fora do fluxo, mas continuam acessíveis */}
      {perdidos.length > 0 && (
        <section className="mt-6 rounded-lg border border-border bg-white p-4 shadow-soft">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-azul-medico">
            <Ban className="size-4 text-cinza-suave" />
            Perdidos ({perdidos.length})
          </h2>
          <p className="mt-1 text-xs text-cinza-suave">
            Base de reativação: entram na régua de reabordagem trimestral.
          </p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {perdidos.map((l) => (
              <li key={l.id}>
                <button
                  onClick={() => setAberto(l)}
                  className="w-full rounded-md border border-border bg-branco-clinico px-3 py-2.5 text-left transition-colors hover:border-teal-claro"
                >
                  <p className="truncate text-sm font-semibold text-cinza-texto">
                    {l.nome}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-cinza-suave">
                    {l.motivo_perda ?? "Sem motivo registrado"}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Ficha do lead */}
      <LeadDialog
        lead={aberto}
        historico={aberto ? interacoes.filter((i) => i.lead_id === aberto.id) : []}
        equipe={equipe}
        demo={demo}
        onOpenChange={(o) => !o && setAberto(null)}
      />

      {/* Novo lead */}
      <LeadForm
        aberto={novoAberto}
        onOpenChange={setNovoAberto}
        equipe={equipe}
        organizationId={organizationId}
      />
    </>
  );
}

/* ------------------------------ Cartão ------------------------------ */

function CardLead({
  lead,
  onAbrir,
  onAvancar,
  temProxima,
}: {
  lead: LeadComContexto;
  onAbrir: () => void;
  onAvancar: () => void;
  temProxima: boolean;
}) {
  const prazo = lead.proximo_contato ? prazoRelativo(lead.proximo_contato) : null;
  const atencao = precisaAtencao(lead);

  return (
    <div
      className={cn(
        "group rounded-md border bg-white p-3 shadow-sm transition-colors",
        atencao ? "border-coral/40" : "border-border hover:border-teal-claro"
      )}
    >
      <button onClick={onAbrir} className="w-full text-left">
        <p className="truncate text-sm font-semibold text-cinza-texto">{lead.nome}</p>

        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-cinza-suave">
          <span className="rounded bg-verde-menta px-1.5 py-0.5 font-medium text-azul-medico">
            {nomeOrigem(lead.origem)}
          </span>
          {lead.valor_estimado ? (
            <span className="font-semibold text-teal">
              {formatarReais(Number(lead.valor_estimado))}
            </span>
          ) : null}
        </div>

        {lead.tags.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {lead.tags.slice(0, 2).map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1 rounded bg-branco-clinico px-1.5 py-0.5 text-[10px] text-cinza-suave"
              >
                <Tag className="size-2.5" />
                {t}
              </span>
            ))}
          </div>
        )}

        <div className="mt-2 space-y-1 border-t border-border pt-2 text-[11px]">
          {lead.responsavel_nome && (
            <p className="flex items-center gap-1 truncate text-cinza-suave">
              <CircleUser className="size-3 shrink-0 text-teal" />
              {lead.responsavel_nome}
            </p>
          )}
          {prazo && (
            <p
              className={cn(
                "flex items-center gap-1",
                prazo.atrasado ? "font-semibold text-coral" : "text-cinza-suave"
              )}
            >
              <Clock className="size-3 shrink-0" />
              Contato {prazo.texto}
            </p>
          )}
          {lead.tarefas_abertas > 0 && (
            <p className="flex items-center gap-1 font-semibold text-alerta">
              <AlertTriangle className="size-3 shrink-0" />
              {lead.tarefas_abertas} tarefa{lead.tarefas_abertas === 1 ? "" : "s"} aberta
              {lead.tarefas_abertas === 1 ? "" : "s"}
            </p>
          )}
          {!prazo && lead.ultima_interacao && (
            <p className="text-cinza-suave/80">
              Último registro {tempoRelativo(lead.ultima_interacao)}
            </p>
          )}
        </div>
      </button>

      {temProxima && (
        <button
          onClick={onAvancar}
          className="mt-2 flex w-full items-center justify-center gap-1 rounded border border-dashed border-border py-1 text-[11px] font-medium text-cinza-suave opacity-0 transition-opacity hover:border-teal hover:text-teal group-hover:opacity-100 focus:opacity-100"
        >
          Avançar etapa <ArrowRight className="size-3" />
        </button>
      )}
    </div>
  );
}
