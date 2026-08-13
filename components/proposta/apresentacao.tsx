"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Lock,
  TrendingUp,
  MessageCircle,
  Sparkles,
  X,
} from "lucide-react";
import { Icone } from "@/components/marketing/icone";
import { FotoPainel } from "@/components/comum/foto-painel";
import { FotoCelular } from "@/components/comum/foto-celular";
import { ConversaWhatsApp } from "@/components/comum/conversa-whatsapp";
import { Button } from "@/components/ui/button";
import { responderProposta } from "@/lib/actions/propostas";
import {
  entregas,
  metodoProposta,
  planosProposta,
  porQueNos,
  proximosPassos,
  seguranca,
} from "@/lib/proposta-conteudo";
import type { PlanoProposta, Proposta } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

/**
 * A proposta, em slides laterais.
 *
 * Horizontal de propósito: é o gesto de apresentação — passa-se um
 * slide, não se rola uma página. No celular o deslizar lateral é
 * nativo; no computador as setas do teclado e os botões conduzem, que
 * é como o vendedor apresenta numa reunião.
 *
 * Cada slide tenta mostrar antes de explicar: o painel aparece como
 * painel, a mensagem aparece como conversa, o funil aparece como
 * funil. Texto em caixa é o último recurso, não o primeiro.
 */
export function Apresentacao({
  proposta,
  whatsapp,
}: {
  proposta: Proposta;
  whatsapp: string;
}) {
  const trilho = useRef<HTMLDivElement>(null);
  const [atual, setAtual] = useState(0);
  const [total, setTotal] = useState(1);

  useEffect(() => {
    const el = trilho.current;
    if (!el) return;

    setTotal(el.querySelectorAll("[data-slide]").length);

    // Arredonda pela largura de um slide: durante o encaixe a posição
    // fica fracionada, e sem isso o indicador piscaria entre dois.
    const aoRolar = () => setAtual(Math.round(el.scrollLeft / el.clientWidth));

    aoRolar();
    el.addEventListener("scroll", aoRolar, { passive: true });
    window.addEventListener("resize", aoRolar);
    return () => {
      el.removeEventListener("scroll", aoRolar);
      window.removeEventListener("resize", aoRolar);
    };
  }, []);

  const irPara = useCallback((i: number) => {
    const el = trilho.current;
    if (!el) return;
    const limite = el.querySelectorAll("[data-slide]").length - 1;
    el.scrollTo({
      left: Math.max(0, Math.min(i, limite)) * el.clientWidth,
      behavior: "smooth",
    });
  }, []);

  useEffect(() => {
    function teclado(e: KeyboardEvent) {
      // Sem sequestrar o teclado de quem está digitando num campo
      if (
        e.target instanceof HTMLElement &&
        e.target.closest("input,textarea")
      ) {
        return;
      }
      if (["ArrowRight", "PageDown", " "].includes(e.key)) {
        e.preventDefault();
        irPara(atual + 1);
      }
      if (["ArrowLeft", "PageUp"].includes(e.key)) {
        e.preventDefault();
        irPara(atual - 1);
      }
    }
    window.addEventListener("keydown", teclado);
    return () => window.removeEventListener("keydown", teclado);
  }, [atual, irPara]);

  const ultimo = atual >= total - 1;

  return (
    <div className="relative h-[100dvh] overflow-hidden bg-branco-clinico">
      <div className="absolute inset-x-0 top-0 z-40 h-1 bg-verde-menta">
        <div
          className="h-full bg-teal transition-[width] duration-500"
          style={{ width: `${((atual + 1) / total) * 100}%` }}
        />
      </div>

      {/* Trilho dos slides */}
      <div
        ref={trilho}
        className="flex h-full snap-x snap-mandatory overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <Capa proposta={proposta} />
        <Diagnostico cliente={proposta.cliente_nome} />
        <Metodo />
        <Entregas />
        <Plataforma />
        <Automacao />
        <Numeros />
        <PorQueNos />
        <Planos proposta={proposta} />
        <Implantacao />
        <Seguranca />
        <Fechamento proposta={proposta} whatsapp={whatsapp} />
      </div>

      {/* Controles */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-40 flex items-center justify-between gap-3 px-4 pb-4 sm:px-6 sm:pb-6">
        <button
          onClick={() => irPara(atual - 1)}
          disabled={atual === 0}
          aria-label="Slide anterior"
          className={cn(
            "pointer-events-auto grid size-11 place-items-center rounded-full border border-border bg-white/90 text-azul-medico shadow-soft backdrop-blur transition-opacity",
            atual === 0 && "pointer-events-none opacity-0",
          )}
        >
          <ChevronLeft className="size-5" />
        </button>

        <div className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-border bg-white/90 px-3 py-2 shadow-soft backdrop-blur">
          {Array.from({ length: total }).map((_, i) => (
            <button
              key={i}
              onClick={() => irPara(i)}
              aria-label={`Ir para o slide ${i + 1}`}
              aria-current={i === atual}
              className={cn(
                "h-2 rounded-full transition-all",
                i === atual
                  ? "w-6 bg-teal"
                  : "w-2 bg-cinza-suave/30 hover:bg-teal/50",
              )}
            />
          ))}
        </div>

        <button
          onClick={() => irPara(atual + 1)}
          disabled={ultimo}
          aria-label="Próximo slide"
          className={cn(
            "pointer-events-auto grid size-11 place-items-center rounded-full shadow-soft transition-opacity",
            ultimo
              ? "pointer-events-none opacity-0"
              : "bg-teal text-white hover:bg-teal/90",
          )}
        >
          <ChevronRight className="size-5" />
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Moldura                                                             */
/* ------------------------------------------------------------------ */

/**
 * Um slide ocupa a largura inteira e rola por dentro no vertical.
 *
 * A rolagem interna existe para o celular: numa tela baixa, prender o
 * slide sem deixar rolar esconderia o fim do conteúdo sem aviso.
 */
function Slide({
  children,
  escuro = false,
  className,
}: {
  children: React.ReactNode;
  escuro?: boolean;
  className?: string;
}) {
  return (
    <section
      data-slide
      className={cn(
        "relative h-full w-full shrink-0 snap-center overflow-y-auto",
        escuro ? "bg-azul-medico text-white" : "bg-branco-clinico",
        className,
      )}
    >
      <div className="mx-auto flex min-h-full w-full max-w-5xl items-center px-5 pb-24 pt-12 sm:px-8 md:pb-28 md:pt-16">
        <div className="w-full">{children}</div>
      </div>
    </section>
  );
}

function Rotulo({
  children,
  escuro,
}: {
  children: React.ReactNode;
  escuro?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide",
        escuro ? "bg-white/10 text-teal-claro" : "bg-verde-menta text-teal",
      )}
    >
      {children}
    </span>
  );
}

function Titulo({
  children,
  escuro,
}: {
  children: React.ReactNode;
  escuro?: boolean;
}) {
  return (
    <h2
      className={cn(
        "mt-3 max-w-3xl text-[1.6rem] leading-tight sm:text-3xl md:text-4xl",
        escuro && "text-white",
      )}
    >
      {children}
    </h2>
  );
}

/* ------------------------------------------------------------------ */
/* Slides                                                              */
/* ------------------------------------------------------------------ */

function Capa({ proposta: p }: { proposta: Proposta }) {
  const validade = p.valida_ate
    ? new Date(`${p.valida_ate}T12:00:00`).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <Slide escuro className="overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-40 -top-20 size-[520px] rounded-full bg-teal/20 blur-3xl"
      />
      <FotoPainel />

      <div className="relative lg:max-w-[46%]">
        <div>
          <div className="mb-7">
            {p.cliente_logo_url ? (
              <span className="inline-block rounded-xl bg-white p-3">
                <Image
                  src={p.cliente_logo_url}
                  alt={p.cliente_nome}
                  width={200}
                  height={64}
                  unoptimized
                  className="h-12 w-auto object-contain"
                />
              </span>
            ) : (
              <span className="grid size-16 place-items-center rounded-2xl bg-white/10 font-heading text-2xl font-bold text-white">
                {p.cliente_nome.charAt(0).toUpperCase()}
              </span>
            )}
          </div>

          <Rotulo escuro>
            <Sparkles className="size-3.5" />
            Proposta comercial
          </Rotulo>

          <h1 className="mt-4 text-3xl leading-[1.1] text-white sm:text-4xl md:text-5xl">
            A agenda da {p.cliente_nome} cheia,
            <span className="text-teal-claro"> atendida e no controle.</span>
          </h1>

          <p className="mt-5 max-w-lg text-white/70">
            {p.mensagem?.trim()
              ? p.mensagem
              : `Um método validado para ${
                  p.especialidade
                    ? `a sua ${p.especialidade.toLowerCase()}`
                    : "a sua clínica"
                } faturar mais com a estrutura que já tem: marketing que traz o paciente certo, equipe treinada para não perder nenhum e a plataforma que mantém tudo no lugar.`}
          </p>

          <dl className="mt-8 flex flex-wrap gap-x-8 gap-y-4 text-sm">
            {p.responsavel && (
              <div>
                <dt className="text-white/45">Preparada para</dt>
                <dd className="font-semibold text-white">{p.responsavel}</dd>
              </div>
            )}
            {p.cidade && (
              <div>
                <dt className="text-white/45">Cidade</dt>
                <dd className="font-semibold text-white">{p.cidade}</dd>
              </div>
            )}
            {validade && (
              <div>
                <dt className="text-white/45">Válida até</dt>
                <dd className="font-semibold text-white">{validade}</dd>
              </div>
            )}
          </dl>

          <p className="mt-9 flex items-center gap-2 text-sm text-white/50">
            <ArrowRight className="size-4 animate-pulse" />
            Deslize para o lado, ou use as setas do teclado
          </p>

          {/* Nossa assinatura fica pequena e embaixo: a capa é da
              clínica, e a logo dela já ocupa o alto. */}
          <Image
            src="/logo-medimarketing-branca.svg"
            alt="Medi Marketing"
            width={150}
            height={26}
            className="mt-10 h-6 w-auto opacity-60"
          />
        </div>
      </div>
    </Slide>
  );
}

/**
 * O funil furado.
 *
 * Uma tabela de dores não mostra a conta; o funil mostra. Cada degrau
 * perdido tem um número ao lado, e é a soma deles que justifica o
 * preço três slides adiante.
 */
function Diagnostico({ cliente }: { cliente: string }) {
  const etapas = [
    { rotulo: "Pessoas que procuram", n: 100, largura: "100%", perda: null },
    {
      rotulo: "Conseguem falar com alguém",
      n: 62,
      largura: "62%",
      perda: "38 desistem sem resposta rápida",
    },
    {
      rotulo: "Marcam consulta",
      n: 41,
      largura: "41%",
      perda: "21 se perdem entre a conversa e a agenda",
    },
    {
      rotulo: "Comparecem",
      n: 29,
      largura: "29%",
      perda: "12 faltam sem avisar",
    },
    {
      rotulo: "Voltam alguma vez",
      n: 11,
      largura: "11%",
      perda: "18 nunca mais são procurados",
    },
  ];

  return (
    <Slide>
      <Rotulo>O ponto de partida</Rotulo>
      <Titulo>Onde o paciente da {cliente} se perde hoje</Titulo>
      <p className="mt-2 max-w-2xl text-sm text-cinza-suave sm:text-base">
        A cada cem pessoas que procuram uma clínica sem processo, é assim que a
        conta costuma terminar. Nenhum desses furos é falta de competência
        clínica. Todos são falha de processo.
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <ol className="space-y-2.5">
          {etapas.map((e) => (
            <li key={e.rotulo}>
              <div className="mb-1 flex items-baseline justify-between gap-3">
                <span className="text-sm font-medium text-azul-medico">
                  {e.rotulo}
                </span>
                <span className="font-heading text-sm font-bold text-azul-medico">
                  {e.n}
                </span>
              </div>
              <div className="h-6 overflow-hidden rounded-md bg-white shadow-soft">
                <div
                  className={cn(
                    "h-full rounded-md transition-all",
                    e.perda ? "bg-teal/70" : "bg-azul-medico",
                  )}
                  style={{ width: e.largura }}
                />
              </div>
              {e.perda && (
                <p className="mt-1 flex items-center gap-1.5 text-xs text-coral">
                  <X className="size-3.5 shrink-0" />
                  {e.perda}
                </p>
              )}
            </li>
          ))}
        </ol>

        <div className="self-center rounded-2xl border border-coral/25 bg-coral/5 p-6">
          <p className="font-heading text-5xl font-bold text-coral">89</p>
          <p className="mt-2 text-sm leading-relaxed text-cinza-texto">
            de cada <strong>100</strong> pessoas interessadas não viram paciente
            recorrente.
          </p>
          <p className="mt-4 border-t border-coral/20 pt-4 text-sm leading-relaxed text-cinza-suave">
            Recuperar <strong className="text-azul-medico">uma</strong> delas
            por semana já costuma pagar o investimento deste plano.
          </p>
        </div>
      </div>
    </Slide>
  );
}

/**
 * O método, que é o que a clínica está comprando de fato.
 *
 * Sem esta tela a proposta parecia um cardápio de serviços avulsos:
 * marketing, atendimento, retenção, cada um por si. O que justifica o
 * preço é existir uma ordem entre eles, e ela ter sido rodada antes.
 */
function Metodo() {
  return (
    <Slide escuro>
      <Rotulo escuro>
        <TrendingUp className="size-3.5" />O método
      </Rotulo>
      <Titulo escuro>
        Um caminho único, já rodado em mais de cem clínicas
      </Titulo>
      <p className="mt-3 max-w-2xl text-white/70">
        Não é um pacote de serviços soltos. É uma ordem: cada etapa só começa
        quando a anterior está de pé, e é por isso que o faturamento sobe em
        degrau em vez de oscilar.
      </p>

      <ol className="relative mt-10 grid gap-6 md:grid-cols-5">
        {metodoProposta.map((m, i) => (
          <li key={m.etapa} className="relative">
            {/* A linha liga uma etapa à seguinte, e para na última */}
            {i < metodoProposta.length - 1 && (
              <span
                aria-hidden
                className="absolute left-9 top-4 hidden w-[calc(100%-1.5rem)] border-t border-dashed border-teal-claro/40 md:block"
              />
            )}
            <span className="relative z-10 grid size-8 place-items-center rounded-full bg-teal font-heading text-xs font-bold text-white">
              {i + 1}
            </span>
            <p className="mt-3 text-[11px] font-bold uppercase tracking-wide text-teal-claro">
              {m.quando}
            </p>
            <h3 className="mt-0.5 font-heading text-sm font-semibold text-white">
              {m.titulo}
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-white/60">
              {m.texto}
            </p>
          </li>
        ))}
      </ol>

      <p className="mt-9 rounded-xl border border-teal/25 bg-white/5 px-5 py-4 text-sm text-white/75">
        <strong className="font-semibold text-white">
          O objetivo do método é um só: faturar mais com a estrutura que você já
          tem.
        </strong>{" "}
        Primeiro parando a perda, depois aumentando a entrada, e só então
        escalando o investimento.
      </p>
    </Slide>
  );
}

function Entregas() {
  return (
    <Slide>
      <Rotulo>O que entregamos</Rotulo>
      <Titulo>Quatro frentes, operadas por gente, num sistema só</Titulo>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {entregas.map((e, i) => (
          <div
            key={e.titulo}
            className="rounded-xl border border-border bg-white p-5 shadow-soft"
          >
            <div className="mb-3 flex items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-verde-menta text-teal">
                <Icone nome={e.icone} className="size-5" />
              </span>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wide text-teal">
                  Frente {i + 1}
                </span>
                <h3 className="font-heading text-base font-semibold leading-tight text-azul-medico">
                  {e.titulo}
                </h3>
              </div>
            </div>
            <ul className="space-y-1.5">
              {e.itens.map((it) => (
                <li key={it} className="flex gap-2 text-sm text-cinza-suave">
                  <Check className="mt-0.5 size-4 shrink-0 text-teal" />
                  {it}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Slide>
  );
}

function Plataforma() {
  const modulos = [
    ["Agenda", "Mês, semana e dia, com status de cada consulta."],
    ["CRM e funil", "Cada contato numa etapa clara, com histórico."],
    ["Atendimento", "WhatsApp, Instagram e Facebook numa caixa só."],
    ["Confirmações", "Lembrete e confirmação sem ninguém tocar."],
    ["Retenção", "Réguas de retorno, aniversário e reativação."],
    ["Indicadores", "Do investimento ao faturamento, sem jargão."],
  ];

  return (
    <Slide escuro>
      <div className="grid items-center gap-8 lg:grid-cols-[1.15fr_1fr]">
        <div>
          <Rotulo escuro>A plataforma</Rotulo>
          <Titulo escuro>
            Não é só agência. É o sistema que roda a clínica.
          </Titulo>
          <p className="mt-3 text-white/70">
            Um painel para gestor, secretária e médico, cada um vendo o que
            precisa. Incluído em todos os planos, sem custo à parte.
          </p>

          <div className="mt-6 grid gap-2.5 sm:grid-cols-2">
            {modulos.map(([titulo, texto]) => (
              <div
                key={titulo}
                className="rounded-lg border border-white/10 bg-white/5 p-3.5"
              >
                <h3 className="text-sm font-semibold text-white">{titulo}</h3>
                <p className="mt-1 text-xs leading-relaxed text-white/55">
                  {texto}
                </p>
              </div>
            ))}
          </div>

          <p className="mt-5 flex items-center gap-2 text-sm text-white/55">
            <Lock className="size-4 shrink-0 text-teal-claro" />
            Acesso separado por papel. Cada clínica é um ambiente isolado.
          </p>
        </div>

        <FotoCelular className="hidden h-[62vh] lg:block" />
      </div>
    </Slide>
  );
}

function Automacao() {
  const ciclo = [
    ["Ao marcar", "O paciente recebe o comprovante, por e-mail e WhatsApp."],
    ["Um dia útil antes", "O lembrete sai sozinho, na hora que você escolheu."],
    ["Ele responde", "Confirma num toque. A agenda muda de status na hora."],
    ["Se pedir para remarcar", "Vira alerta com o telefone dele na mensagem."],
  ];

  return (
    <Slide>
      <div className="grid items-center gap-8 lg:grid-cols-[1fr_1fr]">
        <div>
          <Rotulo>Onde a conta fecha</Rotulo>
          <Titulo>A consulta se confirma sozinha, pelo seu número</Titulo>
          <p className="mt-3 text-cinza-suave">
            Falta quase nunca é descaso: é esquecimento. Cada consulta que deixa
            de virar falta é receita que já estava na sua agenda.
          </p>

          <ol className="mt-6 space-y-3">
            {ciclo.map(([quando, texto], i) => (
              <li key={quando} className="flex gap-3.5">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-azul-medico font-heading text-xs font-bold text-white">
                  {i + 1}
                </span>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-teal">
                    {quando}
                  </p>
                  <p className="text-sm leading-relaxed text-cinza-texto">
                    {texto}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        {/* A mensagem como ela chega, não descrita */}
        <div className="mx-auto w-full max-w-xs lg:max-w-sm">
          <ConversaWhatsApp />
        </div>
      </div>
    </Slide>
  );
}

/**
 * Prova em duas leituras: o tamanho da operação e o efeito num
 * indicador só — o comparecimento, que é o que o médico sente na pele.
 */
function Numeros() {
  const marcos = [
    ["+120", "médicos e clínicas atendidos"],
    ["R$ 38 mi", "gerados para clientes"],
    ["+90 mil", "consultas agendadas"],
    ["-41%", "de faltas com a régua"],
  ];

  return (
    <Slide escuro>
      <Rotulo escuro>Prova</Rotulo>
      <Titulo escuro>O que já construímos com clínicas como a sua</Titulo>

      <dl className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {marcos.map(([valor, label]) => (
          <div
            key={label}
            className="rounded-xl border border-white/10 bg-white/5 p-5"
          >
            <dt className="font-heading text-3xl font-bold text-teal-claro">
              {valor}
            </dt>
            <dd className="mt-1 text-sm leading-relaxed text-white/60">
              {label}
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-8 grid items-center gap-6 rounded-2xl border border-white/10 bg-white/5 p-6 lg:grid-cols-[1fr_1.2fr]">
        <div>
          <p className="text-sm font-semibold text-white">
            Comparecimento antes e depois da régua de confirmação
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-white/55">
            Média das clínicas no terceiro mês de operação.
          </p>
        </div>
        <div className="space-y-3">
          {[
            ["Antes", 68, "bg-white/25"],
            ["Depois", 91, "bg-teal"],
          ].map(([rotulo, valor, cor]) => (
            <div key={rotulo as string}>
              <div className="mb-1 flex justify-between text-xs text-white/60">
                <span>{rotulo as string}</span>
                <span className="font-semibold text-white">{valor}%</span>
              </div>
              <div className="h-6 overflow-hidden rounded-md bg-white/10">
                <div
                  className={cn("h-full rounded-md", cor as string)}
                  style={{ width: `${valor}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <figure className="mt-7 max-w-2xl border-l-2 border-teal pl-5">
        <blockquote className="text-white/85">
          “A diferença não foi só o número de pacientes. Foi parar de perder os
          que já chegavam.”
        </blockquote>
        <figcaption className="mt-2 text-sm text-white/45">
          Dermatologia · São Paulo
        </figcaption>
      </figure>
    </Slide>
  );
}

function PorQueNos() {
  return (
    <Slide>
      <Rotulo>Por que a Medi Marketing</Rotulo>
      <Titulo>O que nos separa de uma agência comum</Titulo>

      <div className="mt-8 grid gap-5 sm:grid-cols-2">
        {porQueNos.map((d) => (
          <div key={d.titulo} className="flex gap-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-verde-menta text-teal">
              <Icone nome={d.icone} className="size-5" />
            </span>
            <div>
              <h3 className="font-heading text-base font-semibold text-azul-medico">
                {d.titulo}
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-cinza-suave">
                {d.texto}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* A comparação explícita, que o cliente faria de qualquer jeito */}
      <div className="mt-8 overflow-hidden rounded-xl border border-border bg-white shadow-soft">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-cinza-suave">
              <th className="px-4 py-2.5 font-semibold">&nbsp;</th>
              <th className="px-4 py-2.5 font-semibold">Agência comum</th>
              <th className="bg-verde-menta px-4 py-2.5 font-semibold text-teal">
                Medi Marketing
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {[
              ["Entrega", "Relatório em PDF", "Sistema rodando a clínica"],
              ["Atendimento", "Fica com você", "Equipe treinada atende"],
              ["Agenda", "Não enxerga", "Integrada e confirmada"],
              ["Retenção", "Raramente", "Régua ativa na base"],
            ].map(([o, a, b]) => (
              <tr key={o}>
                <td className="px-4 py-2.5 font-medium text-azul-medico">
                  {o}
                </td>
                <td className="px-4 py-2.5 text-cinza-suave">{a}</td>
                <td className="bg-verde-menta/40 px-4 py-2.5 font-medium text-azul-medico">
                  {b}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Slide>
  );
}

function precoEmReais(valor: number | null): string {
  if (valor === null) return "Sob consulta";
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function Planos({ proposta: p }: { proposta: Proposta }) {
  const precos: Record<PlanoProposta, number | null> = {
    essencial: p.preco_essencial,
    performance: p.preco_performance,
    full: p.preco_full,
  };

  return (
    <Slide>
      <Rotulo>Investimento</Rotulo>
      <Titulo>Os planos preparados para a {p.cliente_nome}</Titulo>
      <p className="mt-2 text-sm text-cinza-suave sm:text-base">
        Sem taxa de implantação e sem fidelidade. A plataforma está incluída em
        todos.
      </p>

      <div className="mt-7 grid gap-4 lg:grid-cols-3">
        {planosProposta.map((plano) => {
          const destaque = plano.id === p.plano_destaque;
          const valor = precos[plano.id];

          return (
            <div
              key={plano.id}
              className={cn(
                "relative flex flex-col rounded-2xl border p-5",
                destaque
                  ? "border-teal bg-azul-medico text-white shadow-card"
                  : "border-border bg-white shadow-soft",
              )}
            >
              {destaque && (
                <span className="absolute -top-2.5 left-5 rounded-full bg-teal px-2.5 py-1 text-[10px] font-bold uppercase leading-none tracking-wide text-white">
                  Recomendado
                </span>
              )}

              <h3
                className={cn(
                  "font-heading text-lg font-bold",
                  destaque ? "text-white" : "text-azul-medico",
                )}
              >
                {plano.nome}
              </h3>
              <p
                className={cn(
                  "mt-1 text-xs",
                  destaque ? "text-white/60" : "text-cinza-suave",
                )}
              >
                {plano.resumo}
              </p>

              <p className="mt-4 flex items-baseline gap-1">
                <span
                  className={cn(
                    "font-heading text-3xl font-bold",
                    destaque ? "text-teal-claro" : "text-azul-medico",
                  )}
                >
                  {precoEmReais(valor)}
                </span>
                {valor !== null && (
                  <span
                    className={cn(
                      "text-xs",
                      destaque ? "text-white/50" : "text-cinza-suave",
                    )}
                  >
                    /mês
                  </span>
                )}
              </p>

              <ul className="mt-4 grid flex-1 gap-1.5">
                {plano.itens.map((i) => (
                  <li
                    key={i}
                    className={cn(
                      "flex gap-2 text-xs leading-relaxed",
                      destaque ? "text-white/80" : "text-cinza-suave",
                    )}
                  >
                    <Check
                      className={cn(
                        "mt-0.5 size-3.5 shrink-0",
                        destaque ? "text-teal-claro" : "text-teal",
                      )}
                    />
                    {i}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </Slide>
  );
}

/** A linha do tempo tira o medo do "e depois que eu assinar?". */
function Implantacao() {
  const fases = [
    [
      "Semana 1",
      "Diagnóstico e acessos",
      "Entendemos a rotina e configuramos a plataforma.",
    ],
    [
      "Semana 2",
      "Base e equipe",
      "Importamos seus pacientes e treinamos quem atende.",
    ],
    [
      "Semana 3",
      "Campanhas no ar",
      "Google e Meta rodando, com a agenda pronta para receber.",
    ],
    [
      "Mês 2 em diante",
      "Ajuste e escala",
      "Régua de retenção ativa e reunião de resultado.",
    ],
  ];

  return (
    <Slide>
      <Rotulo>Os primeiros 30 dias</Rotulo>
      <Titulo>O que acontece depois que você diz sim</Titulo>

      <ol className="mt-10 grid gap-6 md:grid-cols-4">
        {fases.map(([quando, titulo, texto], i) => (
          <li key={quando} className="relative">
            {/* A linha só existe onde há um próximo passo */}
            {i < fases.length - 1 && (
              <span
                aria-hidden
                className="absolute left-11 top-4 hidden w-[calc(100%-2rem)] border-t border-dashed border-teal/40 md:block"
              />
            )}
            <span className="relative z-10 grid size-9 place-items-center rounded-full border border-teal/30 bg-white font-heading text-sm font-bold text-teal shadow-soft">
              {i + 1}
            </span>
            <p className="mt-3 text-[11px] font-bold uppercase tracking-wide text-teal">
              {quando}
            </p>
            <h3 className="mt-0.5 font-heading text-base font-semibold text-azul-medico">
              {titulo}
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-cinza-suave">
              {texto}
            </p>
          </li>
        ))}
      </ol>
    </Slide>
  );
}

function Seguranca() {
  return (
    <Slide escuro>
      <Rotulo escuro>Sem letra miúda</Rotulo>
      <Titulo escuro>O que você não precisa temer ao começar</Titulo>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {seguranca.map((s) => (
          <div
            key={s.titulo}
            className="rounded-xl border border-white/10 bg-white/5 p-5"
          >
            <h3 className="flex items-center gap-2 font-heading text-base font-semibold text-white">
              <CheckCircle2 className="size-4 shrink-0 text-teal-claro" />
              {s.titulo}
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-white/60">
              {s.texto}
            </p>
          </div>
        ))}
      </div>
    </Slide>
  );
}

function Fechamento({
  proposta: p,
  whatsapp,
}: {
  proposta: Proposta;
  whatsapp: string;
}) {
  const [estado, setEstado] = useState<"aberta" | "enviando" | "aceita">(
    p.status === "aceita" ? "aceita" : "aberta",
  );
  const [erro, setErro] = useState<string | null>(null);

  async function aceitar() {
    setErro(null);
    setEstado("enviando");
    const res = await responderProposta(p.token, "aceita", p.plano_destaque);
    if (!res.ok) {
      setErro(res.erro);
      setEstado("aberta");
      return;
    }
    setEstado("aceita");
  }

  const zap = `https://wa.me/${whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(
    `Olá! Sou da ${p.cliente_nome} e recebi a proposta. Quero conversar.`,
  )}`;

  return (
    <Slide>
      <div className="mx-auto max-w-2xl text-center">
        {estado === "aceita" ? (
          <>
            <CheckCircle2 className="mx-auto size-14 text-teal" />
            <h2 className="mt-4 text-2xl sm:text-3xl">
              Proposta aceita. Obrigado!
            </h2>
            <p className="mx-auto mt-3 max-w-md text-cinza-suave">
              Nossa equipe já foi avisada e entra em contato hoje mesmo para
              marcar o diagnóstico. Se preferir adiantar, chame no WhatsApp.
            </p>
            <Button asChild variant="teal" size="lg" className="mt-7">
              <a href={zap} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="size-5" />
                Falar agora no WhatsApp
              </a>
            </Button>
          </>
        ) : (
          <>
            <Rotulo>Próximos passos</Rotulo>
            <h2 className="mt-4 text-2xl sm:text-3xl md:text-4xl">
              Vamos encher a agenda da {p.cliente_nome}?
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-cinza-suave">
              Ao aceitar, nossa equipe é avisada na hora e marca a reunião de
              diagnóstico. Você não assina nada agora.
            </p>

            <ol className="mx-auto mt-8 grid max-w-xl gap-3 text-left sm:grid-cols-2">
              {proximosPassos.map((s) => (
                <li
                  key={s.passo}
                  className="flex gap-3 rounded-lg border border-border bg-white p-3.5 shadow-soft"
                >
                  <span className="font-heading text-lg font-bold text-teal">
                    {s.passo}
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold text-azul-medico">
                      {s.titulo}
                    </h3>
                    <p className="mt-0.5 text-xs leading-relaxed text-cinza-suave">
                      {s.texto}
                    </p>
                  </div>
                </li>
              ))}
            </ol>

            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Button
                variant="primary"
                size="lg"
                onClick={aceitar}
                disabled={estado === "enviando"}
              >
                {estado === "enviando" ? (
                  <>
                    <Loader2 className="size-5 animate-spin" /> Registrando…
                  </>
                ) : (
                  <>
                    Aceitar a proposta <ArrowRight className="size-5" />
                  </>
                )}
              </Button>
              <Button asChild variant="outline" size="lg">
                <a href={zap} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="size-5" />
                  Tenho uma dúvida
                </a>
              </Button>
            </div>

            {erro && (
              <p className="mt-3 text-sm text-vermelho-alerta">{erro}</p>
            )}
          </>
        )}

        <div className="mt-10 flex flex-col items-center gap-2">
          <Image
            src="/logo-medimarketing.svg"
            alt="Medi Marketing"
            width={170}
            height={30}
            className="h-7 w-auto"
          />
          <p className="text-xs text-cinza-suave">
            Proposta preparada para {p.cliente_nome}
          </p>
        </div>
      </div>
    </Slide>
  );
}
