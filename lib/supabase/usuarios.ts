import { createClient } from "@/lib/supabase/server";
import { adminDisponivel, createAdminClient } from "@/lib/supabase/admin";
import { emModoDemo } from "@/lib/supabase/queries";
import { CONTAS_DEMO, DEMO_ORGANIZACOES, demoEquipe } from "@/lib/demo";
import type { Organization, Profile, Role } from "@/lib/supabase/types";

/** Perfil com o que só o `auth.users` sabe: e-mail, confirmação e último acesso. */
export type UsuarioGerenciavel = Profile & {
  email: string | null;
  email_confirmado: boolean;
  ultimo_acesso: string | null;
  organizacao_nome: string | null;
};

export type EscopoUsuarios = {
  /** null = super admin, que enxerga a carteira inteira. */
  organizationId: string | null;
  ehSuperAdmin: boolean;
};

/**
 * Usuários que o solicitante pode administrar.
 *
 * O e-mail e o último acesso vivem em `auth.users`, que a chave publicável
 * não alcança. Sem a service role a lista ainda vem — só sem esses campos,
 * e a tela avisa o que está faltando.
 */
export async function getUsuarios(
  escopo: EscopoUsuarios
): Promise<UsuarioGerenciavel[]> {
  if (await emModoDemo()) return usuariosDemo(escopo);

  const perfis = await carregarPerfis(escopo);
  if (!perfis.length) return [];

  const nomeOrg = await mapaOrganizacoes(escopo);

  // Sem service role, devolvemos o que a RLS já permite
  if (!adminDisponivel()) {
    return perfis.map((p) => ({
      ...p,
      email: null,
      email_confirmado: false,
      ultimo_acesso: null,
      organizacao_nome: p.organization_id
        ? nomeOrg.get(p.organization_id) ?? null
        : null,
    }));
  }

  const admin = createAdminClient();
  const contas = new Map<
    string,
    { email: string | null; confirmado: boolean; ultimo: string | null }
  >();

  // listUsers é paginado; a carteira é pequena, mas paginamos mesmo assim
  for (let pagina = 1; pagina <= 20; pagina++) {
    const { data, error } = await admin.auth.admin.listUsers({
      page: pagina,
      perPage: 200,
    });
    if (error || !data?.users.length) break;

    for (const u of data.users) {
      contas.set(u.id, {
        email: u.email ?? null,
        confirmado: !!u.email_confirmed_at,
        ultimo: u.last_sign_in_at ?? null,
      });
    }
    if (data.users.length < 200) break;
  }

  return perfis.map((p) => {
    const conta = contas.get(p.id);
    return {
      ...p,
      email: conta?.email ?? null,
      email_confirmado: conta?.confirmado ?? false,
      ultimo_acesso: conta?.ultimo ?? null,
      organizacao_nome: p.organization_id
        ? nomeOrg.get(p.organization_id) ?? null
        : null,
    };
  });
}

async function carregarPerfis(escopo: EscopoUsuarios): Promise<Profile[]> {
  const supabase = await createClient();
  const query = supabase.from("profiles").select("*").order("nome");

  const { data } = escopo.ehSuperAdmin
    ? await query
    : await query.eq("organization_id", escopo.organizationId ?? "");

  return data ?? [];
}

async function mapaOrganizacoes(
  escopo: EscopoUsuarios
): Promise<Map<string, string>> {
  const supabase = await createClient();
  const query = supabase.from("organizations").select("id,nome");
  const { data } = escopo.ehSuperAdmin
    ? await query
    : await query.eq("id", escopo.organizationId ?? "");

  return new Map((data ?? []).map((o) => [o.id, o.nome]));
}

/** Clínicas para o seletor de destino ao criar ou transferir alguém. */
export async function getClinicasDisponiveis(
  escopo: EscopoUsuarios
): Promise<Pick<Organization, "id" | "nome">[]> {
  if (await emModoDemo()) {
    return escopo.ehSuperAdmin
      ? DEMO_ORGANIZACOES.map((o) => ({ id: o.id, nome: o.nome }))
      : DEMO_ORGANIZACOES.filter((o) => o.id === escopo.organizationId).map((o) => ({
          id: o.id,
          nome: o.nome,
        }));
  }

  const mapa = await mapaOrganizacoes(escopo);
  return [...mapa.entries()]
    .map(([id, nome]) => ({ id, nome }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

function usuariosDemo(escopo: EscopoUsuarios): UsuarioGerenciavel[] {
  const emailPorId = new Map(CONTAS_DEMO.map((c) => [c.profile.id, c.email]));
  const nomeOrg = new Map<string, string>([
    ...DEMO_ORGANIZACOES.map((o) => [o.id, o.nome] as [string, string]),
    // Clínica declarada no cadastro público, ainda não ativada
    ["org-6", "Espaço Derma Niterói"],
  ]);

  const horas = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();

  // Um cadastro público esperando liberação, para a fila do painel não
  // aparecer vazia na demonstração.
  const pendente: Profile = {
    id: "pend-1",
    organization_id: "org-6",
    nome: "Dra. Letícia Vasconcelos",
    especialidade: null,
    crm: null,
    telefone: "(21) 98444-1122",
    foto_url: null,
    role: "gestor",
    ativo: false,
    aguardando_liberacao: true,
    created_at: horas(9),
  };

  const perfis = escopo.ehSuperAdmin
    ? [
        pendente,
        ...CONTAS_DEMO.map((c) => c.profile),
        ...DEMO_ORGANIZACOES.flatMap((o) =>
          demoEquipe(o.id).filter((p) => !emailPorId.has(p.id))
        ),
      ]
    : demoEquipe(escopo.organizationId);

  return perfis.map((p, i) => ({
    ...p,
    email: emailPorId.get(p.id) ?? `${slug(p.nome)}@clinica.com.br`,
    // Quem está na fila costuma ainda não ter confirmado o e-mail
    email_confirmado: !p.aguardando_liberacao,
    ultimo_acesso: p.aguardando_liberacao || i % 4 === 3 ? null : horas(2 + i * 9),
    organizacao_nome: p.organization_id ? nomeOrg.get(p.organization_id) ?? null : null,
  }));
}

/** Faixa Unicode das marcas de acento que o NFD separa das letras. */
const ACENTO_INICIO = 0x0300;
const ACENTO_FIM = 0x036f;

function slug(nome: string | null): string {
  // O NFD separa "á" em "a" + acento; descartamos as marcas por código
  // em vez de um intervalo dentro do regex, que é fácil de corromper.
  const semAcento = [...(nome ?? "usuario").toLowerCase().normalize("NFD")]
    .filter((c) => {
      const cod = c.codePointAt(0) ?? 0;
      return cod < ACENTO_INICIO || cod > ACENTO_FIM;
    })
    .join("");

  return semAcento
    .replace(/^dra?\.?\s*/, "")
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.|\.$/g, "");
}

/* ------------------------------------------------------------------ */
/* Resumo                                                              */
/* ------------------------------------------------------------------ */

export type ResumoUsuarios = {
  total: number;
  ativos: number;
  inativos: number;
  aguardando: number;
  semAcesso: number;
  naoConfirmados: number;
  porPapel: Record<Role, number>;
};

export function resumirUsuarios(usuarios: UsuarioGerenciavel[]): ResumoUsuarios {
  const porPapel: Record<Role, number> = {
    super_admin: 0,
    gestor: 0,
    secretaria: 0,
    medico: 0,
  };
  for (const u of usuarios) porPapel[u.role] += 1;

  return {
    total: usuarios.length,
    ativos: usuarios.filter((u) => u.ativo).length,
    // "Cortado" é diferente de "nunca liberado": quem está na fila não
    // conta como acesso retirado.
    inativos: usuarios.filter((u) => !u.ativo && !u.aguardando_liberacao).length,
    aguardando: usuarios.filter((u) => u.aguardando_liberacao).length,
    semAcesso: usuarios.filter((u) => u.ativo && !u.ultimo_acesso).length,
    naoConfirmados: usuarios.filter((u) => u.email && !u.email_confirmado).length,
    porPapel,
  };
}
