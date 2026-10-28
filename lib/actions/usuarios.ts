"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient, adminDisponivel } from "@/lib/supabase/admin";
import {
  bloqueio,
  contexto,
  GESTAO,
  type ActionResult,
  type Contexto,
} from "@/lib/actions/contexto";
import type { Profile, Role } from "@/lib/supabase/types";
import { enviarLinkDeSenha } from "@/lib/acesso-email";

/**
 * GESTÃO DE USUÁRIOS
 *
 * Tudo aqui roda com a service role, que ignora RLS. Isso significa que o
 * banco NÃO é rede de proteção neste arquivo: cada action confere na mão
 * quem está pedindo, sobre quem, e se pode.
 *
 * As três regras que sustentam o resto:
 *
 *   1. Gestor só toca em quem é da própria clínica; super admin, em todos.
 *   2. Só super admin cria ou remove outro super admin. Sem isso, um gestor
 *      se promoveria a dono da carteira inteira em dois cliques.
 *   3. Ninguém rebaixa, desativa ou apaga a si mesmo — evita a clínica
 *      ficar sem nenhum gestor por acidente.
 */

const MSG_SEM_CHAVE =
  "Gestão de usuários indisponível: falta a SUPABASE_SERVICE_ROLE_KEY nas variáveis de ambiente.";

const PAPEIS: readonly Role[] = ["super_admin", "gestor", "secretaria", "medico"];

function revalidar() {
  revalidatePath("/app/admin/usuarios");
  revalidatePath("/app/clinicas", "layout");
  revalidatePath("/app/configuracoes");
  revalidatePath("/app", "layout");
}

/* ------------------------------------------------------------------ */
/* Autorização                                                         */
/* ------------------------------------------------------------------ */

type Autorizado = {
  ctx: Extract<Contexto, { estado: "ok" }>;
  admin: ReturnType<typeof createAdminClient>;
  alvo: Profile;
};

/** Sessão + service role + o perfil alvo, já com todas as regras aplicadas. */
async function autorizar(
  alvoId: string,
  opcoes: { permitirPropriaConta?: boolean } = {}
): Promise<Autorizado | ActionResult> {
  const ctx = await contexto(GESTAO);
  if (ctx.estado !== "ok") return bloqueio(ctx);
  if (!adminDisponivel()) return { ok: false, erro: MSG_SEM_CHAVE };

  if (!opcoes.permitirPropriaConta && alvoId === ctx.profile.id) {
    return { ok: false, erro: "Você não pode fazer isso na sua própria conta." };
  }

  const admin = createAdminClient();
  const { data: alvo } = await admin
    .from("profiles")
    .select("*")
    .eq("id", alvoId)
    .maybeSingle();

  if (!alvo) return { ok: false, erro: "Usuário não encontrado." };

  const souSuper = ctx.profile.role === "super_admin";

  if (!souSuper) {
    if (alvo.organization_id !== ctx.profile.organization_id) {
      return { ok: false, erro: "Esse usuário não é da sua clínica." };
    }
    if (alvo.role === "super_admin") {
      return { ok: false, erro: "Só a equipe Medi Marketing gerencia esse acesso." };
    }
  }

  return { ctx, admin, alvo };
}

function ehErro(r: Autorizado | ActionResult): r is ActionResult {
  return "ok" in r;
}

/* ------------------------------------------------------------------ */
/* Criar                                                               */
/* ------------------------------------------------------------------ */

const criarSchema = z.object({
  email: z.string().trim().toLowerCase().email("E-mail inválido."),
  senha: z
    .string()
    .min(8, "A senha provisória precisa de pelo menos 8 caracteres.")
    .max(72),
  nome: z.string().trim().min(2, "Informe o nome da pessoa."),
  papel: z.enum(["super_admin", "gestor", "secretaria", "medico"]),
  organizationId: z.string().optional().or(z.literal("")),
  especialidade: z.string().trim().max(80).optional().or(z.literal("")),
  crm: z.string().trim().max(40).optional().or(z.literal("")),
  telefone: z.string().trim().max(30).optional().or(z.literal("")),
  /** Manda o e-mail de boas-vindas com o link para criar a senha. */
  enviarConvite: z.boolean().optional(),
});

export type CriarUsuarioInput = z.input<typeof criarSchema>;

export type ResultadoCriacao =
  | { ok: true; emailEnviado: boolean }
  | { ok: false; erro: string };

/**
 * Cria o login e o perfil de uma pessoa da equipe.
 *
 * A conta já nasce confirmada (`email_confirm: true`): quem cadastra é o
 * gestor, presencialmente, então exigir clique num e-mail de confirmação
 * só emperraria a recepção no primeiro dia.
 */
export async function criarUsuario(
  input: CriarUsuarioInput
): Promise<ResultadoCriacao> {
  const parsed = criarSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.errors[0]?.message ?? "Dados inválidos" };
  }

  const ctx = await contexto(GESTAO);
  if (ctx.estado !== "ok") {
    const b = bloqueio(ctx);
    return b.ok ? { ok: false, erro: "Sem permissão." } : b;
  }
  if (!adminDisponivel()) return { ok: false, erro: MSG_SEM_CHAVE };

  const d = parsed.data;
  const souSuper = ctx.profile.role === "super_admin";

  if (d.papel === "super_admin" && !souSuper) {
    return { ok: false, erro: "Só a equipe Medi Marketing cria esse tipo de acesso." };
  }

  // Super admin não pertence a clínica; os demais precisam de uma
  const orgId =
    d.papel === "super_admin"
      ? null
      : souSuper
        ? d.organizationId || null
        : ctx.profile.organization_id;

  if (d.papel !== "super_admin" && !orgId) {
    return { ok: false, erro: "Escolha a clínica da pessoa." };
  }
  if (!souSuper && d.organizationId && d.organizationId !== ctx.profile.organization_id) {
    return { ok: false, erro: "Você só cadastra pessoas na sua clínica." };
  }

  const admin = createAdminClient();

  const { data: criado, error } = await admin.auth.admin.createUser({
    email: d.email,
    password: d.senha,
    email_confirm: true,
    user_metadata: { nome: d.nome, role: d.papel, organization_id: orgId },
  });

  if (error || !criado?.user) {
    const msg = error?.message ?? "";
    if (/already been registered|already exists/i.test(msg)) {
      return { ok: false, erro: "Já existe uma conta com esse e-mail." };
    }
    if (/password/i.test(msg)) {
      return { ok: false, erro: "Senha recusada pelo Supabase: use uma mais forte." };
    }
    console.error("[usuarios] Erro ao criar:", msg);
    return { ok: false, erro: "Não foi possível criar o acesso." };
  }

  // O trigger handle_new_user já criou o profile a partir dos metadados;
  // o upsert garante os campos extras e corrige qualquer divergência.
  const { error: erroPerfil } = await admin.from("profiles").upsert({
    id: criado.user.id,
    nome: d.nome,
    role: d.papel,
    organization_id: orgId,
    especialidade: d.especialidade || null,
    crm: d.crm || null,
    telefone: d.telefone || null,
    ativo: true,
  });

  if (erroPerfil) {
    // Sem perfil a pessoa loga e não enxerga nada: desfazemos a conta
    await admin.auth.admin.deleteUser(criado.user.id);
    console.error("[usuarios] Erro no perfil, conta revertida:", erroPerfil.message);
    return { ok: false, erro: "Não foi possível concluir o cadastro." };
  }

  let emailEnviado = false;
  if (d.enviarConvite) {
    const { data: org } = orgId
      ? await admin.from("organizations").select("nome").eq("id", orgId).maybeSingle()
      : { data: null };
    const envio = await enviarLinkDeSenha({
      email: d.email,
      nome: d.nome,
      tipo: "convite",
      clinica: org?.nome ?? null,
    });
    emailEnviado = envio.enviado;
    if (!envio.enviado) console.error("[usuarios] Convite não enviado:", envio.motivo);
  }

  revalidar();
  return { ok: true, emailEnviado };
}

/* ------------------------------------------------------------------ */
/* Editar                                                              */
/* ------------------------------------------------------------------ */

const dadosSchema = z.object({
  id: z.string().min(1),
  nome: z.string().trim().min(2, "Informe o nome."),
  especialidade: z.string().trim().max(80).optional().or(z.literal("")),
  crm: z.string().trim().max(40).optional().or(z.literal("")),
  telefone: z.string().trim().max(30).optional().or(z.literal("")),
});

export type DadosUsuarioInput = z.input<typeof dadosSchema>;

export async function atualizarUsuario(
  input: DadosUsuarioInput
): Promise<ActionResult> {
  const parsed = dadosSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.errors[0]?.message ?? "Dados inválidos" };
  }

  const r = await autorizar(parsed.data.id, { permitirPropriaConta: true });
  if (ehErro(r)) return r;

  const d = parsed.data;
  const { error } = await r.admin
    .from("profiles")
    .update({
      nome: d.nome,
      especialidade: d.especialidade || null,
      crm: d.crm || null,
      telefone: d.telefone || null,
    })
    .eq("id", d.id);

  if (error) return { ok: false, erro: "Não foi possível salvar os dados." };

  revalidar();
  return { ok: true };
}

/** Troca o papel — o que a pessoa passa a enxergar no painel. */
export async function definirPapel(
  usuarioId: string,
  papel: Role
): Promise<ActionResult> {
  if (!PAPEIS.includes(papel)) return { ok: false, erro: "Papel inválido." };

  const r = await autorizar(usuarioId);
  if (ehErro(r)) return r;

  if (papel === "super_admin" && r.ctx.profile.role !== "super_admin") {
    return { ok: false, erro: "Só a equipe Medi Marketing concede esse acesso." };
  }

  // Virar super admin desliga o vínculo com a clínica, e o caminho de
  // volta precisa de uma clínica de destino explícita.
  if (papel === "super_admin") {
    const { error } = await r.admin
      .from("profiles")
      .update({ role: papel, organization_id: null })
      .eq("id", usuarioId);
    if (error) return { ok: false, erro: "Não foi possível alterar o papel." };
  } else {
    if (!r.alvo.organization_id) {
      return {
        ok: false,
        erro: "Escolha antes a clínica desta pessoa: sem clínica ela não enxerga nada.",
      };
    }
    const { error } = await r.admin
      .from("profiles")
      .update({ role: papel })
      .eq("id", usuarioId);
    if (error) return { ok: false, erro: "Não foi possível alterar o papel." };
  }

  revalidar();
  return { ok: true };
}

/** Move a pessoa para outra clínica (só super admin). */
export async function transferirClinica(
  usuarioId: string,
  organizationId: string
): Promise<ActionResult> {
  const r = await autorizar(usuarioId);
  if (ehErro(r)) return r;

  if (r.ctx.profile.role !== "super_admin") {
    return { ok: false, erro: "Só a equipe Medi Marketing transfere entre clínicas." };
  }
  if (r.alvo.role === "super_admin") {
    return { ok: false, erro: "Super admin não pertence a nenhuma clínica." };
  }

  const { error } = await r.admin
    .from("profiles")
    .update({ organization_id: organizationId })
    .eq("id", usuarioId);

  if (error) return { ok: false, erro: "Não foi possível transferir." };

  revalidar();
  return { ok: true };
}

/**
 * Põe uma conta que já existe dentro de uma clínica da carteira (só super
 * admin). É o que liga o login de alguém aos dados que a equipe já tem da
 * clínica — diagnóstico, indicadores, check-ins: a partir daqui a pessoa
 * enxerga tudo isso no painel dela.
 *
 * Faz junto o que sempre acompanha o vínculo: define o papel, tira da
 * fila de liberação, devolve o acesso e ativa a clínica.
 */
export async function vincularClinica(
  usuarioId: string,
  organizationId: string,
  papel: Role
): Promise<ActionResult> {
  if (papel === "super_admin" || !PAPEIS.includes(papel)) {
    return { ok: false, erro: "Escolha o papel da pessoa na clínica." };
  }

  const r = await autorizar(usuarioId);
  if (ehErro(r)) return r;

  if (r.ctx.profile.role !== "super_admin") {
    return { ok: false, erro: "Só a equipe Medi Marketing vincula contas a clínicas." };
  }
  if (r.alvo.role === "super_admin") {
    return { ok: false, erro: "Contas da equipe Medi Marketing não pertencem a clínicas." };
  }

  const { data: org } = await r.admin
    .from("organizations")
    .select("id")
    .eq("id", organizationId)
    .maybeSingle();
  if (!org) return { ok: false, erro: "Clínica não encontrada." };

  const { error } = await r.admin
    .from("profiles")
    .update({
      organization_id: organizationId,
      role: papel,
      ativo: true,
      aguardando_liberacao: false,
    })
    .eq("id", usuarioId);

  if (error) {
    console.error("[usuarios] Erro ao vincular:", error.message);
    return { ok: false, erro: "Não foi possível vincular a conta." };
  }

  await r.admin.from("organizations").update({ ativo: true }).eq("id", organizationId);
  await r.admin.auth.admin.updateUserById(usuarioId, { ban_duration: "none" });

  revalidar();
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Acesso                                                              */
/* ------------------------------------------------------------------ */

/**
 * Concede ou corta o acesso.
 *
 * Duas camadas de propósito: o `ativo` do perfil, que os guards do app
 * checam, e o banimento no Supabase Auth, que invalida a sessão já aberta
 * e impede novo login. Só o primeiro deixaria quem está logado continuar
 * navegando até o token expirar.
 */
export async function definirAcesso(
  usuarioId: string,
  ativo: boolean
): Promise<ActionResult> {
  const r = await autorizar(usuarioId);
  if (ehErro(r)) return r;

  const { error } = await r.admin
    .from("profiles")
    // Conceder acesso tira a pessoa da fila: continuar "aguardando" com
    // acesso liberado deixaria a lista mentindo.
    .update({ ativo, ...(ativo ? { aguardando_liberacao: false } : {}) })
    .eq("id", usuarioId);

  if (error) return { ok: false, erro: "Não foi possível atualizar o acesso." };

  // A clínica de um cadastro público nasce inativa; ao liberar o primeiro
  // usuário dela, ela vira cliente de fato e passa a contar na carteira.
  if (ativo && r.alvo.organization_id) {
    await r.admin
      .from("organizations")
      .update({ ativo: true })
      .eq("id", r.alvo.organization_id);
  }

  const { error: erroBan } = await r.admin.auth.admin.updateUserById(usuarioId, {
    // ~100 anos equivale a indefinido; "none" remove o banimento
    ban_duration: ativo ? "none" : "876000h",
  });

  if (erroBan) {
    console.error("[usuarios] Perfil atualizado, banimento falhou:", erroBan.message);
    return {
      ok: false,
      erro: ativo
        ? "Perfil reativado, mas o login continua bloqueado. Tente de novo."
        : "Perfil desativado, mas a sessão atual pode seguir ativa. Tente de novo.",
    };
  }

  revalidar();
  return { ok: true };
}

/**
 * Libera um cadastro que chegou pela tela pública.
 *
 * É a ação que fecha o ciclo do autocadastro: o dono da clínica criou a
 * conta e declarou o papel que quer, mas quem decide é o administrador.
 * Junta as três coisas que sempre andam juntas nesse momento — definir o
 * papel, dar acesso e ativar a clínica — para não virar três cliques com
 * estados intermediários incoerentes.
 */
export async function liberarAcesso(
  usuarioId: string,
  papel: Role
): Promise<ActionResult> {
  if (!PAPEIS.includes(papel)) return { ok: false, erro: "Papel inválido." };

  const r = await autorizar(usuarioId);
  if (ehErro(r)) return r;

  if (papel === "super_admin" && r.ctx.profile.role !== "super_admin") {
    return { ok: false, erro: "Só a equipe Medi Marketing concede esse acesso." };
  }
  if (papel !== "super_admin" && !r.alvo.organization_id) {
    return { ok: false, erro: "Defina antes a clínica desta pessoa." };
  }

  const { error } = await r.admin
    .from("profiles")
    .update({
      role: papel,
      ativo: true,
      aguardando_liberacao: false,
      ...(papel === "super_admin" ? { organization_id: null } : {}),
    })
    .eq("id", usuarioId);

  if (error) {
    console.error("[usuarios] Erro ao liberar:", error.message);
    return { ok: false, erro: "Não foi possível liberar o acesso." };
  }

  if (papel !== "super_admin" && r.alvo.organization_id) {
    await r.admin
      .from("organizations")
      .update({ ativo: true })
      .eq("id", r.alvo.organization_id);
  }

  // Cadastro público nunca foi banido, mas liberar alguém que teve o
  // acesso cortado antes precisa desfazer o banimento.
  await r.admin.auth.admin.updateUserById(usuarioId, { ban_duration: "none" });

  revalidar();
  return { ok: true };
}

/** Recusa um cadastro: mantém a conta, mas fora da fila e sem acesso. */
export async function recusarCadastro(usuarioId: string): Promise<ActionResult> {
  const r = await autorizar(usuarioId);
  if (ehErro(r)) return r;

  const { error } = await r.admin
    .from("profiles")
    .update({ ativo: false, aguardando_liberacao: false })
    .eq("id", usuarioId);

  if (error) return { ok: false, erro: "Não foi possível recusar o cadastro." };

  await r.admin.auth.admin.updateUserById(usuarioId, { ban_duration: "876000h" });

  revalidar();
  return { ok: true };
}

const senhaSchema = z.object({
  id: z.string().min(1),
  senha: z.string().min(8, "A senha precisa de pelo menos 8 caracteres.").max(72),
});

/** Define uma senha provisória — para quem perdeu o acesso e precisa entrar hoje. */
export async function definirSenhaDe(input: {
  id: string;
  senha: string;
}): Promise<ActionResult> {
  const parsed = senhaSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.errors[0]?.message ?? "Dados inválidos" };
  }

  const r = await autorizar(parsed.data.id);
  if (ehErro(r)) return r;

  const { error } = await r.admin.auth.admin.updateUserById(parsed.data.id, {
    password: parsed.data.senha,
  });

  if (error) {
    console.error("[usuarios] Erro ao definir senha:", error.message);
    return { ok: false, erro: "Não foi possível definir a senha." };
  }

  revalidar();
  return { ok: true };
}

/** Manda o e-mail de redefinição, para a pessoa escolher a própria senha. */
export async function enviarRedefinicao(usuarioId: string): Promise<ActionResult> {
  const r = await autorizar(usuarioId, { permitirPropriaConta: true });
  if (ehErro(r)) return r;

  const { data: conta } = await r.admin.auth.admin.getUserById(usuarioId);
  if (!conta?.user?.email) {
    return { ok: false, erro: "Essa conta não tem e-mail cadastrado." };
  }

  const envio = await enviarLinkDeSenha({
    email: conta.user.email,
    nome: r.alvo.nome,
    tipo: "redefinir",
  });
  if (envio.enviado) return { ok: true };
  console.error("[usuarios] Resend falhou, tentando pelo Supabase:", envio.motivo);

  const { error } = await r.ctx.supabase.auth.resetPasswordForEmail(conta.user.email);
  if (error) {
    console.error("[usuarios] Erro no envio:", error.message);
    return { ok: false, erro: "Não foi possível enviar o e-mail." };
  }

  return { ok: true };
}

/**
 * Remove a conta em definitivo.
 *
 * Só use quando a pessoa foi cadastrada por engano. Para desligamento,
 * `definirAcesso(false)` é o caminho: corta o acesso e preserva o
 * histórico de tudo que ela registrou.
 */
export async function excluirUsuario(usuarioId: string): Promise<ActionResult> {
  const r = await autorizar(usuarioId);
  if (ehErro(r)) return r;

  // O profile cai junto por ON DELETE CASCADE em auth.users
  const { error } = await r.admin.auth.admin.deleteUser(usuarioId);
  if (error) {
    console.error("[usuarios] Erro ao excluir:", error.message);
    return { ok: false, erro: "Não foi possível excluir a conta." };
  }

  revalidar();
  return { ok: true };
}
