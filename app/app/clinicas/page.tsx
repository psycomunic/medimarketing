import Link from "next/link";
import {
  Building2,
  Users,
  CalendarDays,
  UserPlus,
  Banknote,
  CircleDot,
} from "lucide-react";
import { exigirModulo } from "@/lib/acesso";
import { getClientes } from "@/lib/supabase/indicadores";
import { formatarNumero, formatarReais } from "@/lib/indicadores";
import { cn } from "@/lib/utils";

export const metadata = { title: "Clientes" };

const rotuloPlano: Record<string, string> = {
  essencial: "Essencial",
  performance: "Performance",
  full: "Full / Parceria",
};

const corPlano: Record<string, string> = {
  essencial: "bg-verde-menta text-azul-medico",
  performance: "bg-teal/12 text-teal",
  full: "bg-coral/12 text-coral",
};

// Uso interno da Medi Marketing: só o super admin acessa.
export default async function ClinicasPage() {
  await exigirModulo("clinicas");
  const clientes = await getClientes();

  const ativos = clientes.filter((c) => c.ativo);
  const totais = ativos.reduce(
    (acc, c) => ({
      usuarios: acc.usuarios + c.usuarios,
      consultas: acc.consultas + c.consultas_mes,
      leads: acc.leads + c.leads_mes,
      faturamento: acc.faturamento + c.faturamento_mes,
    }),
    { usuarios: 0, consultas: 0, leads: 0, faturamento: 0 }
  );

  const resumo = [
    { icone: Building2, label: "clínicas ativas", valor: formatarNumero(ativos.length) },
    { icone: Users, label: "usuários na plataforma", valor: formatarNumero(totais.usuarios) },
    { icone: CalendarDays, label: "consultas no mês", valor: formatarNumero(totais.consultas) },
    { icone: Banknote, label: "faturamento da carteira", valor: formatarReais(totais.faturamento) },
  ];

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 md:px-8 md:py-10">
      <header className="flex items-start gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-verde-menta text-teal">
          <Building2 className="size-6" />
        </span>
        <div>
          <h1 className="text-2xl md:text-3xl">Clientes</h1>
          <p className="mt-1 max-w-xl text-cinza-suave">
            Todas as clínicas atendidas pela Medi Marketing, com o uso da
            plataforma no mês corrente.
          </p>
        </div>
      </header>

      {/* Resumo da carteira */}
      <dl className="mt-8 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
        {resumo.map((r) => (
          <div key={r.label} className="bg-white px-6 py-5">
            <span className="grid size-9 place-items-center rounded-lg bg-verde-menta text-teal">
              <r.icone className="size-5" />
            </span>
            <dd className="mt-3 font-heading text-2xl font-bold text-azul-medico">
              {r.valor}
            </dd>
            <dt className="text-sm text-cinza-suave">{r.label}</dt>
          </div>
        ))}
      </dl>

      {/* Lista de clínicas */}
      <section className="mt-8 overflow-hidden rounded-lg border border-border bg-white shadow-soft">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold text-azul-medico">
            Carteira ({clientes.length})
          </h2>
        </div>

        {clientes.length === 0 ? (
          <p className="px-6 py-16 text-center text-cinza-suave">
            Nenhuma clínica cadastrada ainda.
          </p>
        ) : (
          <>
            {/* Tabela no desktop */}
            <table className="hidden w-full text-sm md:table">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-cinza-suave">
                  <th className="px-6 py-3 font-semibold">Clínica</th>
                  <th className="px-4 py-3 font-semibold">Plano</th>
                  <th className="px-4 py-3 text-right font-semibold">Usuários</th>
                  <th className="px-4 py-3 text-right font-semibold">Consultas</th>
                  <th className="px-4 py-3 text-right font-semibold">Leads</th>
                  <th className="px-6 py-3 text-right font-semibold">Faturamento</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {clientes.map((c) => (
                  <tr key={c.id} className="transition-colors hover:bg-branco-clinico">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <CircleDot
                          className={cn(
                            "size-3.5 shrink-0",
                            c.ativo ? "text-sucesso" : "text-cinza-suave/50"
                          )}
                        />
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-azul-medico">
                            {c.nome}
                          </p>
                          <p className="truncate text-xs text-cinza-suave">
                            {[c.especialidade, c.cidade].filter(Boolean).join(" · ")}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide",
                          corPlano[c.plano]
                        )}
                      >
                        {rotuloPlano[c.plano] ?? c.plano}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right text-cinza-texto">{c.usuarios}</td>
                    <td className="px-4 py-4 text-right text-cinza-texto">
                      {c.consultas_mes}
                    </td>
                    <td className="px-4 py-4 text-right text-cinza-texto">
                      {c.leads_mes}
                    </td>
                    <td className="px-6 py-4 text-right font-semibold text-azul-medico">
                      {formatarReais(c.faturamento_mes)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Cartões no mobile */}
            <ul className="divide-y divide-border md:hidden">
              {clientes.map((c) => (
                <li key={c.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 font-semibold text-azul-medico">
                        <CircleDot
                          className={cn(
                            "size-3.5 shrink-0",
                            c.ativo ? "text-sucesso" : "text-cinza-suave/50"
                          )}
                        />
                        <span className="truncate">{c.nome}</span>
                      </p>
                      <p className="mt-0.5 text-xs text-cinza-suave">
                        {[c.especialidade, c.cidade].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                        corPlano[c.plano]
                      )}
                    >
                      {rotuloPlano[c.plano] ?? c.plano}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs">
                    {[
                      { l: "Usuários", v: c.usuarios },
                      { l: "Consultas", v: c.consultas_mes },
                      { l: "Leads", v: c.leads_mes },
                      { l: "Faturam.", v: formatarReais(c.faturamento_mes) },
                    ].map((m) => (
                      <div key={m.l} className="rounded-md bg-branco-clinico py-2">
                        <p className="font-semibold text-azul-medico">{m.v}</p>
                        <p className="text-[10px] text-cinza-suave">{m.l}</p>
                      </div>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <p className="mt-4 rounded-md border border-dashed border-border bg-white px-4 py-3 text-sm text-cinza-suave">
        <UserPlus className="mr-1.5 inline size-4 text-teal" />
        Para cadastrar uma clínica nova e convidar a equipe dela, use o painel do
        Supabase (Authentication → Users) e vincule o usuário à organização. O
        fluxo de convite dentro da plataforma entra na Fase 2.{" "}
        <Link href="/app/admin/academy" className="font-semibold text-teal hover:underline">
          Gerenciar conteúdo da Academy
        </Link>
        .
      </p>
    </div>
  );
}
