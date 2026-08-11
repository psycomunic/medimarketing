import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getConsultas } from "@/lib/supabase/queries";
import { exigirSessao } from "@/lib/acesso";
import { getPainel } from "@/lib/supabase/painel";
import { modulosDoPapel, rotuloPapel } from "@/lib/rbac";
import { formatarHora, rotuloStatus, rotuloTipo, capitalizar } from "@/lib/agenda";
import { cn } from "@/lib/utils";

/** Primeiro nome, sem título. E-mail vira o trecho antes do @. */
function comoChamar(nome: string | null): string {
  if (!nome?.trim()) return "tudo bem";
  const limpo = nome.includes("@") ? nome.split("@")[0] : nome;
  const semTitulo = limpo.replace(/^(dra?\.?|sr[a]?\.?)\s*/i, "").trim();
  const primeiro = semTitulo.split(/[\s._-]+/)[0];
  return primeiro.charAt(0).toUpperCase() + primeiro.slice(1);
}

/** "Bom dia" / "Boa tarde" / "Boa noite" pelo relógio do servidor. */
function saudacao(): string {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

export default async function DashboardPage() {
  const { profile, organizacao, role } = await exigirSessao();

  const agora = new Date();
  const em7 = new Date(agora);
  em7.setDate(em7.getDate() + 7);

  const [painel, proximas] = await Promise.all([
    getPainel(role, organizacao?.id ?? null),
    getConsultas(agora.toISOString(), em7.toISOString()),
  ]);

  const daSemana = proximas.slice(0, 6);
  const urgentes = painel.pendencias.filter((p) => p.urgente);

  // Atalhos ficam no fim e enxutos: a sidebar já navega, aqui é resumo
  const atalhos = modulosDoPapel(role).filter(
    (m) => m.href !== "/app" && m.grupo !== "conta"
  );

  const contexto =
    role === "super_admin"
      ? "Visão consolidada das clínicas atendidas."
      : `${rotuloPapel(role)} · ${organizacao?.nome ?? "sua clínica"}`;

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 md:px-8 md:py-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl">
            {saudacao()}, {comoChamar(profile.nome)} 👋
          </h1>
          <p className="mt-1 text-cinza-suave">{contexto}</p>
        </div>
        <Button asChild variant="marca">
          <Link href="/app/agenda">
            Ver agenda <ArrowRight className="size-4" />
          </Link>
        </Button>
      </header>

      {/* ---------------- O que precisa de você ---------------- */}
      <section className="mt-8">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-azul-medico">
          {urgentes.length > 0 ? (
            <AlertTriangle className="size-5 text-alerta" />
          ) : (
            <CheckCircle2 className="size-5 text-sucesso" />
          )}
          O que precisa de você
        </h2>

        {painel.pendencias.length === 0 ? (
          <div className="mt-3 rounded-lg border border-sucesso/30 bg-sucesso/5 px-5 py-6">
            <p className="font-semibold text-sucesso">Nada pendente por aqui</p>
            <p className="mt-1 text-sm text-cinza-suave">
              Lembretes em dia, ninguém esperando resposta e nenhuma tarefa
              atrasada. Bom momento para olhar os indicadores.
            </p>
          </div>
        ) : (
          <ul className="mt-3 grid gap-2.5 sm:grid-cols-2">
            {painel.pendencias.map((p) => (
              <li key={p.chave}>
                <Link
                  href={p.href}
                  className={cn(
                    "group flex items-start gap-3 rounded-lg border bg-white p-4 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-card",
                    p.urgente ? "border-alerta/40" : "border-border"
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg",
                      p.urgente
                        ? "bg-alerta/15 text-alerta"
                        : "bg-verde-menta text-teal"
                    )}
                  >
                    {p.urgente ? (
                      <AlertTriangle className="size-4" />
                    ) : (
                      <Clock className="size-4" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-azul-medico">
                      {p.titulo}
                    </span>
                    <span className="mt-0.5 block text-sm leading-snug text-cinza-suave">
                      {p.detalhe}
                    </span>
                  </span>
                  <ChevronRight className="mt-1 size-4 shrink-0 text-cinza-suave/40 transition-colors group-hover:text-teal" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ---------------- Números ---------------- */}
      {painel.numeros.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-azul-medico">
            {painel.tituloNumeros}
          </h2>
          <dl className="mt-3 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
            {painel.numeros.map((n) => (
              <div key={n.chave} className="bg-white px-5 py-4">
                <dd className="font-heading text-2xl font-bold text-azul-medico">
                  {n.valor}
                </dd>
                <dt className="text-sm text-cinza-suave">{n.rotulo}</dt>
                {n.nota && (
                  <p className="mt-0.5 text-xs text-cinza-suave/80">{n.nota}</p>
                )}
              </div>
            ))}
          </dl>
        </section>
      )}

      {/* ---------------- Próximas consultas ---------------- */}
      <section className="mt-8 overflow-hidden rounded-lg border border-border bg-white shadow-soft">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold text-azul-medico">
            Próximas consultas
          </h2>
          <Link
            href="/app/agenda"
            className="text-sm font-medium text-teal hover:underline"
          >
            Ver todas
          </Link>
        </div>

        {daSemana.length === 0 ? (
          <div className="px-6 py-12 text-center text-cinza-suave">
            <CalendarDays className="mx-auto mb-3 size-10 text-teal-claro" />
            <p>Nenhuma consulta nos próximos 7 dias.</p>
            <p className="mt-1 text-sm">
              Marque pela agenda — o lembrete de confirmação é criado junto.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {daSemana.map((c) => {
              const data = new Date(c.data_hora);
              const ehHoje = data.toDateString() === agora.toDateString();

              return (
                <li key={c.id} className="flex items-center gap-4 px-6 py-3.5">
                  <div
                    className={cn(
                      "flex w-16 shrink-0 flex-col items-center rounded-lg py-2",
                      ehHoje ? "bg-teal text-white" : "bg-verde-menta"
                    )}
                  >
                    <span
                      className={cn(
                        "text-sm font-bold",
                        ehHoje ? "text-white" : "text-azul-medico"
                      )}
                    >
                      {formatarHora(c.data_hora)}
                    </span>
                    <span
                      className={cn(
                        "text-[11px]",
                        ehHoje ? "text-white/80" : "text-cinza-suave"
                      )}
                    >
                      {ehHoje
                        ? "hoje"
                        : data.toLocaleDateString("pt-BR", {
                            day: "2-digit",
                            month: "2-digit",
                          })}
                    </span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-cinza-texto">
                      {c.paciente_nome}
                    </p>
                    <p className="truncate text-sm text-cinza-suave">
                      {rotuloTipo[c.tipo]}
                      {c.convenio && ` · ${c.convenio}`}
                    </p>
                  </div>

                  <Badge variant={c.status}>{rotuloStatus[c.status]}</Badge>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ---------------- Atalhos ---------------- */}
      <section className="mt-8">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-azul-medico">
          <Sparkles className="size-5 text-teal" />
          Ir para
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {atalhos.map((m) => (
            <Link
              key={m.href}
              href={m.href}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-4 py-2 text-sm font-medium text-cinza-suave shadow-soft transition-colors hover:border-teal hover:text-teal"
            >
              <m.icone className="size-4 text-teal" />
              {capitalizar(m.label)}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
