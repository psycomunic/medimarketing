"use client";

import { useState } from "react";
import { ChevronDown, Search, SlidersHorizontal, X } from "lucide-react";
import type { StatusConsulta, TipoConsulta } from "@/lib/supabase/types";
import type { OpcoesAgenda } from "@/lib/supabase/queries";
import { rotuloStatus, rotuloTipo } from "@/lib/agenda";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type FiltrosAgenda = {
  clinica: string;
  medico: string;
  status: StatusConsulta | "";
  tipo: TipoConsulta | "";
  convenio: string;
  /** Nome do serviço; "__sem" = consultas sem serviço. */
  servico: string;
  busca: string;
};

export const FILTROS_VAZIOS: FiltrosAgenda = {
  clinica: "",
  medico: "",
  status: "",
  tipo: "",
  convenio: "",
  servico: "",
  busca: "",
};

export function contarFiltrosAtivos(f: FiltrosAgenda): number {
  return Object.values(f).filter((v) => v !== "").length;
}

/** Aplica os filtros a uma lista já carregada (a janela toda vem do servidor). */
export function aplicarFiltros<
  T extends {
    organization_id: string | null;
    medico_id: string;
    status: StatusConsulta;
    tipo: TipoConsulta;
    convenio: string | null;
    paciente_nome: string;
    paciente_telefone: string | null;
    servico_nome?: string | null;
  },
>(consultas: T[], f: FiltrosAgenda): T[] {
  const busca = f.busca.trim().toLowerCase();

  return consultas.filter((c) => {
    if (f.clinica && c.organization_id !== f.clinica) return false;
    if (f.medico && c.medico_id !== f.medico) return false;
    if (f.status && c.status !== f.status) return false;
    if (f.tipo && c.tipo !== f.tipo) return false;
    if (f.convenio && c.convenio !== f.convenio) return false;
    if (f.servico && (f.servico === "__sem" ? !!c.servico_nome : c.servico_nome !== f.servico)) return false;
    if (busca) {
      const alvo = `${c.paciente_nome} ${c.paciente_telefone ?? ""}`.toLowerCase();
      if (!alvo.includes(busca)) return false;
    }
    return true;
  });
}

/**
 * Barra de filtros da agenda.
 *
 * O seletor de clínica só aparece para quem enxerga mais de uma — ou seja,
 * na prática só para a equipe da Medi Marketing. Escolher uma clínica
 * restringe a lista de profissionais àquela clínica, senão o filtro de
 * médico ofereceria nomes que nunca devolvem resultado.
 */
export function AgendaFiltros({
  filtros,
  onChange,
  opcoes,
  total,
  visiveis,
  servicos = [],
}: {
  filtros: FiltrosAgenda;
  onChange: (f: FiltrosAgenda) => void;
  opcoes: OpcoesAgenda;
  total: number;
  visiveis: number;
  /** Serviços da clínica (tabela de preços e os já usados na agenda). */
  servicos?: string[];
}) {
  const ativos = contarFiltrosAtivos(filtros);
  // Filtros de lista (sem a busca): recolhidos até alguém precisar deles,
  // para o calendário do dia aparecer logo ao abrir a agenda
  const selecionados = ativos - (filtros.busca ? 1 : 0);
  const [aberto, setAberto] = useState(selecionados > 0);
  const multiClinica = opcoes.clinicas.length > 1;

  const medicos = filtros.clinica
    ? opcoes.medicos.filter((m) => m.organization_id === filtros.clinica)
    : opcoes.medicos;

  function set<K extends keyof FiltrosAgenda>(chave: K, valor: FiltrosAgenda[K]) {
    const proximo = { ...filtros, [chave]: valor };
    // Trocar de clínica invalida o médico escolhido, se ele for de outra
    if (chave === "clinica" && proximo.medico) {
      const aindaVale = opcoes.medicos.some(
        (m) => m.id === proximo.medico && (!valor || m.organization_id === valor)
      );
      if (!aindaVale) proximo.medico = "";
    }
    onChange(proximo);
  }

  return (
    <div className="rounded-xl border border-border bg-white p-2 shadow-soft">
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-cinza-suave" />
          <Input
            value={filtros.busca}
            onChange={(e) => set("busca", e.target.value)}
            placeholder="Buscar paciente ou telefone"
            className="h-10 border-transparent bg-branco-clinico pl-9 shadow-none"
            aria-label="Buscar paciente"
          />
        </div>

        <button
          type="button"
          onClick={() => setAberto((a) => !a)}
          aria-expanded={aberto}
          className={cn(
            "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-sm font-semibold transition-colors",
            selecionados > 0
              ? "border-teal bg-verde-menta text-azul-medico"
              : "border-border bg-white text-cinza-texto hover:border-teal"
          )}
        >
          <SlidersHorizontal className="size-4 text-teal" />
          <span className="hidden sm:inline">Filtros</span>
          {selecionados > 0 && (
            <span className="grid min-w-5 place-items-center rounded-full bg-teal px-1 text-[11px] text-white">{selecionados}</span>
          )}
          <ChevronDown className={cn("size-4 text-cinza-suave transition-transform", aberto && "rotate-180")} />
        </button>

        {ativos > 0 && (
          <button
            type="button"
            onClick={() => onChange(FILTROS_VAZIOS)}
            aria-label="Limpar filtros"
            title="Limpar filtros"
            className="grid size-10 shrink-0 place-items-center rounded-lg text-cinza-suave transition-colors hover:bg-verde-menta hover:text-azul-medico"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      <div
        className={cn(
          "grid grid-cols-2 gap-3 px-1",
          aberto ? "mt-3 pb-1" : "hidden",
          ["lg:grid-cols-4", "lg:grid-cols-5", "lg:grid-cols-6"][(multiClinica ? 1 : 0) + (servicos.length ? 1 : 0)]
        )}
      >
        {multiClinica && (
          <Campo label="Clínica">
            <Select
              value={filtros.clinica}
              onChange={(e) => set("clinica", e.target.value)}
              className="h-10"
              aria-label="Filtrar por clínica"
            >
              <option value="">Todas as clínicas</option>
              {opcoes.clinicas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </Select>
          </Campo>
        )}

        <Campo label="Profissional">
          <Select
            value={filtros.medico}
            onChange={(e) => set("medico", e.target.value)}
            className="h-10"
            aria-label="Filtrar por profissional"
          >
            <option value="">Todos</option>
            {medicos.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nome}
              </option>
            ))}
          </Select>
        </Campo>

        <Campo label="Status">
          <Select
            value={filtros.status}
            onChange={(e) => set("status", e.target.value as StatusConsulta | "")}
            className="h-10"
            aria-label="Filtrar por status"
          >
            <option value="">Todos</option>
            {(["confirmada", "pendente", "realizada", "cancelada", "faltou"] as StatusConsulta[]).map(
              (s) => (
                <option key={s} value={s}>
                  {rotuloStatus[s]}
                </option>
              )
            )}
          </Select>
        </Campo>

        <Campo label="Tipo">
          <Select
            value={filtros.tipo}
            onChange={(e) => set("tipo", e.target.value as TipoConsulta | "")}
            className="h-10"
            aria-label="Filtrar por tipo"
          >
            <option value="">Todos</option>
            {(["primeira", "retorno", "teleconsulta"] as TipoConsulta[]).map((t) => (
              <option key={t} value={t}>
                {rotuloTipo[t]}
              </option>
            ))}
          </Select>
        </Campo>

        {servicos.length > 0 && (
          <Campo label="Serviço">
            <Select
              value={filtros.servico}
              onChange={(e) => set("servico", e.target.value)}
              className="h-10"
              aria-label="Filtrar por serviço"
            >
              <option value="">Todos</option>
              {servicos.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
              <option value="__sem">Sem serviço</option>
            </Select>
          </Campo>
        )}

        <Campo label="Convênio">
          <Select
            value={filtros.convenio}
            onChange={(e) => set("convenio", e.target.value)}
            className="h-10"
            aria-label="Filtrar por convênio"
          >
            <option value="">Todos</option>
            {opcoes.convenios.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Campo>
      </div>

      {ativos > 0 && (
        <p className="mt-3 text-xs text-cinza-suave">
          Mostrando <strong className="text-azul-medico">{visiveis}</strong> de {total}{" "}
          consulta{total === 1 ? "" : "s"} na janela carregada.
        </p>
      )}
    </div>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-medium text-cinza-suave">{label}</span>
      {children}
    </label>
  );
}
