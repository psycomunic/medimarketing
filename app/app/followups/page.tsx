import Link from "next/link";
import { CheckCircle2, ListTodo } from "lucide-react";
import { exigirModulo } from "@/lib/acesso";
import { contarTarefas, getTarefas, type Aba } from "@/lib/supabase/followup";
import { getUsuarios } from "@/lib/supabase/usuarios";
import { linkWhatsApp } from "@/lib/lembretes";
import { ItemTarefa } from "@/components/app/pacientes/followup";
import { cn } from "@/lib/utils";

export const metadata = { title: "Follow-ups" };

const ABAS: { v: Aba; r: string }[] = [
  { v: "atrasadas", r: "Atrasados" },
  { v: "hoje", r: "Hoje" },
  { v: "proximas", r: "Próximos" },
  { v: "concluidas", r: "Concluídos" },
];

export default async function FollowupsPage({ searchParams }: { searchParams: { aba?: string; de?: string } }) {
  const { organizacao, role, profile } = await exigirModulo("followups");
  // O médico começa pelas dele; dono e atendimento, pela clínica toda
  const minhas = searchParams.de ? searchParams.de === "minhas" : role === "medico";
  const contagem = await contarTarefas({ minhas });
  const abaPadrao: Aba = contagem?.atrasadas ? "atrasadas" : "hoje";
  const aba = (ABAS.some((a) => a.v === searchParams.aba) ? searchParams.aba : abaPadrao) as Aba;
  const [{ instalado, lista }, usuarios] = await Promise.all([
    getTarefas({ aba, minhas }),
    getUsuarios({ organizationId: organizacao?.id ?? null, ehSuperAdmin: role === "super_admin" }),
  ]);
  const nomes = Object.fromEntries(usuarios.map((u) => [u.id, u.nome ?? "Equipe"]));
  const clinica = organizacao?.nome ?? "clínica";
  const link = (mud: Record<string, string>) => {
    const p = new URLSearchParams({ aba, de: minhas ? "minhas" : "todas", ...mud });
    return `/app/followups?${p}`;
  };
  const numero = (v: Aba) => (v === "atrasadas" ? contagem?.atrasadas : v === "hoje" ? contagem?.hoje : undefined);

  return (
    <div className="mx-auto grid max-w-4xl grid-cols-[minmax(0,1fr)] gap-6 px-4 py-8 sm:px-5 md:px-8 md:py-10">
      <header className="flex items-start gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-verde-menta text-teal">
          <ListTodo className="size-6" />
        </span>
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl">Follow-ups</h1>
          <p className="mt-1 text-cinza-suave">
            Ligações, mensagens, orçamentos e retornos combinados com os pacientes. Crie novos na ficha de cada paciente.
          </p>
        </div>
      </header>

      {!instalado ? (
        <div className="rounded-xl border border-border bg-white p-6 text-sm text-cinza-suave shadow-soft">
          Os follow-ups ainda não foram ativados. Rode o SQL &quot;Pacientes: follow-up (Fase 2)&quot; no Supabase.
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <nav aria-label="Período" className="flex flex-wrap gap-1.5">
              {ABAS.map((a) => {
                const n = numero(a.v);
                return (
                  <Link
                    key={a.v}
                    href={link({ aba: a.v })}
                    aria-current={aba === a.v ? "page" : undefined}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors",
                      aba === a.v ? "border-azul-medico bg-azul-medico text-white" : "border-border bg-white text-cinza-suave hover:border-teal hover:text-teal"
                    )}
                  >
                    {a.r}
                    {n ? (
                      <span
                        className={cn(
                          "rounded-full px-1.5 text-xs tabular-nums",
                          aba === a.v ? "bg-white/20" : a.v === "atrasadas" ? "bg-coral/15 text-coral" : "bg-[#FEF3C7] text-[#B45309]"
                        )}
                      >
                        {n}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </nav>
            <div className="inline-flex rounded-full border border-border bg-white p-1 text-xs font-semibold">
              {[
                { v: "minhas", r: "Meus" },
                { v: "todas", r: "Da clínica" },
              ].map((o) => (
                <Link
                  key={o.v}
                  href={link({ de: o.v })}
                  className={cn("rounded-full px-3 py-1", (o.v === "minhas") === minhas ? "bg-teal text-white" : "text-cinza-suave hover:text-teal")}
                >
                  {o.r}
                </Link>
              ))}
            </div>
          </div>

          {lista.length ? (
            <ul className="grid gap-2.5">
              {lista.map((t) => (
                <ItemTarefa
                  key={t.id}
                  t={t}
                  paciente={t.paciente}
                  responsavel={t.status === "feita" ? (t.concluida_por ? nomes[t.concluida_por] : null) : t.responsavel_id && t.responsavel_id !== profile.id ? nomes[t.responsavel_id] : minhas ? null : "você"}
                  whatsapp={t.paciente?.telefone ? linkWhatsApp(t.paciente.telefone, `Olá, ${t.paciente.nome.split(" ")[0]}! Aqui é da ${clinica}.`) : null}
                />
              ))}
            </ul>
          ) : (
            <div className="grid justify-items-center gap-2 rounded-xl border border-border bg-white px-6 py-12 text-center shadow-soft">
              <CheckCircle2 className="size-10 text-teal" />
              <p className="font-heading text-lg font-semibold text-azul-medico">
                {aba === "atrasadas" ? "Nada atrasado" : aba === "hoje" ? "Nada para hoje" : aba === "proximas" ? "Nada agendado" : "Nenhum concluído ainda"}
              </p>
              <p className="text-sm text-cinza-suave">
                Para criar um follow-up, abra a{" "}
                <Link href="/app/pacientes" className="font-medium text-teal hover:underline">
                  ficha do paciente
                </Link>
                .
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
