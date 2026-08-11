"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, adminDisponivel } from "@/lib/supabase/admin";
import { supabaseConfigurado } from "@/lib/supabase/queries";
import { notificar } from "@/lib/supabase/notificacoes";
import type { ActionResult } from "@/lib/actions/contexto";

/**
 * CADASTRO PÚBLICO — dono de clínica criando a própria conta.
 *
 * O que este caminho pode e o que não pode:
 *
 *   - PODE criar o login e registrar a clínica declarada.
 *   - NÃO PODE conceder acesso. A conta nasce com `aguardando_liberacao`
 *     e `ativo = false`, então o guard do painel a barra no login.
 *
 * Quem libera é um administrador, em Usuários, definindo o papel. É por
 * isso que o trigger do banco parou de ler papel dos metadados: se o
 * visitante pudesse escolher o próprio papel, "aguardar liberação" seria
 * teatro.
 */

const schema = z.object({
  nome: z.string().trim().min(3, "Informe seu nome completo."),
  clinica: z.string().trim().min(2, "Informe o nome da clínica."),
  email: z.string().trim().toLowerCase().email("E-mail inválido."),
  telefone: z.string().trim().min(8, "Informe um telefone para contato.").max(30),
  senha: z
    .string()
    .min(8, "A senha precisa de pelo menos 8 caracteres.")
    .max(72, "Senha muito longa."),
  confirmacao: z.string(),
  consentimento: z.literal(true, {
    errorMap: () => ({ message: "É preciso aceitar a política de privacidade." }),
  }),
}).refine((d) => d.senha === d.confirmacao, {
  message: "A confirmação não confere com a senha.",
  path: ["confirmacao"],
});

export type CadastroInput = z.input<typeof schema>;

export type CadastroResult =
  | { ok: true; precisaConfirmarEmail: boolean }
  | { ok: false; erro: string };

/** Transforma "Clínica Vida Derma" em "clinica-vida-derma". */
function gerarSlug(nome: string): string {
  const semAcento = [...nome.toLowerCase().normalize("NFD")]
    .filter((c) => {
      const cod = c.codePointAt(0) ?? 0;
      return cod < 0x0300 || cod > 0x036f;
    })
    .join("");

  return semAcento
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50) || "clinica";
}

export async function cadastrar(input: CadastroInput): Promise<CadastroResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.errors[0]?.message ?? "Dados inválidos" };
  }

  if (!supabaseConfigurado()) {
    return {
      ok: false,
      erro: "Modo demonstração: o cadastro só funciona com o banco conectado.",
    };
  }
  if (!adminDisponivel()) {
    // Sem a service role não dá para registrar a clínica nem marcar a
    // conta como pendente — e criar o login solto deixaria a pessoa num
    // limbo pior que não conseguir se cadastrar.
    return {
      ok: false,
      erro: "Cadastro indisponível no momento. Fale com a equipe Medi Marketing.",
    };
  }

  const d = parsed.data;

  // O signUp normal (e não o admin) é de propósito: é ele que dispara o
  // e-mail de confirmação. Sem confirmar, ninguém prova ser dono do
  // endereço que digitou.
  const supabase = await createClient();
  const { data: cadastro, error } = await supabase.auth.signUp({
    email: d.email,
    password: d.senha,
    options: { data: { nome: d.nome } },
  });

  if (error || !cadastro.user) {
    const msg = error?.message ?? "";
    if (/already registered|already exists|user already/i.test(msg)) {
      return {
        ok: false,
        erro: "Já existe uma conta com esse e-mail. Tente entrar ou recuperar a senha.",
      };
    }
    if (/rate limit|too many/i.test(msg)) {
      return { ok: false, erro: "Muitas tentativas. Aguarde alguns minutos." };
    }
    if (/password/i.test(msg)) {
      return { ok: false, erro: "Senha recusada: escolha uma mais forte." };
    }
    console.error("[cadastro] Erro no signUp:", msg);
    return { ok: false, erro: "Não foi possível concluir o cadastro." };
  }

  const admin = createAdminClient();

  // A clínica entra inativa: é um cadastro declarado, ainda não um
  // cliente. Vira ativa quando um administrador liberar o acesso.
  let organizationId: string | null = null;
  const base = gerarSlug(d.clinica);

  for (let tentativa = 0; tentativa < 5; tentativa++) {
    const slug = tentativa === 0 ? base : `${base}-${tentativa + 1}`;
    const { data: org, error: erroOrg } = await admin
      .from("organizations")
      .insert({
        nome: d.clinica,
        slug,
        especialidade: null,
        plano: "essencial",
        cidade: null,
        telefone: d.telefone,
        email: d.email,
        ativo: false,
        cnpj: null,
        endereco: null,
        responsavel: d.nome,
        site: null,
        instagram: null,
        mensagem_lembrete: null,
        antecedencia_lembrete_h: 24,
        lembrete_dias_uteis: 1,
        lembrete_hora: 9,
        lembrete_ativo: true,
      })
      .select("id")
      .single();

    if (org) {
      organizationId = org.id;
      break;
    }
    // Slug repetido: tenta o próximo sufixo. Outro erro, desiste.
    if (!/duplicate|unique/i.test(erroOrg?.message ?? "")) {
      console.error("[cadastro] Erro ao criar clínica:", erroOrg?.message);
      break;
    }
  }

  const { error: erroPerfil } = await admin
    .from("profiles")
    .update({
      nome: d.nome,
      telefone: d.telefone,
      organization_id: organizationId,
      role: "gestor",
      // As duas linhas que sustentam a fila: o papel fica registrado
      // como intenção, mas sem acesso até alguém liberar.
      ativo: false,
      aguardando_liberacao: true,
    })
    .eq("id", cadastro.user.id);

  if (erroPerfil) {
    console.error("[cadastro] Erro ao preparar o perfil:", erroPerfil.message);
    return {
      ok: false,
      erro: "Conta criada, mas houve um erro no cadastro. Fale com a equipe Medi Marketing.",
    };
  }

  // Avisa a equipe Medi Marketing: sem organização, a notificação é da
  // plataforma e só o super admin enxerga.
  await notificar({
    organizationId: null,
    tipo: "cadastro_pendente",
    prioridade: "alta",
    titulo: `${d.clinica} se cadastrou`,
    descricao: `${d.nome} · ${d.email} · ${d.telefone}. A conta não entra até você definir o papel.`,
    href: "/app/admin/usuarios",
    entidadeId: cadastro.user.id,
    papeis: ["super_admin"],
  });

  // Sessão presente = o projeto está com confirmação de e-mail desligada
  return { ok: true, precisaConfirmarEmail: !cadastro.session };
}
