import { AtSign, Building2, CalendarDays, Mail, Phone, ShieldCheck } from "lucide-react";
import { FotoPerfil } from "@/components/app/perfil/foto-perfil";
import { FormPerfil, FormSenha } from "@/components/app/perfil/form-perfil";
import { MarcaClinica } from "@/components/app/perfil/marca-clinica";
import { exigirSessao } from "@/lib/acesso";
import { emModoDemo } from "@/lib/supabase/queries";
import { listarConexoesMerge } from "@/lib/actions/configuracoes";
import { rotuloPapel, modulosDoPapel } from "@/lib/rbac";
import { PreferenciasAviso } from "@/components/app/avisos/preferencias";
import { getPreferencia } from "@/lib/supabase/envios";
import { envioAutomatico } from "@/lib/envio";
import { createClient } from "@/lib/supabase/server";
import { getMeusRepasses } from "@/lib/supabase/financeiro-dados";
import { MeusRepasses } from "@/components/app/financeiro/listas-simples";
import { supabaseConfigurado } from "@/lib/supabase/queries";

export const metadata = { title: "Meu perfil" };

export default async function PerfilPage() {
  const { profile, organizacao, role } = await exigirSessao();
  const [demo, whatsapp, preferencia, email, repasses] = await Promise.all([
    emModoDemo(),
    listarConexoesMerge(),
    getPreferencia(profile.id),
    emailDaConta(),
    role === "medico" ? getMeusRepasses(profile.id) : Promise.resolve([]),
  ]);

  const modulos = modulosDoPapel(role);
  // Mesma régua da action e da política do banco
  const podeEditarMarca = role === "gestor" || role === "medico";
  const desde = new Date(profile.created_at).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="mx-auto max-w-3xl px-5 py-8 md:px-8 md:py-10">
      <header>
        <h1 className="text-2xl md:text-3xl">Meu perfil</h1>
        <p className="mt-1 text-cinza-suave">
          Sua foto, seus dados, os avisos que você recebe e a senha da conta.
        </p>
      </header>

      {/* Cartão de identificação */}
      <section className="mt-8 overflow-hidden rounded-xl border border-border bg-white shadow-soft">
        <div className="h-28 bg-gradient-to-r from-azul-medico via-azul-medico to-teal sm:h-32" />
        <div className="px-6 pb-6">
          <div className="-mt-14 flex flex-col items-center gap-4 sm:flex-row sm:items-end">
            <FotoPerfil nome={profile.nome} fotoUrl={profile.foto_url} demo={demo} />
            <div className="min-w-0 flex-1 text-center sm:pb-2 sm:text-left">
              <p className="font-heading text-xl font-semibold text-azul-medico">
                {[profile.tratamento, profile.nome || "Sem nome"].filter(Boolean).join(" ")}
              </p>
              <p className="text-sm text-cinza-suave">
                {[
                  profile.especialidade || (role === "secretaria" ? null : "Especialidade não informada"),
                  profile.crm,
                  profile.rqe ? `RQE ${profile.rqe}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            <span className="rounded-full bg-verde-menta px-3 py-1.5 text-xs font-semibold text-azul-medico sm:mb-2">
              {rotuloPapel(role)}
            </span>
          </div>

          {profile.bio && (
            <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-cinza-texto">{profile.bio}</p>
          )}

          {(profile.telefone || profile.instagram || email) && (
            <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
              {profile.telefone && <Contato icone={Phone} texto={profile.telefone} />}
              {email && <Contato icone={Mail} texto={email} />}
              {profile.instagram && <Contato icone={AtSign} texto={profile.instagram.replace(/^@/, "")} />}
            </div>
          )}

          <dl className="mt-5 grid gap-3 border-t border-border pt-5 sm:grid-cols-3">
            <Info icone={Building2} rotulo="Clínica" valor={organizacao?.nome ?? "Todas as clínicas"} />
            <Info icone={ShieldCheck} rotulo="Módulos liberados" valor={`${modulos.length} do painel`} />
            <Info icone={CalendarDays} rotulo="Na plataforma desde" valor={desde} />
          </dl>
        </div>
      </section>

      {!profile.foto_url && (
        <p className="mt-3 text-center text-xs text-cinza-suave sm:text-left">
          Clique no círculo para adicionar sua foto. Ela aparece na barra lateral e para a equipe.
        </p>
      )}

      <div className="mt-6">
        <FormPerfil profile={profile} email={email} demo={demo} />
      </div>

      {/* A marca só aparece para quem responde por ela. A secretária
          opera a agenda e não decide como a clínica se apresenta. */}
      {organizacao && podeEditarMarca && (
        <MarcaClinica
          organizationId={organizacao.id}
          nome={organizacao.nome}
          logoUrl={organizacao.logo_url}
          conexaoEscolhida={organizacao.merge_connection_id}
          conexoes={whatsapp.conexoes}
          mergeDisponivel={whatsapp.disponivel}
          demo={demo}
        />
      )}

      {/* Avisos da agenda: só quem é de uma clínica recebe */}
      {organizacao && role !== "super_admin" && (
        <div className="mt-6">
          <PreferenciasAviso
            usuarioId={profile.id}
            papel={role}
            inicial={preferencia?.canais ?? {}}
            resumoHora={preferencia?.resumo_hora ?? 7}
            temTelefone={!!profile.telefone}
            temEmail={!!email}
            whatsappDaClinica={envioAutomatico(organizacao.merge_connection_id)}
            propria
            demo={demo}
          />
        </div>
      )}

      {role === "medico" && <MeusRepasses repasses={repasses} />}

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

async function emailDaConta(): Promise<string | null> {
  if (!supabaseConfigurado() || (await emModoDemo())) return null;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user?.email ?? null;
}

function Contato({ icone: Icone, texto }: { icone: typeof Phone; texto: string }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-branco-clinico px-3 py-1 text-xs text-cinza-texto">
      <Icone className="size-3.5 shrink-0 text-teal" />
      <span className="truncate">{texto}</span>
    </span>
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
