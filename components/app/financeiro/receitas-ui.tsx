"use client";

import { useMemo, useState } from "react";
import { CalendarClock, Check, FileText, MoreHorizontal, Pencil, Plus, Search, Stethoscope, Trash2, Wallet } from "lucide-react";
import type { FormaPagamento, Lancamento, PrecoProcedimento } from "@/lib/supabase/types";
import { temFaixa, textoValor } from "@/lib/financeiro/precos";
import { excluirReceita, registrarRecebimento, salvarReceita } from "@/lib/actions/financeiro";
import { bruto, dataDeEntrada, liquido } from "@/lib/financeiro/calculos";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { reais } from "@/components/graficos/formato";
import { rotuloFormaPagamento } from "@/lib/rotulos";
import { Campo, CampoReais, Erro, Girando, emTexto, hojeLocal, numero, useAcao } from "./form-comum";
import { Situacao } from "./ui";
import { cn } from "@/lib/utils";
import { useAcaoFlutuante } from "@/components/app/botao-flutuante";

const FORMAS = Object.keys(rotuloFormaPagamento) as FormaPagamento[];
const dataBr = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR");

export type Opcoes = {
  profissionais: { id: string; nome: string }[];
  precos: PrecoProcedimento[];
  convenios: string[];
};

/* --------------------------- Registrar pagamento --------------------------- */

export function RecebimentoDialog({
  aberto,
  onFechar,
  lancamento,
  consultaId,
  valorSugerido,
  convenioSugerido,
  convenios = [],
  demo,
}: {
  aberto: boolean;
  onFechar: () => void;
  lancamento?: Lancamento | null;
  consultaId?: string;
  valorSugerido?: number | null;
  convenioSugerido?: string | null;
  convenios?: string[];
  demo: boolean;
}) {
  const inicialForma: FormaPagamento = lancamento?.forma_pagamento ?? (convenioSugerido ? "convenio" : "pix");
  const [v, setV] = useState({
    forma: inicialForma,
    convenio: lancamento?.convenio ?? convenioSugerido ?? "",
    valor: emTexto(lancamento ? Number(lancamento.valor) : valorSugerido ?? null),
    desconto: emTexto(lancamento ? Number(lancamento.desconto ?? 0) : 0),
    parcelas: String(lancamento?.parcelas ?? 1),
    data: hojeLocal(),
    recebido: inicialForma !== "convenio" && inicialForma !== "boleto",
  });
  const { pending, erro, setErro, executar } = useAcao();
  const set = <K extends keyof typeof v>(k: K, x: (typeof v)[K]) => setV({ ...v, [k]: x });
  const valor = numero(v.valor);
  const desconto = numero(v.desconto);

  function salvar() {
    if (!(valor >= 0) || Number.isNaN(valor)) return setErro("Valor inválido.");
    if (desconto > valor) return setErro("O desconto é maior que o valor.");
    executar(
      () =>
        registrarRecebimento({
          lancamentoId: lancamento?.id,
          consultaId,
          forma: v.forma,
          convenio: v.convenio,
          valor,
          desconto,
          parcelas: Number(v.parcelas),
          data: v.data,
          recebido: v.recebido,
        }),
      onFechar
    );
  }

  return (
    <Dialog open={aberto} onOpenChange={(a) => !a && onFechar()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar pagamento</DialogTitle>
          <DialogDescription>
            {lancamento ? `${lancamento.paciente_nome} · ${lancamento.procedimento}` : "Como o paciente pagou esta consulta."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid grid-cols-3 gap-2">
            {FORMAS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setV({ ...v, forma: f, recebido: f !== "convenio" && f !== "boleto" })}
                className={cn(
                  "rounded-lg border px-2 py-2.5 text-xs font-semibold transition-colors sm:text-sm",
                  v.forma === f ? "border-teal bg-verde-menta text-azul-medico ring-1 ring-teal" : "border-border text-cinza-suave hover:text-azul-medico"
                )}
              >
                {rotuloFormaPagamento[f]}
              </button>
            ))}
          </div>
          {v.forma === "convenio" && (
            <Campo id="r-conv" rotulo="Convênio">
              <Input id="r-conv" list="r-convs" value={v.convenio} onChange={(e) => set("convenio", e.target.value)} placeholder="Ex.: Unimed" />
              <datalist id="r-convs">
                {convenios.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </Campo>
          )}
          <div className="grid grid-cols-2 gap-4">
            <Campo id="r-valor" rotulo="Valor">
              <CampoReais id="r-valor" valor={v.valor} onChange={(x) => set("valor", x)} />
            </Campo>
            <Campo id="r-desc" rotulo="Desconto">
              <CampoReais id="r-desc" valor={v.desconto} onChange={(x) => set("desconto", x)} />
            </Campo>
            {v.forma === "cartao_credito" && (
              <Campo id="r-parc" rotulo="Parcelas">
                <Select id="r-parc" value={v.parcelas} onChange={(e) => set("parcelas", e.target.value)}>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      {n === 1 ? "À vista" : `${n}x`}
                    </option>
                  ))}
                </Select>
              </Campo>
            )}
            <Campo id="r-data" rotulo={v.recebido ? "Recebido em" : "Previsão de recebimento"}>
              <Input id="r-data" type="date" value={v.data} onChange={(e) => set("data", e.target.value)} />
            </Campo>
          </div>
          <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-border px-3 py-2.5 text-sm">
            <input type="checkbox" className="size-4 accent-teal" checked={v.recebido} onChange={(e) => set("recebido", e.target.checked)} />
            <span className="text-cinza-texto">
              O dinheiro já entrou
              <span className="block text-xs text-cinza-suave">Desmarque para convênio e boleto que ainda vão cair.</span>
            </span>
          </label>
          <div className="flex items-center justify-between rounded-lg bg-branco-clinico px-4 py-3 text-sm">
            <span className="text-cinza-suave">Total cobrado</span>
            <strong className="font-heading text-lg tabular-nums text-azul-medico">{reais(Math.max(valor - desconto, 0), true)}</strong>
          </div>
          <Erro texto={erro} />
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" onClick={onFechar}>
              Cancelar
            </Button>
            <Button type="button" variant="marca" onClick={salvar} disabled={pending || demo}>
              {pending ? <Girando /> : <Check />} Registrar
            </Button>
          </div>
          {demo && <p className="text-center text-xs text-cinza-suave">Modo demonstração: nada é salvo.</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------------------- Receita manual ---------------------------- */

export function ReceitaDialog({
  aberto,
  onFechar,
  receita,
  opcoes,
  demo,
}: {
  aberto: boolean;
  onFechar: () => void;
  receita?: Lancamento | null;
  opcoes: Opcoes;
  demo: boolean;
}) {
  const [v, setV] = useState({
    paciente: receita?.paciente_nome ?? "",
    procedimento: receita?.procedimento ?? "",
    categoria: receita?.categoria ?? "",
    valor: emTexto(receita ? Number(receita.valor) : null),
    custo: emTexto(receita ? Number(receita.custo) : null),
    desconto: emTexto(receita ? Number(receita.desconto ?? 0) : null),
    forma: (receita?.forma_pagamento ?? "pix") as FormaPagamento,
    convenio: receita?.convenio ?? "",
    competencia: receita?.data_competencia ?? hojeLocal(),
    recebido: receita ? receita.status === "recebido" : true,
    medicoId: receita?.medico_id ?? opcoes.profissionais[0]?.id ?? "",
  });
  const { pending, erro, setErro, executar } = useAcao();
  const set = <K extends keyof typeof v>(k: K, x: (typeof v)[K]) => setV({ ...v, [k]: x });
  const procedimentos = [...new Set(opcoes.precos.map((p) => p.procedimento))];

  function escolherProcedimento(nome: string) {
    const preco =
      opcoes.precos.find((p) => p.procedimento === nome && (v.forma === "convenio" ? p.convenio === v.convenio : !p.convenio)) ??
      opcoes.precos.find((p) => p.procedimento === nome);
    setV({
      ...v,
      procedimento: nome,
      categoria: preco?.categoria ?? v.categoria,
      valor: preco ? (temFaixa(preco) ? "" : emTexto(Number(preco.valor))) : v.valor,
      custo: preco ? emTexto(Number(preco.custo)) : v.custo,
    });
  }

  const precoAtual = opcoes.precos.find((p) => p.procedimento === v.procedimento && temFaixa(p));

  function salvar() {
    const valor = numero(v.valor);
    if (Number.isNaN(valor)) return setErro("Valor inválido.");
    executar(
      () =>
        salvarReceita({
          id: receita?.id,
          pacienteNome: v.paciente,
          procedimento: v.procedimento,
          categoria: v.categoria,
          valor,
          custo: numero(v.custo) || 0,
          desconto: numero(v.desconto) || 0,
          forma: v.forma,
          convenio: v.convenio,
          competencia: v.competencia,
          recebido: v.recebido,
          dataRecebimento: v.competencia,
          medicoId: v.medicoId,
        }),
      onFechar
    );
  }

  return (
    <Dialog open={aberto} onOpenChange={(a) => !a && onFechar()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{receita ? "Editar receita" : "Nova receita"}</DialogTitle>
          <DialogDescription>Para o que não passou pela agenda: um procedimento avulso, um pacote, uma venda.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo id="rc-pac" rotulo="Paciente">
              <Input id="rc-pac" value={v.paciente} onChange={(e) => set("paciente", e.target.value)} placeholder="Nome do paciente" autoFocus />
            </Campo>
            <Campo id="rc-proc" rotulo="Procedimento">
              <Input
                id="rc-proc"
                list="rc-procs"
                value={v.procedimento}
                onChange={(e) => (procedimentos.includes(e.target.value) ? escolherProcedimento(e.target.value) : set("procedimento", e.target.value))}
                placeholder="Escolha ou digite"
              />
              <datalist id="rc-procs">
                {procedimentos.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </Campo>
            <Campo id="rc-forma" rotulo="Forma de pagamento">
              <Select id="rc-forma" value={v.forma} onChange={(e) => set("forma", e.target.value as FormaPagamento)}>
                {FORMAS.map((f) => (
                  <option key={f} value={f}>
                    {rotuloFormaPagamento[f]}
                  </option>
                ))}
              </Select>
            </Campo>
            {v.forma === "convenio" ? (
              <Campo id="rc-conv" rotulo="Convênio">
                <Input id="rc-conv" list="rc-convs" value={v.convenio} onChange={(e) => set("convenio", e.target.value)} placeholder="Ex.: Unimed" />
                <datalist id="rc-convs">
                  {opcoes.convenios.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </Campo>
            ) : (
              <Campo id="rc-prof" rotulo="Profissional">
                <Select id="rc-prof" value={v.medicoId} onChange={(e) => set("medicoId", e.target.value)}>
                  <option value="">Nenhum</option>
                  {opcoes.profissionais.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                    </option>
                  ))}
                </Select>
              </Campo>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Campo id="rc-valor" rotulo="Valor" dica={precoAtual ? `Tabela: ${textoValor(precoAtual)}` : undefined}>
              <CampoReais id="rc-valor" valor={v.valor} onChange={(x) => set("valor", x)} />
            </Campo>
            <Campo id="rc-desc" rotulo="Desconto">
              <CampoReais id="rc-desc" valor={v.desconto} onChange={(x) => set("desconto", x)} />
            </Campo>
            <Campo id="rc-custo" rotulo="Custo direto" dica="Material, laboratório.">
              <CampoReais id="rc-custo" valor={v.custo} onChange={(x) => set("custo", x)} />
            </Campo>
            <Campo id="rc-data" rotulo="Data do atendimento">
              <Input id="rc-data" type="date" value={v.competencia} onChange={(e) => set("competencia", e.target.value)} />
            </Campo>
          </div>
          <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-border px-3 py-2.5 text-sm">
            <input type="checkbox" className="size-4 accent-teal" checked={v.recebido} onChange={(e) => set("recebido", e.target.checked)} />
            O dinheiro já entrou
          </label>
          <Erro texto={erro} />
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" onClick={onFechar}>
              Cancelar
            </Button>
            <Button type="button" variant="marca" onClick={salvar} disabled={pending || demo || !v.paciente.trim() || !v.procedimento.trim()}>
              {pending && <Girando />} {receita ? "Salvar" : "Adicionar receita"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------- Lista -------------------------------- */

type Filtro = "todas" | "receber" | "atrasadas" | "recebidas";

export function ListaReceitas({
  receitas,
  opcoes,
  nomes,
  demo,
}: {
  receitas: Lancamento[];
  opcoes: Opcoes;
  nomes: Record<string, string>;
  demo: boolean;
}) {
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [forma, setForma] = useState("");
  const [profissional, setProfissional] = useState("");
  const [convenio, setConvenio] = useState("");
  const [busca, setBusca] = useState("");
  const [nova, setNova] = useState(false);
  const [editar, setEditar] = useState<Lancamento | null>(null);
  const [receber, setReceber] = useState<Lancamento | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const { erro, executar } = useAcao();
  useAcaoFlutuante("fab:nova-receita", () => setNova(true));
  const hoje = hojeLocal();
  const atrasada = (l: Lancamento) => l.status === "atrasado" || (l.status === "previsto" && dataDeEntrada(l) < hoje);

  const lista = useMemo(
    () =>
      receitas
        .filter((l) => l.status !== "cancelado")
        .filter((l) =>
          filtro === "receber" ? l.status !== "recebido" : filtro === "atrasadas" ? atrasada(l) : filtro === "recebidas" ? l.status === "recebido" : true
        )
        .filter((l) => !forma || l.forma_pagamento === forma)
        .filter((l) => !profissional || (profissional === "__sem" ? !l.medico_id : l.medico_id === profissional))
        .filter((l) => !convenio || (convenio === "__particular" ? !l.convenio && l.forma_pagamento !== "convenio" : l.convenio === convenio))
        .filter((l) => {
          const t = busca.trim().toLowerCase();
          return !t || l.paciente_nome.toLowerCase().includes(t) || l.procedimento.toLowerCase().includes(t) || (l.convenio ?? "").toLowerCase().includes(t);
        })
        .sort((a, b) => b.data_competencia.localeCompare(a.data_competencia)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [receitas, filtro, forma, profissional, convenio, busca]
  );
  const total = lista.reduce((s, l) => s + bruto(l), 0);
  const cont = (f: Filtro) =>
    receitas.filter((l) =>
      l.status === "cancelado" ? false : f === "receber" ? l.status !== "recebido" : f === "atrasadas" ? atrasada(l) : f === "recebidas" ? l.status === "recebido" : true
    ).length;

  return (
    <div className="min-w-0 rounded-xl border border-border bg-white shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["todas", "Todas"],
              ["receber", "A receber"],
              ["atrasadas", "Em atraso"],
              ["recebidas", "Recebidas"],
            ] as const
          ).map(([id, r]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFiltro(id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                filtro === id ? "bg-azul-medico text-white" : "bg-branco-clinico text-cinza-suave hover:text-azul-medico"
              )}
            >
              {r}
              <span className={cn("rounded-full px-1.5 tabular-nums", filtro === id ? "bg-white/20" : "bg-white")}>{cont(id)}</span>
            </button>
          ))}
        </div>
        <Button type="button" variant="marca" size="sm" onClick={() => setNova(true)}>
          <Plus /> Nova receita
        </Button>
      </div>
      <div className="grid gap-2 border-b border-border px-4 py-3 sm:grid-cols-2 sm:px-5 xl:grid-cols-[minmax(0,1fr)_repeat(3,12rem)]">
        <div className="relative min-w-0 sm:col-span-2 xl:col-span-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-cinza-suave" />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar paciente, procedimento ou convênio" className="h-10 pl-9" />
        </div>
        {opcoes.profissionais.length > 1 && (
          <Select value={profissional} onChange={(e) => setProfissional(e.target.value)} className="h-10" aria-label="Profissional">
            <option value="">Todos os profissionais</option>
            {opcoes.profissionais.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
            <option value="__sem">Sem profissional</option>
          </Select>
        )}
        {opcoes.convenios.length > 0 && (
          <Select value={convenio} onChange={(e) => setConvenio(e.target.value)} className="h-10" aria-label="Convênio">
            <option value="">Particular e convênios</option>
            <option value="__particular">Só particular</option>
            {opcoes.convenios.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        )}
        <div>
          <Select value={forma} onChange={(e) => setForma(e.target.value)} className="h-10" aria-label="Forma de pagamento">
            <option value="">Todas as formas</option>
            {FORMAS.map((f) => (
              <option key={f} value={f}>
                {rotuloFormaPagamento[f]}
              </option>
            ))}
          </Select>
        </div>
      </div>
      {erro && (
        <div className="px-5 pt-3">
          <Erro texto={erro} />
        </div>
      )}
      {lista.length === 0 ? (
        <p className="px-6 py-12 text-center text-sm text-cinza-suave">Nenhuma receita com esses filtros no período.</p>
      ) : (
        <ul className="max-h-[640px] divide-y divide-border overflow-y-auto">
          {lista.map((l) => {
            const atraso = atrasada(l);
            return (
              <li key={l.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                <div className="hidden w-12 shrink-0 text-center sm:block">
                  <p className="font-heading text-base font-bold leading-none text-azul-medico">{l.data_competencia.slice(8, 10)}</p>
                  <p className="mt-0.5 text-[10px] uppercase tracking-wide text-cinza-suave">
                    {new Date(`${l.data_competencia}T12:00:00`).toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}
                  </p>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-cinza-texto">{l.paciente_nome}</p>
                  <p className="flex min-w-0 items-center gap-1 truncate text-xs text-cinza-suave">
                    <span className="truncate">
                      {l.procedimento}
                      {l.medico_id && nomes[l.medico_id] ? ` · ${nomes[l.medico_id]}` : ""}
                    </span>
                    {l.origem === "agenda" && <Stethoscope className="size-3 shrink-0 text-teal" aria-label="Da agenda" />}
                  </p>
                </div>
                <div className="hidden w-36 shrink-0 text-xs text-cinza-suave lg:block">
                  <p className="truncate text-cinza-texto">{l.forma_pagamento === "convenio" ? l.convenio || "Convênio" : rotuloFormaPagamento[l.forma_pagamento]}</p>
                  {Number(l.taxa ?? 0) > 0 && <p className="truncate">taxa {reais(Number(l.taxa), true)}</p>}
                  {Number(l.glosa ?? 0) > 0 && <p className="truncate text-[#B91C1C]">glosa {reais(Number(l.glosa), true)}</p>}
                </div>
                <div className="hidden shrink-0 md:block">
                  {l.status === "recebido" ? (
                    <Situacao tom="bom">Recebido</Situacao>
                  ) : atraso ? (
                    <Situacao tom="critico">Em atraso</Situacao>
                  ) : (
                    <Situacao tom="neutro">A receber {dataBr(dataDeEntrada(l)).slice(0, 5)}</Situacao>
                  )}
                </div>
                <div className="w-24 shrink-0 text-right">
                  <p className="text-sm font-semibold tabular-nums text-azul-medico">{reais(bruto(l), true)}</p>
                  {liquido(l) !== bruto(l) && <p className="text-[11px] tabular-nums text-cinza-suave">líq. {reais(liquido(l), true)}</p>}
                </div>
                <div className="relative flex shrink-0 items-center gap-1">
                  {l.status !== "recebido" && (
                    <button
                      type="button"
                      onClick={() => setReceber(l)}
                      className="hidden h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-xs font-semibold text-[#15803D] hover:border-[#15803D] hover:bg-[#E9F8EF] sm:inline-flex"
                    >
                      <Wallet className="size-3.5" /> Receber
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setMenu(menu === l.id ? null : l.id)}
                    className="grid size-8 place-items-center rounded-lg text-cinza-suave hover:bg-branco-clinico hover:text-azul-medico"
                    aria-label="Mais ações"
                  >
                    <MoreHorizontal className="size-4" />
                  </button>
                  {menu === l.id && (
                    <div className="absolute right-0 top-9 z-30 w-48 overflow-hidden rounded-lg border border-border bg-white py-1 shadow-card" onMouseLeave={() => setMenu(null)}>
                      <BotaoMenu icone={Wallet} onClick={() => { setMenu(null); setReceber(l); }}>
                        {l.status === "recebido" ? "Corrigir pagamento" : "Registrar pagamento"}
                      </BotaoMenu>
                      <BotaoMenu icone={Pencil} onClick={() => { setMenu(null); setEditar(l); }}>
                        Editar
                      </BotaoMenu>
                      {l.status === "recebido" && bruto(l) > 0 && (
                        <a
                          href={`/app/financeiro/recibo/${l.id}`}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-cinza-texto hover:bg-branco-clinico"
                        >
                          <FileText className="size-4 shrink-0" /> Recibo em PDF
                        </a>
                      )}
                      <BotaoMenu icone={Trash2} perigo onClick={() => { setMenu(null); if (confirm("Cancelar esta receita? Ela sai de todos os cálculos.")) executar(() => excluirReceita(l.id)); }}>
                        Cancelar receita
                      </BotaoMenu>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <div className="flex items-center justify-between border-t border-border bg-branco-clinico px-5 py-3 text-sm">
        <span className="flex items-center gap-1.5 text-cinza-suave">
          <CalendarClock className="size-4 text-teal" /> {lista.length} lançamento{lista.length === 1 ? "" : "s"}
        </span>
        <span className="font-semibold tabular-nums text-azul-medico">{reais(total, true)}</span>
      </div>
      {(nova || editar) && (
        <ReceitaDialog key={editar?.id ?? "nova"} aberto receita={editar} opcoes={opcoes} demo={demo} onFechar={() => { setNova(false); setEditar(null); }} />
      )}
      {receber && (
        <RecebimentoDialog key={receber.id} aberto lancamento={receber} convenios={opcoes.convenios} demo={demo} onFechar={() => setReceber(null)} />
      )}
    </div>
  );
}

function BotaoMenu({ icone: Icone, children, onClick, perigo }: { icone: typeof Check; children: React.ReactNode; onClick: () => void; perigo?: boolean }) {
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
