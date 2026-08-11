"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, PencilLine, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { salvarIndicador } from "@/lib/actions/indicadores";
import { mesPorExtenso } from "@/lib/indicadores";
import type { IndicadorMensal } from "@/lib/supabase/types";

/** Últimos 12 meses disponíveis para lançamento, do atual para trás. */
function mesesDisponiveis(): string[] {
  const hoje = new Date();
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  });
}

/**
 * Lançamento manual dos números do mês.
 *
 * É o fallback do briefing enquanto Meta Ads, Google Ads e GA4 não estão
 * conectados: as APIs vão preencher exatamente estes mesmos campos.
 */
export function FormLancamento({
  organizationId,
  historico,
}: {
  organizationId: string;
  historico: IndicadorMensal[];
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [mes, setMes] = useState(mesesDisponiveis()[0]);
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);
  const [pending, startTransition] = useTransition();

  // Pré-preenche com o que já existe no mês escolhido
  const existente = historico.find((h) => h.mes === mes);
  const [valores, setValores] = useState({
    investimento: "",
    leads: "",
    agendamentos: "",
    comparecimentos: "",
    faturamento: "",
    observacao: "",
  });

  function trocarMes(novo: string) {
    setMes(novo);
    setSalvo(false);
    const registro = historico.find((h) => h.mes === novo);
    setValores({
      investimento: registro ? String(registro.investimento) : "",
      leads: registro ? String(registro.leads) : "",
      agendamentos: registro ? String(registro.agendamentos) : "",
      comparecimentos: registro ? String(registro.comparecimentos) : "",
      faturamento: registro ? String(registro.faturamento) : "",
      observacao: registro?.observacao ?? "",
    });
  }

  function abrir() {
    setAberto(true);
    trocarMes(mes);
  }

  function enviar() {
    setErro(null);
    setSalvo(false);
    startTransition(async () => {
      const res = await salvarIndicador({
        organizationId,
        mes,
        investimento: Number(valores.investimento || 0),
        leads: Number(valores.leads || 0),
        agendamentos: Number(valores.agendamentos || 0),
        comparecimentos: Number(valores.comparecimentos || 0),
        faturamento: Number(valores.faturamento || 0),
        observacao: valores.observacao,
      });
      if (!res.ok) {
        setErro(res.erro);
        return;
      }
      setSalvo(true);
      router.refresh();
    });
  }

  if (!aberto) {
    return (
      <Button type="button" variant="outline" onClick={abrir}>
        <PencilLine className="size-4" />
        Lançar números do mês
      </Button>
    );
  }

  const campos = [
    { chave: "investimento", label: "Investimento em marketing (R$)", modo: "decimal" },
    { chave: "leads", label: "Leads recebidos", modo: "numeric" },
    { chave: "agendamentos", label: "Consultas agendadas", modo: "numeric" },
    { chave: "comparecimentos", label: "Pacientes que compareceram", modo: "numeric" },
    { chave: "faturamento", label: "Faturamento (R$)", modo: "decimal" },
  ] as const;

  return (
    <div className="rounded-lg border border-border bg-white p-6 shadow-soft">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-heading text-lg font-semibold text-azul-medico">
            Lançar números do mês
          </h3>
          <p className="mt-1 text-sm text-cinza-suave">
            {existente
              ? `Já existe lançamento para ${mesPorExtenso(mes)}. Salvar substitui os valores.`
              : "Preencha o que aconteceu no período. Você pode ajustar depois."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAberto(false)}
          className="rounded-md p-1.5 text-cinza-suave hover:bg-verde-menta"
          aria-label="Fechar"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="grid gap-1.5">
          <Label htmlFor="mes">Mês de referência</Label>
          <Select
            id="mes"
            value={mes}
            onChange={(e) => trocarMes(e.target.value)}
          >
            {mesesDisponiveis().map((m) => (
              <option key={m} value={m}>
                {mesPorExtenso(m)}
              </option>
            ))}
          </Select>
        </div>

        {campos.map((c) => (
          <div key={c.chave} className="grid gap-1.5">
            <Label htmlFor={c.chave}>{c.label}</Label>
            <Input
              id={c.chave}
              inputMode={c.modo}
              placeholder="0"
              value={valores[c.chave]}
              onChange={(e) =>
                setValores((v) => ({ ...v, [c.chave]: e.target.value.replace(",", ".") }))
              }
            />
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-1.5">
        <Label htmlFor="observacao">Observação (opcional)</Label>
        <Textarea
          id="observacao"
          rows={2}
          placeholder="Ex.: campanha nova entrou no ar na segunda quinzena."
          value={valores.observacao}
          onChange={(e) => setValores((v) => ({ ...v, observacao: e.target.value }))}
        />
      </div>

      {erro && (
        <p className="mt-4 rounded-md bg-coral/10 px-3 py-2 text-sm text-coral">
          {erro}
        </p>
      )}
      {salvo && (
        <p className="mt-4 flex items-center gap-2 rounded-md bg-sucesso/10 px-3 py-2 text-sm text-sucesso">
          <CheckCircle2 className="size-4" /> Números salvos.
        </p>
      )}

      <div className="mt-5 flex justify-end gap-3">
        <Button type="button" variant="ghost" onClick={() => setAberto(false)}>
          Cancelar
        </Button>
        <Button type="button" variant="marca" onClick={enviar} disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          Salvar lançamento
        </Button>
      </div>
    </div>
  );
}
