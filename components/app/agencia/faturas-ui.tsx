"use client";

import { useState } from "react";
import { Check, FilePlus2, MoreHorizontal, RefreshCw, RotateCcw, XCircle } from "lucide-react";
import type { Fatura } from "@/lib/supabase/types";
import { cancelarFatura, criarFaturaAvulsa, gerarFaturasDoMes, pagarFatura, reabrirFatura } from "@/lib/actions/agencia";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { reais } from "@/components/graficos/formato";
import { Campo, CampoReais, Erro, Girando, hojeLocal, numero, useAcao } from "@/components/app/financeiro/form-comum";
import { Situacao } from "@/components/app/financeiro/ui";
import { cn } from "@/lib/utils";
import { useAcaoFlutuante } from "@/components/app/botao-flutuante";
import type { Cliente } from "./contratos-ui";

const dataBr = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR");

export function ListaFaturas({ faturas, clientes, mes, demo }: { faturas: Fatura[]; clientes: Cliente[]; mes: string; demo: boolean }) {
  const [filtro, setFiltro] = useState<"todas" | "abertas" | "vencidas" | "pagas">("todas");
  const [pagar, setPagar] = useState<Fatura | null>(null);
  const [avulsa, setAvulsa] = useState(false);
  const [menu, setMenu] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  useAcaoFlutuante("fab:cobranca-avulsa", () => setAvulsa(true));
  const { pending, erro, executar } = useAcao();
  const hoje = hojeLocal();
  const nome = (id: string) => clientes.find((c) => c.id === id)?.nome ?? "Clínica";
  const venc = (f: Fatura) => f.status === "aberta" && f.vencimento < hoje;
  const lista = faturas
    .filter((f) => f.status !== "cancelada")
    .filter((f) => (filtro === "abertas" ? f.status === "aberta" && !venc(f) : filtro === "vencidas" ? venc(f) : filtro === "pagas" ? f.status === "paga" : true))
    .sort((a, b) => a.vencimento.localeCompare(b.vencimento));

  return (
    <div className="min-w-0 rounded-xl border border-border bg-white shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["todas", "Todas"],
              ["abertas", "Em aberto"],
              ["vencidas", "Vencidas"],
              ["pagas", "Pagas"],
            ] as const
          ).map(([id, r]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFiltro(id)}
              className={cn("rounded-full px-3 py-1.5 text-xs font-semibold", filtro === id ? "bg-azul-medico text-white" : "bg-branco-clinico text-cinza-suave hover:text-azul-medico")}
            >
              {r}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending || demo}
            onClick={() => {
              setAviso(null);
              executar(
                () => gerarFaturasDoMes(mes),
                () => setAviso("Mensalidades do mês conferidas: as que faltavam foram geradas.")
              );
            }}
          >
            {pending ? <Girando /> : <RefreshCw />} Gerar mensalidades
          </Button>
          <Button type="button" variant="marca" size="sm" onClick={() => setAvulsa(true)}>
            <FilePlus2 /> Cobrança avulsa
          </Button>
        </div>
      </div>
      {(erro || aviso) && (
        <div className="px-5 pt-3">
          {erro ? <Erro texto={erro} /> : <p className="rounded-md bg-[#E9F8EF] px-3 py-2 text-sm text-[#15803D]">{aviso}</p>}
        </div>
      )}
      {lista.length === 0 ? (
        <p className="px-6 py-12 text-center text-sm text-cinza-suave">Nenhuma fatura com esse filtro neste mês.</p>
      ) : (
        <ul className="divide-y divide-border">
          {lista.map((f) => (
            <li key={f.id} className="flex items-center gap-3 px-5 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-cinza-texto">{nome(f.organization_id)}</p>
                <p className="truncate text-xs text-cinza-suave">
                  {f.descricao} · vence {dataBr(f.vencimento)}
                  {f.pago_em ? ` · paga em ${dataBr(f.pago_em)}` : ""}
                </p>
              </div>
              <div className="hidden sm:block">
                {f.status === "paga" ? (
                  <Situacao tom="bom">Paga</Situacao>
                ) : venc(f) ? (
                  <Situacao tom="critico">Vencida há {Math.round((Date.parse(hoje) - Date.parse(f.vencimento)) / 86400000)} d</Situacao>
                ) : (
                  <Situacao tom="neutro">Em aberto</Situacao>
                )}
              </div>
              <p className="w-24 shrink-0 text-right text-sm font-semibold tabular-nums text-azul-medico">{reais(Number(f.valor))}</p>
              <div className="relative flex shrink-0 items-center gap-1">
                {f.status === "aberta" && (
                  <button
                    type="button"
                    onClick={() => setPagar(f)}
                    className="hidden h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-xs font-semibold text-[#15803D] hover:border-[#15803D] hover:bg-[#E9F8EF] sm:inline-flex"
                  >
                    <Check className="size-3.5" /> Baixar
                  </button>
                )}
                <button type="button" onClick={() => setMenu(menu === f.id ? null : f.id)} className="grid size-8 place-items-center rounded-lg text-cinza-suave hover:bg-branco-clinico" aria-label="Ações">
                  <MoreHorizontal className="size-4" />
                </button>
                {menu === f.id && (
                  <div className="absolute right-0 top-9 z-30 w-44 overflow-hidden rounded-lg border border-border bg-white py-1 shadow-card" onMouseLeave={() => setMenu(null)}>
                    {f.status === "aberta" ? (
                      <BotaoMenu icone={Check} onClick={() => { setMenu(null); setPagar(f); }}>Dar baixa</BotaoMenu>
                    ) : (
                      <BotaoMenu icone={RotateCcw} onClick={() => { setMenu(null); executar(() => reabrirFatura(f.id)); }}>Reabrir</BotaoMenu>
                    )}
                    <BotaoMenu icone={XCircle} perigo onClick={() => { setMenu(null); if (confirm("Cancelar esta fatura?")) executar(() => cancelarFatura(f.id)); }}>Cancelar fatura</BotaoMenu>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center justify-between border-t border-border bg-branco-clinico px-5 py-3 text-sm">
        <span className="text-cinza-suave">{lista.length} fatura{lista.length === 1 ? "" : "s"}</span>
        <span className="font-semibold tabular-nums text-azul-medico">{reais(lista.reduce((s, f) => s + Number(f.valor), 0))}</span>
      </div>
      {pagar && <BaixaDialog fatura={pagar} nome={nome(pagar.organization_id)} demo={demo} onFechar={() => setPagar(null)} />}
      {avulsa && <AvulsaDialog clientes={clientes} demo={demo} onFechar={() => setAvulsa(false)} />}
    </div>
  );
}

function BaixaDialog({ fatura, nome, demo, onFechar }: { fatura: Fatura; nome: string; demo: boolean; onFechar: () => void }) {
  const [data, setData] = useState(hojeLocal());
  const [forma, setForma] = useState("pix");
  const { pending, erro, executar } = useAcao();
  return (
    <Dialog open onOpenChange={(a) => !a && onFechar()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Dar baixa</DialogTitle>
          <DialogDescription>
            {nome} · {reais(Number(fatura.valor))}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Campo id="bx-data" rotulo="Pago em">
            <Input id="bx-data" type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </Campo>
          <Campo id="bx-forma" rotulo="Forma">
            <Select id="bx-forma" value={forma} onChange={(e) => setForma(e.target.value)}>
              <option value="pix">Pix</option>
              <option value="boleto">Boleto</option>
              <option value="cartao">Cartão</option>
              <option value="transferencia">Transferência</option>
            </Select>
          </Campo>
          <Erro texto={erro} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onFechar}>
              Cancelar
            </Button>
            <Button type="button" variant="marca" disabled={pending || demo} onClick={() => executar(() => pagarFatura(fatura.id, data, forma), onFechar)}>
              {pending && <Girando />} Confirmar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AvulsaDialog({ clientes, demo, onFechar }: { clientes: Cliente[]; demo: boolean; onFechar: () => void }) {
  const [v, setV] = useState({ org: clientes[0]?.id ?? "", descricao: "", valor: "", vencimento: hojeLocal() });
  const { pending, erro, executar } = useAcao();
  return (
    <Dialog open onOpenChange={(a) => !a && onFechar()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Cobrança avulsa</DialogTitle>
          <DialogDescription>Um serviço extra: sessão de fotos, landing page, campanha especial.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Campo id="av-org" rotulo="Clínica">
            <Select id="av-org" value={v.org} onChange={(e) => setV({ ...v, org: e.target.value })}>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </Select>
          </Campo>
          <Campo id="av-desc" rotulo="Descrição">
            <Input id="av-desc" value={v.descricao} onChange={(e) => setV({ ...v, descricao: e.target.value })} placeholder="Ex.: Ensaio fotográfico" />
          </Campo>
          <div className="grid grid-cols-2 gap-4">
            <Campo id="av-valor" rotulo="Valor">
              <CampoReais id="av-valor" valor={v.valor} onChange={(x) => setV({ ...v, valor: x })} />
            </Campo>
            <Campo id="av-venc" rotulo="Vencimento">
              <Input id="av-venc" type="date" value={v.vencimento} onChange={(e) => setV({ ...v, vencimento: e.target.value })} />
            </Campo>
          </div>
          <Erro texto={erro} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onFechar}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="marca"
              disabled={pending || demo}
              onClick={() => executar(() => criarFaturaAvulsa({ organizationId: v.org, descricao: v.descricao, valor: numero(v.valor), vencimento: v.vencimento }), onFechar)}
            >
              {pending && <Girando />} Criar cobrança
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function BotaoMenu({ icone: Icone, children, onClick, perigo }: { icone: typeof Check; children: React.ReactNode; onClick: () => void; perigo?: boolean }) {
  return (
    <button type="button" onClick={onClick} className={cn("flex w-full items-center gap-2 px-3 py-2 text-left text-sm", perigo ? "text-[#B91C1C] hover:bg-[#FDECEC]" : "text-cinza-texto hover:bg-branco-clinico")}>
      <Icone className="size-4 shrink-0" /> {children}
    </button>
  );
}
