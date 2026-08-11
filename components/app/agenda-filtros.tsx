"use client";

import { Search, SlidersHorizontal, X } from "lucide-react";
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
  busca: string;
};

export const FILTROS_VAZIOS: FiltrosAgenda = {
  clinica: "",
  medico: "",
  status: "",
  tipo: "",
  convenio: "",
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
  },
>(consultas: T[], f: FiltrosAgenda): T[] {
  const busca = f.busca.trim().toLowerCase();

  return consultas.filter((c) => {
    if (f.clinica && c.organization_id !== f.clinica) return false;
    if (f.medico && c.medico_id !== f.medico) return false;
    if (f.status && c.status !== f.status) return false;
    if (f.tipo && c.tipo !== f.tipo) return false;
    if (f.convenio && c.convenio !== f.convenio) return false;
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
}: {
  filtros: FiltrosAgenda;
  onChange: (f: FiltrosAgenda) => void;
  opcoes: OpcoesAgenda;
  total: number;
  visiveis: number;
}) {
  const ativos = contarFiltrosAtivos(filtros);
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
    <div className="rounded-lg border border-border bg-white p-4 shadow-soft">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-azul-medico">
          <SlidersHorizontal className="size-4 text-teal" />
          Filtros
        </span>

        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-cinza-suave" />
          <Input
            value={filtros.busca}
            onChange={(e) => set("busca", e.target.value)}
            placeholder="Buscar paciente ou telefone"
            className="h-10 pl-9"
            aria-label="Buscar paciente"
          />
        </div>

        {ativos > 0 && (
          <button
            type="button"
            onClick={() => onChange(FILTROS_VAZIOS)}
            className="inline-flex items-center gap-1.5 rounded-full bg-verde-menta px-3 py-1.5 text-xs font-semibold text-azul-medico transition-colors hover:bg-teal-claro/40"
          >
            <X className="size-3.5" />
            Limpar {ativos}
          </button>
        )}
      </div>

      <div
        className={cn(
          "mt-3 grid gap-3 sm:grid-cols-2",
          multiClinica ? "lg:grid-cols-5" : "lg:grid-cols-4"
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
            {(["confirmada", "pendente", "realizada", "cancelada"] as StatusConsulta[]).map(
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
