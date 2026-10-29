import "server-only";

import { randomBytes } from "node:crypto";
import { createAdminClient, adminDisponivel } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { emModoDemo } from "@/lib/supabase/queries";
import { clinicaParaEnvio } from "@/lib/comunicacao/equipe";
import { cancelarPendentes, enfileirar, type ItemFila } from "@/lib/comunicacao/fila";
import { envioAutomatico } from "@/lib/envio";
import { emailConfigurado } from "@/lib/email";
import { emailPacientePesquisa } from "@/lib/email-modelos";
import { msgPesquisa } from "@/lib/mensagens";
import { urlBase } from "@/lib/lembretes";
import type { Avaliacao } from "@/lib/supabase/types";

/**
 * PESQUISA DE SATISFAÇÃO (NPS)
 *
 * Uma pergunta depois da consulta: "de 0 a 10, o quanto você nos
 * recomendaria?". Notas 9 e 10 são promotores, 7 e 8 neutros, 0 a 6
 * detratores. O NPS é a fatia de promotores menos a de detratores.
 *
 * O envio automático é opcional por clínica (`pesquisa_ativa`) e sai
 * algumas horas depois da consulta marcada como realizada, para chegar
 * quando o paciente já voltou para casa.
 */

export const EVENTO_PESQUISA = "pesquisa_satisfacao";
/** Espera entre a consulta realizada e a pesquisa. */
const ATRASO_HORAS = 2;

export const urlAvaliacao = (token: string) => `${urlBase()}/avaliar/${token}`;

export type Categoria = "promotor" | "neutro" | "detrator";
export const categoria = (nota: number): Categoria => (nota >= 9 ? "promotor" : nota >= 7 ? "neutro" : "detrator");

/**
 * Cria (ou devolve) a avaliação da consulta. Uma por consulta: marcar
 * como realizada de novo não gera outra pesquisa.
 */
async function garantirAvaliacao(consultaId: string): Promise<{ avaliacao: Avaliacao; consulta: ConsultaPesquisa } | null> {
  const admin = createAdminClient();
  const { data: c } = await admin
    .from("consultas")
    .select("id,organization_id,medico_id,paciente_nome,paciente_telefone,paciente_email,status")
    .eq("id", consultaId)
    .maybeSingle();
  if (!c?.organization_id) return null;

  const { data: existente } = await admin.from("avaliacoes").select("*").eq("consulta_id", consultaId).maybeSingle();
  if (existente) return { avaliacao: existente as Avaliacao, consulta: c as ConsultaPesquisa };

  const { data: nova, error } = await admin
    .from("avaliacoes")
    .insert({
      consulta_id: c.id,
      organization_id: c.organization_id,
      medico_id: c.medico_id,
      paciente_nome: c.paciente_nome,
      token: randomBytes(24).toString("base64url"),
    })
    .select("*")
    .single();
  if (error || !nova) {
    // Tabela ainda não criada: a consulta segue normalmente
    if (error) console.error("[avaliacoes] Não criou a pesquisa:", error.message);
    return null;
  }
  return { avaliacao: nova as Avaliacao, consulta: c as ConsultaPesquisa };
}

type ConsultaPesquisa = {
  id: string;
  organization_id: string;
  medico_id: string;
  paciente_nome: string;
  paciente_telefone: string | null;
  paciente_email: string | null;
  status: string;
};

/**
 * Consulta realizada: programa a pesquisa, se a clínica ligou o envio
 * automático e há um canal para chegar ao paciente. Nunca lança.
 */
export async function programarPesquisa(consultaId: string): Promise<void> {
  if (!adminDisponivel()) return;
  try {
    const admin = createAdminClient();
    const { data: base } = await admin.from("consultas").select("organization_id").eq("id", consultaId).maybeSingle();
    if (!base?.organization_id) return;
    const { data: org } = await admin
      .from("organizations")
      .select("pesquisa_ativa,ativo")
      .eq("id", base.organization_id)
      .maybeSingle();
    // Sem a coluna (SQL não rodou) ou desligado: nada sai sozinho
    if (!org?.ativo || !(org as { pesquisa_ativa?: boolean }).pesquisa_ativa) return;

    const clinica = await clinicaParaEnvio(base.organization_id);
    if (!clinica) return;
    const r = await garantirAvaliacao(consultaId);
    if (!r || r.avaliacao.respondido_em) return;
    const { avaliacao, consulta } = r;

    const link = urlAvaliacao(avaliacao.token);
    const quando = new Date(Date.now() + ATRASO_HORAS * 3600_000);
    const itens: ItemFila[] = [];
    if (consulta.paciente_telefone && envioAutomatico(clinica.merge_connection_id)) {
      itens.push({
        organizationId: consulta.organization_id,
        evento: EVENTO_PESQUISA,
        canal: "whatsapp",
        publico: "paciente",
        destino: consulta.paciente_telefone,
        destinoNome: consulta.paciente_nome,
        consultaId: consulta.id,
        conteudo: msgPesquisa({ paciente: consulta.paciente_nome, clinica: clinica.nome, link }),
        payload: { conexaoId: clinica.merge_connection_id ?? null },
        chave: `pesquisa:${avaliacao.id}:whatsapp`,
        agendadoPara: quando,
      });
    } else if (consulta.paciente_email && emailConfigurado()) {
      // E-mail só quando o WhatsApp não alcança: uma pesquisa por paciente basta
      const m = emailPacientePesquisa(
        { clinica: clinica.nome, logoUrl: clinica.logo_url, emailClinica: clinica.email, telefoneClinica: clinica.telefone },
        { paciente: consulta.paciente_nome, link }
      );
      itens.push({
        organizationId: consulta.organization_id,
        evento: EVENTO_PESQUISA,
        canal: "email",
        publico: "paciente",
        destino: consulta.paciente_email,
        destinoNome: consulta.paciente_nome,
        consultaId: consulta.id,
        assunto: m.assunto,
        conteudo: m.texto,
        payload: { html: m.html, remetenteNome: clinica.nome },
        chave: `pesquisa:${avaliacao.id}:email`,
        agendadoPara: quando,
      });
    }
    if (!itens.length) return;
    await enfileirar(itens);
    await admin.from("avaliacoes").update({ enviado_em: quando.toISOString() }).eq("id", avaliacao.id).is("enviado_em", null);
  } catch (e) {
    console.error("[avaliacoes] Falha ao programar:", e instanceof Error ? e.message : e);
  }
}

/** A consulta deixou de ser realizada: a pesquisa que ainda não saiu fica. */
export async function suspenderPesquisa(consultaId: string): Promise<void> {
  await cancelarPendentes(consultaId, [EVENTO_PESQUISA]);
}

/** Link e texto para a recepção mandar pelo WhatsApp do próprio celular. */
export async function pesquisaManual(consultaId: string): Promise<{ link: string; texto: string; telefone: string | null } | null> {
  if (!adminDisponivel()) return null;
  const r = await garantirAvaliacao(consultaId);
  if (!r) return null;
  const clinica = await clinicaParaEnvio(r.consulta.organization_id);
  const link = urlAvaliacao(r.avaliacao.token);
  return {
    link,
    texto: msgPesquisa({ paciente: r.consulta.paciente_nome, clinica: clinica?.nome ?? "clínica", link }),
    telefone: r.consulta.paciente_telefone,
  };
}

/* ------------------------------------------------------------------ */
/* Página pública                                                      */
/* ------------------------------------------------------------------ */

export type AvaliacaoPublica = {
  token: string;
  paciente: string;
  clinica: string;
  logoClinica: string | null;
  medico: string | null;
  respondida: boolean;
  nota: number | null;
  linkAvaliacao: string | null;
};

export async function getAvaliacaoPorToken(token: string): Promise<AvaliacaoPublica | null> {
  if (!adminDisponivel() || !/^[\w-]{20,64}$/.test(token)) return null;
  const admin = createAdminClient();
  const { data: a } = await admin.from("avaliacoes").select("*").eq("token", token).maybeSingle();
  if (!a) return null;
  const [{ data: org }, { data: medico }] = await Promise.all([
    admin.from("organizations").select("*").eq("id", a.organization_id).maybeSingle(),
    a.medico_id ? admin.from("profiles").select("nome").eq("id", a.medico_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  return {
    token: a.token,
    paciente: a.paciente_nome.trim().split(/\s+/)[0] ?? a.paciente_nome,
    clinica: org?.nome ?? "Clínica",
    logoClinica: org?.logo_url ?? null,
    medico: medico?.nome ?? null,
    respondida: !!a.respondido_em,
    nota: a.nota,
    linkAvaliacao: (org as { link_avaliacao?: string | null } | null)?.link_avaliacao ?? null,
  };
}

/* ------------------------------------------------------------------ */
/* Painel                                                              */
/* ------------------------------------------------------------------ */

export type ResumoNps = {
  /** -100 a 100; nulo sem respostas. */
  nps: number | null;
  respostas: number;
  enviadas: number;
  promotores: number;
  neutros: number;
  detratores: number;
  porMes: { mes: string; nps: number | null; respostas: number }[];
  comentarios: { paciente: string; nota: number; comentario: string; quando: string; medicoId: string | null }[];
  ativa: boolean;
  instalada: boolean;
};

const npsDe = (notas: number[]) => {
  if (!notas.length) return null;
  const p = notas.filter((n) => n >= 9).length;
  const d = notas.filter((n) => n <= 6).length;
  return Math.round(((p - d) / notas.length) * 100);
};

/** NPS dos últimos 90 dias e a evolução dos últimos 6 meses. */
export async function resumoNps(orgId: string, ativa: boolean): Promise<ResumoNps> {
  const agora = new Date();
  const desde = new Date(agora.getFullYear(), agora.getMonth() - 5, 1);
  let lista: Avaliacao[];
  let instalada = true;
  if (await emModoDemo()) {
    lista = demoAvaliacoes();
  } else {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("avaliacoes")
      .select("*")
      .eq("organization_id", orgId)
      .gte("created_at", desde.toISOString())
      .order("respondido_em", { ascending: false })
      .limit(2000);
    instalada = !error;
    lista = (data ?? []) as Avaliacao[];
  }

  const corte90 = new Date(agora.getTime() - 90 * 86400_000);
  const respondidas = lista.filter((a) => a.respondido_em && a.nota !== null);
  const recentes = respondidas.filter((a) => new Date(a.respondido_em!) >= corte90);
  const notas = recentes.map((a) => a.nota!);

  const porMes = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(agora.getFullYear(), agora.getMonth() - 5 + i, 1);
    const chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const doMes = respondidas.filter((a) => a.respondido_em!.startsWith(chave)).map((a) => a.nota!);
    return { mes: d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""), nps: npsDe(doMes), respostas: doMes.length };
  });

  return {
    nps: npsDe(notas),
    respostas: notas.length,
    enviadas: lista.filter((a) => a.enviado_em && new Date(a.enviado_em) >= corte90).length,
    promotores: notas.filter((n) => n >= 9).length,
    neutros: notas.filter((n) => n >= 7 && n <= 8).length,
    detratores: notas.filter((n) => n <= 6).length,
    porMes,
    comentarios: recentes
      .filter((a) => a.comentario?.trim())
      .sort((a, b) => b.respondido_em!.localeCompare(a.respondido_em!))
      .slice(0, 4)
      .map((a) => ({ paciente: a.paciente_nome, nota: a.nota!, comentario: a.comentario!.trim(), quando: a.respondido_em!, medicoId: a.medico_id })),
    ativa: (await emModoDemo()) ? true : ativa,
    instalada,
  };
}

/** Respostas fictícias, determinísticas, para o modo demonstração. */
function demoAvaliacoes(): Avaliacao[] {
  const nomes = ["Ana Ribeiro", "Bruno Almeida", "Larissa Pinto", "Beatriz Souza", "Carlos Menezes", "Helena Martins", "Igor Barbosa", "Fernanda Dias", "Patrícia Gomes", "Rafael Costa"];
  // O comentário acompanha a nota: elogio de promotor, ressalva de neutro, queixa de detrator
  const comentario = (i: number, nota: number) => {
    if (i % 4 !== 0) return null;
    if (nota >= 9) return ["Atendimento excelente, a doutora explicou tudo com calma.", "Ótima experiência, já indiquei para minha irmã.", "Recepção super atenciosa."][i % 3];
    if (nota >= 7) return "Bom atendimento, mas o estacionamento é difícil.";
    return "Esperei 40 minutos além do horário marcado.";
  };
  const lista: Avaliacao[] = [];
  let semente = 7;
  const r = () => ((semente = (semente * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < 60; i++) {
    const dias = Math.floor(i * 2.9) + 1;
    const d = new Date(Date.now() - dias * 86400_000);
    const x = r();
    const respondeu = x < 0.62;
    const nota = respondeu ? (x < 0.36 ? 10 : x < 0.45 ? 9 : x < 0.52 ? 8 : x < 0.56 ? 7 : x < 0.59 ? 6 : 3) : null;
    lista.push({
      id: `av-${i}`,
      consulta_id: `c-av-${i}`,
      organization_id: "demo",
      medico_id: i % 3 === 0 ? "med-vd-2" : null,
      paciente_nome: nomes[i % nomes.length],
      token: `demo-${i}`,
      enviado_em: d.toISOString(),
      nota,
      comentario: nota !== null ? comentario(i, nota) : null,
      respondido_em: respondeu ? new Date(d.getTime() + 3 * 3600_000).toISOString() : null,
      created_at: d.toISOString(),
    });
  }
  return lista;
}
