"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { bloqueio, contexto } from "@/lib/actions/contexto";
import { criarUsuario } from "@/lib/actions/usuarios";
import { liberarFormulario } from "@/lib/actions/formularios";
import { SLUG_DIAGNOSTICO } from "@/lib/formularios/diagnostico-clinica";
import { urlBase } from "@/lib/lembretes";
import { gerarSlug } from "@/lib/slug";

/**
 * CADASTRO MANUAL DE CLÍNICA
 *
 * Para o cliente que fechou por conversa e não vai passar pelo cadastro
 * público. A equipe cria a clínica já ativa e, no mesmo passo, pode
 * abrir o acesso do responsável e liberar o diagnóstico — os três
 * pedidos que sempre vêm juntos no primeiro dia.
 *
 * Cada passo é independente: se o acesso falhar (e-mail já usado, por
 * exemplo), a clínica continua criada e a tela diz o que faltou.
 */
const schema = z
  .object({
    nome: z.string().trim().min(2, "Informe o nome da clínica."),
    especialidade: z.string().trim().max(80),
    cidade: z.string().trim().max(120),
    telefone: z.string().trim().max(30),
    email: z.string().trim().toLowerCase().email("E-mail da clínica inválido.").or(z.literal("")),
    responsavel: z.string().trim().max(120),
    plano: z.enum(["essencial", "performance", "full"]),
    liberarDiagnostico: z.boolean(),
    acesso: z
      .object({
        nome: z.string().trim().min(2, "Informe o nome de quem vai acessar."),
        email: z.string().trim().toLowerCase().email("E-mail de acesso inválido."),
        senha: z.string().min(8, "A senha provisória precisa de pelo menos 8 caracteres.").max(72),
        papel: z.enum(["gestor", "medico"]),
        enviarConvite: z.boolean().optional(),
      })
      .nullable(),
  });

export type NovaClinicaInput = z.input<typeof schema>;

export type ResultadoNovaClinica =
  | {
      ok: true;
      organizationId: string;
      linkDiagnostico: string | null;
      /** O que não deu certo depois de a clínica existir. */
      avisos: string[];
    }
  | { ok: false; erro: string };

export async function criarClinica(input: NovaClinicaInput): Promise<ResultadoNovaClinica> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.errors[0]?.message ?? "Dados inválidos." };
  }

  const ctx = await contexto(["super_admin"]);
  if (ctx.estado !== "ok") {
    const b = bloqueio(ctx);
    return { ok: false, erro: b.ok ? "Sem permissão." : b.erro };
  }

  const d = parsed.data;
  const base = gerarSlug(d.nome);
  let organizationId: string | null = null;

  // O slug é único: "clinica-vida", depois "clinica-vida-2"...
  for (let tentativa = 0; tentativa < 5 && !organizationId; tentativa++) {
    const slug = tentativa === 0 ? base : `${base}-${tentativa + 1}`;
    const { data, error } = await ctx.supabase
      .from("organizations")
      .insert({
        nome: d.nome,
        slug,
        especialidade: d.especialidade || null,
        plano: d.plano,
        cidade: d.cidade || null,
        telefone: d.telefone || null,
        email: d.email || null,
        ativo: true,
        cnpj: null,
        endereco: null,
        responsavel: d.responsavel || null,
        logo_url: null,
        site: null,
        instagram: null,
        mensagem_lembrete: null,
        antecedencia_lembrete_h: 24,
        lembrete_dias_uteis: 1,
        lembrete_hora: 9,
        lembrete_ativo: true,
        merge_connection_id: null,
      })
      .select("id")
      .single();

    if (data) organizationId = data.id;
    else if (error && !/duplicate|unique/i.test(error.message)) {
      console.error("[clinicas] Erro ao criar:", error.message);
      return { ok: false, erro: "Não foi possível criar a clínica." };
    }
  }

  if (!organizationId) {
    return { ok: false, erro: "Já existem clínicas com nome parecido. Ajuste o nome e tente de novo." };
  }

  const avisos: string[] = [];

  if (d.acesso) {
    const res = await criarUsuario({
      nome: d.acesso.nome,
      email: d.acesso.email,
      senha: d.acesso.senha,
      papel: d.acesso.papel,
      organizationId,
      telefone: d.telefone,
      enviarConvite: d.acesso.enviarConvite,
    });
    if (!res.ok) avisos.push(`O acesso não foi criado: ${res.erro}`);
    else if (d.acesso.enviarConvite && !res.emailEnviado) {
      avisos.push("O acesso foi criado, mas o e-mail de convite não saiu. Repasse a senha provisória.");
    }
  }

  let linkDiagnostico: string | null = null;
  if (d.liberarDiagnostico) {
    const res = await liberarFormulario(organizationId, SLUG_DIAGNOSTICO);
    if (res.ok) {
      const { data } = await ctx.supabase
        .from("formularios_respostas")
        .select("token")
        .eq("id", res.id)
        .single();
      if (data?.token) linkDiagnostico = `${urlBase()}/diagnostico/${data.token}`;
    } else {
      avisos.push(`O diagnóstico não foi liberado: ${res.erro}`);
    }
  }

  revalidatePath("/app/clinicas");
  revalidatePath("/app/admin/usuarios");
  return { ok: true, organizationId, linkDiagnostico, avisos };
}
