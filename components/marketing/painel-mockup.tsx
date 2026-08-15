"use client";

import { useEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useInView,
  useReducedMotion,
} from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Bell,
  CalendarCheck,
  CalendarDays,
  Check,
  ChevronRight,
  Clock,
  LayoutDashboard,
  LogOut,
  Megaphone,
  MessageCircle,
  MessagesSquare,
  PencilLine,
  Repeat,
  TrendingUp,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * MOCKUP DO PAINEL — seção "A Plataforma".
 *
 * Reproduz o painel de verdade, não uma ilustração inspirada nele: o
 * menu lateral traz os mesmos grupos e módulos do `lib/rbac.ts`, a tela
 * inicial repete a estrutura de `app/app/page.tsx` (saudação, "O que
 * precisa de você", números, próximas consultas) e a de indicadores
 * repete os cartões e o gráfico de funil de `app/app/indicadores`.
 * Quem vê aqui e depois entra no sistema reconhece a mesma tela.
 *
 * É HTML e SVG, sem imagem: não pesa no carregamento, fica nítido em
 * qualquer tela e não envelhece junto com um print.
 *
 * O movimento não é enfeite, é argumento. Ele conta três coisas que uma
 * imagem parada não consegue: que o painel alterna entre telas de
 * verdade, que os números são apurados ali, e sobretudo que a
 * confirmação chega sozinha pelo WhatsApp e muda o status da agenda sem
 * ninguém tocar. Por isso a consulta pendente vira confirmada na frente
 * de quem está lendo.
 *
 * Tudo isso para quando o ponteiro entra (ninguém quer ler algo que se
 * mexe) e não chega a acontecer para quem pediu menos animação no
 * sistema operacional.
 */

/* ------------------------------------------------------------------ */
/* Menu lateral: os mesmos grupos e rótulos do painel                  */
/* ------------------------------------------------------------------ */

const NAV = [
  {
    grupo: "Operação",
    itens: [
      { id: "inicio", label: "Início", icone: LayoutDashboard },
      { id: "agenda", label: "Agenda", icone: CalendarDays },
      { id: "confirmacoes", label: "Confirmações", icone: CalendarCheck },
      { id: "crm", label: "CRM", icone: Users },
      { id: "atendimento", label: "Atendimento", icone: MessagesSquare },
    ],
  },
  {
    grupo: "Crescimento",
    itens: [
      { id: "retencao", label: "Retenção", icone: Repeat },
      { id: "marketing", label: "Marketing", icone: Megaphone },
      { id: "indicadores", label: "Indicadores", icone: BarChart3 },
    ],
  },
] as const;

type Tela = "inicio" | "indicadores";

/* ------------------------------------------------------------------ */
/* Contagem dos números                                                */
/* ------------------------------------------------------------------ */

/**
 * Anima de zero até o alvo com desaceleração.
 *
 * Vale para número apurado, que é o caso aqui: dá a sensação de que o
 * painel foi buscar o dado. Em textos fixos seria só ruído.
 */
function useContagem(alvo: number, ativo: boolean, duracao = 1100) {
  const reduzir = useReducedMotion();
  const [n, setN] = useState(reduzir ? alvo : 0);

  useEffect(() => {
    if (!ativo) return;
    if (reduzir) {
      setN(alvo);
      return;
    }

    let quadro = 0;
    let inicio = 0;
    const passo = (t: number) => {
      if (!inicio) inicio = t;
      const p = Math.min(1, (t - inicio) / duracao);
      setN(alvo * (1 - Math.pow(1 - p, 3)));
      if (p < 1) quadro = requestAnimationFrame(passo);
    };
    quadro = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(quadro);
  }, [alvo, ativo, duracao, reduzir]);

  return n;
}

function Contador({
  alvo,
  formatar,
  ativo,
  className,
}: {
  alvo: number;
  formatar: (n: number) => string;
  ativo: boolean;
  className?: string;
}) {
  const n = useContagem(alvo, ativo);
  // tabular-nums para o número não dançar de largura enquanto sobe
  return <span className={cn("tabular-nums", className)}>{formatar(n)}</span>;
}

const inteiro = (n: number) => String(Math.round(n));
const porcento = (n: number) => `${Math.round(n)}%`;
const reais = (n: number) =>
  `R$ ${Math.round(n).toLocaleString("pt-BR")}`;
const multiplo = (n: number) => `${n.toFixed(1).replace(".", ",")}x`;

/* ------------------------------------------------------------------ */
/* Conteúdo das telas                                                  */
/* ------------------------------------------------------------------ */

const NUMEROS = [
  { rotulo: "consultas hoje", alvo: 18, formatar: inteiro },
  { rotulo: "taxa de resposta", alvo: 94, formatar: porcento, nota: "no WhatsApp da clínica" },
  { rotulo: "leads em aberto", alvo: 37, formatar: inteiro, nota: "12 em negociação" },
  { rotulo: "faturado no mês", alvo: 82400, formatar: reais, nota: "+18% sobre julho" },
  { rotulo: "retorno do marketing", alvo: 4.8, formatar: multiplo, nota: "R$ 42 por lead" },
  { rotulo: "pacientes reativados", alvo: 26, formatar: inteiro, nota: "pela régua de retorno" },
];

const PENDENCIAS = [
  {
    titulo: "3 lembretes de confirmação para enviar",
    detalhe: "Já passaram do horário programado e ainda não foram enviados.",
    urgente: true,
  },
  {
    titulo: "1 paciente pediu para reagendar",
    detalhe: "O horário segue reservado até a clínica combinar outro.",
    urgente: false,
  },
];

const CONSULTAS = [
  { hora: "08:30", paciente: "Ana Ribeiro", status: "confirmada" },
  { hora: "09:15", paciente: "Carlos Menezes", status: "confirmada" },
  { hora: "10:00", paciente: "Juliana Faria", status: "pendente" },
  { hora: "11:00", paciente: "Marcos Lima", status: "confirmada" },
  { hora: "11:45", paciente: "Beatriz Nunes", status: "pendente" },
];

/** A paciente que confirma na tela, para o efeito e o aviso baterem. */
const QUEM_CONFIRMA = "Juliana Faria";

const MESES = ["mar", "abr", "mai", "jun", "jul", "ago"];

/** Mesmas cores do gráfico do painel (`components/app/indicadores`). */
const SERIES = [
  { nome: "Leads", cor: "#5FC9B8", valores: [42, 51, 58, 63, 71, 78] },
  { nome: "Agendamentos", cor: "#1A9E8F", valores: [24, 30, 36, 41, 47, 53] },
  { nome: "Comparecimentos", cor: "#0B4F6C", valores: [19, 25, 30, 35, 40, 46] },
];

/* ------------------------------------------------------------------ */
/* Componente                                                          */
/* ------------------------------------------------------------------ */

export function PainelMockup() {
  const ref = useRef<HTMLDivElement>(null);
  const visivel = useInView(ref, { once: true, margin: "-120px" });
  const reduzir = useReducedMotion();

  const [tela, setTela] = useState<Tela>("inicio");
  const [parado, setParado] = useState(false);
  const [confirmada, setConfirmada] = useState(false);
  const [aviso, setAviso] = useState(false);

  /* Alterna entre as duas telas, e para enquanto o ponteiro estiver em cima */
  useEffect(() => {
    if (!visivel || parado || reduzir) return;
    const t = setTimeout(
      () => setTela((a) => (a === "inicio" ? "indicadores" : "inicio")),
      tela === "inicio" ? 9000 : 7000
    );
    return () => clearTimeout(t);
  }, [visivel, parado, reduzir, tela]);

  /* A confirmação que chega sozinha, sempre que a tela inicial entra */
  useEffect(() => {
    if (tela !== "inicio" || !visivel || reduzir) return;
    setConfirmada(false);
    setAviso(false);
    const a = setTimeout(() => {
      setConfirmada(true);
      setAviso(true);
    }, 2600);
    const b = setTimeout(() => setAviso(false), 7000);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, [tela, visivel, reduzir]);

  const semConfirmar = confirmada ? 1 : 2;

  return (
    <div
      ref={ref}
      onMouseEnter={() => setParado(true)}
      onMouseLeave={() => setParado(false)}
      className="overflow-hidden rounded-2xl border border-border bg-white text-left shadow-card"
    >
      {/* Barra do navegador */}
      <div className="flex items-center gap-2 border-b border-border bg-branco-clinico px-4 py-3">
        <span className="size-2.5 rounded-full bg-coral/60" />
        <span className="size-2.5 rounded-full bg-alerta/60" />
        <span className="size-2.5 rounded-full bg-sucesso/60" />
        <div className="ml-3 flex-1 truncate rounded-md bg-white px-3 py-1 text-[11px] text-cinza-suave">
          painel.medimarketing.com.br
          <span className="text-cinza-suave/50">
            {tela === "inicio" ? "/app" : "/app/indicadores"}
          </span>
        </div>
      </div>

      <div className="flex">
        <MenuLateral tela={tela} aoTrocar={setTela} />

        {/* A altura mínima segura a troca de tela: sem ela a seção
            inteira pula de tamanho a cada nove segundos. */}
        <div className="relative min-h-[27rem] min-w-0 flex-1 p-4 sm:p-5">
          <AnimatePresence mode="wait">
            {tela === "inicio" ? (
              <Fade key="inicio">
                <TelaInicio
                  ativo={visivel}
                  confirmada={confirmada}
                  semConfirmar={semConfirmar}
                />
              </Fade>
            ) : (
              <Fade key="indicadores">
                <TelaIndicadores ativo={visivel} />
              </Fade>
            )}
          </AnimatePresence>

          <AnimatePresence>{aviso && <AvisoConfirmacao />}</AnimatePresence>
        </div>
      </div>
    </div>
  );
}

/** Transição entre telas: rápida o bastante para não virar espera. */
function Fade({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -12 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */

function MenuLateral({
  tela,
  aoTrocar,
}: {
  tela: Tela;
  aoTrocar: (t: Tela) => void;
}) {
  return (
    <div className="hidden w-44 shrink-0 flex-col justify-between border-r border-border bg-white sm:flex lg:w-48">
      <div>
        {/* Marca da clínica: no painel dela, a logo dela é que manda */}
        <div className="flex items-center gap-2 px-3 pb-3 pt-4">
          <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-teal font-heading text-xs font-bold text-white">
            VD
          </span>
          <span className="truncate font-heading text-[13px] font-bold text-azul-medico">
            Vida Derma
          </span>
        </div>

        {/* Notificações fica fora dos grupos, como no painel */}
        <div className="mx-2 mb-3 flex items-center gap-2.5 rounded-lg bg-coral/[0.08] px-2.5 py-2 text-[11px] font-medium text-coral">
          <span className="relative">
            <Bell className="size-4" />
            <span className="absolute -right-1 -top-0.5 size-1.5 rounded-full bg-coral" />
          </span>
          Notificações
          <span className="ml-auto rounded-full bg-coral px-1.5 text-[9px] font-bold text-white">
            4
          </span>
        </div>

        <nav className="space-y-3 px-2">
          {NAV.map((g) => (
            <div key={g.grupo}>
              <p className="px-2.5 pb-1 text-[9px] font-semibold uppercase tracking-wider text-cinza-suave/70">
                {g.grupo}
              </p>
              <div className="space-y-0.5">
                {g.itens.map((m) => {
                  const ativo =
                    (tela === "inicio" && m.id === "inicio") ||
                    (tela === "indicadores" && m.id === "indicadores");
                  return (
                    <div
                      key={m.id}
                      onClick={() =>
                        (m.id === "inicio" || m.id === "indicadores") &&
                        aoTrocar(m.id as Tela)
                      }
                      className={cn(
                        "relative flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium",
                        ativo ? "text-azul-medico" : "text-cinza-suave"
                      )}
                    >
                      {/* O realce desliza de um item para o outro: é o
                          que deixa claro que houve navegação, e não
                          apenas troca de conteúdo. */}
                      {ativo && (
                        <motion.span
                          layoutId="mockup-ativo"
                          transition={{ type: "spring", stiffness: 380, damping: 32 }}
                          className="absolute inset-0 rounded-lg bg-verde-menta"
                        />
                      )}
                      <m.icone className="relative size-3.5 shrink-0" />
                      <span className="relative truncate">{m.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>

      {/* Rodapé com o usuário, igual ao do painel */}
      <div className="border-t border-border p-2">
        <div className="flex items-center gap-2 px-1.5 py-1.5">
          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-azul-medico text-[10px] font-semibold text-white">
            HC
          </span>
          <div className="min-w-0">
            <p className="truncate text-[11px] font-medium text-cinza-texto">
              Dra. Helena Costa
            </p>
            <p className="truncate text-[9px] text-cinza-suave">Gestora</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 px-2.5 py-1.5 text-[11px] font-medium text-cinza-suave">
          <LogOut className="size-3.5" /> Sair
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function TelaInicio({
  ativo,
  confirmada,
  semConfirmar,
}: {
  ativo: boolean;
  confirmada: boolean;
  semConfirmar: number;
}) {
  return (
    <div>
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-heading text-[15px] font-bold text-azul-medico">
            Boa tarde, Helena 👋
          </p>
          <p className="truncate text-[11px] text-cinza-suave">
            Gestora · Clínica Vida Derma
          </p>
        </div>
        <span className="flex shrink-0 items-center gap-1.5 rounded-md bg-coral px-2.5 py-1 text-[10px] font-semibold text-white">
          Ver agenda <ArrowRight className="size-3" />
        </span>
      </div>

      {/* O que precisa de você */}
      <p className="mt-4 flex items-center gap-1.5 text-[11px] font-semibold text-azul-medico">
        <AlertTriangle className="size-3.5 text-alerta" />O que precisa de você
      </p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {PENDENCIAS.map((p, i) => (
          <motion.div
            key={p.titulo}
            initial={{ opacity: 0, y: 8 }}
            animate={ativo ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.1 + i * 0.08, duration: 0.4 }}
            className={cn(
              "flex items-start gap-2 rounded-lg border bg-white p-2.5",
              p.urgente ? "border-alerta/40" : "border-border"
            )}
          >
            <span
              className={cn(
                "grid size-6 shrink-0 place-items-center rounded-md",
                p.urgente
                  ? "bg-alerta/15 text-alerta"
                  : "bg-verde-menta text-teal"
              )}
            >
              {p.urgente ? (
                <AlertTriangle className="size-3" />
              ) : (
                <Clock className="size-3" />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[11px] font-semibold leading-tight text-azul-medico">
                {p.titulo}
              </span>
              <span className="mt-0.5 block text-[10px] leading-snug text-cinza-suave">
                {p.detalhe}
              </span>
            </span>
            <ChevronRight className="mt-0.5 size-3 shrink-0 text-cinza-suave/40" />
          </motion.div>
        ))}
      </div>

      {/* Sua clínica hoje */}
      <div className="mt-4 flex items-baseline justify-between">
        <p className="text-[11px] font-semibold text-azul-medico">
          Sua clínica hoje
        </p>
        <span className="flex items-center gap-1.5 rounded-full bg-sucesso/10 px-2 py-0.5 text-[9px] font-semibold text-sucesso">
          <span className="size-1.5 animate-pulse rounded-full bg-sucesso" />
          ao vivo
        </span>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-3">
        {NUMEROS.map((n) => (
          <div key={n.rotulo} className="bg-white px-2.5 py-2">
            <p className="font-heading text-base font-bold leading-tight text-azul-medico">
              <Contador alvo={n.alvo} formatar={n.formatar} ativo={ativo} />
            </p>
            <p className="text-[10px] leading-tight text-cinza-suave">
              {n.rotulo}
            </p>
            <p className="mt-0.5 truncate text-[9px] text-cinza-suave/80">
              {n.rotulo === "consultas hoje"
                ? `${semConfirmar} ainda sem confirmação`
                : n.nota}
            </p>
          </div>
        ))}
      </div>

      {/* Próximas consultas */}
      <div className="mt-4 overflow-hidden rounded-lg border border-border">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <p className="text-[11px] font-semibold text-azul-medico">
            Próximas consultas
          </p>
          <span className="text-[10px] font-medium text-teal">Ver todas</span>
        </div>
        <div className="divide-y divide-border">
          {CONSULTAS.map((c, i) => {
            const confirmou = c.paciente === QUEM_CONFIRMA && confirmada;
            const ok = c.status === "confirmada" || confirmou;
            return (
              <motion.div
                key={c.hora}
                initial={{ opacity: 0 }}
                animate={ativo ? { opacity: 1 } : {}}
                transition={{ delay: 0.25 + i * 0.06, duration: 0.35 }}
                className="flex items-center gap-2 px-3 py-1.5"
              >
                <span className="shrink-0 font-mono text-[10px] font-semibold text-azul-medico">
                  {c.hora}
                </span>
                <span className="min-w-0 flex-1 truncate text-[11px] text-cinza-texto">
                  {c.paciente}
                </span>
                {/* O selo troca com um leve salto: é o momento em que a
                    resposta do paciente chega na agenda. */}
                <motion.span
                  key={ok ? "ok" : "espera"}
                  initial={confirmou ? { scale: 0.7, opacity: 0 } : false}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 480, damping: 20 }}
                  className={cn(
                    "flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold",
                    ok
                      ? "bg-sucesso/12 text-sucesso"
                      : "bg-alerta/12 text-alerta"
                  )}
                >
                  {ok ? (
                    <>
                      <Check className="size-2.5" /> confirmada
                    </>
                  ) : (
                    <>
                      <Clock className="size-2.5" /> aguardando
                    </>
                  )}
                </motion.span>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * O aviso que aparece quando o paciente responde.
 *
 * No celular ocupa a largura toda: encolhido no canto, ele cobria duas
 * linhas da agenda em vez de uma.
 */
function AvisoConfirmacao() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.98 }}
      transition={{ type: "spring", stiffness: 320, damping: 26 }}
      className="pointer-events-none absolute inset-x-3 bottom-3 flex items-start gap-2 rounded-xl border border-sucesso/30 bg-white px-3 py-2 shadow-card sm:inset-x-auto sm:bottom-4 sm:right-4 sm:max-w-[15rem]"
    >
      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-sucesso/12 text-sucesso">
        <MessageCircle className="size-3.5" />
      </span>
      <span>
        <span className="block text-[11px] font-semibold leading-tight text-azul-medico">
          Juliana confirmou pelo WhatsApp
        </span>
        <span className="block text-[10px] leading-tight text-cinza-suave">
          A agenda foi atualizada sozinha.
        </span>
      </span>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */

function TelaIndicadores({ ativo }: { ativo: boolean }) {
  const cards = [
    { valor: 78, formatar: inteiro, label: "leads recebidos", variacao: "+9,9%" },
    { valor: 53, formatar: inteiro, label: "consultas agendadas", variacao: "+12,8%" },
    { valor: 82400, formatar: reais, label: "faturamento", variacao: "+18,4%" },
  ];

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-heading text-[15px] font-bold text-azul-medico">
            Indicadores
          </p>
          <p className="truncate text-[11px] text-cinza-suave">
            Agosto de 2026 · comparado ao mês anterior
          </p>
        </div>
        <span className="flex shrink-0 items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-[10px] font-semibold text-azul-medico">
          <PencilLine className="size-3" /> Lançar números do mês
        </span>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        {cards.map((c, i) => (
          <motion.div
            key={c.label}
            initial={{ opacity: 0, y: 8 }}
            animate={ativo ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: i * 0.07, duration: 0.4 }}
            className="rounded-lg border border-border p-2.5"
          >
            <div className="flex items-center justify-between">
              <span className="grid size-6 place-items-center rounded-md bg-verde-menta text-teal">
                <TrendingUp className="size-3" />
              </span>
              <span className="flex items-center gap-0.5 rounded-full bg-sucesso/10 px-1.5 py-0.5 text-[9px] font-semibold text-sucesso">
                {c.variacao}
              </span>
            </div>
            <p className="mt-2 font-heading text-base font-bold leading-tight text-azul-medico">
              <Contador alvo={c.valor} formatar={c.formatar} ativo={ativo} />
            </p>
            <p className="text-[10px] leading-tight text-cinza-suave">
              {c.label}
            </p>
          </motion.div>
        ))}
      </div>

      <div className="mt-3 rounded-lg border border-border p-3">
        <p className="text-[11px] font-semibold text-azul-medico">
          Evolução do funil
        </p>
        <p className="text-[10px] text-cinza-suave">
          Leads, agendamentos e comparecimento nos últimos 6 meses.
        </p>
        <GraficoFunil ativo={ativo} />
      </div>
    </div>
  );
}

/**
 * O funil mês a mês, o mesmo gráfico da tela de indicadores.
 *
 * Desenhado em SVG à mão em vez de trazer a biblioteca de gráficos:
 * carregar a recharts inteira na página de venda por causa de um
 * mockup custaria mais que o gráfico vale.
 */
function GraficoFunil({ ativo }: { ativo: boolean }) {
  const reduzir = useReducedMotion();
  const L = 8;
  const R = 292;
  const TOPO = 8;
  const BASE = 96;
  const MAX = 84;

  const x = (i: number) => L + (i * (R - L)) / (MESES.length - 1);
  const y = (v: number) => BASE - (v / MAX) * (BASE - TOPO);
  const linha = (vs: number[]) => vs.map((v, i) => `${x(i)},${y(v)}`).join(" ");

  return (
    <>
      {/* O SVG estica na horizontal para preencher a largura, então os
          traços levam `non-scaling-stroke` e os pontos finais são
          elementos HTML posicionados por porcentagem: dentro do SVG
          esticado eles virariam elipses. */}
      <div className="relative mt-2 h-32">
        <svg
          viewBox="0 0 300 112"
          className="h-full w-full"
          preserveAspectRatio="none"
          role="img"
          aria-label="Evolução de leads, agendamentos e comparecimento nos últimos seis meses"
        >
          {[0, 1, 2, 3].map((i) => (
            <line
              key={i}
              x1={0}
              x2={300}
              y1={TOPO + (i * (BASE - TOPO)) / 3}
              y2={TOPO + (i * (BASE - TOPO)) / 3}
              stroke="#E2ECEF"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          ))}

          {/* A varredura da esquerda para a direita é feita com recorte,
              e não com `pathLength`: o traço não escalável é medido em
              pixels de tela enquanto o comprimento do caminho é medido
              nas unidades do viewBox, e num SVG esticado na horizontal
              as duas contas não batem — a linha nasce partida no meio. */}
          <defs>
            <clipPath id="mockup-funil-revela">
              <motion.rect
                x={0}
                y={0}
                height={112}
                initial={reduzir ? false : { width: 0 }}
                animate={ativo ? { width: 300 } : {}}
                transition={{ duration: 1.2, delay: 0.15, ease: "easeOut" }}
              />
            </clipPath>
          </defs>

          <g clipPath="url(#mockup-funil-revela)">
            {SERIES.map((s) => (
              <polyline
                key={s.nome}
                points={linha(s.valores)}
                fill="none"
                stroke={s.cor}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </g>
        </svg>

        {/* Último ponto de cada série: onde o olho para */}
        {SERIES.map((s, i) => {
          const ultimo = s.valores[s.valores.length - 1];
          return (
            <motion.span
              key={s.nome}
              initial={reduzir ? false : { opacity: 0, scale: 0.4 }}
              animate={ativo ? { opacity: 1, scale: 1 } : {}}
              transition={{ delay: 1.1 + i * 0.15, duration: 0.3 }}
              style={{
                left: `${(x(MESES.length - 1) / 300) * 100}%`,
                top: `${(y(ultimo) / 112) * 100}%`,
                backgroundColor: s.cor,
              }}
              className="absolute size-[5px] -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white"
            />
          );
        })}
      </div>

      <div className="mt-1 flex justify-between px-1 text-[9px] text-cinza-suave">
        {MESES.map((m) => (
          <span key={m}>{m}</span>
        ))}
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-t border-border pt-2 text-[9px] text-cinza-suave">
        {SERIES.map((s) => (
          <span key={s.nome} className="flex items-center gap-1.5">
            <span
              className="size-1.5 rounded-full"
              style={{ backgroundColor: s.cor }}
            />
            {s.nome}
          </span>
        ))}
      </div>
    </>
  );
}
