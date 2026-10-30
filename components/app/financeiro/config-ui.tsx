"use client";

import { useState } from "react";
import { CheckCircle2, Pencil, Plus, Trash2 } from "lucide-react";
import type { ConfigFinanceira, FormaPagamento, PrecoProcedimento } from "@/lib/supabase/types";
import { excluirPreco, salvarConfigFinanceira, salvarPreco } from "@/lib/actions/financeiro";
import { TAXAS_PADRAO } from "@/lib/financeiro/calculos";
import { temFaixa, textoDuracao, textoValor } from "@/lib/financeiro/precos";
import { rotuloFormaPagamento } from "@/lib/rotulos";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { reais } from "@/components/graficos/formato";
import { cn } from "@/lib/utils";
import { Campo, CampoReais, Erro, Girando, emTexto, numero, useAcao } from "./form-comum";
import { useAcaoFlutuante } from "@/components/app/botao-flutuante";

const FORMAS = Object.keys(rotuloFormaPagamento) as FormaPagamento[];

function CampoPct({ id, valor, onChange }: { id: string; valor: string; onChange: (v: string) => void }) {
  return (
    <div className="relative">
      <Input id={id} inputMode="decimal" value={valor} onChange={(e) => onChange(e.target.value.replace(/[^\d.,]/g, ""))} className="pr-9 tabular-nums" />
      <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-cinza-suave">%</span>
    </div>
  );
}

const pctTexto = (v: number) => String(v).replace(".", ",");
const pctNum = (v: string) => Number(v.replace(",", ".")) || 0;

export function FormConfig({ config, demo }: { config: ConfigFinanceira; demo: boolean }) {
  const [taxas, setTaxas] = useState<Record<string, string>>(
    Object.fromEntries(FORMAS.map((f) => [f, pctTexto(config.taxas?.[f] ?? TAXAS_PADRAO[f])]))
  );
  const [imposto, setImposto] = useState(pctTexto(Number(config.imposto)));
  const [reserva, setReserva] = useState(pctTexto(Number(config.reserva_glosa)));
  const [saldo, setSaldo] = useState(emTexto(Number(config.saldo_inicial)));
  const [meta, setMeta] = useState(emTexto(config.meta_lucro ? Number(config.meta_lucro) : null));
  const [salvo, setSalvo] = useState(false);
  const { pending, erro, executar } = useAcao();

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="rounded-xl border border-border bg-white p-5 shadow-soft">
        <h2 className="font-heading text-base font-semibold text-azul-medico">Taxas por forma de pagamento</h2>
        <p className="mt-0.5 text-sm text-cinza-suave">O que a maquininha ou o banco cobra. Entra sozinho em cada recebimento.</p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {FORMAS.map((f) => (
            <Campo key={f} id={`tx-${f}`} rotulo={rotuloFormaPagamento[f]}>
              <CampoPct id={`tx-${f}`} valor={taxas[f]} onChange={(v) => setTaxas({ ...taxas, [f]: v })} />
            </Campo>
          ))}
        </div>
      </section>
      <section className="rounded-xl border border-border bg-white p-5 shadow-soft">
        <h2 className="font-heading text-base font-semibold text-azul-medico">Caixa, impostos e metas</h2>
        <p className="mt-0.5 text-sm text-cinza-suave">Base do fluxo de caixa e do resultado do mês.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Campo id="cf-saldo" rotulo="Saldo em caixa hoje" dica="Bancos + dinheiro. Atualize de vez em quando.">
            <CampoReais id="cf-saldo" valor={saldo} onChange={setSaldo} />
          </Campo>
          <Campo id="cf-meta" rotulo="Meta de lucro mensal">
            <CampoReais id="cf-meta" valor={meta} onChange={setMeta} />
          </Campo>
          <Campo id="cf-imp" rotulo="Imposto sobre a receita" dica="Simples Nacional costuma ficar entre 6% e 15%.">
            <CampoPct id="cf-imp" valor={imposto} onChange={setImposto} />
          </Campo>
          <Campo id="cf-res" rotulo="Reserva para glosas" dica="Do faturamento de convênio. 5% a 10% é o usual.">
            <CampoPct id="cf-res" valor={reserva} onChange={setReserva} />
          </Campo>
        </div>
      </section>
      <div className="flex flex-wrap items-center justify-end gap-3 lg:col-span-2">
        <Erro texto={erro} />
        {salvo && !erro && (
          <span className="flex items-center gap-1.5 text-sm text-[#15803D]">
            <CheckCircle2 className="size-4" /> Configuração salva
          </span>
        )}
        <Button
          type="button"
          variant="marca"
          disabled={pending || demo}
          onClick={() => {
            setSalvo(false);
            executar(
              () =>
                salvarConfigFinanceira({
                  taxas: Object.fromEntries(FORMAS.map((f) => [f, pctNum(taxas[f])])),
                  imposto: pctNum(imposto),
                  reservaGlosa: pctNum(reserva),
                  saldoInicial: numero(saldo) || 0,
                  metaLucro: numero(meta) || null,
                }),
              () => setSalvo(true)
            );
          }}
        >
          {pending && <Girando />} Salvar configuração
        </Button>
      </div>
    </div>
  );
}

export function TabelaPrecos({ precos, demo }: { precos: PrecoProcedimento[]; demo: boolean }) {
  const [editar, setEditar] = useState<PrecoProcedimento | null>(null);
  const [novo, setNovo] = useState(false);
  const { erro, executar } = useAcao();
  useAcaoFlutuante("fab:novo-preco", () => setNovo(true));
  const grupos = new Map<string, PrecoProcedimento[]>();
  for (const p of precos) grupos.set(p.procedimento, [...(grupos.get(p.procedimento) ?? []), p]);

  return (
    <section className="min-w-0 rounded-xl border border-border bg-white shadow-soft">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <h2 className="font-heading text-base font-semibold text-azul-medico">Tabela de preços</h2>
          <p className="mt-0.5 text-sm text-cinza-suave">Valor particular e por convênio de cada procedimento, com o custo direto para calcular a margem.</p>
        </div>
        <Button type="button" variant="marca" size="sm" onClick={() => setNovo(true)}>
          <Plus /> Novo preço
        </Button>
      </header>
      {erro && (
        <div className="px-5 pt-3">
          <Erro texto={erro} />
        </div>
      )}
      {precos.length === 0 ? (
        <p className="px-6 py-12 text-center text-sm text-cinza-suave">Nenhum preço cadastrado ainda.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-cinza-suave">
                <th className="px-5 py-2.5 font-semibold">Procedimento</th>
                <th className="px-2 py-2.5 font-semibold">Tabela</th>
                <th className="px-2 py-2.5 text-right font-semibold">Valor</th>
                <th className="px-2 py-2.5 text-right font-semibold">Duração</th>
                <th className="px-2 py-2.5 text-right font-semibold">Custo</th>
                <th className="px-2 py-2.5 text-right font-semibold">Margem</th>
                <th className="w-20 px-5 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {[...grupos.entries()].map(([proc, lista]) =>
                lista
                  .sort((a, b) => (a.convenio ?? "").localeCompare(b.convenio ?? ""))
                  .map((p, i) => {
                    const margemDe = (valor: number) => `${Math.round(((valor - Number(p.custo)) / valor) * 100)}%`;
                    const margem = !Number(p.valor)
                      ? "—"
                      : temFaixa(p)
                        ? `${margemDe(Number(p.valor))} a ${margemDe(Number(p.valor_max))}`
                        : margemDe(Number(p.valor));
                    return (
                      <tr key={p.id}>
                        <td className="px-5 py-2.5">
                          {i === 0 ? (
                            <>
                              <span className="font-medium text-cinza-texto">{proc}</span>
                              {p.categoria && <span className="block text-xs text-cinza-suave">{p.categoria}</span>}
                            </>
                          ) : null}
                        </td>
                        <td className="px-2 py-2.5 text-cinza-texto">{p.convenio ?? "Particular"}</td>
                        <td className="whitespace-nowrap px-2 py-2.5 text-right font-semibold tabular-nums text-azul-medico">{textoValor(p)}</td>
                        <td className="whitespace-nowrap px-2 py-2.5 text-right tabular-nums text-cinza-suave">
                          {textoDuracao(p) ?? "—"}
                          {p.retorno_dias ? <span className="block text-[11px] text-teal">retorno {p.retorno_dias} d</span> : null}
                        </td>
                        <td className="px-2 py-2.5 text-right tabular-nums text-cinza-suave">{Number(p.custo) ? reais(Number(p.custo), true) : "—"}</td>
                        <td className="whitespace-nowrap px-2 py-2.5 text-right tabular-nums text-cinza-suave">{margem}</td>
                        <td className="px-5 py-2.5">
                          <div className="flex justify-end gap-1">
                            <button type="button" onClick={() => setEditar(p)} className="grid size-8 place-items-center rounded-lg text-cinza-suave hover:bg-branco-clinico hover:text-azul-medico" aria-label="Editar">
                              <Pencil className="size-4" />
                            </button>
                            <button
                              type="button"
                              disabled={demo}
                              onClick={() => confirm("Excluir este preço?") && executar(() => excluirPreco(p.id))}
                              className="grid size-8 place-items-center rounded-lg text-cinza-suave hover:bg-[#FDECEC] hover:text-[#B91C1C]"
                              aria-label="Excluir"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
              )}
            </tbody>
          </table>
        </div>
      )}
      {(novo || editar) && <PrecoDialog key={editar?.id ?? "novo"} preco={editar} demo={demo} onFechar={() => { setNovo(false); setEditar(null); }} />}
    </section>
  );
}

/** Chave "Fixo / Varia" ao lado do rótulo de um campo. */
function RotuloFaixa({ htmlFor, rotulo, faixa, onChange }: { htmlFor: string; rotulo: string; faixa: boolean; onChange: (f: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <label htmlFor={htmlFor} className="text-sm font-medium text-cinza-texto">
        {rotulo}
      </label>
      <div role="radiogroup" aria-label={`${rotulo}: fixo ou varia`} className="flex rounded-full bg-branco-clinico p-0.5 text-xs font-semibold">
        {[
          { f: false, r: "Fixo" },
          { f: true, r: "Varia" },
        ].map((o) => (
          <button
            key={o.r}
            type="button"
            role="radio"
            aria-checked={faixa === o.f}
            onClick={() => onChange(o.f)}
            className={cn(
              "rounded-full px-2.5 py-1 transition-colors",
              faixa === o.f ? "bg-white text-azul-medico shadow-sm" : "text-cinza-suave hover:text-azul-medico"
            )}
          >
            {o.r}
          </button>
        ))}
      </div>
    </div>
  );
}

function CampoMinutos({
  id,
  valor,
  onChange,
  placeholder,
  sufixo = "min",
}: {
  id: string;
  valor: string;
  onChange: (v: string) => void;
  placeholder?: string;
  sufixo?: string;
}) {
  return (
    <div className="relative">
      <Input id={id} inputMode="numeric" value={valor} placeholder={placeholder} onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 3))} className="pr-12 tabular-nums" />
      <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-cinza-suave">{sufixo}</span>
    </div>
  );
}

/** Dois campos lado a lado: "de [ ] até [ ]". */
function Faixa({ de, ate }: { de: React.ReactNode; ate: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
      {de}
      <span className="text-xs text-cinza-suave">até</span>
      {ate}
    </div>
  );
}

function PrecoDialog({ preco, demo, onFechar }: { preco: PrecoProcedimento | null; demo: boolean; onFechar: () => void }) {
  const [v, setV] = useState({
    procedimento: preco?.procedimento ?? "",
    categoria: preco?.categoria ?? "",
    convenio: preco?.convenio ?? "",
    valor: emTexto(preco ? Number(preco.valor) : null),
    valorMax: emTexto(preco?.valor_max != null ? Number(preco.valor_max) : null),
    custo: emTexto(preco ? Number(preco.custo) : null),
    duracao: preco?.duracao_min ? String(preco.duracao_min) : "",
    duracaoMax: preco?.duracao_max ? String(preco.duracao_max) : "",
    retorno: preco?.retorno_dias ? String(preco.retorno_dias) : "",
  });
  const [valorVaria, setValorVaria] = useState(!!preco && temFaixa(preco));
  const [duracaoVaria, setDuracaoVaria] = useState(!!preco?.duracao_max);
  const { pending, erro, setErro, executar } = useAcao();
  const set = <K extends keyof typeof v>(k: K, x: string) => setV({ ...v, [k]: x });

  function salvar() {
    const valor = numero(v.valor);
    const valorMax = numero(v.valorMax);
    const duracao = v.duracao ? Number(v.duracao) : 0;
    const duracaoMax = v.duracaoMax ? Number(v.duracaoMax) : 0;
    if (Number.isNaN(valor) || Number.isNaN(valorMax)) return setErro("Valor inválido.");
    if (valorVaria && (!valor || !valorMax)) return setErro("Preencha o valor mínimo e o máximo.");
    if (valorVaria && valorMax <= valor) return setErro("O valor máximo precisa ser maior que o mínimo.");
    if (duracaoVaria && (!duracao || !duracaoMax)) return setErro("Preencha a duração mínima e a máxima.");
    if (duracaoVaria && duracaoMax <= duracao) return setErro("A duração máxima precisa ser maior que a mínima.");
    // Só manda as colunas de faixa quando usadas ou quando havia faixa para limpar
    executar(
      () =>
        salvarPreco({
          id: preco?.id,
          procedimento: v.procedimento,
          categoria: v.categoria,
          convenio: v.convenio,
          valor: valor || 0,
          custo: numero(v.custo) || 0,
          duracao: duracao || undefined,
          valorMax: valorVaria ? valorMax : preco?.valor_max != null ? null : undefined,
          duracaoMax: duracaoVaria ? duracaoMax : preco?.duracao_max != null ? null : undefined,
          // Só manda quando preenchido ou para limpar um retorno antigo
          retornoDias: v.retorno ? Number(v.retorno) : preco?.retorno_dias != null ? null : undefined,
        }),
      onFechar
    );
  }

  return (
    <Dialog open onOpenChange={(a) => !a && onFechar()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{preco ? "Editar preço" : "Novo preço"}</DialogTitle>
          <DialogDescription>Deixe o convênio em branco para o valor particular. Se o valor ou o tempo mudam de caso para caso, marque “Varia”.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo id="p-proc" rotulo="Procedimento">
              <Input id="p-proc" value={v.procedimento} onChange={(e) => set("procedimento", e.target.value)} autoFocus />
            </Campo>
            <Campo id="p-cat" rotulo="Categoria">
              <Input id="p-cat" value={v.categoria} onChange={(e) => set("categoria", e.target.value)} placeholder="Ex.: Consultas" />
            </Campo>
            <Campo id="p-conv" rotulo="Convênio">
              <Input id="p-conv" value={v.convenio} onChange={(e) => set("convenio", e.target.value)} placeholder="Particular" />
            </Campo>
            <Campo id="p-custo" rotulo="Custo direto">
              <CampoReais id="p-custo" valor={v.custo} onChange={(x) => set("custo", x)} />
            </Campo>
          </div>

          <div className="grid gap-1.5">
            <RotuloFaixa htmlFor="p-valor" rotulo="Valor" faixa={valorVaria} onChange={setValorVaria} />
            {valorVaria ? (
              <Faixa
                de={<CampoReais id="p-valor" valor={v.valor} onChange={(x) => set("valor", x)} placeholder="mínimo" />}
                ate={<CampoReais id="p-valor-max" valor={v.valorMax} onChange={(x) => set("valorMax", x)} placeholder="máximo" />}
              />
            ) : (
              <CampoReais id="p-valor" valor={v.valor} onChange={(x) => set("valor", x)} />
            )}
            {valorVaria && <p className="text-xs text-cinza-suave">Ao lançar a receita, você informa quanto cobrou de cada paciente.</p>}
          </div>

          <div className="grid gap-1.5">
            <RotuloFaixa htmlFor="p-dur" rotulo="Duração" faixa={duracaoVaria} onChange={setDuracaoVaria} />
            {duracaoVaria ? (
              <Faixa
                de={<CampoMinutos id="p-dur" valor={v.duracao} onChange={(x) => set("duracao", x)} placeholder="mín." />}
                ate={<CampoMinutos id="p-dur-max" valor={v.duracaoMax} onChange={(x) => set("duracaoMax", x)} placeholder="máx." />}
              />
            ) : (
              <CampoMinutos id="p-dur" valor={v.duracao} onChange={(x) => set("duracao", x)} />
            )}
          </div>

          <Campo id="p-retorno" rotulo="Retorno recomendado (opcional)" dica="Em quantos dias o paciente deve voltar. Perto da data, ele aparece na lista de contatos da Retenção.">
            <CampoMinutos id="p-retorno" valor={v.retorno} onChange={(x) => set("retorno", x)} placeholder="Ex.: 30" sufixo="dias" />
          </Campo>

          <Erro texto={erro} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onFechar}>
              Cancelar
            </Button>
            <Button type="button" variant="marca" disabled={pending || demo || !v.procedimento.trim()} onClick={salvar}>
              {pending && <Girando />} Salvar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
