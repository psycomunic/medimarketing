"use client";

import { useState } from "react";
import { Check, Lock, RotateCcw, Settings2 } from "lucide-react";
import type { RegraRepasse, Repasse } from "@/lib/supabase/types";
import { fecharRepasse, pagarRepasse, reabrirRepasse, salvarRegraRepasse } from "@/lib/actions/financeiro";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { reais } from "@/components/graficos/formato";
import { Campo, CampoReais, Erro, Girando, emTexto, hojeLocal, numero, useAcao } from "./form-comum";
import { Situacao } from "./ui";
import { cn } from "@/lib/utils";

export type LinhaRepasseTela = {
  medicoId: string;
  nome: string;
  atendimentos: number;
  base: number;
  valor: number;
  regra: RegraRepasse | null;
  fechado: Repasse | null;
};

function descreverRegra(r: RegraRepasse | null) {
  if (!r) return "Sem regra definida";
  const v = r.tipo === "percentual" ? `${Number(r.valor).toLocaleString("pt-BR")}%` : `${reais(Number(r.valor), true)} por atendimento`;
  return `${v} sobre o ${r.base === "bruto" ? "valor bruto" : "líquido"}${r.so_recebido ? ", só do que já entrou" : ""}`;
}

export function TabelaRepasses({ linhas, competencia, demo }: { linhas: LinhaRepasseTela[]; competencia: string; demo: boolean }) {
  const [regra, setRegra] = useState<LinhaRepasseTela | null>(null);
  const [pagar, setPagar] = useState<Repasse | null>(null);
  const { pending, erro, executar } = useAcao();

  return (
    <div className="min-w-0 rounded-xl border border-border bg-white shadow-soft">
      <header className="border-b border-border px-5 py-4">
        <h2 className="font-heading text-base font-semibold text-azul-medico">Repasse por profissional</h2>
        <p className="mt-0.5 text-sm text-cinza-suave">
          Calculado sozinho pela regra de cada um. Feche o mês para congelar o valor e marque como pago quando transferir.
        </p>
      </header>
      {erro && (
        <div className="px-5 pt-3">
          <Erro texto={erro} />
        </div>
      )}
      {linhas.length === 0 ? (
        <p className="px-6 py-12 text-center text-sm text-cinza-suave">Nenhum atendimento com profissional neste mês.</p>
      ) : (
        <ul className="divide-y divide-border">
          {linhas.map((l) => {
            const f = l.fechado;
            const valor = f ? Number(f.valor) : l.valor;
            return (
              <li key={l.medicoId} className="grid gap-3 px-5 py-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-azul-medico font-heading text-sm font-bold text-white">
                    {l.nome.replace(/^Dra?\.\s*/i, "").split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-cinza-texto">{l.nome}</p>
                    <button type="button" onClick={() => setRegra(l)} className="flex max-w-full items-center gap-1 text-left text-xs text-cinza-suave hover:text-teal">
                      <Settings2 className="size-3.5 shrink-0" />
                      <span className="truncate">{descreverRegra(l.regra)}</span>
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 md:justify-end">
                  <div className="text-right">
                    <p className="text-[11px] uppercase tracking-wide text-cinza-suave">Atendimentos</p>
                    <p className="font-semibold tabular-nums text-cinza-texto">{f ? f.atendimentos : l.atendimentos}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] uppercase tracking-wide text-cinza-suave">Base</p>
                    <p className="font-semibold tabular-nums text-cinza-texto">{reais(f ? Number(f.base) : l.base)}</p>
                  </div>
                  <div className="min-w-[96px] text-right">
                    <p className="text-[11px] uppercase tracking-wide text-cinza-suave">Repasse</p>
                    <p className="font-heading text-lg font-bold tabular-nums text-azul-medico">{reais(valor, true)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {!f ? (
                      <>
                        <Situacao tom="neutro">Em aberto</Situacao>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={pending || demo || !l.regra}
                          title={!l.regra ? "Defina a regra primeiro" : undefined}
                          onClick={() =>
                            executar(() =>
                              fecharRepasse({ medicoId: l.medicoId, competencia, atendimentos: l.atendimentos, base: l.base, valor: l.valor })
                            )
                          }
                        >
                          <Lock /> Fechar mês
                        </Button>
                      </>
                    ) : f.status === "fechado" ? (
                      <>
                        <Situacao tom="atencao">Fechado</Situacao>
                        <Button type="button" variant="marca" size="sm" disabled={demo} onClick={() => setPagar(f)}>
                          <Check /> Pago
                        </Button>
                        <button
                          type="button"
                          onClick={() => executar(() => reabrirRepasse(f.id))}
                          className="grid size-8 place-items-center rounded-lg text-cinza-suave hover:bg-branco-clinico"
                          aria-label="Reabrir"
                          title="Reabrir"
                        >
                          <RotateCcw className="size-4" />
                        </button>
                      </>
                    ) : (
                      <Situacao tom="bom">Pago em {new Date(`${f.pago_em}T12:00:00`).toLocaleDateString("pt-BR")}</Situacao>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {regra && <RegraDialog linha={regra} demo={demo} onFechar={() => setRegra(null)} />}
      {pagar && <PagarDialog repasse={pagar} demo={demo} onFechar={() => setPagar(null)} />}
    </div>
  );
}

function RegraDialog({ linha, demo, onFechar }: { linha: LinhaRepasseTela; demo: boolean; onFechar: () => void }) {
  const r = linha.regra;
  const [tipo, setTipo] = useState<"percentual" | "fixo">(r?.tipo ?? "percentual");
  const [valor, setValor] = useState(r ? (r.tipo === "fixo" ? emTexto(Number(r.valor)) : String(r.valor)) : "40");
  const [base, setBase] = useState<"bruto" | "liquido">(r?.base ?? "liquido");
  const [soRecebido, setSoRecebido] = useState(r?.so_recebido ?? true);
  const { pending, erro, executar } = useAcao();
  return (
    <Dialog open onOpenChange={(a) => !a && onFechar()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Regra de repasse</DialogTitle>
          <DialogDescription>{linha.nome}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ["percentual", "Percentual"],
                ["fixo", "Valor por atendimento"],
              ] as const
            ).map(([id, rot]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTipo(id)}
                className={cn(
                  "rounded-lg border px-2 py-2.5 text-sm font-medium",
                  tipo === id ? "border-teal bg-verde-menta text-azul-medico ring-1 ring-teal" : "border-border text-cinza-suave"
                )}
              >
                {rot}
              </button>
            ))}
          </div>
          {tipo === "percentual" ? (
            <Campo id="rg-pct" rotulo="Percentual">
              <div className="relative">
                <Input id="rg-pct" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value.replace(/[^\d.,]/g, ""))} className="pr-9" />
                <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-cinza-suave">%</span>
              </div>
            </Campo>
          ) : (
            <Campo id="rg-fixo" rotulo="Valor por atendimento">
              <CampoReais id="rg-fixo" valor={valor} onChange={setValor} />
            </Campo>
          )}
          {tipo === "percentual" && (
            <Campo id="rg-base" rotulo="Calcular sobre">
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    ["liquido", "Líquido", "Sem taxas, glosas e custos"],
                    ["bruto", "Bruto", "Valor cobrado do paciente"],
                  ] as const
                ).map(([id, rot, d]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setBase(id)}
                    className={cn("rounded-lg border px-3 py-2 text-left", base === id ? "border-teal bg-verde-menta ring-1 ring-teal" : "border-border")}
                  >
                    <span className="block text-sm font-medium text-azul-medico">{rot}</span>
                    <span className="block text-[11px] text-cinza-suave">{d}</span>
                  </button>
                ))}
              </div>
            </Campo>
          )}
          <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-border px-3 py-2.5 text-sm">
            <input type="checkbox" className="size-4 accent-teal" checked={soRecebido} onChange={(e) => setSoRecebido(e.target.checked)} />
            Repassar só o que já entrou no caixa
          </label>
          <Erro texto={erro} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onFechar}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="marca"
              disabled={pending || demo}
              onClick={() =>
                executar(
                  () => salvarRegraRepasse({ medicoId: linha.medicoId, tipo, valor: tipo === "fixo" ? numero(valor) : Number(valor.replace(",", ".")), base, soRecebido }),
                  onFechar
                )
              }
            >
              {pending && <Girando />} Salvar regra
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PagarDialog({ repasse, demo, onFechar }: { repasse: Repasse; demo: boolean; onFechar: () => void }) {
  const [data, setData] = useState(hojeLocal());
  const { pending, erro, executar } = useAcao();
  return (
    <Dialog open onOpenChange={(a) => !a && onFechar()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Repasse pago</DialogTitle>
          <DialogDescription>{reais(Number(repasse.valor), true)}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Campo id="pg-data" rotulo="Pago em">
            <Input id="pg-data" type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </Campo>
          <Erro texto={erro} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onFechar}>
              Cancelar
            </Button>
            <Button type="button" variant="marca" disabled={pending || demo} onClick={() => executar(() => pagarRepasse(repasse.id, data), onFechar)}>
              {pending && <Girando />} Confirmar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
