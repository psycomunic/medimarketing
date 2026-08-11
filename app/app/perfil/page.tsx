import Image from "next/image";
import { Building2, CalendarDays, ShieldCheck } from "lucide-react";
import { FormPerfil, FormSenha } from "@/components/app/perfil/form-perfil";
import { exigirSessao } from "@/lib/acesso";
import { emModoDemo } from "@/lib/supabase/queries";
import { rotuloPapel, modulosDoPapel } from "@/lib/rbac";

export const metadata = { title: "Meu perfil" };

export default async function PerfilPage() {
  const { profile, organizacao, role } = await exigirSessao();
  const demo = await emModoDemo();

  const modulos = modulosDoPapel(role);
  const desde = new Date(profile.created_at).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="mx-auto max-w-3xl px-5 py-8 md:px-8 md:py-10">
      <header>
        <h1 className="text-2xl md:text-3xl">Meu perfil</h1>
        <p className="mt-1 text-cinza-suave">
          Seus dados, seu acesso e a senha da conta.
        </p>
      </header>

      {/* Cartão de identificação */}
      <section className="mt-8 rounded-lg border border-border bg-white p-6 shadow-soft">
        <div className="flex flex-wrap items-center gap-4">
          {profile.foto_url ? (
            <Image
              src={profile.foto_url}
              alt=""
              width={64}
              height={64}
              className="size-16 shrink-0 rounded-full object-cover"
              unoptimized
            />
          ) : (
            <span className="grid size-16 shrink-0 place-items-center rounded-full bg-azul-medico text-xl font-semibold text-white">
              {(profile.nome ?? "?").charAt(0).toUpperCase()}
            </span>
          )}

          <div className="min-w-0 flex-1">
            <p className="font-heading text-lg font-semibold text-azul-medico">
              {profile.nome || "Sem nome"}
            </p>
            <p className="text-sm text-cinza-suave">
              {profile.especialidade || "Especialidade não informada"}
              {profile.crm && ` · ${profile.crm}`}
            </p>
          </div>

          <span className="rounded-full bg-verde-menta px-3 py-1.5 text-xs font-semibold text-azul-medico">
            {rotuloPapel(role)}
          </span>
        </div>

        <dl className="mt-5 grid gap-3 border-t border-border pt-5 sm:grid-cols-3">
          <Info
            icone={Building2}
            rotulo="Clínica"
            valor={organizacao?.nome ?? "Todas as clínicas"}
          />
          <Info
            icone={ShieldCheck}
            rotulo="Módulos liberados"
            valor={`${modulos.length} do painel`}
          />
          <Info icone={CalendarDays} rotulo="Na plataforma desde" valor={desde} />
        </dl>
      </section>

      <div className="mt-6">
        <FormPerfil profile={profile} demo={demo} />
      </div>

      <FormSenha demo={demo} />

      {/* O que este papel pode acessar */}
      <section className="mt-6 rounded-lg border border-border bg-white p-6 shadow-soft">
        <h2 className="text-lg font-semibold text-azul-medico">Seu acesso</h2>
        <p className="mt-1 text-sm text-cinza-suave">
          Como {rotuloPapel(role).toLowerCase()}, você enxerga estes módulos.
          Quem muda isso é o gestor da clínica, em Configurações.
        </p>

        <ul className="mt-4 flex flex-wrap gap-2">
          {modulos.map((m) => (
            <li
              key={m.id}
              className="inline-flex items-center gap-1.5 rounded-full bg-branco-clinico px-3 py-1.5 text-xs text-cinza-suave"
            >
              <m.icone className="size-3.5 text-teal" />
              {m.label}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Info({
  icone: Icone,
  rotulo,
  valor,
}: {
  icone: typeof Building2;
  rotulo: string;
  valor: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icone className="mt-0.5 size-4 shrink-0 text-teal" />
      <div className="min-w-0">
        <dt className="text-xs text-cinza-suave">{rotulo}</dt>
        <dd className="truncate text-sm font-medium text-cinza-texto">{valor}</dd>
      </div>
    </div>
  );
}
