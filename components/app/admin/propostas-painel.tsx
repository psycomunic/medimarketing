"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Copy,
  ExternalLink,
  Eye,
  Loader2,
  Trash2,
  Wand2,
} from "lucide-react";
import { criarProposta, removerProposta } from "@/lib/actions/propostas";
import type { PlanoProposta, Proposta } from "@/lib/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/**
 * Geração de propostas.
 *
 * Os preços vêm preenchidos com os valores de tabela porque é assim que
 * a conversa começa — e cada proposta ajusta a partir dali. Deixar os
 * campos vazios obrigaria a lembrar os números de cabeça a cada vez.
 */
const PADRAO = {
  clienteNome: "",
  clienteLogoUrl: "",
  especialidade: "",
  cidade: "",
  responsavel: "",
  precoEssencial: "1497",
  precoPerformance: "1997",
  precoFull: "",
  planoDestaque: "performance" as PlanoProposta,
  mensagem: "",
  validaAte: "",
};

const rotuloStatus: Record<string, { texto: string; cor: string }> = {
  enviada: { texto: "Enviada", cor: "bg-branco-clinico text-cinza-suave" },
  vista: { texto: "Aberta pelo cliente", cor: "bg-verde-menta text-teal" },
  aceita: { texto: "Aceita", cor: "bg-teal text-white" },
  recusada: { texto: "Recusada", cor: "bg-alerta/15 text-alerta" },
};

export function PropostasPainel({
  propostas,
  base,
  demo,
}: {
  propostas: Proposta[];
  base: string;
  demo: boolean;
}) {
  const router = useRouter();
  const [v, setV] = useState(PADRAO);
  const [erro, setErro] = useState<string | null>(null);
  const [criada, setCriada] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function campo<K extends keyof typeof PADRAO>(k: K, valor: (typeof PADRAO)[K]) {
    setV((atual) => ({ ...atual, [k]: valor }));
    setCriada(null);
  }

  /** Campo vazio significa "sob consulta", não zero. */
  const numero = (s: string) => {
    const limpo = s.replace(/[^\d,.-]/g, "").replace(",", ".");
    return limpo.trim() === "" ? null : Number(limpo);
  };

  function gerar() {
    setErro(null);
    startTransition(async () => {
      const res = await criarProposta({
        clienteNome: v.clienteNome,
        clienteLogoUrl: v.clienteLogoUrl,
        especialidade: v.especialidade,
        cidade: v.cidade,
        responsavel: v.responsavel,
        precoEssencial: numero(v.precoEssencial),
        precoPerformance: numero(v.precoPerformance),
        precoFull: numero(v.precoFull),
        planoDestaque: v.planoDestaque,
        mensagem: v.mensagem,
        validaAte: v.validaAte,
      });

      if (!res.ok) {
        setErro(res.erro);
        return;
      }
      setCriada(res.url);
      setV({ ...PADRAO });
      router.refresh();
    });
  }

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,26rem)_1fr]">
      {/* ---------- Formulário ---------- */}
      <section className="rounded-lg border border-border bg-white p-6 shadow-soft">
        <h2 className="text-lg font-semibold text-azul-medico">Nova proposta</h2>
        <p className="mt-1 text-sm text-cinza-suave">
          O link abre uma apresentação com a marca do cliente e os preços que
          você definir aqui.
        </p>

        <div className="mt-5 grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="clienteNome">Nome da clínica ou do médico</Label>
            <Input
              id="clienteNome"
              value={v.clienteNome}
              onChange={(e) => campo("clienteNome", e.target.value)}
              placeholder="Clínica Vida Derma"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="responsavel">Responsável</Label>
              <Input
                id="responsavel"
                value={v.responsavel}
                onChange={(e) => campo("responsavel", e.target.value)}
                placeholder="Dra. Helena Costa"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="especialidade">Especialidade</Label>
              <Input
                id="especialidade"
                value={v.especialidade}
                onChange={(e) => campo("especialidade", e.target.value)}
                placeholder="Dermatologia"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="cidade">Cidade</Label>
              <Input
                id="cidade"
                value={v.cidade}
                onChange={(e) => campo("cidade", e.target.value)}
                placeholder="São Paulo, SP"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="validaAte">Válida até</Label>
              <Input
                id="validaAte"
                type="date"
                value={v.validaAte}
                onChange={(e) => campo("validaAte", e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="clienteLogoUrl">Logo do cliente (endereço)</Label>
            <Input
              id="clienteLogoUrl"
              value={v.clienteLogoUrl}
              onChange={(e) => campo("clienteLogoUrl", e.target.value)}
              placeholder="https://…/logo.png"
            />
            <p className="text-xs text-cinza-suave">
              Sem logo, a capa usa a inicial do nome num selo.
            </p>
          </div>

          <fieldset className="grid gap-4 border-t border-border pt-4">
            <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-teal">
              Investimento mensal
            </legend>

            <div className="grid grid-cols-3 gap-3">
              {(
                [
                  ["precoEssencial", "Essencial"],
                  ["precoPerformance", "Performance"],
                  ["precoFull", "Full"],
                ] as const
              ).map(([chave, rotulo]) => (
                <div key={chave} className="grid gap-1.5">
                  <Label htmlFor={chave}>{rotulo}</Label>
                  <Input
                    id={chave}
                    inputMode="decimal"
                    value={v[chave]}
                    onChange={(e) => campo(chave, e.target.value)}
                    placeholder="—"
                  />
                </div>
              ))}
            </div>
            <p className="-mt-1 text-xs text-cinza-suave">
              Campo vazio aparece como “Sob consulta”.
            </p>

            <div className="grid gap-1.5">
              <Label htmlFor="planoDestaque">Plano recomendado</Label>
              <Select
                id="planoDestaque"
                value={v.planoDestaque}
                onChange={(e) =>
                  campo("planoDestaque", e.target.value as PlanoProposta)
                }
              >
                <option value="essencial">Essencial</option>
                <option value="performance">Performance</option>
                <option value="full">Full / Parceria</option>
              </Select>
            </div>
          </fieldset>

          <div className="grid gap-1.5">
            <Label htmlFor="mensagem">Mensagem da capa</Label>
            <Textarea
              id="mensagem"
              rows={3}
              value={v.mensagem}
              onChange={(e) => campo("mensagem", e.target.value)}
              placeholder="Uma frase sobre o que vocês conversaram. Em branco, usamos um texto padrão."
            />
          </div>

          <Button onClick={gerar} disabled={demo || pending}>
            {pending ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Gerando…
              </>
            ) : (
              <>
                <Wand2 className="size-4" /> Gerar link da proposta
              </>
            )}
          </Button>

          {erro && <p className="text-sm text-vermelho-alerta">{erro}</p>}
          {criada && <LinkPronto url={criada} />}
        </div>
      </section>

      {/* ---------- Lista ---------- */}
      <section className="rounded-lg border border-border bg-white shadow-soft">
        <div className="border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold text-azul-medico">
            Propostas ({propostas.length})
          </h2>
          <p className="mt-0.5 text-sm text-cinza-suave">
            O status muda sozinho quando o cliente abre e quando responde.
          </p>
        </div>

        {propostas.length === 0 ? (
          <p className="px-6 py-16 text-center text-cinza-suave">
            Nenhuma proposta gerada ainda.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {propostas.map((p) => (
              <Linha key={p.id} proposta={p} base={base} demo={demo} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function LinkPronto({ url }: { url: string }) {
  const [copiado, setCopiado] = useState(false);

  return (
    <div className="rounded-lg border border-teal/25 bg-verde-menta/60 p-4">
      <p className="text-sm font-semibold text-azul-medico">Link pronto</p>
      <p className="mt-1 break-all font-mono text-xs text-cinza-suave">{url}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="teal"
          onClick={() => {
            navigator.clipboard.writeText(url);
            setCopiado(true);
            setTimeout(() => setCopiado(false), 2000);
          }}
        >
          {copiado ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copiado ? "Copiado" : "Copiar"}
        </Button>
        <Button asChild size="sm" variant="ghost">
          <a href={url} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="size-4" /> Abrir
          </a>
        </Button>
      </div>
    </div>
  );
}

function Linha({
  proposta: p,
  base,
  demo,
}: {
  proposta: Proposta;
  base: string;
  demo: boolean;
}) {
  const router = useRouter();
  const [copiado, setCopiado] = useState(false);
  const [pending, startTransition] = useTransition();
  const url = `${base}/proposta/${p.token}`;
  const s = rotuloStatus[p.status] ?? rotuloStatus.enviada;

  return (
    <li className="flex flex-wrap items-center gap-3 px-6 py-4">
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-azul-medico">{p.cliente_nome}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-cinza-suave">
          <span>
            {new Date(p.created_at).toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
            })}
          </span>
          {[p.especialidade, p.cidade].filter(Boolean).length > 0 && (
            <span>{[p.especialidade, p.cidade].filter(Boolean).join(" · ")}</span>
          )}
          <span className="inline-flex items-center gap-1">
            <Eye className="size-3.5" />
            {p.visualizacoes}
          </span>
        </p>
      </div>

      <span
        className={cn(
          "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold",
          s.cor
        )}
      >
        {s.texto}
      </span>

      <div className="flex shrink-0 gap-1">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            navigator.clipboard.writeText(url);
            setCopiado(true);
            setTimeout(() => setCopiado(false), 2000);
          }}
          aria-label="Copiar link"
        >
          {copiado ? <Check className="size-4" /> : <Copy className="size-4" />}
        </Button>
        <Button asChild size="sm" variant="ghost" aria-label="Abrir proposta">
          <a href={url} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="size-4" />
          </a>
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={demo || pending}
          aria-label="Remover proposta"
          onClick={() =>
            startTransition(async () => {
              await removerProposta(p.id);
              router.refresh();
            })
          }
        >
          <Trash2 className="size-4 text-vermelho-alerta" />
        </Button>
      </div>
    </li>
  );
}
