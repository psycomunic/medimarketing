"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CloudOff,
  Loader2,
  Paperclip,
  Plus,
  Printer,
  Send,
  Trash2,
} from "lucide-react";
import { enviarFormulario, salvarRascunho } from "@/lib/actions/formularios";
import {
  autorizarAnexoLink,
  enviarFormularioLink,
  removerAnexoLink,
  salvarRascunhoLink,
} from "@/lib/actions/formulario-link";
import { createClient } from "@/lib/supabase/client";
import {
  etapaCompleta,
  linhasMensais,
  linhasTabela,
  numeracao,
  pendencias,
  progresso,
  substituirClinica,
  valorMensal,
  valorTexto,
  type Anexo,
  type CampoMensal,
  type CampoTabela,
  type CampoTexto,
  type LinhaTabela,
  type Respostas,
  type SchemaFormulario,
} from "@/lib/formularios/tipos";
import type { FormularioResposta } from "@/lib/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  BUCKET_ANEXOS,
  CabecalhoEtapa,
  CapaFormulario,
  CartaoEtapa,
  LinkAnexo,
} from "@/components/app/formularios/comum";
import { rotuloMes } from "@/lib/formularios/formato";
import { LeituraFormulario } from "@/components/app/formularios/leitura";
import { cn } from "@/lib/utils";

type Dados = {
  nome: string;
  cargo: string;
  data: string;
  respostas: Respostas;
};

type EstadoSalvamento =
  | "salvo"
  | "pendente"
  | "salvando"
  | "erro"
  | "conflito"
  | "travado"
  | "demo";

/** Espera depois da última tecla antes de gravar. */
const DEBOUNCE = 1500;
const MAX_ARQUIVO = 10 * 1024 * 1024;
const TIPOS_ARQUIVO = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
  "image/png",
  "image/jpeg",
];

function hoje(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function chaveCopia(id: string) {
  return `formulario:${id}`;
}

/**
 * Preenchimento do formulário pela clínica.
 *
 * Salva sozinho: 1,5 s depois da última tecla, ao trocar de etapa e ao
 * sair da aba. Enquanto o servidor não confirma, uma cópia fica no
 * navegador — se a conexão cair no meio de uma resposta longa, o texto
 * volta ao reabrir a página.
 */
export function PreenchimentoFormulario({
  resposta,
  schema,
  clinica,
  demo,
  token,
}: {
  resposta: FormularioResposta;
  schema: SchemaFormulario;
  clinica: string;
  demo: boolean;
  /** Preenchimento pelo link público: grava pelo token, sem sessão. */
  token?: string;
}) {
  const router = useRouter();
  const [dados, setDados] = useState<Dados>(() => ({
    nome: resposta.respondente_nome ?? "",
    cargo: resposta.respondente_cargo ?? "",
    data: resposta.data_referencia ?? hoje(),
    respostas: resposta.respostas ?? {},
  }));
  const [etapa, setEtapa] = useState(0);
  const [estado, setEstado] = useState<EstadoSalvamento>(demo ? "demo" : "salvo");
  const [salvoEm, setSalvoEm] = useState<Date | null>(null);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);
  const [enviando, startEnvio] = useTransition();

  const versao = useRef(resposta.updated_at);
  const dadosRef = useRef(dados);
  const sujo = useRef(false);
  const emVoo = useRef(false);
  const tentativas = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const primeiraRenderizacao = useRef(true);
  const salvarRef = useRef<() => Promise<void>>(async () => {});

  const guardarCopia = useCallback(
    (d: Dados) => {
      try {
        localStorage.setItem(
          chaveCopia(resposta.id),
          JSON.stringify({ base: versao.current, dados: d })
        );
      } catch {
        // Navegador sem armazenamento: segue só com o servidor
      }
    },
    [resposta.id]
  );

  const apagarCopia = useCallback(() => {
    try {
      localStorage.removeItem(chaveCopia(resposta.id));
    } catch {}
  }, [resposta.id]);

  const agendar = useCallback((ms: number) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void salvarRef.current(), ms);
  }, []);

  const salvar = useCallback(async () => {
    clearTimeout(timer.current);
    if (demo || !sujo.current) return;
    if (emVoo.current) return; // ao terminar, o voo atual confere `sujo` de novo

    emVoo.current = true;
    sujo.current = false;
    setEstado("salvando");
    const d = dadosRef.current;

    let res: Awaited<ReturnType<typeof salvarRascunho>>;
    try {
      const input = {
        respondenteNome: d.nome,
        respondenteCargo: d.cargo,
        dataReferencia: d.data,
        respostas: d.respostas,
      };
      res = token
        ? await salvarRascunhoLink(token, versao.current, input)
        : await salvarRascunho(resposta.id, versao.current, input);
    } catch {
      res = { ok: false, erro: "Sem conexão com o servidor." };
    }
    emVoo.current = false;

    if (res.ok) {
      versao.current = res.versao;
      tentativas.current = 0;
      setSalvoEm(new Date());
      setErroSalvar(null);
      if (sujo.current) {
        // Digitou durante o voo: a cópia precisa apontar para a versão nova
        guardarCopia(dadosRef.current);
        setEstado("pendente");
        agendar(300);
      } else {
        apagarCopia();
        setEstado("salvo");
      }
      return;
    }

    sujo.current = true;
    setErroSalvar(res.erro);
    if (res.conflito) return setEstado("conflito");
    if (res.travado) return setEstado("travado");

    setEstado("erro");
    const espera = Math.min(30_000, 2000 * 2 ** tentativas.current);
    tentativas.current += 1;
    agendar(espera);
  }, [demo, resposta.id, token, agendar, apagarCopia, guardarCopia]);

  salvarRef.current = salvar;

  // Recupera o que ficou no navegador sem chegar ao servidor — mas só se
  // foi escrito em cima desta mesma versão. Se outra pessoa salvou
  // depois, a cópia é mais velha que o banco e é descartada.
  useEffect(() => {
    if (demo) return;
    try {
      const bruto = localStorage.getItem(chaveCopia(resposta.id));
      if (!bruto) return;
      const copia = JSON.parse(bruto) as { base: string; dados: Dados };
      if (copia.base === resposta.updated_at && copia.dados) {
        setDados(copia.dados);
      } else {
        localStorage.removeItem(chaveCopia(resposta.id));
      }
    } catch {}
  }, [demo, resposta.id, resposta.updated_at]);

  useEffect(() => {
    dadosRef.current = dados;
    if (primeiraRenderizacao.current) {
      primeiraRenderizacao.current = false;
      return;
    }
    if (demo) return;
    sujo.current = true;
    guardarCopia(dados);
    setEstado((e) => (e === "conflito" || e === "travado" ? e : "pendente"));
    agendar(DEBOUNCE);
  }, [dados, demo, agendar, guardarCopia]);

  // Sair da aba ou fechar o celular: grava o que estiver pendente
  useEffect(() => {
    const aoEsconder = () => {
      if (document.visibilityState === "hidden") void salvarRef.current();
    };
    const aoSair = (e: BeforeUnloadEvent) => {
      if (sujo.current || emVoo.current) {
        void salvarRef.current();
        e.preventDefault();
      }
    };
    document.addEventListener("visibilitychange", aoEsconder);
    window.addEventListener("beforeunload", aoSair);
    return () => {
      document.removeEventListener("visibilitychange", aoEsconder);
      window.removeEventListener("beforeunload", aoSair);
      clearTimeout(timer.current);
    };
  }, []);

  const bloqueado = estado === "conflito" || estado === "travado";

  function atualizarResposta(id: string, valor: unknown) {
    if (bloqueado) return;
    setDados((d) => ({ ...d, respostas: { ...d.respostas, [id]: valor } }));
  }

  function atualizarAnexos(campo: string, lista: Anexo[]) {
    setDados((d) => ({
      ...d,
      respostas: { ...d.respostas, anexos: { ...(d.respostas.anexos ?? {}), [campo]: lista } },
    }));
  }

  function irPara(i: number, campo?: string) {
    void salvar();
    setEtapa(i);
    requestAnimationFrame(() => {
      const alvo = campo ? document.getElementById(`campo-${campo}`) : document.getElementById("topo-etapas");
      alvo?.scrollIntoView({ behavior: "smooth", block: campo ? "center" : "start" });
      if (campo) (alvo?.querySelector("textarea,input") as HTMLElement | null)?.focus();
    });
  }

  function enviar() {
    setErroEnvio(null);
    startEnvio(async () => {
      // Antes de mudar o status, garante que a última tecla chegou ao banco
      while (emVoo.current) await new Promise((r) => setTimeout(r, 100));
      sujo.current = true;
      await salvar();
      if (sujo.current) {
        setErroEnvio("Não foi possível salvar as últimas alterações. Confira a conexão e tente de novo.");
        return;
      }
      const res = token ? await enviarFormularioLink(token) : await enviarFormulario(resposta.id);
      if (!res.ok) {
        setErroEnvio(res.erro);
        return;
      }
      apagarCopia();
      setConfirmando(false);
      router.refresh();
    });
  }

  const pct = useMemo(() => progresso(schema, dados.respostas), [schema, dados.respostas]);
  const faltando = useMemo(() => pendencias(schema, dados.respostas), [schema, dados.respostas]);
  const nums = useMemo(() => numeracao(schema), [schema]);
  const atual = schema.etapas[etapa];
  const ultima = etapa === schema.etapas.length - 1;

  return (
    <>
      <div className="print:hidden">
        <CapaFormulario schema={schema} clinica={clinica}>
          <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-border pt-6">
            <Button type="button" variant="outline" size="sm" onClick={() => window.print()}>
              <Printer /> Imprimir ou salvar PDF
            </Button>
            <IndicadorSalvamento estado={estado} salvoEm={salvoEm} />
          </div>
          <p className="mt-4 rounded-lg bg-verde-menta/70 px-4 py-3 text-sm leading-relaxed text-azul-medico">
            {schema.aviso}
          </p>
        </CapaFormulario>

        {bloqueado && (
          <div
            role="alert"
            className="mt-6 flex flex-col gap-3 rounded-lg border border-alerta/40 bg-alerta/10 p-4 text-sm text-cinza-texto sm:flex-row sm:items-center sm:justify-between"
          >
            <p className="flex gap-2">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-alerta" />
              <span>
                {estado === "conflito"
                  ? "Outra pessoa da clínica salvou este diagnóstico enquanto você editava. Para não apagar o que ela escreveu, paramos de salvar aqui. Copie o que digitou nos últimos segundos, se precisar, e recarregue."
                  : "Este diagnóstico já foi enviado por outra pessoa da clínica e não aceita mais alterações."}
              </span>
            </p>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                apagarCopia();
                window.location.reload();
              }}
            >
              Recarregar
            </Button>
          </div>
        )}

        <section className="mt-8 grid gap-4 rounded-[1.25rem] border border-border bg-white p-5 shadow-soft sm:grid-cols-[1.4fr_1fr_auto] md:p-6">
          <div className="grid gap-1.5">
            <Label htmlFor="respondente-nome">Responsável pelas respostas</Label>
            <Input
              id="respondente-nome"
              value={dados.nome}
              disabled={bloqueado}
              onChange={(e) => setDados((d) => ({ ...d, nome: e.target.value }))}
              placeholder="Nome"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="respondente-cargo">Cargo</Label>
            <Input
              id="respondente-cargo"
              value={dados.cargo}
              disabled={bloqueado}
              onChange={(e) => setDados((d) => ({ ...d, cargo: e.target.value }))}
              placeholder="Seu cargo"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="respondente-data">Data</Label>
            <Input
              id="respondente-data"
              type="date"
              value={dados.data}
              disabled={bloqueado}
              onChange={(e) => setDados((d) => ({ ...d, data: e.target.value }))}
            />
          </div>
        </section>

        {/* Progresso e navegação entre etapas */}
        <div id="topo-etapas" className="mt-8 scroll-mt-20">
          <div className="flex items-center justify-between gap-4 text-sm">
            <span className="font-semibold text-azul-medico">{pct}% preenchido</span>
            <span className="text-cinza-suave">
              Etapa {etapa + 1} de {schema.etapas.length}
            </span>
          </div>
          <div
            className="mt-2 h-2 overflow-hidden rounded-full bg-verde-menta"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Progresso do preenchimento"
          >
            <div className="h-full rounded-full bg-teal transition-all" style={{ width: `${pct}%` }} />
          </div>

          <nav aria-label="Etapas" className="mt-5 flex flex-wrap gap-x-5 gap-y-2">
            {schema.etapas.map((e, i) => {
              const completa = etapaCompleta(schema, dados.respostas, e);
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => irPara(i)}
                  aria-current={i === etapa ? "step" : undefined}
                  className={cn(
                    "inline-flex items-center gap-1.5 border-b-2 pb-1.5 text-sm transition-colors",
                    i === etapa
                      ? "border-teal font-semibold text-azul-medico"
                      : "border-transparent text-cinza-suave hover:text-azul-medico"
                  )}
                >
                  <span className="tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                  {e.rotulo}
                  {completa && <Check className="size-3.5 text-teal" aria-label="completa" />}
                </button>
              );
            })}
          </nav>
        </div>

        <CartaoEtapa className="mt-6">
          <CabecalhoEtapa indice={etapa} titulo={atual.titulo} instrucao={atual.instrucao} />

          <div className="mt-6 grid gap-9">
            {atual.campos.map((campo) => {
              if (campo.tipo === "texto") {
                return (
                  <PerguntaTexto
                    key={campo.id}
                    campo={campo}
                    numero={nums.get(campo.id) ?? 0}
                    clinica={clinica}
                    valor={valorTexto(dados.respostas, campo.id)}
                    aoMudar={(v) => atualizarResposta(campo.id, v)}
                    desabilitado={bloqueado}
                  >
                    {campo.anexos && (
                      <CampoAnexos
                        lista={dados.respostas.anexos?.[campo.id] ?? []}
                        pasta={`${resposta.organization_id}/${resposta.id}`}
                        aoMudar={(l) => atualizarAnexos(campo.id, l)}
                        demo={demo}
                        token={token}
                        desabilitado={bloqueado}
                      />
                    )}
                  </PerguntaTexto>
                );
              }
              if (campo.tipo === "tabela") {
                return (
                  <TabelaEditavel
                    key={campo.id}
                    campo={campo}
                    linhas={linhasTabela(dados.respostas, campo)}
                    aoMudar={(l) => atualizarResposta(campo.id, l)}
                    desabilitado={bloqueado}
                  />
                );
              }
              return (
                <TabelaMensalEditavel
                  key={campo.id}
                  schema={schema}
                  campo={campo}
                  respostas={dados.respostas}
                  aoMudar={(v) => atualizarResposta(campo.id, v)}
                  desabilitado={bloqueado}
                />
              );
            })}
          </div>

          {atual.nota_final && (
            <p className="mt-8 text-sm leading-relaxed text-cinza-suave">{atual.nota_final}</p>
          )}
        </CartaoEtapa>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={() => irPara(etapa - 1)}
            disabled={etapa === 0}
          >
            <ArrowLeft /> Etapa anterior
          </Button>
          {ultima ? (
            <Button
              type="button"
              variant="primary"
              onClick={() => setConfirmando(true)}
              disabled={bloqueado}
            >
              <Send /> Enviar diagnóstico
            </Button>
          ) : (
            <Button type="button" onClick={() => irPara(etapa + 1)}>
              Próxima etapa <ArrowRight />
            </Button>
          )}
        </div>
      </div>

      {/* Impressão: todas as etapas em sequência, sem botões */}
      <div className="hidden print:block">
        <CapaFormulario schema={schema} clinica={clinica} />
        <p className="mt-6 text-sm">
          Responsável: <strong>{dados.nome || "—"}</strong>
          {dados.cargo && ` · ${dados.cargo}`} · {dados.data.split("-").reverse().join("/")}
        </p>
        <div className="mt-8">
          <LeituraFormulario
            schema={schema}
            respostas={dados.respostas}
            clinica={clinica}
            demo={demo}
            token={token}
          />
        </div>
      </div>

      <Dialog open={confirmando} onOpenChange={(v) => !enviando && setConfirmando(v)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Enviar o diagnóstico?</DialogTitle>
            <DialogDescription>
              Depois de enviado, ele fica disponível só para leitura. Para corrigir algo, a
              MediMarketing reabre para vocês.
            </DialogDescription>
          </DialogHeader>

          {faltando.length > 0 ? (
            <div className="text-sm">
              <p className="font-semibold text-azul-medico">
                {faltando.length === 1
                  ? "1 item ficou em branco:"
                  : `${faltando.length} itens ficaram em branco:`}
              </p>
              <ul className="mt-2 grid gap-1">
                {faltando.map((p) => (
                  <li key={p.campo}>
                    <button
                      type="button"
                      className="text-left text-teal underline-offset-2 hover:underline"
                      onClick={() => {
                        setConfirmando(false);
                        irPara(schema.etapas.findIndex((e) => e.id === p.etapa), p.campo);
                      }}
                    >
                      {substituirClinica(p.titulo, clinica)}
                    </button>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-cinza-suave">
                Pode enviar assim mesmo: os itens em branco aparecem como “não informado”.
              </p>
            </div>
          ) : (
            <p className="text-sm text-cinza-suave">Todas as perguntas foram respondidas.</p>
          )}

          {erroEnvio && <p className="text-sm text-coral">{erroEnvio}</p>}

          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setConfirmando(false)} disabled={enviando}>
              Continuar preenchendo
            </Button>
            <Button type="button" variant="primary" onClick={enviar} disabled={enviando || demo}>
              {enviando ? <Loader2 className="animate-spin" /> : <Send />}
              {demo ? "Indisponível na demonstração" : "Enviar diagnóstico"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function IndicadorSalvamento({
  estado,
  salvoEm,
}: {
  estado: EstadoSalvamento;
  salvoEm: Date | null;
}) {
  const hora = salvoEm?.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const mapa: Record<EstadoSalvamento, { texto: string; icone?: React.ReactNode; cor: string }> = {
    demo: { texto: "Modo demonstração: nada é salvo", cor: "text-cinza-suave" },
    salvo: {
      texto: hora ? `Salvo às ${hora}` : "Respostas salvas no painel",
      icone: <Check className="size-3.5" />,
      cor: "text-teal",
    },
    pendente: { texto: "Alterações não salvas", cor: "text-cinza-suave" },
    salvando: { texto: "Salvando…", icone: <Loader2 className="size-3.5 animate-spin" />, cor: "text-cinza-suave" },
    erro: {
      texto: "Não foi possível salvar. Tentando de novo…",
      icone: <CloudOff className="size-3.5" />,
      cor: "text-coral",
    },
    conflito: { texto: "Salvamento pausado", icone: <AlertTriangle className="size-3.5" />, cor: "text-alerta" },
    travado: { texto: "Diagnóstico já enviado", icone: <AlertTriangle className="size-3.5" />, cor: "text-alerta" },
  };
  const m = mapa[estado];
  return (
    <span aria-live="polite" className={cn("inline-flex items-center gap-1.5 text-xs font-medium", m.cor)}>
      {m.icone}
      {m.texto}
    </span>
  );
}

function PerguntaTexto({
  campo,
  numero,
  clinica,
  valor,
  aoMudar,
  desabilitado,
  children,
}: {
  campo: CampoTexto;
  numero: number;
  clinica: string;
  valor: string;
  aoMudar: (v: string) => void;
  desabilitado: boolean;
  children?: React.ReactNode;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  // O campo cresce com o texto: resposta longa não fica escondida atrás de rolagem
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(96, el.scrollHeight + 2)}px`;
  }, [valor]);

  const idAjuda = campo.ajuda ? `ajuda-${campo.id}` : undefined;

  return (
    <div id={`campo-${campo.id}`} className="scroll-mt-24">
      <label htmlFor={`resposta-${campo.id}`} className="block text-base font-semibold leading-snug text-azul-medico">
        <span className="tabular-nums">{numero}.</span> {substituirClinica(campo.pergunta, clinica)}
      </label>
      {campo.ajuda && (
        <p id={idAjuda} className="mt-1.5 text-sm leading-relaxed text-cinza-suave">
          {substituirClinica(campo.ajuda, clinica)}
        </p>
      )}
      <textarea
        ref={ref}
        id={`resposta-${campo.id}`}
        aria-describedby={idAjuda}
        value={valor}
        disabled={desabilitado}
        onChange={(e) => aoMudar(e.target.value)}
        placeholder="Digite sua resposta aqui"
        className="mt-3 block min-h-24 w-full resize-none overflow-hidden rounded-md border border-input bg-branco-clinico px-4 py-3 text-base leading-relaxed text-cinza-texto shadow-sm transition-colors placeholder:text-cinza-suave/70 focus-visible:border-teal focus-visible:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-60 md:text-[15px]"
      />
      {children}
    </div>
  );
}

const celula =
  "h-10 w-full min-w-0 rounded-md border border-input bg-white px-3 text-base text-cinza-texto shadow-sm placeholder:text-cinza-suave/60 focus-visible:border-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-60 md:text-sm";

function TabelaEditavel({
  campo,
  linhas,
  aoMudar,
  desabilitado,
}: {
  campo: CampoTabela;
  linhas: LinhaTabela[];
  aoMudar: (l: LinhaTabela[]) => void;
  desabilitado: boolean;
}) {
  function mudar(i: number, coluna: string, valor: string) {
    aoMudar(linhas.map((l, j) => (j === i ? { ...l, [coluna]: valor } : l)));
  }
  function adicionar() {
    const nova: LinhaTabela = { rotulo: "" };
    for (const c of campo.colunas) nova[c.id] = "";
    aoMudar([...linhas, nova]);
  }
  function remover(i: number) {
    aoMudar(linhas.filter((_, j) => j !== i));
  }

  const rotulo = (l: LinhaTabela, i: number, classe?: string) =>
    campo.rotulo_editavel ? (
      <input
        className={cn(celula, "font-medium", classe)}
        value={l.rotulo}
        disabled={desabilitado}
        aria-label={`${campo.rotulo}, linha ${i + 1}`}
        placeholder="Nome do serviço"
        onChange={(e) => mudar(i, "rotulo", e.target.value)}
      />
    ) : (
      <span className="font-medium text-cinza-texto">{l.rotulo}</span>
    );

  const botaoRemover = (i: number, l: LinhaTabela) =>
    campo.permite_linhas && (
      <button
        type="button"
        onClick={() => remover(i)}
        disabled={desabilitado}
        className="grid size-9 shrink-0 place-items-center rounded-md text-cinza-suave hover:bg-coral/10 hover:text-coral"
        aria-label={`Remover ${l.rotulo || `linha ${i + 1}`}`}
      >
        <Trash2 className="size-4" />
      </button>
    );

  return (
    <div id={`campo-${campo.id}`} className="scroll-mt-24">
      {/* Desktop: tabela */}
      <div className="hidden md:block">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-verde-menta/60 text-left text-azul-medico">
              <th className="w-[34%] border border-border px-3 py-2.5 font-semibold">{campo.rotulo}</th>
              {campo.colunas.map((c) => (
                <th key={c.id} className="border border-border px-3 py-2.5 font-semibold">
                  {c.titulo}
                </th>
              ))}
              {campo.permite_linhas && <th className="w-12 border border-border" aria-label="Ações" />}
            </tr>
          </thead>
          <tbody>
            {linhas.map((l, i) => (
              <tr key={i}>
                <td className="border border-border px-2 py-2">{rotulo(l, i)}</td>
                {campo.colunas.map((c) => (
                  <td key={c.id} className="border border-border px-2 py-2">
                    <input
                      className={celula}
                      value={l[c.id] ?? ""}
                      disabled={desabilitado}
                      aria-label={`${l.rotulo || `Linha ${i + 1}`}: ${c.titulo}`}
                      placeholder="Preencher"
                      onChange={(e) => mudar(i, c.id, e.target.value)}
                    />
                  </td>
                ))}
                {campo.permite_linhas && (
                  <td className="border border-border px-1 text-center">{botaoRemover(i, l)}</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Celular: um cartão por linha */}
      <div className="grid gap-3 md:hidden">
        {linhas.map((l, i) => (
          <div key={i} className="rounded-lg border border-border p-4">
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1">{rotulo(l, i)}</div>
              {botaoRemover(i, l)}
            </div>
            <div className="mt-3 grid gap-3">
              {campo.colunas.map((c) => (
                <label key={c.id} className="grid gap-1 text-xs font-medium text-cinza-suave">
                  {c.titulo}
                  <input
                    className={celula}
                    value={l[c.id] ?? ""}
                    disabled={desabilitado}
                    placeholder="Preencher"
                    onChange={(e) => mudar(i, c.id, e.target.value)}
                  />
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      {campo.permite_linhas && (
        <Button type="button" variant="ghost" size="sm" className="mt-3" onClick={adicionar} disabled={desabilitado}>
          <Plus /> Adicionar linha
        </Button>
      )}
      {campo.nota && <p className="mt-3 text-sm leading-relaxed text-cinza-suave">{campo.nota}</p>}
    </div>
  );
}

function TabelaMensalEditavel({
  schema,
  campo,
  respostas,
  aoMudar,
  desabilitado,
}: {
  schema: SchemaFormulario;
  campo: CampoMensal;
  respostas: Respostas;
  aoMudar: (v: ReturnType<typeof valorMensal>) => void;
  desabilitado: boolean;
}) {
  const valor = valorMensal(respostas, campo);
  const linhas = linhasMensais(schema, respostas, campo);
  const vals = (chave: string) => valor.linhas[chave] ?? Array<string>(campo.meses).fill("");

  function mudarCelula(chave: string, i: number, v: string) {
    const nova = [...vals(chave)];
    nova[i] = v;
    aoMudar({ ...valor, linhas: { ...valor.linhas, [chave]: nova } });
  }
  function mudarMes(i: number, v: string) {
    const meses = [...valor.meses];
    meses[i] = v;
    aoMudar({ ...valor, meses });
  }

  const rotuloLinha = (l: (typeof linhas)[number]) => (
    <>
      {l.rotulo}
      {l.orfa && (
        <span className="mt-0.5 block text-xs font-normal text-alerta">
          Serviço renomeado ou removido na etapa 02
        </span>
      )}
    </>
  );

  return (
    <div id={`campo-${campo.id}`} className="scroll-mt-24">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 md:hidden">
        {valor.meses.map((m, i) => (
          <label key={i} className="grid gap-1 text-xs font-medium text-cinza-suave">
            Mês {i + 1}
            <input
              type="month"
              className={celula}
              value={m}
              disabled={desabilitado}
              onChange={(e) => mudarMes(i, e.target.value)}
            />
          </label>
        ))}
      </div>

      <div className="hidden md:block">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-verde-menta/60 text-left text-azul-medico">
              <th className="w-[40%] border border-border px-3 py-2.5 font-semibold">{campo.rotulo}</th>
              {valor.meses.map((m, i) => (
                <th key={i} className="border border-border px-2 py-2 font-semibold">
                  <input
                    type="month"
                    className={cn(celula, "h-9 font-semibold text-azul-medico")}
                    value={m}
                    disabled={desabilitado}
                    aria-label={`Mês ${i + 1}`}
                    onChange={(e) => mudarMes(i, e.target.value)}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.chave}>
                <td className="border border-border px-3 py-2 font-medium text-cinza-texto">{rotuloLinha(l)}</td>
                {vals(l.chave).map((v, i) => (
                  <td key={i} className="border border-border px-2 py-2">
                    <input
                      className={celula}
                      value={v}
                      disabled={desabilitado}
                      aria-label={`${l.rotulo}, ${rotuloMes(valor.meses[i] ?? "")}`}
                      placeholder="Preencher"
                      onChange={(e) => mudarCelula(l.chave, i, e.target.value)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 grid gap-3 md:hidden">
        {linhas.map((l) => (
          <div key={l.chave} className="rounded-lg border border-border p-4">
            <p className="text-sm font-semibold text-azul-medico">{rotuloLinha(l)}</p>
            <div className="mt-3 grid grid-cols-1 gap-3 min-[420px]:grid-cols-3">
              {vals(l.chave).map((v, i) => (
                <label key={i} className="grid gap-1 text-xs font-medium text-cinza-suave">
                  {rotuloMes(valor.meses[i] ?? "")}
                  <input
                    className={celula}
                    value={v}
                    disabled={desabilitado}
                    placeholder="—"
                    onChange={(e) => mudarCelula(l.chave, i, e.target.value)}
                  />
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      {campo.nota && <p className="mt-3 text-sm leading-relaxed text-cinza-suave">{campo.nota}</p>}
    </div>
  );
}

/**
 * Envio de relatórios junto da resposta.
 *
 * O arquivo sobe direto do navegador para o Storage. No painel, com a
 * sessão de quem está preenchendo — a RLS do bucket confere a clínica e
 * se o diagnóstico ainda é rascunho. Pelo link, com uma URL de envio
 * assinada que o servidor só entrega depois de conferir o token. Só a
 * referência entra nas respostas.
 */
function CampoAnexos({
  lista,
  pasta,
  aoMudar,
  demo,
  token,
  desabilitado,
}: {
  lista: Anexo[];
  pasta: string;
  aoMudar: (l: Anexo[]) => void;
  demo: boolean;
  token?: string;
  desabilitado: boolean;
}) {
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  async function escolher(arquivos: FileList | null) {
    setErro(null);
    if (!arquivos?.length) return;
    if (demo) {
      setErro("Modo demonstração: arquivos não são enviados.");
      return;
    }

    const supabase = createClient();
    const novos: Anexo[] = [];
    setEnviando(true);
    for (const f of Array.from(arquivos)) {
      if (f.size > MAX_ARQUIVO) {
        setErro(`${f.name}: o limite é 10 MB por arquivo.`);
        continue;
      }
      const tipo = f.type || (f.name.toLowerCase().endsWith(".csv") ? "text/csv" : "");
      if (!TIPOS_ARQUIVO.includes(tipo)) {
        setErro(`${f.name}: use PDF, planilha (XLSX ou CSV) ou imagem (PNG ou JPG).`);
        continue;
      }
      let caminho: string;
      let error: unknown;
      if (token) {
        const aut = await autorizarAnexoLink(token, f.name, tipo, f.size);
        if (!aut.ok) {
          setErro(`${f.name}: ${aut.erro}`);
          continue;
        }
        caminho = aut.caminho;
        ({ error } = await supabase.storage
          .from(BUCKET_ANEXOS)
          .uploadToSignedUrl(caminho, aut.tokenEnvio, f, { contentType: tipo }));
      } else {
        const seguro = f.name.normalize("NFD").replace(/[^\w.-]+/g, "-").slice(-80);
        caminho = `${pasta}/${Date.now()}-${seguro}`;
        ({ error } = await supabase.storage
          .from(BUCKET_ANEXOS)
          .upload(caminho, f, { contentType: tipo }));
      }
      if (error) {
        setErro(`${f.name}: não foi possível enviar.`);
        continue;
      }
      novos.push({ nome: f.name, caminho, tamanho: f.size });
    }
    setEnviando(false);
    if (novos.length) aoMudar([...lista, ...novos]);
    if (input.current) input.current.value = "";
  }

  async function remover(a: Anexo) {
    if (token) await removerAnexoLink(token, a.caminho);
    else if (!demo) await createClient().storage.from(BUCKET_ANEXOS).remove([a.caminho]);
    aoMudar(lista.filter((x) => x.caminho !== a.caminho));
  }

  return (
    <div className="mt-3">
      {lista.length > 0 && (
        <ul className="mb-3 grid gap-2">
          {lista.map((a) => (
            <li key={a.caminho} className="flex min-w-0 items-center gap-2">
              <LinkAnexo anexo={a} demo={demo} token={token} />
              <button
                type="button"
                onClick={() => remover(a)}
                disabled={desabilitado}
                className="grid size-9 shrink-0 place-items-center rounded-md text-cinza-suave hover:bg-coral/10 hover:text-coral"
                aria-label={`Remover ${a.nome}`}
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <input
        ref={input}
        type="file"
        multiple
        className="sr-only"
        id={`anexos-${pasta}`}
        accept=".pdf,.xlsx,.xls,.csv,.png,.jpg,.jpeg"
        disabled={desabilitado || enviando}
        onChange={(e) => escolher(e.target.files)}
      />
      <label
        htmlFor={`anexos-${pasta}`}
        className={cn(
          "inline-flex cursor-pointer items-center gap-2 rounded-full border-2 border-dashed border-azul-medico/20 px-4 py-2 text-sm font-semibold text-azul-medico hover:border-teal hover:text-teal",
          (desabilitado || enviando) && "pointer-events-none opacity-60"
        )}
      >
        {enviando ? <Loader2 className="size-4 animate-spin" /> : <Paperclip className="size-4" />}
        {enviando ? "Enviando…" : "Anexar relatórios"}
      </label>
      <p className="mt-1.5 text-xs text-cinza-suave">
        PDF, XLSX, CSV, PNG ou JPG, até 10 MB cada.
      </p>
      {erro && <p className="mt-1.5 text-xs text-coral">{erro}</p>}
    </div>
  );
}
