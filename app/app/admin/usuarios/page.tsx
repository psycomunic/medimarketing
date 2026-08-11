import { UsersRound, UserCheck, UserPlus, Ban, Clock, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { GestaoUsuarios } from "@/components/app/admin/gestao-usuarios";
import { exigirModulo } from "@/lib/acesso";
import { emModoDemo } from "@/lib/supabase/queries";
import { adminDisponivel } from "@/lib/supabase/admin";
import {
  getClinicasDisponiveis,
  getUsuarios,
  resumirUsuarios,
} from "@/lib/supabase/usuarios";
import { rotuloPapel } from "@/lib/rbac";
import { formatarNumero } from "@/lib/indicadores";

export const metadata = { title: "Usuários" };

export default async function AdminUsuariosPage() {
  const { profile } = await exigirModulo("admin-usuarios");
  const escopo = { organizationId: null, ehSuperAdmin: true };

  const [usuarios, clinicas, demo] = await Promise.all([
    getUsuarios(escopo),
    getClinicasDisponiveis(escopo),
    emModoDemo(),
  ]);

  const r = resumirUsuarios(usuarios);
  const temAdmin = adminDisponivel();

  const cards = [
    {
      icone: UserPlus,
      label: "aguardando liberação",
      valor: formatarNumero(r.aguardando),
      destaque: r.aguardando > 0,
    },
    { icone: UserCheck, label: "com acesso ativo", valor: formatarNumero(r.ativos) },
    { icone: Ban, label: "acesso cortado", valor: formatarNumero(r.inativos) },
    { icone: Clock, label: "nunca entraram", valor: formatarNumero(r.semAcesso) },
    {
      icone: ShieldCheck,
      label: "equipe Medi Marketing",
      valor: formatarNumero(r.porPapel.super_admin),
    },
  ];

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 md:px-8 md:py-10">
      <header className="flex items-start gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-verde-menta text-teal">
          <UsersRound className="size-6" />
        </span>
        <div>
          <h1 className="text-2xl md:text-3xl">Usuários</h1>
          <p className="mt-1 max-w-2xl text-cinza-suave">
            Todos os acessos da carteira. Crie contas, defina o que cada um
            enxerga e corte a entrada de quem saiu — sem passar pelo painel do
            Supabase.
          </p>
        </div>
      </header>

      {usuarios.length > 0 && (
        <dl className="mt-8 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-5">
          {cards.map((c) => (
            <div key={c.label} className="bg-white px-6 py-5">
              <span
                className={cn(
                  "grid size-9 place-items-center rounded-lg",
                  c.destaque ? "bg-alerta/15 text-alerta" : "bg-verde-menta text-teal"
                )}
              >
                <c.icone className="size-5" />
              </span>
              <dd
                className={cn(
                  "mt-3 font-heading text-2xl font-bold",
                  c.destaque ? "text-alerta" : "text-azul-medico"
                )}
              >
                {c.valor}
              </dd>
              <dt className="text-sm text-cinza-suave">{c.label}</dt>
            </div>
          ))}
        </dl>
      )}

      {/* Quantos de cada papel, para bater o olho na composição do time */}
      {usuarios.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {(["gestor", "secretaria", "medico"] as const).map((p) => (
            <span
              key={p}
              className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs text-cinza-suave shadow-soft"
            >
              <strong className="text-azul-medico">{r.porPapel[p]}</strong>
              {rotuloPapel(p)}
            </span>
          ))}
        </div>
      )}

      <div className="mt-8">
        <GestaoUsuarios
          usuarios={usuarios}
          clinicas={clinicas}
          usuarioId={profile.id}
          ehSuperAdmin
          organizationId={null}
          adminDisponivel={temAdmin}
          demo={demo}
        />
      </div>
    </div>
  );
}
