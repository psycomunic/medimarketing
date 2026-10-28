import "server-only";

import { createAdminClient, adminDisponivel } from "@/lib/supabase/admin";
import { envioAutomatico } from "@/lib/envio";
import { emailConfigurado } from "@/lib/email";
import { canaisEfetivos, type EventoEquipe } from "@/lib/comunicacao/eventos";
import { enfileirar, type ItemFila } from "@/lib/comunicacao/fila";
import type { CanalAviso, Organization, Role, TipoNotificacao } from "@/lib/supabase/types";

/**
 * QUEM DA EQUIPE RECEBE
 *
 * Junta as pessoas ativas da clínica com o que cada uma escolheu em
 * Meu Perfil (ou o padrão do catálogo) e transforma um evento em itens
 * da fila: um por pessoa e canal.
 *
 * Quem fez a ação não recebe o aviso dela — a secretária que marcou a
 * consulta não precisa ser avisada de que marcou.
 */

export type MembroEquipe = {
  id: string;
  nome: string;
  role: Exclude<Role, "super_admin">;
  telefone: string | null;
  email: string | null;
  canais: Partial<Record<string, CanalAviso[]>>;
  resumoHora: number;
};

export type ClinicaEnvio = Pick<
  Organization,
  "id" | "nome" | "email" | "telefone" | "logo_url" | "merge_connection_id" | "endereco" | "cidade"
>;

/** Pessoas ativas da clínica, com e-mail e preferências. */
export async function membrosDaClinica(organizationId: string): Promise<MembroEquipe[]> {
  if (!adminDisponivel()) return [];
  const admin = createAdminClient();

  const [{ data: perfis }, { data: prefs }] = await Promise.all([
    admin
      .from("profiles")
      .select("id,nome,role,telefone,ativo,aguardando_liberacao")
      .eq("organization_id", organizationId)
      .eq("ativo", true),
    admin.from("preferencias_aviso").select("*").eq("organization_id", organizationId),
  ]);

  const porUsuario = new Map((prefs ?? []).map((p) => [p.usuario_id, p]));

  const membros = (perfis ?? []).filter(
    (p) => !p.aguardando_liberacao && p.role !== "super_admin"
  );

  // O e-mail de login vive em auth.users
  const emails = await Promise.all(
    membros.map(async (p) => {
      const { data } = await admin.auth.admin.getUserById(p.id);
      const e = data?.user?.email ?? null;
      return e && !e.endsWith("@example.invalid") ? e : null;
    })
  );

  return membros.map((p, i) => ({
    id: p.id,
    nome: p.nome ?? "Equipe",
    role: p.role as MembroEquipe["role"],
    telefone: p.telefone,
    email: emails[i],
    canais: porUsuario.get(p.id)?.canais ?? {},
    resumoHora: porUsuario.get(p.id)?.resumo_hora ?? 7,
  }));
}

export async function clinicaParaEnvio(organizationId: string): Promise<ClinicaEnvio | null> {
  if (!adminDisponivel()) return null;
  const { data } = await createAdminClient()
    .from("organizations")
    .select("id,nome,email,telefone,logo_url,merge_connection_id,endereco,cidade")
    .eq("id", organizationId)
    .maybeSingle();
  return data;
}

const digitos = (t: string | null | undefined) => (t ?? "").replace(/\D/g, "");

export type AvisoEquipeInput = {
  organizationId: string;
  evento: EventoEquipe;
  /** Base da chave anti-repetição; cada pessoa e canal ganha um sufixo. */
  chave: string;
  consultaId?: string | null;
  /** Profissional da consulta: recebe como "médico". */
  medicoId?: string | null;
  /** Quem fez a ação: não recebe o próprio aviso. */
  atorId?: string | null;
  /** Painel */
  titulo: string;
  descricao?: string | null;
  href?: string | null;
  tipoPainel: TipoNotificacao;
  prioridade?: "alta" | "normal";
  /** Texto do WhatsApp. Sem ele, o canal não é usado. */
  whatsapp?: string | null;
  /** E-mail pronto. Sem ele, o canal não é usado. */
  email?: { assunto: string; html: string; texto: string } | null;
  /** Também manda o e-mail para a caixa da clínica (a recepção). */
  copiaCaixaClinica?: boolean;
  /** Já carregados por quem chama, para não buscar de novo. */
  membros?: MembroEquipe[];
  clinica?: ClinicaEnvio | null;
  /** Restringe a estas pessoas (ex.: o resumo do dia de um médico). */
  somente?: string[];
  agendadoPara?: Date;
};

/** Transforma o evento em itens da fila e enfileira. */
export async function avisarEquipe(a: AvisoEquipeInput): Promise<number> {
  const [membros, clinica] = await Promise.all([
    a.membros ?? membrosDaClinica(a.organizationId),
    a.clinica !== undefined ? a.clinica : clinicaParaEnvio(a.organizationId),
  ]);
  if (!clinica) return 0;

  const conexaoId = clinica.merge_connection_id ?? null;
  const podeWhatsApp = !!a.whatsapp && envioAutomatico(conexaoId);
  const podeEmail = !!a.email && emailConfigurado();
  const telefoneClinica = digitos(clinica.telefone);

  const itens: ItemFila[] = [];
  const base = {
    organizationId: a.organizationId,
    evento: a.evento,
    publico: "equipe" as const,
    consultaId: a.consultaId ?? null,
    agendadoPara: a.agendadoPara,
  };

  for (const m of membros) {
    if (a.atorId && m.id === a.atorId) continue;
    if (a.somente && !a.somente.includes(m.id)) continue;

    const canais = canaisEfetivos(a.evento, m.role, m.id === a.medicoId, m.canais);

    for (const canal of canais) {
      if (canal === "painel") {
        itens.push({
          ...base,
          canal,
          usuarioId: m.id,
          destinoNome: m.nome,
          assunto: a.titulo,
          conteudo: a.descricao ?? null,
          payload: { tipo: a.tipoPainel, href: a.href ?? null, prioridade: a.prioridade ?? "normal" },
          chave: `${a.chave}:${m.id}:painel`,
        });
      } else if (canal === "whatsapp" && podeWhatsApp && m.telefone) {
        // O número da clínica é o que envia: não manda para si mesmo
        if (telefoneClinica && digitos(m.telefone) === telefoneClinica) continue;
        itens.push({
          ...base,
          canal,
          usuarioId: m.id,
          destino: m.telefone,
          destinoNome: m.nome,
          conteudo: a.whatsapp!,
          payload: { conexaoId },
          chave: `${a.chave}:${m.id}:whatsapp`,
        });
      } else if (canal === "email" && podeEmail && m.email) {
        itens.push({
          ...base,
          canal,
          usuarioId: m.id,
          destino: m.email,
          destinoNome: m.nome,
          assunto: a.email!.assunto,
          conteudo: a.email!.texto,
          payload: { html: a.email!.html, remetenteNome: clinica.nome },
          chave: `${a.chave}:${m.id}:email`,
        });
      }
    }
  }

  // A caixa da clínica, quando é outro endereço que alguém da equipe
  if (a.copiaCaixaClinica && podeEmail && clinica.email) {
    const jaVai = itens.some((i) => i.canal === "email" && i.destino?.toLowerCase() === clinica.email!.toLowerCase());
    if (!jaVai) {
      itens.push({
        ...base,
        canal: "email",
        publico: "clinica",
        destino: clinica.email,
        destinoNome: clinica.nome,
        assunto: a.email!.assunto,
        conteudo: a.email!.texto,
        payload: { html: a.email!.html, remetenteNome: clinica.nome },
        chave: `${a.chave}:clinica:email`,
      });
    }
  }

  await enfileirar(itens);
  return itens.length;
}
