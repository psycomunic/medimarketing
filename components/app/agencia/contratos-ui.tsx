"use client";

import { useState } from "react";
import { MoreHorizontal, Pause, Pencil, Play, Plus, XCircle } from "lucide-react";
import type { Contrato, PlanoOrganizacao } from "@/lib/supabase/types";
import { mudarStatusContrato, salvarContrato } from "@/lib/actions/agencia";
import { PRECO_SUGERIDO, ROTULO_PLANO, fimFidelidade } from "@/lib/financeiro/agencia";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { reais } from "@/components/graficos/formato";
import { Campo, CampoReais, Erro, Girando, emTexto, hojeLocal, numero, useAcao } from "@/components/app/financeiro/form-comum";
import { Situacao } from "@/components/app/financeiro/ui";
import { cn } from "@/lib/utils";

const dataBr = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR");

export type Cliente = { id: string; nome: string; logo_url: string | null };

export function ContratoDialog({
  contrato,
  clientes,
  ocupados,
  demo,
  onFechar,
}: {
  contrato: Contrato | null;
  clientes: Cliente[];
  /** Clínicas que já têm contrato ativo (não aparecem para contrato novo). */
  ocupados: Set<string>;
  demo: boolean;
  onFechar: () => void;
}) {
  const livres = clientes.filter((c) => !ocupados.has(c.id) || c.id === contrato?.organization_id);
  const [v, setV] = useState({
    organizationId: contrato?.organization_id ?? livres[0]?.id ?? "",
    plano: (contrato?.plano ?? "performance") as PlanoOrganizacao,
    mensalidade: emTexto(contrato ? Number(contrato.mensalidade) : PRECO_SUGERIDO.performance),
    implantacao: emTexto(contrato ? Number(contrato.implantacao) : 2500),
    inicio: contrato?.inicio ?? hojeLocal(),
    fidelidade: String(contrato?.fidelidade_meses ?? 12),
    dia: String(contrato?.dia_vencimento ?? 10),
    reajuste: contrato?.reajuste ?? "IPCA",
    responsavel: contrato?.responsavel ?? "",
    observacao: contrato?.observacao ?? "",
    vigencia: hojeLocal(),
    gerarImplantacao: true,
  });
  const { pending, erro, executar } = useAcao();
  const set = <K extends keyof typeof v>(k: K, x: (typeof v)[K]) => setV({ ...v, [k]: x });
  const mudouValor = contrato && numero(v.mensalidade) !== Number(contrato.mensalidade);

  return (
    <Dialog open onOpenChange={(a) => !a && onFechar()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{contrato ? "Editar contrato" : "Novo contrato"}</DialogTitle>
          <DialogDescription>Mensalidade, implantação e fidelidade. Mudar o valor registra um upgrade ou downgrade no histórico do MRR.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo id="ct-org" rotulo="Clínica">
              <Select id="ct-org" value={v.organizationId} onChange={(e) => set("organizationId", e.target.value)} disabled={!!contrato}>
                {livres.length === 0 && <option value="">Todas as clínicas já têm contrato</option>}
                {livres.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </Select>
            </Campo>
            <Campo id="ct-resp" rotulo="Responsável na agência">
              <Input id="ct-resp" value={v.responsavel} onChange={(e) => set("responsavel", e.target.value)} placeholder="Quem cuida da conta" />
            </Campo>
          </div>

          <div className="grid gap-2">
            <span className="text-sm font-medium text-cinza-texto">Plano</span>
            <div className="grid grid-cols-3 gap-2">
              {(["essencial", "performance", "full"] as PlanoOrganizacao[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setV({ ...v, plano: p, mensalidade: contrato ? v.mensalidade : emTexto(PRECO_SUGERIDO[p]) })}
                  className={cn(
                    "rounded-lg border px-2 py-2.5 text-left transition-colors",
                    v.plano === p ? "border-teal bg-verde-menta ring-1 ring-teal" : "border-border hover:border-teal/50"
                  )}
                >
                  <span className="block text-sm font-semibold text-azul-medico">{ROTULO_PLANO[p]}</span>
                  <span className="block text-[11px] text-cinza-suave">sugestão {reais(PRECO_SUGERIDO[p])}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Campo id="ct-mens" rotulo="Mensalidade" className="col-span-2 sm:col-span-1">
              <CampoReais id="ct-mens" valor={v.mensalidade} onChange={(x) => set("mensalidade", x)} />
            </Campo>
            <Campo id="ct-impl" rotulo="Implantação" className="col-span-2 sm:col-span-1">
              <CampoReais id="ct-impl" valor={v.implantacao} onChange={(x) => set("implantacao", x)} />
            </Campo>
            <Campo id="ct-ini" rotulo="Início">
              <Input id="ct-ini" type="date" value={v.inicio} onChange={(e) => set("inicio", e.target.value)} />
            </Campo>
            <Campo id="ct-fid" rotulo="Fidelidade">
              <Select id="ct-fid" value={v.fidelidade} onChange={(e) => set("fidelidade", e.target.value)}>
                {[0, 3, 6, 12, 18, 24].map((m) => (
                  <option key={m} value={m}>
                    {m ? `${m} meses` : "Sem fidelidade"}
                  </option>
                ))}
              </Select>
            </Campo>
            <Campo id="ct-dia" rotulo="Vencimento">
              <Select id="ct-dia" value={v.dia} onChange={(e) => set("dia", e.target.value)}>
                {[1, 5, 10, 15, 20, 25].map((d) => (
                  <option key={d} value={d}>
                    Dia {d}
                  </option>
                ))}
              </Select>
            </Campo>
            <Campo id="ct-reaj" rotulo="Reajuste anual">
              <Select id="ct-reaj" value={v.reajuste} onChange={(e) => set("reajuste", e.target.value)}>
                {["IPCA", "IGP-M", "Fixo 5%", "Sem reajuste"].map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </Select>
            </Campo>
            {mudouValor && (
              <Campo id="ct-vig" rotulo="Novo valor vale a partir de" className="col-span-2">
                <Input id="ct-vig" type="date" value={v.vigencia} onChange={(e) => set("vigencia", e.target.value)} />
              </Campo>
            )}
          </div>

          {!contrato && numero(v.implantacao) > 0 && (
            <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-border px-3 py-2.5 text-sm">
              <input type="checkbox" className="size-4 accent-teal" checked={v.gerarImplantacao} onChange={(e) => set("gerarImplantacao", e.target.checked)} />
              Gerar a fatura da implantação agora
            </label>
          )}

          <Campo id="ct-obs" rotulo="Observação">
            <Textarea id="ct-obs" value={v.observacao} onChange={(e) => set("observacao", e.target.value)} className="min-h-[56px]" />
          </Campo>
          <Erro texto={erro} />
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" onClick={onFechar}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="marca"
              disabled={pending || demo || !v.organizationId}
              onClick={() =>
                executar(
                  () =>
                    salvarContrato({
                      id: contrato?.id,
                      organizationId: v.organizationId,
                      plano: v.plano,
                      mensalidade: numero(v.mensalidade) || 0,
                      implantacao: numero(v.implantacao) || 0,
                      inicio: v.inicio,
                      fidelidadeMeses: Number(v.fidelidade),
                      diaVencimento: Number(v.dia),
                      reajuste: v.reajuste,
                      responsavel: v.responsavel,
                      observacao: v.observacao,
                      vigencia: v.vigencia,
                      gerarImplantacao: v.gerarImplantacao,
                    }),
                  onFechar
                )
              }
            >
              {pending && <Girando />} {contrato ? "Salvar contrato" : "Criar contrato"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StatusDialog({
  contrato,
  acao,
  nome,
  demo,
  onFechar,
}: {
  contrato: Contrato;
  acao: "pausar" | "reativar" | "cancelar";
  nome: string;
  demo: boolean;
  onFechar: () => void;
}) {
  const [data, setData] = useState(hojeLocal());
  const [motivo, setMotivo] = useState("");
  const { pending, erro, executar } = useAcao();
  const titulo = { pausar: "Pausar contrato", reativar: "Reativar contrato", cancelar: "Cancelar contrato" }[acao];
  const motivos = ["Corte de custos", "Resultado abaixo do esperado", "Mudou de agência", "Fechou a clínica", "Mudou de cidade", "Outro"];
  return (
    <Dialog open onOpenChange={(a) => !a && onFechar()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>
            {nome} · {reais(Number(contrato.mensalidade))}/mês
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Campo id="st-data" rotulo="A partir de">
            <Input id="st-data" type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </Campo>
          {acao !== "reativar" && (
            <Campo id="st-mot" rotulo="Motivo">
              <Select id="st-mot" value={motivo} onChange={(e) => setMotivo(e.target.value)}>
                <option value="">Selecione…</option>
                {motivos.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </Select>
            </Campo>
          )}
          {acao === "cancelar" && (
            <p className="rounded-lg bg-[#FFF8EB] px-3 py-2 text-xs text-cinza-texto">
              As mensalidades em aberto com vencimento depois dessa data são canceladas. O cancelamento entra no churn do mês.
            </p>
          )}
          <Erro texto={erro} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onFechar}>
              Voltar
            </Button>
            <Button
              type="button"
              variant={acao === "cancelar" ? "primary" : "marca"}
              disabled={pending || demo || (acao === "cancelar" && !motivo)}
              onClick={() => executar(() => mudarStatusContrato({ id: contrato.id, acao, data, motivo }), onFechar)}
            >
              {pending && <Girando />} Confirmar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ListaContratos({ contratos, clientes, demo }: { contratos: Contrato[]; clientes: Cliente[]; demo: boolean }) {
  const [editar, setEditar] = useState<Contrato | null>(null);
  const [novo, setNovo] = useState(false);
  const [status, setStatus] = useState<{ c: Contrato; acao: "pausar" | "reativar" | "cancelar" } | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<"ativos" | "todos">("ativos");
  const nome = (id: string) => clientes.find((c) => c.id === id)?.nome ?? "Clínica";
  const ocupados = new Set(contratos.filter((c) => c.status !== "cancelado").map((c) => c.organization_id));
  const hoje = hojeLocal();
  const lista = contratos
    .filter((c) => filtro === "todos" || c.status !== "cancelado")
    .sort((a, b) => Number(b.mensalidade) - Number(a.mensalidade));

  return (
    <div className="min-w-0 rounded-xl border border-border bg-white shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
        <div className="flex gap-1.5">
          {(
            [
              ["ativos", "Em vigor"],
              ["todos", "Todos, com cancelados"],
            ] as const
          ).map(([id, r]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFiltro(id)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-semibold",
                filtro === id ? "bg-azul-medico text-white" : "bg-branco-clinico text-cinza-suave hover:text-azul-medico"
              )}
            >
              {r}
            </button>
          ))}
        </div>
        <Button type="button" variant="marca" size="sm" onClick={() => setNovo(true)}>
          <Plus /> Novo contrato
        </Button>
      </div>
      {lista.length === 0 ? (
        <p className="px-6 py-12 text-center text-sm text-cinza-suave">Nenhum contrato ainda. Cadastre o primeiro para o MRR começar a aparecer.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-cinza-suave">
                <th className="px-5 py-2.5 font-semibold">Clínica</th>
                <th className="px-2 py-2.5 font-semibold">Plano</th>
                <th className="px-2 py-2.5 text-right font-semibold">Mensalidade</th>
                <th className="px-2 py-2.5 font-semibold">Início</th>
                <th className="px-2 py-2.5 font-semibold">Fidelidade até</th>
                <th className="px-2 py-2.5 font-semibold">Situação</th>
                <th className="w-12 px-5 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {lista.map((c) => {
                const fim = fimFidelidade(c);
                const proximo = c.status === "ativo" && fim >= hoje && fim <= new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);
                return (
                  <tr key={c.id} className={c.status === "cancelado" ? "opacity-60" : undefined}>
                    <td className="px-5 py-3">
                      <p className="font-medium text-cinza-texto">{nome(c.organization_id)}</p>
                      {c.responsavel && <p className="text-xs text-cinza-suave">{c.responsavel}</p>}
                    </td>
                    <td className="px-2 py-3 text-cinza-texto">{ROTULO_PLANO[c.plano] ?? c.plano}</td>
                    <td className="px-2 py-3 text-right font-semibold tabular-nums text-azul-medico">{reais(Number(c.mensalidade))}</td>
                    <td className="px-2 py-3 tabular-nums text-cinza-suave">{dataBr(c.inicio)}</td>
                    <td className="px-2 py-3 tabular-nums text-cinza-suave">
                      {c.fidelidade_meses ? dataBr(fim) : "—"}
                      {proximo && <span className="ml-1.5 text-[11px] font-semibold text-[#B45309]">renovar</span>}
                    </td>
                    <td className="px-2 py-3">
                      {c.status === "ativo" ? (
                        <Situacao tom="bom">Ativo</Situacao>
                      ) : c.status === "pausado" ? (
                        <Situacao tom="atencao">Pausado</Situacao>
                      ) : (
                        <span title={c.motivo_saida ?? undefined}>
                          <Situacao tom="neutro">Cancelado {c.cancelado_em ? dataBr(c.cancelado_em).slice(3) : ""}</Situacao>
                        </span>
                      )}
                    </td>
                    <td className="relative px-5 py-3">
                      {c.status !== "cancelado" && (
                        <>
                          <button
                            type="button"
                            onClick={() => setMenu(menu === c.id ? null : c.id)}
                            className="grid size-8 place-items-center rounded-lg text-cinza-suave hover:bg-branco-clinico hover:text-azul-medico"
                            aria-label="Ações"
                          >
                            <MoreHorizontal className="size-4" />
                          </button>
                          {menu === c.id && (
                            <div className="absolute right-5 top-11 z-30 w-44 overflow-hidden rounded-lg border border-border bg-white py-1 shadow-card" onMouseLeave={() => setMenu(null)}>
                              <Item icone={Pencil} onClick={() => { setMenu(null); setEditar(c); }}>Editar</Item>
                              {c.status === "ativo" ? (
                                <Item icone={Pause} onClick={() => { setMenu(null); setStatus({ c, acao: "pausar" }); }}>Pausar</Item>
                              ) : (
                                <Item icone={Play} onClick={() => { setMenu(null); setStatus({ c, acao: "reativar" }); }}>Reativar</Item>
                              )}
                              <Item icone={XCircle} perigo onClick={() => { setMenu(null); setStatus({ c, acao: "cancelar" }); }}>Cancelar</Item>
                            </div>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {(novo || editar) && (
        <ContratoDialog key={editar?.id ?? "novo"} contrato={editar} clientes={clientes} ocupados={ocupados} demo={demo} onFechar={() => { setNovo(false); setEditar(null); }} />
      )}
      {status && <StatusDialog contrato={status.c} acao={status.acao} nome={nome(status.c.organization_id)} demo={demo} onFechar={() => setStatus(null)} />}
    </div>
  );
}

function Item({ icone: Icone, children, onClick, perigo }: { icone: typeof Pencil; children: React.ReactNode; onClick: () => void; perigo?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("flex w-full items-center gap-2 px-3 py-2 text-left text-sm", perigo ? "text-[#B91C1C] hover:bg-[#FDECEC]" : "text-cinza-texto hover:bg-branco-clinico")}
    >
      <Icone className="size-4 shrink-0" /> {children}
    </button>
  );
}
