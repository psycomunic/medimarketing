import Link from "next/link";
import { CalendarCheck2, Coins, Mail, MessageCircle, Plus, Send, Users } from "lucide-react";
import { exigirModulo } from "@/lib/acesso";
import { DIAS_ATRIBUICAO, getDisparos, type DisparoComResultado } from "@/lib/disparos";
import { Indicador } from "@/components/app/financeiro/ui";
import { reais } from "@/components/graficos/formato";
import { cn } from "@/lib/utils";
import { STATUS_DISPARO } from "@/components/app/disparos/status";

export const metadata = { title: "Disparos" };


const data = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: "America/Sao_Paulo" }).replace(/\./g, "");

export default async function DisparosPage() {
  await exigirModulo("disparos");
  const { instalado, lista } = await getDisparos();
  const soma = lista.reduce(
    (s, d) => ({
      enviados: s.enviados + d.resultado.enviados,
      consultas: s.consultas + d.resultado.consultas,
      faturamento: s.faturamento + d.resultado.faturamento,
    }),
    { enviados: 0, consultas: 0, faturamento: 0 }
  );

  return (
    <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] gap-6 px-4 py-8 sm:px-5 md:px-8 md:py-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-verde-menta text-teal">
            <Send className="size-6" />
          </span>
          <div className="min-w-0">
            <h1 className="text-2xl md:text-3xl">Disparos</h1>
            <p className="mt-1 text-cinza-suave">Mensagens de WhatsApp e e-mail para grupos de pacientes, com ritmo seguro e resultado medido.</p>
          </div>
        </div>
        {instalado && (
          <Link
            href="/app/disparos/novo"
            className="inline-flex h-10 items-center gap-1.5 rounded-full bg-azul-medico px-4 text-sm font-semibold text-white shadow-soft hover:bg-azul-profundo"
          >
            <Plus className="size-4" /> Novo disparo
          </Link>
        )}
      </header>

      {!instalado ? (
        <div className="rounded-xl border border-border bg-white p-6 text-sm text-cinza-suave shadow-soft">
          Os disparos ainda não foram ativados. Rode o SQL &quot;Pacientes: disparos (Fase 3)&quot; no Supabase.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Indicador icone={Users} rotulo="Mensagens enviadas" valor={soma.enviados.toLocaleString("pt-BR")} nota={`Em ${lista.length} disparo${lista.length === 1 ? "" : "s"}`} />
            <Indicador icone={CalendarCheck2} rotulo="Consultas geradas" valor={soma.consultas.toLocaleString("pt-BR")} nota={`Marcadas até ${DIAS_ATRIBUICAO} dias depois`} />
            <Indicador icone={Coins} rotulo="Faturamento gerado" valor={reais(soma.faturamento)} nota="Das consultas geradas" destaque />
          </div>

          {lista.length ? (
            <ul className="grid gap-3">
              {lista.map((d) => {
                const r = d.resultado;
                const progresso = r.total ? ((r.enviados + r.falhas + r.ignorados + r.cancelados) / r.total) * 100 : 0;
                const Icone = d.canal === "whatsapp" ? MessageCircle : Mail;
                return (
                  <li key={d.id}>
                    <Link
                      href={`/app/disparos/${d.id}`}
                      className="grid gap-4 rounded-xl border border-border bg-white p-5 shadow-soft transition-colors hover:border-teal/50 md:grid-cols-[minmax(0,1fr)_auto]"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", STATUS_DISPARO[d.status].c)}>{STATUS_DISPARO[d.status].r}</span>
                          <span className="inline-flex items-center gap-1 text-xs text-cinza-suave">
                            <Icone className={cn("size-3.5", d.canal === "whatsapp" && "text-[#16A34A]")} />
                            {d.canal === "whatsapp" ? "WhatsApp" : "E-mail"} · {d.finalidade === "cuidado" ? "Cuidado" : "Promoção"} · {data(d.inicio)}
                          </span>
                        </div>
                        <p className="mt-1.5 truncate font-heading text-base font-semibold text-azul-medico">{d.nome}</p>
                        <p className="truncate text-sm text-cinza-suave">{d.segmento_nome ?? "Pacientes"} · {r.total} destinatário{r.total === 1 ? "" : "s"}</p>
                        {d.status !== "cancelado" && (
                          <div className="mt-3 h-1.5 max-w-md overflow-hidden rounded-full bg-[var(--g-trilho)]">
                            <div className="h-full rounded-full bg-teal" style={{ width: `${Math.max(progresso, 2)}%` }} />
                          </div>
                        )}
                      </div>
                      <dl className="grid grid-cols-3 gap-4 text-right md:min-w-[320px]">
                        <div>
                          <dt className="text-xs text-cinza-suave">Enviadas</dt>
                          <dd className="font-heading text-lg font-bold tabular-nums text-cinza-texto">{r.enviados}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-cinza-suave">Consultas</dt>
                          <dd className="font-heading text-lg font-bold tabular-nums text-cinza-texto">{r.consultas}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-cinza-suave">Faturamento</dt>
                          <dd className="font-heading text-lg font-bold tabular-nums text-teal">{reais(r.faturamento)}</dd>
                        </div>
                      </dl>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="grid justify-items-center gap-3 rounded-xl border border-border bg-white px-6 py-12 text-center shadow-soft">
              <Send className="size-10 text-teal" />
              <p className="font-heading text-lg font-semibold text-azul-medico">Nenhum disparo ainda</p>
              <p className="max-w-md text-sm text-cinza-suave">
                Comece pelos pacientes sem retorno: uma mensagem de cuidado costuma trazer consultas já na primeira semana.
              </p>
              <Link href="/app/disparos/novo" className="text-sm font-semibold text-teal hover:underline">
                Criar o primeiro disparo
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}
