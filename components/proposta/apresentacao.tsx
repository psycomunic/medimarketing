"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  ArrowDown,
  ArrowRight,
  Check,
  CheckCircle2,
  Loader2,
  Lock,
  MessageCircle,
  Sparkles,
} from "lucide-react";
import { Icone } from "@/components/marketing/icone";
import { Button } from "@/components/ui/button";
import { responderProposta } from "@/lib/actions/propostas";
import {
  cicloAutomatico,
  diagnostico,
  entregas,
  planosProposta,
  porQueNos,
  proximosPassos,
  seguranca,
} from "@/lib/proposta-conteudo";
import type { PlanoProposta, Proposta } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

/**
 * A proposta, em telas.
 *
 * Rolagem com encaixe (scroll-snap) em vez de um carrossel de verdade:
 * o médico vai abrir isto no celular, entre um paciente e outro, e o
 * gesto que ele já conhece é deslizar. Um carrossel com setas exigiria
 * aprender a navegar antes de ler.
 *
 * No computador, as teclas de seta e os pontos laterais dão o controle
 * de apresentação — é assim que o vendedor conduz numa reunião.
 */
export function Apresentacao({
  proposta,
  whatsapp,
}: {
  proposta: Proposta;
  whatsapp: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [atual, setAtual] = useState(0);
  const [total, setTotal] = useState(1);

  useEffect(() => {
    const el = container.current;
    if (!el) return;

    const telas = () => Array.from(el.querySelectorAll<HTMLElement>("[data-tela]"));
    setTotal(telas().length);

    // Qual tela ocupa o meio da janela — mais estável que o topo,
    // que oscila durante o encaixe da rolagem.
    const aoRolar = () => {
      const meio = el.scrollTop + el.clientHeight / 2;
      const i = telas().findIndex((t) => t.offsetTop + t.offsetHeight > meio);
      setAtual(i < 0 ? telas().length - 1 : i);
    };

    aoRolar();
    el.addEventListener("scroll", aoRolar, { passive: true });
    return () => el.removeEventListener("scroll", aoRolar);
  }, []);

  function irPara(i: number) {
    const el = container.current;
    if (!el) return;
    const telas = Array.from(el.querySelectorAll<HTMLElement>("[data-tela]"));
    telas[Math.max(0, Math.min(i, telas.length - 1))]?.scrollIntoView({
      behavior: "smooth",
    });
  }

  useEffect(() => {
    function teclado(e: KeyboardEvent) {
      if (["ArrowDown", "PageDown", " "].includes(e.key)) {
        e.preventDefault();
        irPara(atual + 1);
      }
      if (["ArrowUp", "PageUp"].includes(e.key)) {
        e.preventDefault();
        irPara(atual - 1);
      }
    }
    window.addEventListener("keydown", teclado);
    return () => window.removeEventListener("keydown", teclado);
  }, [atual]);

  return (
    <div className="relative h-[100dvh] overflow-hidden bg-branco-clinico">
      {/* Progresso: diz quanto falta, que é o que sustenta a leitura */}
      <div className="absolute inset-x-0 top-0 z-30 h-1 bg-verde-menta">
        <div
          className="h-full bg-teal transition-[width] duration-500"
          style={{ width: `${((atual + 1) / total) * 100}%` }}
        />
      </div>

      {/* Pontos de navegação, só onde há espaço e mouse */}
      <nav
        aria-label="Telas da proposta"
        className="absolute right-5 top-1/2 z-30 hidden -translate-y-1/2 flex-col gap-2.5 lg:flex"
      >
        {Array.from({ length: total }).map((_, i) => (
          <button
            key={i}
            onClick={() => irPara(i)}
            aria-label={`Ir para a tela ${i + 1}`}
            aria-current={i === atual}
            className={cn(
              "size-2.5 rounded-full transition-all",
              i === atual ? "scale-125 bg-teal" : "bg-cinza-suave/30 hover:bg-teal/50"
            )}
          />
        ))}
      </nav>

      <div
        ref={container}
        className="h-full snap-y snap-mandatory overflow-y-auto scroll-smooth"
      >
        <Capa proposta={proposta} aoAvancar={() => irPara(1)} />
        <Diagnostico cliente={proposta.cliente_nome} />
        <Entregas />
        <Plataforma />
        <Automacao />
        <Numeros />
        <PorQueNos />
        <Planos proposta={proposta} />
        <Seguranca />
        <Fechamento proposta={proposta} whatsapp={whatsapp} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Moldura comum                                                       */
/* ------------------------------------------------------------------ */

/**
 * Cada tela ocupa a altura da janela mas rola por dentro quando o
 * conteúdo não cabe — num celular baixo, encaixar a tela sem deixar
 * rolar esconderia o fim do texto sem aviso.
 */
function Tela({
  children,
  escura = false,
  className,
}: {
  children: React.ReactNode;
  escura?: boolean;
  className?: string;
}) {
  return (
    <section
      data-tela
      className={cn(
        "flex min-h-[100dvh] snap-start items-center overflow-y-auto px-5 py-16 sm:px-8 md:py-20",
        escura ? "bg-azul-medico text-white" : "bg-branco-clinico",
        className
      )}
    >
      <div className="mx-auto w-full max-w-5xl">{children}</div>
    </section>
  );
}

function Rotulo({ children, escura }: { children: React.ReactNode; escura?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wide",
        escura ? "bg-white/10 text-teal-claro" : "bg-verde-menta text-teal"
      )}
    >
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Telas                                                               */
/* ------------------------------------------------------------------ */

function Capa({
  proposta: p,
  aoAvancar,
}: {
  proposta: Proposta;
  aoAvancar: () => void;
}) {
  const validade = p.valida_ate
    ? new Date(`${p.valida_ate}T12:00:00`).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <Tela escura className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-32 top-0 size-[420px] rounded-full bg-teal/25 blur-3xl"
      />
      <div className="relative">
        {/* A logo do cliente vem primeiro: a proposta é dele */}
        <div className="mb-8">
          {p.cliente_logo_url ? (
            <Image
              src={p.cliente_logo_url}
              alt={p.cliente_nome}
              width={180}
              height={72}
              unoptimized
              className="h-16 w-auto object-contain"
            />
          ) : (
            <span className="grid size-16 place-items-center rounded-2xl bg-white/10 font-heading text-2xl font-bold text-white">
              {p.cliente_nome.charAt(0).toUpperCase()}
            </span>
          )}
        </div>

        <Rotulo escura>
          <Sparkles className="size-3.5" />
          Proposta comercial
        </Rotulo>

        <h1 className="mt-5 text-3xl leading-[1.15] text-white sm:text-4xl md:text-5xl lg:text-[3.2rem]">
          A agenda da {p.cliente_nome} cheia,
          <span className="text-teal-claro"> atendida e no controle.</span>
        </h1>

        <p className="mt-6 max-w-xl text-lg text-white/70">
          {p.mensagem?.trim()
            ? p.mensagem
            : `Um plano para ${
                p.especialidade
                  ? `a sua ${p.especialidade.toLowerCase()}`
                  : "a sua clínica"
              } atrair mais pacientes, atender melhor e enxergar os números — com marketing, equipe e plataforma no mesmo lugar.`}
        </p>

        <dl className="mt-10 flex flex-wrap gap-x-10 gap-y-4 text-sm">
          {p.responsavel && (
            <div>
              <dt className="text-white/50">Preparada para</dt>
              <dd className="font-semibold text-white">{p.responsavel}</dd>
            </div>
          )}
          {p.cidade && (
            <div>
              <dt className="text-white/50">Cidade</dt>
              <dd className="font-semibold text-white">{p.cidade}</dd>
            </div>
          )}
          {validade && (
            <div>
              <dt className="text-white/50">Válida até</dt>
              <dd className="font-semibold text-white">{validade}</dd>
            </div>
          )}
        </dl>

        <button
          onClick={aoAvancar}
          className="mt-12 inline-flex items-center gap-2 text-sm font-medium text-white/70 transition-colors hover:text-white"
        >
          Ver a proposta <ArrowDown className="size-4 animate-bounce" />
        </button>
      </div>
    </Tela>
  );
}

function Diagnostico({ cliente }: { cliente: string }) {
  return (
    <Tela>
      <Rotulo>O ponto de partida</Rotulo>
      <h2 className="mt-4 max-w-3xl text-2xl sm:text-3xl md:text-4xl">
        O que costuma travar o crescimento de uma clínica como a {cliente}
      </h2>
      <p className="mt-3 max-w-2xl text-cinza-suave">
        Nenhum destes problemas é falta de competência clínica. São falhas de
        processo — e processo se conserta.
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {diagnostico.map((d) => (
          <div
            key={d.titulo}
            className="rounded-xl border border-border bg-white p-5 shadow-soft"
          >
            <div className="mb-3 grid size-10 place-items-center rounded-lg bg-verde-menta text-teal">
              <Icone nome={d.icone} className="size-5" />
            </div>
            <h3 className="font-heading text-base font-semibold text-azul-medico">
              {d.titulo}
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-cinza-suave">
              {d.texto}
            </p>
          </div>
        ))}
      </div>
    </Tela>
  );
}

function Entregas() {
  return (
    <Tela>
      <Rotulo>O que entregamos</Rotulo>
      <h2 className="mt-4 max-w-3xl text-2xl sm:text-3xl md:text-4xl">
        Quatro frentes, operadas por gente, num sistema só
      </h2>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {entregas.map((e) => (
          <div
            key={e.titulo}
            className="rounded-xl border border-border bg-white p-5 shadow-soft"
          >
            <div className="mb-3 flex items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-verde-menta text-teal">
                <Icone nome={e.icone} className="size-5" />
              </span>
              <h3 className="font-heading text-base font-semibold text-azul-medico">
                {e.titulo}
              </h3>
            </div>
            <ul className="space-y-1.5">
              {e.itens.map((i) => (
                <li key={i} className="flex gap-2 text-sm text-cinza-suave">
                  <Check className="mt-0.5 size-4 shrink-0 text-teal" />
                  {i}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Tela>
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
    <Tela escura>
      <Rotulo escura>A plataforma</Rotulo>
      <h2 className="mt-4 max-w-3xl text-2xl text-white sm:text-3xl md:text-4xl">
        Não é só agência. É o sistema que roda a sua clínica.
      </h2>
      <p className="mt-3 max-w-2xl text-white/70">
        Um painel para gestor, secretária e médico — cada um vendo o que
        precisa, no computador ou no celular. Está incluído em todos os planos.
      </p>

      <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {modulos.map(([titulo, texto]) => (
          <div
            key={titulo}
            className="rounded-xl border border-white/10 bg-white/5 p-5"
          >
            <h3 className="font-heading text-base font-semibold text-white">
              {titulo}
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-white/60">{texto}</p>
          </div>
        ))}
      </div>

      <p className="mt-8 flex items-center gap-2 text-sm text-white/60">
        <Lock className="size-4 text-teal-claro" />
        Acesso separado por papel. Cada clínica é um ambiente isolado.
      </p>
    </Tela>
  );
}

function Automacao() {
  return (
    <Tela>
      <Rotulo>Onde a conta fecha</Rotulo>
      <h2 className="mt-4 max-w-3xl text-2xl sm:text-3xl md:text-4xl">
        A consulta se confirma sozinha, pelo número da sua clínica
      </h2>
      <p className="mt-3 max-w-2xl text-cinza-suave">
        Falta de paciente quase nunca é descaso: é esquecimento. Cada consulta
        que deixa de virar falta é receita que já estava na sua agenda.
      </p>

      <ol className="mt-10 grid gap-4 sm:grid-cols-2">
        {cicloAutomatico.map((c, i) => (
          <li
            key={c.titulo}
            className="flex gap-4 rounded-xl border border-border bg-white p-5 shadow-soft"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-azul-medico font-heading text-sm font-bold text-white">
              {i + 1}
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-teal">
                {c.quando}
              </p>
              <h3 className="mt-0.5 font-heading text-base font-semibold text-azul-medico">
                {c.titulo}
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-cinza-suave">
                {c.texto}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </Tela>
  );
}

function Numeros() {
  const numeros = [
    ["+120", "médicos e clínicas atendidos"],
    ["R$ 38 mi", "gerados em faturamento para clientes"],
    ["+90 mil", "consultas agendadas pela nossa operação"],
    ["-41%", "de faltas com a régua de confirmação"],
  ];

  return (
    <Tela escura>
      <Rotulo escura>Prova</Rotulo>
      <h2 className="mt-4 max-w-3xl text-2xl text-white sm:text-3xl md:text-4xl">
        O que já construímos com clínicas como a sua
      </h2>

      <dl className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
        {numeros.map(([valor, label]) => (
          <div key={label}>
            <dt className="font-heading text-3xl font-bold text-teal-claro md:text-4xl">
              {valor}
            </dt>
            <dd className="mt-1.5 text-sm leading-relaxed text-white/60">{label}</dd>
          </div>
        ))}
      </dl>

      <figure className="mt-12 max-w-2xl border-l-2 border-teal pl-5">
        <blockquote className="text-lg leading-relaxed text-white/85">
          “A diferença não foi só o número de pacientes. Foi parar de perder os
          que já chegavam.”
        </blockquote>
        <figcaption className="mt-3 text-sm text-white/50">
          Dermatologia · São Paulo
        </figcaption>
      </figure>
    </Tela>
  );
}

function PorQueNos() {
  return (
    <Tela>
      <Rotulo>Por que a Medi Marketing</Rotulo>
      <h2 className="mt-4 max-w-3xl text-2xl sm:text-3xl md:text-4xl">
        O que nos separa de uma agência comum
      </h2>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
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
    </Tela>
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
    <Tela>
      <Rotulo>Investimento</Rotulo>
      <h2 className="mt-4 max-w-3xl text-2xl sm:text-3xl md:text-4xl">
        Os planos preparados para a {p.cliente_nome}
      </h2>
      <p className="mt-3 max-w-2xl text-cinza-suave">
        Sem taxa de implantação e sem fidelidade. A plataforma está incluída em
        todos.
      </p>

      <div className="mt-10 grid gap-4 lg:grid-cols-3">
        {planosProposta.map((plano) => {
          const destaque = plano.id === p.plano_destaque;
          const valor = precos[plano.id];

          return (
            <div
              key={plano.id}
              className={cn(
                "relative flex flex-col rounded-2xl border p-6",
                destaque
                  ? "border-teal bg-azul-medico text-white shadow-card lg:-my-2 lg:py-8"
                  : "border-border bg-white shadow-soft"
              )}
            >
              {destaque && (
                <span className="absolute -top-3 left-6 rounded-full bg-teal px-3 py-1.5 text-[11px] font-bold uppercase leading-none tracking-wide text-white">
                  Recomendado para você
                </span>
              )}

              <h3
                className={cn(
                  "font-heading text-lg font-bold",
                  destaque ? "text-white" : "text-azul-medico"
                )}
              >
                {plano.nome}
              </h3>
              <p
                className={cn(
                  "mt-1 text-sm",
                  destaque ? "text-white/65" : "text-cinza-suave"
                )}
              >
                {plano.resumo}
              </p>

              <p className="mt-5 flex items-baseline gap-1">
                <span
                  className={cn(
                    "font-heading text-3xl font-bold",
                    destaque ? "text-teal-claro" : "text-azul-medico"
                  )}
                >
                  {precoEmReais(valor)}
                </span>
                {valor !== null && (
                  <span
                    className={cn(
                      "text-sm",
                      destaque ? "text-white/50" : "text-cinza-suave"
                    )}
                  >
                    /mês
                  </span>
                )}
              </p>

              <ul className="mt-6 grid flex-1 gap-2">
                {plano.itens.map((i) => (
                  <li
                    key={i}
                    className={cn(
                      "flex gap-2 text-sm",
                      destaque ? "text-white/80" : "text-cinza-suave"
                    )}
                  >
                    <Check
                      className={cn(
                        "mt-0.5 size-4 shrink-0",
                        destaque ? "text-teal-claro" : "text-teal"
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
    </Tela>
  );
}

function Seguranca() {
  return (
    <Tela escura>
      <Rotulo escura>Sem letra miúda</Rotulo>
      <h2 className="mt-4 max-w-3xl text-2xl text-white sm:text-3xl md:text-4xl">
        O que você não precisa temer ao começar
      </h2>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
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
    </Tela>
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
    p.status === "aceita" ? "aceita" : "aberta"
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
    `Olá! Sou da ${p.cliente_nome} e recebi a proposta. Quero conversar.`
  )}`;

  return (
    <Tela>
      <Rotulo>Próximos passos</Rotulo>
      <h2 className="mt-4 max-w-3xl text-2xl sm:text-3xl md:text-4xl">
        Como começa, se fizer sentido para você
      </h2>

      <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {proximosPassos.map((s) => (
          <li key={s.passo}>
            <span className="font-heading text-2xl font-bold text-teal-claro">
              {s.passo}
            </span>
            <h3 className="mt-1 font-heading text-base font-semibold text-azul-medico">
              {s.titulo}
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-cinza-suave">
              {s.texto}
            </p>
          </li>
        ))}
      </ol>

      <div className="mt-12 rounded-2xl border border-teal/25 bg-verde-menta/60 p-7 text-center">
        {estado === "aceita" ? (
          <>
            <CheckCircle2 className="mx-auto size-10 text-teal" />
            <h3 className="mt-3 font-heading text-xl font-bold text-azul-medico">
              Proposta aceita. Obrigado!
            </h3>
            <p className="mx-auto mt-2 max-w-md text-cinza-suave">
              Nossa equipe já foi avisada e entra em contato hoje mesmo para
              marcar o diagnóstico. Se preferir adiantar, chame no WhatsApp.
            </p>
            <Button asChild variant="teal" size="lg" className="mt-5">
              <a href={zap} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="size-5" />
                Falar agora no WhatsApp
              </a>
            </Button>
          </>
        ) : (
          <>
            <h3 className="font-heading text-xl font-bold text-azul-medico md:text-2xl">
              Vamos encher a agenda da {p.cliente_nome}?
            </h3>
            <p className="mx-auto mt-2 max-w-lg text-cinza-suave">
              Ao aceitar, nossa equipe é avisada na hora e marca a reunião de
              diagnóstico. Você não assina nada agora.
            </p>

            <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
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

            {erro && <p className="mt-3 text-sm text-vermelho-alerta">{erro}</p>}
          </>
        )}
      </div>

      <p className="mt-8 text-center text-xs text-cinza-suave">
        Proposta preparada pela Medi Marketing para {p.cliente_nome}.
        {p.valida_ate && " Sujeita à validade indicada na capa."}
      </p>
    </Tela>
  );
}
