"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  Check,
  HeartHandshake,
  Loader2,
  Mail,
  Megaphone,
  MessageCircle,
  Send,
  ShieldCheck,
  Users,
} from "lucide-react";
import { criarDisparo, previaDisparo, type Previa } from "@/lib/actions/disparos";
import type { CanalDisparo, FinalidadeDisparo, SegmentoPacientes } from "@/lib/supabase/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Filtros = Record<string, string>;
type OpcaoPublico = { chave: string; rotulo: string; dica?: string; filtros: Filtros };

const PRONTOS: OpcaoPublico[] = [
  { chave: "ativos", rotulo: "Todos os pacientes ativos", filtros: {} },
  { chave: "sem-retorno", rotulo: "Sem retorno há mais de 6 meses", dica: "Bom para reativação", filtros: { situacao: "sem-retorno" } },
  { chave: "primeira-sem-retorno", rotulo: "1ª consulta sem retorno", dica: "Vieram uma vez e não voltaram", filtros: { situacao: "primeira-sem-retorno" } },
  { chave: "faltaram", rotulo: "Faltaram e não remarcaram", filtros: { situacao: "faltaram" } },
  { chave: "aniversariantes", rotulo: "Aniversariantes do mês", filtros: { situacao: "aniversariantes" } },
  { chave: "promotores", rotulo: "Promotores (NPS 9–10)", dica: "Peça indicação ou avaliação", filtros: { situacao: "promotores" } },
  { chave: "valiosos", rotulo: "Mais valiosos", filtros: { situacao: "valiosos" } },
  { chave: "novos", rotulo: "Novos no mês", filtros: { situacao: "novos" } },
];

const MODELOS: Record<FinalidadeDisparo, { nome: string; texto: string }[]> = {
  cuidado: [
    {
      nome: "Retorno",
      texto:
        "Oi, {nome}! Aqui é da {clinica}. Faz um tempinho desde a sua última consulta e queremos saber como você está. Que tal marcar um retorno? É só responder esta mensagem que a gente encontra um horário.",
    },
    {
      nome: "Aniversário",
      texto: "Oi, {nome}! Toda a equipe da {clinica} deseja um feliz aniversário! Que seja um ano de muita saúde. Um abraço!",
    },
    {
      nome: "Faltou",
      texto: "Oi, {nome}! Aqui é da {clinica}. Sentimos sua falta na última consulta. Quer remarcar? Responda esta mensagem com o melhor dia e horário para você.",
    },
  ],
  marketing: [
    {
      nome: "Novidade",
      texto:
        "Oi, {nome}! A {clinica} tem uma novidade: [conte aqui o novo tratamento ou serviço]. Quer saber mais? É só responder esta mensagem.",
    },
    {
      nome: "Campanha do mês",
      texto: "Oi, {nome}! Em [mês], a {clinica} preparou condições especiais para [tratamento]. As vagas são limitadas. Quer garantir a sua? Responda aqui.",
    },
    {
      nome: "Indicação",
      texto:
        "Oi, {nome}! Ficamos muito felizes com a sua confiança na {clinica}. Se conhece alguém que também precisa de cuidado, indique a gente: é só compartilhar este contato.",
    },
  ],
};

const VARIAVEIS = [
  { v: "{nome}", r: "Primeiro nome" },
  { v: "{nome_completo}", r: "Nome completo" },
  { v: "{clinica}", r: "Clínica" },
];

const PASSOS = ["Público", "Mensagem", "Quando", "Revisão"];

const dataHora = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).replace(/\./g, "");

export function NovoDisparo({
  segmentos,
  filtrosIniciais,
  clinica,
  nomesServicos = {},
}: {
  segmentos: SegmentoPacientes[];
  /** Vindo da lista de pacientes: o filtro que estava aberto. */
  filtrosIniciais: Filtros | null;
  clinica: string;
  /** Para descrever o filtro de serviço pelo nome. */
  nomesServicos?: Record<string, string>;
}) {
  const router = useRouter();
  const opcoes: OpcaoPublico[] = useMemo(
    () => [
      ...(filtrosIniciais ? [{ chave: "lista", rotulo: "O filtro da lista de pacientes", dica: descreverFiltro(filtrosIniciais, nomesServicos), filtros: filtrosIniciais }] : []),
      ...PRONTOS,
      ...segmentos.map((s) => ({ chave: `seg-${s.id}`, rotulo: s.nome, dica: "Segmento salvo", filtros: s.filtros })),
    ],
    [segmentos, filtrosIniciais, nomesServicos]
  );

  const [passo, setPasso] = useState(0);
  const [publico, setPublico] = useState(opcoes[0].chave);
  const [canal, setCanal] = useState<CanalDisparo>("whatsapp");
  const [finalidade, setFinalidade] = useState<FinalidadeDisparo>("cuidado");
  const [evitarRecentes, setEvitarRecentes] = useState(true);
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [nome, setNome] = useState("");
  const [assunto, setAssunto] = useState("");
  const [mensagem, setMensagem] = useState(MODELOS.cuidado[0].texto);
  const [quando, setQuando] = useState<"agora" | "agendar">("agora");
  const [inicio, setInicio] = useState("");
  const [confirmo, setConfirmo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const caixa = useRef<HTMLTextAreaElement>(null);
  const escolhido = opcoes.find((o) => o.chave === publico) ?? opcoes[0];

  useEffect(() => {
    let vivo = true;
    setCarregando(true);
    previaDisparo({ filtros: escolhido.filtros, canal, finalidade, evitarRecentes }).then((r) => {
      if (!vivo) return;
      setCarregando(false);
      if (r.ok) {
        setPrevia(r);
        setErro(null);
      } else setErro(r.erro);
    });
    return () => {
      vivo = false;
    };
  }, [escolhido, canal, finalidade, evitarRecentes]);

  useEffect(() => {
    if (!nome) setNome(escolhido.rotulo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [escolhido]);

  function inserir(v: string) {
    const el = caixa.current;
    if (!el) return setMensagem((m) => m + v);
    const a = el.selectionStart ?? mensagem.length;
    const b = el.selectionEnd ?? a;
    const novo = mensagem.slice(0, a) + v + mensagem.slice(b);
    setMensagem(novo);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(a + v.length, a + v.length);
    });
  }

  const exemplo = previa?.amostra[0] ?? "Ana Ribeiro";
  const texto = mensagem
    .replace(/\{nome_completo\}/gi, exemplo)
    .replace(/\{nome\}/gi, exemplo.split(" ")[0])
    .replace(/\{cl[ií]nica\}/gi, clinica);
  const canalOk = !previa || previa.canais[canal];
  const temColchete = /\[[^\]]+\]/.test(mensagem);

  const podeAvancar =
    passo === 0
      ? !!previa && previa.elegiveis > 0 && canalOk
      : passo === 1
        ? nome.trim().length >= 3 && mensagem.trim().length >= 10 && !temColchete && (canal === "whatsapp" || assunto.trim().length > 0)
        : passo === 2
          ? quando === "agora" || !!inicio
          : confirmo;

  function criar() {
    setErro(null);
    startTransition(async () => {
      const r = await criarDisparo({
        nome,
        canal,
        finalidade,
        assunto: canal === "email" ? assunto : undefined,
        mensagem,
        filtros: escolhido.filtros,
        segmentoNome: escolhido.rotulo,
        inicio: quando === "agendar" && inicio ? new Date(inicio).toISOString() : "",
        evitarRecentes,
        confirmo: confirmo as true,
      });
      if (!r.ok) return setErro(r.erro);
      router.push(`/app/disparos/${r.id}`);
    });
  }

  return (
    <div className="grid gap-6">
      {/* Passos */}
      <ol className="grid grid-cols-4 gap-2">
        {PASSOS.map((p, i) => (
          <li key={p}>
            <button
              type="button"
              disabled={i > passo}
              onClick={() => setPasso(i)}
              className={cn(
                "flex w-full flex-col items-start gap-1.5 rounded-lg border-t-4 px-1 pt-2 text-left text-xs font-semibold transition-colors sm:text-sm",
                i < passo ? "border-teal text-teal" : i === passo ? "border-azul-medico text-azul-medico" : "border-border text-cinza-suave"
              )}
            >
              <span className="text-[10px] font-medium uppercase tracking-wide opacity-70">Passo {i + 1}</span>
              {p}
            </button>
          </li>
        ))}
      </ol>

      {passo === 0 && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <section className="grid content-start gap-5 rounded-xl border border-border bg-white p-5 shadow-soft">
            <div>
              <h2 className="font-heading text-base font-semibold text-azul-medico">Para quem</h2>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {opcoes.map((o) => (
                  <label
                    key={o.chave}
                    className={cn(
                      "flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 transition-colors",
                      publico === o.chave ? "border-teal bg-verde-menta/50" : "border-border hover:border-teal/50"
                    )}
                  >
                    <input type="radio" name="publico" checked={publico === o.chave} onChange={() => setPublico(o.chave)} className="mt-0.5 accent-teal" />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-cinza-texto">{o.rotulo}</span>
                      {o.dica && <span className="block truncate text-xs text-cinza-suave">{o.dica}</span>}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <h2 className="font-heading text-base font-semibold text-azul-medico">Por onde</h2>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {[
                  { v: "whatsapp" as const, r: "WhatsApp", icone: MessageCircle },
                  { v: "email" as const, r: "E-mail", icone: Mail },
                ].map((c) => (
                  <button
                    key={c.v}
                    type="button"
                    onClick={() => setCanal(c.v)}
                    className={cn(
                      "flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-semibold transition-colors",
                      canal === c.v ? "border-teal bg-verde-menta/50 text-azul-medico" : "border-border text-cinza-suave hover:border-teal/50"
                    )}
                  >
                    <c.icone className="size-4" /> {c.r}
                  </button>
                ))}
              </div>
              {previa && !previa.canais[canal] && (
                <p className="mt-2 rounded-md bg-[#FFF4E5] px-3 py-2 text-xs text-[#9A5B00]">
                  {canal === "whatsapp"
                    ? "O WhatsApp da clínica não está conectado. Conecte em Configurações › Mensagens."
                    : "O envio de e-mail não está configurado."}
                </p>
              )}
            </div>

            <div>
              <h2 className="font-heading text-base font-semibold text-azul-medico">Tipo de mensagem</h2>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {[
                  {
                    v: "cuidado" as const,
                    r: "Cuidado e retorno",
                    d: "Lembrar de voltar, aniversário, remarcar. Vai para todos, menos quem pediu para sair. Sem ofertas.",
                    icone: HeartHandshake,
                  },
                  {
                    v: "marketing" as const,
                    r: "Novidades e promoções",
                    d: "Campanhas e ofertas. Pela LGPD, só para quem aceitou receber.",
                    icone: Megaphone,
                  },
                ].map((f) => (
                  <button
                    key={f.v}
                    type="button"
                    onClick={() => {
                      setFinalidade(f.v);
                      setMensagem(MODELOS[f.v][0].texto);
                    }}
                    className={cn(
                      "flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors",
                      finalidade === f.v ? "border-teal bg-verde-menta/50" : "border-border hover:border-teal/50"
                    )}
                  >
                    <f.icone className="mt-0.5 size-4 shrink-0 text-teal" />
                    <span>
                      <span className="block text-sm font-semibold text-cinza-texto">{f.r}</span>
                      <span className="block text-xs text-cinza-suave">{f.d}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <label className="flex items-start gap-2.5 text-sm text-cinza-texto">
              <input type="checkbox" checked={evitarRecentes} onChange={(e) => setEvitarRecentes(e.target.checked)} className="mt-0.5 size-4 accent-teal" />
              <span>
                Não mandar para quem recebeu outro disparo nos últimos 7 dias
                <span className="block text-xs text-cinza-suave">Evita cansar o paciente e protege o número da clínica.</span>
              </span>
            </label>
          </section>

          <PreviaPublico previa={previa} carregando={carregando} finalidade={finalidade} canal={canal} />
        </div>
      )}

      {passo === 1 && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <section className="grid content-start gap-4 rounded-xl border border-border bg-white p-5 shadow-soft">
            <label className="grid gap-1.5">
              <span className="text-sm font-medium text-cinza-texto">Nome do disparo (só a equipe vê)</span>
              <input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={120} className="h-10 rounded-md border border-border px-3 text-sm focus:border-teal focus:outline-none" />
            </label>
            {canal === "email" && (
              <label className="grid gap-1.5">
                <span className="text-sm font-medium text-cinza-texto">Assunto do e-mail</span>
                <input
                  value={assunto}
                  onChange={(e) => setAssunto(e.target.value)}
                  maxLength={150}
                  placeholder="Ex.: {nome}, sentimos sua falta"
                  className="h-10 rounded-md border border-border px-3 text-sm focus:border-teal focus:outline-none"
                />
              </label>
            )}
            <div>
              <p className="text-sm font-medium text-cinza-texto">Modelos</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {MODELOS[finalidade].map((m) => (
                  <button
                    key={m.nome}
                    type="button"
                    onClick={() => setMensagem(m.texto)}
                    className="rounded-full border border-border px-3 py-1 text-xs font-medium text-azul-medico hover:border-teal hover:text-teal"
                  >
                    {m.nome}
                  </button>
                ))}
              </div>
            </div>
            <label className="grid gap-1.5">
              <span className="flex items-baseline justify-between text-sm font-medium text-cinza-texto">
                Mensagem <span className="text-xs font-normal text-cinza-suave">{mensagem.length}/2000</span>
              </span>
              <textarea
                ref={caixa}
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                rows={7}
                maxLength={2000}
                className="rounded-md border border-border px-3 py-2 text-sm leading-relaxed focus:border-teal focus:outline-none"
              />
            </label>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-cinza-suave">Inserir:</span>
              {VARIAVEIS.map((v) => (
                <button key={v.v} type="button" onClick={() => inserir(v.v)} className="rounded bg-verde-menta px-2 py-0.5 font-mono text-xs text-azul-medico hover:bg-teal/15">
                  {v.v}
                  <span className="sr-only"> ({v.r})</span>
                </button>
              ))}
            </div>
            {temColchete && (
              <p className="rounded-md bg-[#FFF4E5] px-3 py-2 text-xs text-[#9A5B00]">
                Troque os trechos entre colchetes [ ] pelo texto da sua clínica antes de continuar.
              </p>
            )}
            <p className="flex items-start gap-1.5 text-xs text-cinza-suave">
              <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-teal" />
              Não cite diagnóstico, exame ou procedimento do paciente: a mensagem pode ser lida por outra pessoa.
            </p>
          </section>

          <section className="rounded-xl border border-border bg-[#E5DDD5] p-4 shadow-soft">
            <p className="mb-3 text-center text-[11px] font-medium uppercase tracking-wide text-[#54656F]">Como {exemplo.split(" ")[0]} recebe</p>
            {canal === "whatsapp" ? (
              <div className="ml-auto max-w-[92%] rounded-lg rounded-tr-none bg-[#DCF8C6] px-3 py-2 text-sm text-[#111B21] shadow-sm">
                <p className="whitespace-pre-line break-words">{texto}</p>
                <p className="mt-2 break-words text-[13px] text-[#54656F]">
                  Não quer mais receber mensagens como esta? <span className="text-[#027EB5] underline">{"link"}</span>
                </p>
                <p className="mt-1 text-right text-[10px] text-[#667781]">09:41</p>
              </div>
            ) : (
              <div className="rounded-lg bg-white p-4 text-sm text-cinza-texto shadow-sm">
                <p className="text-xs text-cinza-suave">De: {clinica}</p>
                <p className="mt-0.5 font-semibold">{assunto.replace(/\{nome\}/gi, exemplo.split(" ")[0]).replace(/\{cl[ií]nica\}/gi, clinica) || "(sem assunto)"}</p>
                <hr className="my-3 border-border" />
                <p className="whitespace-pre-line break-words leading-relaxed">{texto}</p>
                <p className="mt-4 text-[11px] text-cinza-suave">
                  Você recebeu este e-mail por ser paciente da {clinica}. <u>Não quero mais receber</u>.
                </p>
              </div>
            )}
          </section>
        </div>
      )}

      {passo === 2 && (
        <section className="grid gap-4 rounded-xl border border-border bg-white p-5 shadow-soft">
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              { v: "agora" as const, r: "Começar agora", d: "Dentro do horário comercial; fora dele, às 8h do próximo dia útil." },
              { v: "agendar" as const, r: "Agendar o início", d: "Escolha o dia e a hora da primeira mensagem." },
            ].map((o) => (
              <label
                key={o.v}
                className={cn(
                  "flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5",
                  quando === o.v ? "border-teal bg-verde-menta/50" : "border-border hover:border-teal/50"
                )}
              >
                <input type="radio" checked={quando === o.v} onChange={() => setQuando(o.v)} className="mt-0.5 accent-teal" />
                <span>
                  <span className="block text-sm font-semibold text-cinza-texto">{o.r}</span>
                  <span className="block text-xs text-cinza-suave">{o.d}</span>
                </span>
              </label>
            ))}
          </div>
          {quando === "agendar" && (
            <input
              type="datetime-local"
              value={inicio}
              onChange={(e) => setInicio(e.target.value)}
              className="h-10 w-full max-w-xs rounded-md border border-border px-3 text-sm focus:border-teal focus:outline-none"
            />
          )}
          <div className="rounded-lg bg-branco-clinico px-4 py-3 text-sm text-cinza-texto">
            <p className="flex items-center gap-2 font-medium">
              <CalendarClock className="size-4 text-teal" /> Ritmo seguro
            </p>
            <p className="mt-1 text-xs leading-relaxed text-cinza-suave">
              {canal === "whatsapp"
                ? "Uma mensagem a cada 40 a 90 segundos, das 8h às 20h, de segunda a sábado, até 250 por dia. É o que mantém o número da clínica longe de bloqueios."
                : "Uma mensagem a cada poucos segundos, das 8h às 20h, de segunda a sábado."}
              {previa?.terminaEm && quando === "agora" && (
                <>
                  {" "}
                  Com {previa.elegiveis} paciente{previa.elegiveis === 1 ? "" : "s"}, termina por volta de <strong className="text-cinza-texto">{dataHora(previa.terminaEm)}</strong>.
                </>
              )}
            </p>
          </div>
        </section>
      )}

      {passo === 3 && previa && (
        <section className="grid gap-4 rounded-xl border border-border bg-white p-5 shadow-soft">
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            {[
              ["Disparo", nome],
              ["Público", `${escolhido.rotulo} · ${previa.elegiveis} paciente${previa.elegiveis === 1 ? "" : "s"}`],
              ["Canal", canal === "whatsapp" ? "WhatsApp da clínica" : "E-mail"],
              ["Tipo", finalidade === "cuidado" ? "Cuidado e retorno" : "Novidades e promoções (só quem aceitou)"],
              ["Início", quando === "agora" ? "Agora" : inicio ? dataHora(new Date(inicio).toISOString()) : "—"],
              ["Termina por volta de", quando === "agora" && previa.terminaEm ? dataHora(previa.terminaEm) : "Conforme o início"],
            ].map(([r, v]) => (
              <div key={r} className="rounded-lg bg-branco-clinico px-3 py-2">
                <dt className="text-xs text-cinza-suave">{r}</dt>
                <dd className="font-medium text-cinza-texto">{v}</dd>
              </div>
            ))}
          </dl>
          <label className="flex items-start gap-2.5 rounded-lg border border-border px-4 py-3 text-sm text-cinza-texto">
            <input type="checkbox" checked={confirmo} onChange={(e) => setConfirmo(e.target.checked)} className="mt-0.5 size-4 accent-teal" />
            <span>
              Confirmo que a mensagem não expõe dados de saúde do paciente e respeita a LGPD.
              <span className="block text-xs text-cinza-suave">Toda mensagem leva o link para o paciente parar de receber.</span>
            </span>
          </label>
        </section>
      )}

      {erro && <p className="rounded-md bg-coral/10 px-4 py-2.5 text-sm text-coral">{erro}</p>}

      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" onClick={() => (passo ? setPasso(passo - 1) : router.push("/app/disparos"))} disabled={pending}>
          <ArrowLeft className="size-4" /> {passo ? "Voltar" : "Cancelar"}
        </Button>
        {passo < 3 ? (
          <Button variant="marca" onClick={() => setPasso(passo + 1)} disabled={!podeAvancar || carregando}>
            Continuar <ArrowRight className="size-4" />
          </Button>
        ) : (
          <Button variant="marca" onClick={criar} disabled={!podeAvancar || pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            Disparar para {previa?.elegiveis ?? 0}
          </Button>
        )}
      </div>
    </div>
  );
}

function PreviaPublico({
  previa,
  carregando,
  finalidade,
  canal,
}: {
  previa: Previa | null;
  carregando: boolean;
  finalidade: FinalidadeDisparo;
  canal: CanalDisparo;
}) {
  const fora = previa
    ? [
        { r: canal === "whatsapp" ? "Sem WhatsApp cadastrado" : "Sem e-mail cadastrado", v: previa.excluidos.semContato },
        ...(finalidade === "marketing" ? [{ r: "Não aceitaram receber novidades", v: previa.excluidos.semConsentimento }] : []),
        { r: "Pediram para não receber", v: previa.excluidos.descadastrados },
        { r: "Receberam outro disparo há pouco", v: previa.excluidos.recentes },
      ].filter((x) => x.v > 0)
    : [];
  return (
    <aside className="grid content-start gap-4 rounded-xl border border-border bg-white p-5 shadow-soft">
      <div className="flex items-center gap-3">
        <span className="grid size-12 place-items-center rounded-xl bg-azul-medico text-white">
          {carregando ? <Loader2 className="size-5 animate-spin" /> : <Users className="size-5" />}
        </span>
        <div>
          <p className="font-heading text-3xl font-bold leading-none tabular-nums text-azul-medico">{previa?.elegiveis ?? "–"}</p>
          <p className="mt-1 text-xs text-cinza-suave">recebem a mensagem{previa ? ` de ${previa.total} no segmento` : ""}</p>
        </div>
      </div>
      {fora.length > 0 && (
        <div>
          <p className="text-xs font-medium text-cinza-suave">Ficam de fora</p>
          <ul className="mt-1.5 grid gap-1 text-sm">
            {fora.map((x) => (
              <li key={x.r} className="flex justify-between gap-2 text-cinza-texto">
                <span>{x.r}</span>
                <span className="tabular-nums text-cinza-suave">{x.v}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {previa && previa.amostra.length > 0 && (
        <div>
          <p className="text-xs font-medium text-cinza-suave">Alguns de quem recebe</p>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {previa.amostra.map((n) => (
              <li key={n} className="inline-flex items-center gap-1 rounded-full bg-verde-menta px-2 py-0.5 text-xs text-azul-medico">
                <Check className="size-3 text-teal" /> {n}
              </li>
            ))}
          </ul>
        </div>
      )}
      {previa && previa.elegiveis === 0 && (
        <p className="rounded-md bg-[#FFF4E5] px-3 py-2 text-xs text-[#9A5B00]">
          Ninguém deste público pode receber.{" "}
          {finalidade === "marketing" ? "Para campanhas, o paciente precisa ter aceitado receber novidades (na ficha dele)." : "Escolha outro público ou canal."}
        </p>
      )}
    </aside>
  );
}

const ROTULOS_SITUACAO: Record<string, string> = {
  "sem-retorno": "sem retorno",
  novos: "novos no mês",
  aniversariantes: "aniversariantes",
  "primeira-sem-retorno": "1ª consulta sem retorno",
  faltaram: "faltaram",
  promotores: "promotores",
  detratores: "detratores",
  valiosos: "mais valiosos",
};

function descreverFiltro(f: Filtros, servicos: Record<string, string> = {}): string {
  return (
    [
      f.situacao && ROTULOS_SITUACAO[f.situacao],
      f.convenio && `convênio ${f.convenio}`,
      f.tag && `etiqueta ${f.tag}`,
      f.servico && `fizeram ${servicos[f.servico] ?? "um serviço"}`,
      f.busca && `busca “${f.busca}”`,
      f.profissional && "um profissional",
    ]
      .filter(Boolean)
      .join(" · ") || "todos os ativos"
  );
}
