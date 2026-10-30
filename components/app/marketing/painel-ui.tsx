"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, FileUp, Loader2, PiggyBank, Upload } from "lucide-react";
import { lerRelatorio, type LeituraRelatorio, type PlataformaMidia } from "@/lib/marketing/relatorio";
import { textoDoArquivo } from "@/lib/csv";
import { importarAnuncios, salvarOrcamentoMidia } from "@/lib/actions/midia";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CampoReais, emTexto, numero } from "@/components/app/financeiro/form-comum";
import { reais } from "@/components/graficos/formato";
import { cn } from "@/lib/utils";

const NOME: Record<PlataformaMidia, string> = { meta: "Meta Ads", google: "Google Ads" };
const dataBr = (s: string) => s.split("-").reverse().join("/");

/* ------------------------------ Importar relatório ------------------------------ */

export function ImportarRelatorio({ organizationId, demo }: { organizationId?: string; demo: boolean }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState<string | null>(null);
  const [texto, setTexto] = useState<string | null>(null);
  const [forcar, setForcar] = useState<PlataformaMidia | undefined>(undefined);
  const [erro, setErro] = useState<string | null>(null);
  const [feito, setFeito] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  const leitura: LeituraRelatorio | null = texto ? lerRelatorio(texto, forcar) : null;
  const resumo =
    leitura?.ok &&
    (() => {
      const datas = leitura.linhas.map((l) => l.data).sort();
      return {
        campanhas: new Set(leitura.linhas.map((l) => l.campanhaId)).size,
        de: datas[0],
        ate: datas[datas.length - 1],
        investimento: leitura.linhas.reduce((s, l) => s + l.investimento, 0),
        contatos: leitura.linhas.reduce((s, l) => s + l.leads + l.conversas, 0),
        cliques: leitura.linhas.reduce((s, l) => s + l.cliques, 0),
      };
    })();

  async function escolher(f: File | undefined) {
    if (!f) return;
    setErro(null);
    setFeito(null);
    setForcar(undefined);
    setNome(f.name);
    if (/\.xlsx?$/i.test(f.name)) {
      setTexto(null);
      setErro("Esse arquivo é do Excel. No Gerenciador de Anúncios ou no Google Ads, exporte em CSV.");
      return;
    }
    setTexto(await textoDoArquivo(f));
  }

  function importar() {
    if (!leitura?.ok) return;
    setErro(null);
    startTransition(async () => {
      const r = await importarAnuncios({
        organizationId,
        plataforma: leitura.plataforma,
        linhas: leitura.linhas.map(({ plataforma: _p, ...l }) => {
          void _p;
          return l;
        }),
      });
      if (!r.ok) return setErro(r.erro);
      setFeito(`${r.linhas} linhas de ${NOME[leitura.plataforma]} importadas.`);
      setTexto(null);
      setNome(null);
      router.refresh();
    });
  }

  return (
    <>
      <Button type="button" variant="marca" size="sm" onClick={() => setAberto(true)}>
        <Upload /> Importar relatório
      </Button>
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Importar relatório de anúncios</DialogTitle>
            <DialogDescription>O CSV exportado do Gerenciador de Anúncios (Meta) ou do Google Ads. Importar o mesmo período de novo atualiza os números.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 rounded-lg bg-branco-clinico p-4 text-sm text-cinza-texto sm:grid-cols-2">
            <div>
              <p className="font-semibold text-azul-medico">Meta Ads</p>
              <ol className="mt-1 list-decimal space-y-0.5 pl-4 text-xs text-cinza-suave">
                <li>Gerenciador de Anúncios › aba Campanhas</li>
                <li>Escolha o período</li>
                <li>Detalhamento › Por tempo › Dia</li>
                <li>Exportar › Exportar dados da tabela › CSV</li>
              </ol>
            </div>
            <div>
              <p className="font-semibold text-azul-medico">Google Ads</p>
              <ol className="mt-1 list-decimal space-y-0.5 pl-4 text-xs text-cinza-suave">
                <li>Campanhas › escolha o período</li>
                <li>Segmentar › Tempo › Dia</li>
                <li>Colunas com Custo, Impr., Cliques e Conversões</li>
                <li>Baixar › CSV</li>
              </ol>
            </div>
          </div>

          <input ref={input} type="file" accept=".csv,text/csv,.txt" className="hidden" onChange={(e) => escolher(e.target.files?.[0])} />
          <button
            type="button"
            onClick={() => input.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              escolher(e.dataTransfer.files?.[0]);
            }}
            className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border px-4 py-8 text-sm text-cinza-suave transition-colors hover:border-teal hover:text-azul-medico"
          >
            <FileUp className="size-7 text-teal" />
            {nome ? <span className="font-medium text-cinza-texto">{nome}</span> : "Clique ou arraste o arquivo CSV aqui"}
          </button>

          {leitura && !leitura.ok && <p className="rounded-md bg-coral/10 px-3 py-2 text-sm text-coral">{leitura.erro}</p>}
          {leitura?.ok && resumo && (
            <div className="grid gap-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-cinza-suave">Plataforma:</span>
                {(["meta", "google"] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setForcar(p)}
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-semibold",
                      leitura.plataforma === p ? "bg-azul-medico text-white" : "bg-branco-clinico text-cinza-suave hover:text-azul-medico"
                    )}
                  >
                    {NOME[p]}
                  </button>
                ))}
                <span className="text-xs text-cinza-suave">(reconhecida pelo arquivo; troque se estiver errada)</span>
              </div>
              <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  { r: "Período", v: `${dataBr(resumo.de)} a ${dataBr(resumo.ate)}` },
                  { r: "Campanhas", v: String(resumo.campanhas) },
                  { r: "Investimento", v: reais(resumo.investimento, true) },
                  { r: "Contatos", v: `${resumo.contatos} · ${resumo.cliques} cliques` },
                ].map((x) => (
                  <div key={x.r} className="rounded-lg border border-border px-3 py-2">
                    <dt className="text-[11px] text-cinza-suave">{x.r}</dt>
                    <dd className="text-sm font-semibold text-azul-medico">{x.v}</dd>
                  </div>
                ))}
              </dl>
              {leitura.avisos.map((a) => (
                <p key={a} className="flex items-start gap-2 rounded-md bg-alerta/8 px-3 py-2 text-xs text-cinza-texto">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-alerta" /> {a}
                </p>
              ))}
            </div>
          )}
          {erro && <p className="rounded-md bg-coral/10 px-3 py-2 text-sm text-coral">{erro}</p>}
          {feito && (
            <p className="flex items-center gap-2 rounded-md bg-verde-menta px-3 py-2 text-sm text-azul-medico">
              <CheckCircle2 className="size-4 text-teal" /> {feito}
            </p>
          )}
          {demo && <p className="text-xs text-cinza-suave">Na demonstração dá para ver a prévia, mas nada é salvo.</p>}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setAberto(false)}>
              Fechar
            </Button>
            <Button type="button" variant="marca" disabled={!leitura?.ok || pending || demo} onClick={importar}>
              {pending && <Loader2 className="size-4 animate-spin" />} Importar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ------------------------------ Orçamento do mês ------------------------------ */

export function OrcamentoDialog({
  organizationId,
  mes,
  atual,
  demo,
}: {
  organizationId?: string;
  mes: string;
  atual: { meta: number; google: number };
  demo: boolean;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [meta, setMeta] = useState(emTexto(atual.meta));
  const [google, setGoogle] = useState(emTexto(atual.google));
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const nomeMes = new Date(`${mes}-15T12:00:00`).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setAberto(true)}>
        <PiggyBank /> Orçamento do mês
      </Button>
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Orçamento de mídia</DialogTitle>
            <DialogDescription className="first-letter:uppercase">{nomeMes}: quanto está planejado para cada plataforma.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-medium text-cinza-texto">
              Meta Ads
              <CampoReais id="orc-meta" valor={meta} onChange={setMeta} />
            </label>
            <label className="grid gap-1.5 text-sm font-medium text-cinza-texto">
              Google Ads
              <CampoReais id="orc-google" valor={google} onChange={setGoogle} />
            </label>
          </div>
          {erro && <p className="rounded-md bg-coral/10 px-3 py-2 text-sm text-coral">{erro}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setAberto(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="marca"
              disabled={pending || demo}
              onClick={() =>
                startTransition(async () => {
                  setErro(null);
                  const r = await salvarOrcamentoMidia({ organizationId, mes, meta: numero(meta) || 0, google: numero(google) || 0 });
                  if (!r.ok) return setErro(r.erro);
                  setAberto(false);
                  router.refresh();
                })
              }
            >
              {pending && <Loader2 className="size-4 animate-spin" />} Salvar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
