"use client";

import { useMemo, useState } from "react";
import { CheckCheck, ShieldAlert } from "lucide-react";
import type { Lancamento } from "@/lib/supabase/types";
import { receberLote, registrarGlosa } from "@/lib/actions/financeiro";
import { bruto, dataDeEntrada, liquido } from "@/lib/financeiro/calculos";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { reais } from "@/components/graficos/formato";
import { Campo, CampoReais, Erro, Girando, emTexto, hojeLocal, numero, useAcao } from "./form-comum";
import { Situacao } from "./ui";
import { cn } from "@/lib/utils";

const MOTIVOS = [
  "Procedimento sem autorização prévia",
  "Guia preenchida incorretamente",
  "Carteirinha vencida ou inválida",
  "Valor acima da tabela",
  "Prazo de envio expirado",
  "Duplicidade de cobrança",
  "Outro",
];

const dataBr = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR");

export function PendentesConvenio({ lancamentos, demo }: { lancamentos: Lancamento[]; demo: boolean }) {
  const [convenio, setConvenio] = useState("");
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [dataPag, setDataPag] = useState(hojeLocal());
  const [glosa, setGlosa] = useState<Lancamento | null>(null);
  const { pending, erro, executar } = useAcao();
  const hoje = hojeLocal();

  const convenios = useMemo(() => [...new Set(lancamentos.map((l) => l.convenio || "Convênio não informado"))].sort(), [lancamentos]);
  const lista = lancamentos
    .filter((l) => !convenio || (l.convenio || "Convênio não informado") === convenio)
    .sort((a, b) => a.data_competencia.localeCompare(b.data_competencia));
  const selecionados = lista.filter((l) => marcados.has(l.id));
  const todos = lista.length > 0 && selecionados.length === lista.length;

  function alternar(id: string) {
    const n = new Set(marcados);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    setMarcados(n);
  }

  return (
    <div className="min-w-0 rounded-xl border border-border bg-white shadow-soft">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <h2 className="font-heading text-base font-semibold text-azul-medico">A receber dos convênios</h2>
          <p className="mt-0.5 text-sm text-cinza-suave">Marque o que o convênio pagou e dê baixa de uma vez. Registre a glosa do que voltou.</p>
        </div>
        <div className="w-full sm:w-56">
          <Select value={convenio} onChange={(e) => { setConvenio(e.target.value); setMarcados(new Set()); }} className="h-10" aria-label="Convênio">
            <option value="">Todos os convênios</option>
            {convenios.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>
      </header>

      {selecionados.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 border-b border-border bg-verde-menta/50 px-5 py-3">
          <p className="text-sm text-azul-medico">
            <strong>{selecionados.length}</strong> selecionado{selecionados.length > 1 ? "s" : ""} ·{" "}
            <strong className="tabular-nums">{reais(selecionados.reduce((s, l) => s + liquido(l), 0), true)}</strong>
          </p>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <label className="text-xs text-cinza-suave" htmlFor="data-lote">
              Pago em
            </label>
            <Input id="data-lote" type="date" value={dataPag} onChange={(e) => setDataPag(e.target.value)} className="h-9 w-40" />
            <Button
              type="button"
              variant="marca"
              size="sm"
              disabled={pending || demo}
              onClick={() => executar(() => receberLote(selecionados.map((l) => l.id), dataPag), () => setMarcados(new Set()))}
            >
              {pending ? <Girando /> : <CheckCheck />} Dar baixa
            </Button>
          </div>
        </div>
      )}
      {erro && (
        <div className="px-5 pt-3">
          <Erro texto={erro} />
        </div>
      )}

      {lista.length === 0 ? (
        <p className="px-6 py-12 text-center text-sm text-cinza-suave">Nada a receber de convênio. Tudo em dia.</p>
      ) : (
        <div className="max-h-[560px] overflow-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead className="sticky top-0 z-10 bg-white shadow-[0_1px_0_#E2ECEF]">
              <tr className="text-left text-[11px] uppercase tracking-wide text-cinza-suave">
                <th className="w-10 px-5 py-2.5">
                  <input
                    type="checkbox"
                    className="size-4 accent-teal"
                    checked={todos}
                    onChange={() => setMarcados(todos ? new Set() : new Set(lista.map((l) => l.id)))}
                    aria-label="Selecionar todos"
                  />
                </th>
                <th className="px-2 py-2.5 font-semibold">Atendimento</th>
                <th className="px-2 py-2.5 font-semibold">Paciente</th>
                <th className="px-2 py-2.5 font-semibold">Convênio</th>
                <th className="px-2 py-2.5 font-semibold">Previsão</th>
                <th className="px-2 py-2.5 text-right font-semibold">Valor</th>
                <th className="px-5 py-2.5 text-right font-semibold">Glosa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {lista.map((l) => {
                const prev = dataDeEntrada(l);
                return (
                  <tr key={l.id} className={cn("transition-colors", marcados.has(l.id) && "bg-verde-menta/30")}>
                    <td className="px-5 py-2.5">
                      <input type="checkbox" className="size-4 accent-teal" checked={marcados.has(l.id)} onChange={() => alternar(l.id)} aria-label={`Selecionar ${l.paciente_nome}`} />
                    </td>
                    <td className="px-2 py-2.5 tabular-nums text-cinza-suave">{dataBr(l.data_competencia)}</td>
                    <td className="max-w-[200px] truncate px-2 py-2.5 text-cinza-texto">{l.paciente_nome}</td>
                    <td className="px-2 py-2.5 text-cinza-texto">{l.convenio || "—"}</td>
                    <td className="px-2 py-2.5">
                      {prev < hoje ? <Situacao tom="critico">Atrasado {dataBr(prev).slice(0, 5)}</Situacao> : <span className="tabular-nums text-cinza-suave">{dataBr(prev)}</span>}
                    </td>
                    <td className="px-2 py-2.5 text-right font-semibold tabular-nums text-azul-medico">{reais(bruto(l), true)}</td>
                    <td className="px-5 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => setGlosa(l)}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold",
                          Number(l.glosa ?? 0) > 0 ? "bg-[#FDECEC] text-[#B91C1C]" : "text-cinza-suave hover:bg-branco-clinico hover:text-azul-medico"
                        )}
                      >
                        <ShieldAlert className="size-3.5" />
                        {Number(l.glosa ?? 0) > 0 ? reais(Number(l.glosa), true) : "Registrar"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {glosa && <GlosaDialog lancamento={glosa} demo={demo} onFechar={() => setGlosa(null)} />}
    </div>
  );
}

function GlosaDialog({ lancamento, demo, onFechar }: { lancamento: Lancamento; demo: boolean; onFechar: () => void }) {
  const [valor, setValor] = useState(emTexto(Number(lancamento.glosa ?? 0)));
  const atual = lancamento.glosa_motivo ?? "";
  const [motivo, setMotivo] = useState(MOTIVOS.includes(atual) ? atual : atual ? "Outro" : MOTIVOS[0]);
  const [outro, setOutro] = useState(MOTIVOS.includes(atual) ? "" : atual);
  const { pending, erro, executar } = useAcao();
  return (
    <Dialog open onOpenChange={(a) => !a && onFechar()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Glosa do convênio</DialogTitle>
          <DialogDescription>
            {lancamento.paciente_nome} · {lancamento.convenio} · faturado {reais(bruto(lancamento), true)}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Campo id="g-valor" rotulo="Valor glosado" dica="Zero para retirar a glosa.">
            <CampoReais id="g-valor" valor={valor} onChange={setValor} />
          </Campo>
          <Campo id="g-mot" rotulo="Motivo">
            <Select id="g-mot" value={motivo} onChange={(e) => setMotivo(e.target.value)}>
              {MOTIVOS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </Select>
          </Campo>
          {motivo === "Outro" && <Input value={outro} onChange={(e) => setOutro(e.target.value)} placeholder="Descreva o motivo" />}
          <Erro texto={erro} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onFechar}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="marca"
              disabled={pending || demo}
              onClick={() => executar(() => registrarGlosa(lancamento.id, numero(valor) || 0, motivo === "Outro" ? outro : motivo), onFechar)}
            >
              {pending && <Girando />} Salvar glosa
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
