import Link from "next/link";
import {
  Check,
  Headset,
  CalendarDays,
  Megaphone,
  ArrowRight,
  Search,
  Instagram,
  BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";
import { AgendaMockup } from "@/components/marketing/agenda-mockup";
import { site } from "@/lib/site";
import { whatsappLink } from "@/lib/utils";

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-teal/12 text-teal">
        <Check className="size-3.5" />
      </span>
      <span className="text-cinza-suave">{children}</span>
    </li>
  );
}

export function Servicos() {
  const zapAtendimento = whatsappLink(
    site.whatsapp,
    "Quero saber mais sobre o atendimento/secretariado para marcar minhas consultas."
  );
  const zapMarketing = whatsappLink(
    site.whatsapp,
    "Quero saber mais sobre as campanhas de Google Ads e Meta Ads para meu consultório."
  );

  return (
    <section id="servicos" className="section">
      <div className="container">
        <div className="mx-auto max-w-2xl text-center">
          <Reveal>
            <span className="eyebrow">
              <Megaphone className="size-4" />
              Nossas soluções
            </span>
            <h2 className="mt-4 text-3xl md:text-4xl">
              Tudo o que o seu consultório precisa, em um só lugar
            </h2>
          </Reveal>
        </div>

        {/* --- Solução 1: Atendimento --- */}
        <div className="mt-20 grid items-center gap-12 lg:grid-cols-2">
          <Reveal>
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-teal/12 px-3 py-1 text-sm font-semibold text-teal">
                <Headset className="size-4" /> Atendimento humano
              </span>
              <h3 className="mt-4 text-2xl md:text-3xl">
                Atendentes que marcam suas consultas por você
              </h3>
              <p className="mt-4 text-lg text-cinza-suave">
                Uma equipe treinada atende, agenda, confirma e reduz faltas — com
                a cordialidade que o seu paciente espera. Integrado diretamente à
                sua agenda no sistema.
              </p>
              <ul className="mt-6 space-y-3">
                <Bullet>Atendimento cordial e humanizado, do primeiro contato ao pós-consulta</Bullet>
                <Bullet>Confirmação ativa que reduz faltas e otimiza sua agenda</Bullet>
                <Bullet>Agendamentos registrados em tempo real no seu painel</Bullet>
              </ul>
              <Button asChild variant="teal" className="mt-8">
                <a href={zapAtendimento} target="_blank" rel="noopener noreferrer">
                  Quero um time atendendo por mim
                  <ArrowRight className="size-4" />
                </a>
              </Button>
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <AgendaMockup />
          </Reveal>
        </div>

        {/* --- Solução 2: Agenda integrada (o sistema) --- */}
        <div className="mt-24 grid items-center gap-12 lg:grid-cols-2">
          <Reveal className="lg:order-2">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-azul-medico/10 px-3 py-1 text-sm font-semibold text-azul-medico">
                <CalendarDays className="size-4" /> Agenda integrada
              </span>
              <h3 className="mt-4 text-2xl md:text-3xl">
                Toda a sua agenda em um só lugar, acessível de qualquer lugar
              </h3>
              <p className="mt-4 text-lg text-cinza-suave">
                Você tem login próprio e vê as consultas marcadas pela nossa
                equipe em tempo real, com status de confirmada, pendente ou
                cancelada. Do computador ou do celular.
              </p>
              <ul className="mt-6 space-y-3">
                <Bullet>Visualização por mês, semana e dia</Bullet>
                <Bullet>Status de cada consulta sempre atualizado</Bullet>
                <Bullet>Você define disponibilidade e bloqueia horários</Bullet>
              </ul>
              <Button asChild variant="marca" className="mt-8">
                <Link href="/login">
                  Conhecer a área do médico
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          </Reveal>
          <Reveal delay={0.1} className="lg:order-1">
            {/* Ilustração do painel */}
            <div className="rounded-2xl border border-border bg-gradient-to-br from-azul-medico to-azul-profundo p-6 shadow-card">
              <div className="rounded-xl bg-white p-5">
                <p className="text-sm font-semibold text-cinza-suave">
                  Resumo da semana
                </p>
                <div className="mt-4 grid grid-cols-3 gap-3">
                  {[
                    { n: "18", l: "Consultas" },
                    { n: "92%", l: "Confirmadas" },
                    { n: "3", l: "Retornos" },
                  ].map((s) => (
                    <div
                      key={s.l}
                      className="rounded-lg bg-verde-menta p-3 text-center"
                    >
                      <p className="font-heading text-2xl font-bold text-azul-medico">
                        {s.n}
                      </p>
                      <p className="text-xs text-cinza-suave">{s.l}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex items-end gap-1.5">
                  {[40, 65, 50, 80, 70, 90, 60].map((h, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-t bg-teal-claro"
                      style={{ height: `${h}px` }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </Reveal>
        </div>

        {/* --- Solução 3: Marketing / Tráfego pago --- */}
        <div className="mt-24 grid items-center gap-12 lg:grid-cols-2">
          <Reveal>
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-coral/10 px-3 py-1 text-sm font-semibold text-coral">
                <Megaphone className="size-4" /> Tráfego pago
              </span>
              <h3 className="mt-4 text-2xl md:text-3xl">
                Anúncios no Google e no Instagram que trazem pacientes certos
              </h3>
              <p className="mt-4 text-lg text-cinza-suave">
                Gestão profissional de Google Ads e Meta Ads, com segmentação por
                especialidade e região — sempre dentro das normas do CFM para
                publicidade médica.
              </p>
              <ul className="mt-6 space-y-3">
                <Bullet>
                  <strong className="text-cinza-texto">Google Ads:</strong> apareça
                  quando o paciente procura seu especialista
                </Bullet>
                <Bullet>
                  <strong className="text-cinza-texto">Meta Ads:</strong>{" "}
                  reconhecimento e captação no Instagram e Facebook
                </Bullet>
                <Bullet>Relatórios claros de resultado, sem jargão técnico</Bullet>
              </ul>
              <Button asChild variant="teal" className="mt-8">
                <a href={zapMarketing} target="_blank" rel="noopener noreferrer">
                  Quero atrair mais pacientes
                  <ArrowRight className="size-4" />
                </a>
              </Button>
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                { icon: Search, t: "Busca no Google", d: "Intenção de consulta agora" },
                { icon: Instagram, t: "Instagram & Facebook", d: "Presença e autoridade" },
                { icon: BarChart3, t: "Relatórios mensais", d: "Retorno transparente" },
                { icon: Check, t: "Compliance CFM", d: "Publicidade ética" },
              ].map((c) => (
                <div
                  key={c.t}
                  className="rounded-lg border border-border bg-white p-5 shadow-soft"
                >
                  <div className="mb-3 grid size-10 place-items-center rounded-lg bg-verde-menta text-teal">
                    <c.icon className="size-5" />
                  </div>
                  <p className="font-semibold text-azul-medico">{c.t}</p>
                  <p className="text-sm text-cinza-suave">{c.d}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
