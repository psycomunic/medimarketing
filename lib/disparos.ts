import "server-only";

import { createAdminClient, adminDisponivel } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { emModoDemo } from "@/lib/supabase/queries";
import { getPacientesFiltrados, type FiltrosPacientes } from "@/lib/supabase/pacientes";
import { clinicaParaEnvio } from "@/lib/comunicacao/equipe";
import { enfileirar } from "@/lib/comunicacao/fila";
import { agendarWhatsApp } from "@/lib/envio";
import { mergeConfigurado } from "@/lib/merge";
import { emailDisparo } from "@/lib/email-modelos";
import { urlBase } from "@/lib/lembretes";
import { DEMO_ORG_ID, DEMO_USER_ID } from "@/lib/demo";
import type { CanalDisparo, Disparo, FinalidadeDisparo, PacienteResumo, StatusDestinatario } from "@/lib/supabase/types";

/**
 * DISPAROS
 *
 * Campanha de WhatsApp ou e-mail para um segmento de pacientes. O que
 * protege a clínica:
 *
 *   - ritmo: intervalo aleatório entre mensagens, só em horário
 *     comercial e com limite por dia. Disparo em rajada é o caminho mais
 *     curto para o WhatsApp bloquear o número da clínica;
 *   - LGPD: marketing só para quem aceitou; descadastrado nunca recebe;
 *     toda mensagem leva o link "não quero mais receber";
 *   - repetição: quem recebeu um disparo há poucos dias fica de fora.
 *
 * Cada destinatário ganha um horário previsto na criação. A rotina de
 * 10 em 10 minutos programa no WhatsApp (ou na fila de e-mail) só o que
 * vence a seguir, então cancelar interrompe o restante na hora.
 */

export const RITMO = {
  whatsapp: { minSeg: 40, maxSeg: 90, porDia: 250 },
  email: { minSeg: 2, maxSeg: 4, porDia: 2000 },
} as const;
/** Janela de envio, em Brasília: das 8h às 20h, de segunda a sábado. */
const JANELA = { inicio: 8, fim: 20, dias: [1, 2, 3, 4, 5, 6] };
/** Quem recebeu um disparo há menos que isso não recebe outro. */
export const DIAS_SEM_REPETIR = 7;
/** Maior público de um disparo. */
export const MAX_DESTINATARIOS = 3000;
/** Consultas marcadas até tantos dias depois da mensagem contam como resultado. */
export const DIAS_ATRIBUICAO = 15;
/** A rotina passa a cada 10 minutos: programa um pouco além disso. */
const HORIZONTE_MIN = 12;

const OFFSET_MS = 3 * 3600_000; // Brasília, sem horário de verão

/* ------------------------------------------------------------------ */
/* Público                                                             */
/* ------------------------------------------------------------------ */

export type Publico = {
  elegiveis: PacienteResumo[];
  excluidos: { semContato: number; semConsentimento: number; descadastrados: number; recentes: number };
  total: number;
};

const emailValido = (e: string | null) => !!e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

/**
 * Quem do segmento recebe e quem fica de fora (e por quê). Devolve
 * `null` quando o banco de pacientes ainda não existe.
 */
export async function montarPublico(
  filtros: FiltrosPacientes,
  canal: CanalDisparo,
  finalidade: FinalidadeDisparo,
  evitarRecentes = true
): Promise<Publico | null> {
  const todos = await getPacientesFiltrados({ ...filtros, pagina: 1 });
  if (!todos) return null;
  const recentes = evitarRecentes ? await recebeuRecentemente(todos.map((p) => p.id)) : new Set<string>();

  const excluidos = { semContato: 0, semConsentimento: 0, descadastrados: 0, recentes: 0 };
  const elegiveis: PacienteResumo[] = [];
  for (const p of todos) {
    if (p.descadastrado_em) excluidos.descadastrados++;
    else if (canal === "whatsapp" ? !p.telefone_chave && !(p.telefone ?? "").replace(/\D/g, "").match(/\d{10,}/) : !emailValido(p.email))
      excluidos.semContato++;
    else if (finalidade === "marketing" && !p.consentimento_marketing) excluidos.semConsentimento++;
    else if (recentes.has(p.id)) excluidos.recentes++;
    else elegiveis.push(p);
  }
  return { elegiveis, excluidos, total: todos.length };
}

async function recebeuRecentemente(ids: string[]): Promise<Set<string>> {
  if (!ids.length || (await emModoDemo())) return new Set();
  const supabase = await createClient();
  const desde = new Date(Date.now() - DIAS_SEM_REPETIR * 86400_000).toISOString();
  const achados = new Set<string>();
  for (let i = 0; i < ids.length; i += 500) {
    const { data } = await supabase
      .from("disparo_destinatarios")
      .select("paciente_id")
      .in("paciente_id", ids.slice(i, i + 500))
      .gte("previsto_para", desde)
      .neq("status", "cancelado");
    for (const d of data ?? []) achados.add(d.paciente_id);
  }
  return achados;
}

/* ------------------------------------------------------------------ */
/* Horários                                                            */
/* ------------------------------------------------------------------ */

/** Hora e dia da semana em Brasília de um instante. */
function emBrasilia(t: number) {
  const d = new Date(t - OFFSET_MS);
  return { hora: d.getUTCHours() + d.getUTCMinutes() / 60, dia: d.getUTCDay(), data: d.toISOString().slice(0, 10) };
}

/** Próximo instante dentro da janela de envio (o próprio, se já estiver nela). */
function dentroDaJanela(t: number): number {
  for (let i = 0; i < 14; i++) {
    const b = emBrasilia(t);
    if (JANELA.dias.includes(b.dia) && b.hora >= JANELA.inicio && b.hora < JANELA.fim) return t;
    // Pula para as 8h do dia certo (hoje, se ainda é cedo; senão amanhã)
    const base = Date.parse(`${b.data}T00:00:00Z`) + OFFSET_MS;
    t = b.hora < JANELA.inicio && JANELA.dias.includes(b.dia) ? base + JANELA.inicio * 3600_000 : base + 86400_000 + JANELA.inicio * 3600_000;
  }
  return t;
}

/**
 * Horário de cada mensagem: intervalo aleatório, só dentro da janela e
 * no máximo `porDia` por dia. Devolve também quando termina.
 */
export function calcularHorarios(n: number, inicio: Date, canal: CanalDisparo): Date[] {
  const r = RITMO[canal];
  const horarios: Date[] = [];
  let t = dentroDaJanela(Math.max(inicio.getTime(), Date.now() + 60_000));
  let dia = emBrasilia(t).data;
  let noDia = 0;
  for (let i = 0; i < n; i++) {
    if (noDia >= r.porDia) {
      // Cota do dia cheia: recomeça amanhã às 8h
      t = dentroDaJanela(Date.parse(`${dia}T00:00:00Z`) + OFFSET_MS + 86400_000);
      noDia = 0;
    }
    t = dentroDaJanela(t);
    const d = emBrasilia(t).data;
    if (d !== dia) {
      dia = d;
      noDia = 0;
    }
    horarios.push(new Date(t));
    noDia++;
    t += (r.minSeg + Math.random() * (r.maxSeg - r.minSeg)) * 1000;
  }
  return horarios;
}

/* ------------------------------------------------------------------ */
/* Texto                                                               */
/* ------------------------------------------------------------------ */

export const urlSair = (token: string) => `${urlBase()}/sair/${token}`;

/** Troca {nome}, {nome_completo}, {clinica} e {profissional}. */
export function preencher(texto: string, d: { nome: string; clinica: string; profissional?: string | null }): string {
  const primeiro = d.nome.trim().split(/\s+/)[0] ?? d.nome;
  return texto
    .replace(/\{nome_completo\}/gi, d.nome.trim())
    .replace(/\{nome\}/gi, primeiro)
    .replace(/\{cl[ií]nica\}/gi, d.clinica)
    .replace(/\{profissional\}/gi, d.profissional || "nossa equipe");
}

export function textoWhatsApp(mensagem: string, linkSair: string): string {
  return `${mensagem.trim()}\n\nNão quer mais receber mensagens como esta? ${linkSair}`;
}

/* ------------------------------------------------------------------ */
/* Rotina                                                              */
/* ------------------------------------------------------------------ */

type Fila = {
  id: string;
  disparo_id: string;
  paciente_id: string;
  nome: string;
  destino: string;
  token: string;
  previsto_para: string;
};

/**
 * Programa o que vence nos próximos minutos. Chamada pela rotina de 10 em
 * 10 minutos e logo depois da criação do disparo. Nunca lança.
 */
export async function processarDisparos(): Promise<number> {
  if (!adminDisponivel()) return 0;
  const admin = createAdminClient();
  const ate = new Date(Date.now() + HORIZONTE_MIN * 60_000).toISOString();
  const { data: pendentes, error } = await admin
    .from("disparo_destinatarios")
    .select("id,disparo_id,paciente_id,nome,destino,token,previsto_para")
    .eq("status", "pendente")
    .lte("previsto_para", ate)
    .order("previsto_para")
    .limit(300);
  if (error || !pendentes?.length) {
    if (!error) await fecharConcluidos();
    return 0;
  }

  const disparoIds = [...new Set(pendentes.map((p) => p.disparo_id))];
  const { data: disparos } = await admin.from("disparos").select("*").in("id", disparoIds);
  const porId = new Map((disparos ?? []).map((d) => [d.id, d as Disparo]));
  const clinicas = new Map<string, Awaited<ReturnType<typeof clinicaParaEnvio>>>();
  const pacienteIds = [...new Set(pendentes.map((p) => p.paciente_id))];
  const { data: pacientes } = await admin
    .from("pacientes")
    .select("id,descadastrado_em,consentimento_marketing")
    .in("id", pacienteIds);
  const situacao = new Map((pacientes ?? []).map((p) => [p.id, p]));

  let total = 0;
  for (const item of pendentes as Fila[]) {
    const d = porId.get(item.disparo_id);
    const marcar = (status: StatusDestinatario, extra: { referencia?: string | null; erro?: string | null } = {}) =>
      admin
        .from("disparo_destinatarios")
        .update({ status, processado_em: new Date().toISOString(), ...extra })
        .eq("id", item.id)
        .eq("status", "pendente");

    if (!d || d.status === "cancelado") {
      await marcar("cancelado");
      continue;
    }
    // O paciente pode ter saído da lista depois da criação do disparo
    const p = situacao.get(item.paciente_id);
    if (!p || p.descadastrado_em || (d.finalidade === "marketing" && !p.consentimento_marketing)) {
      await marcar("ignorado", { erro: "Paciente pediu para não receber." });
      continue;
    }

    if (!clinicas.has(d.organization_id)) clinicas.set(d.organization_id, await clinicaParaEnvio(d.organization_id));
    const clinica = clinicas.get(d.organization_id);
    if (!clinica) {
      await marcar("falhou", { erro: "Clínica não encontrada." });
      continue;
    }

    const quando = new Date(item.previsto_para);
    const mensagem = preencher(d.mensagem, { nome: item.nome, clinica: clinica.nome });
    const link = urlSair(item.token);

    if (d.canal === "whatsapp") {
      if (!mergeConfigurado() || !clinica.merge_connection_id) {
        await marcar("falhou", { erro: "WhatsApp da clínica não conectado." });
        continue;
      }
      const r = await agendarWhatsApp(
        { nome: item.nome, telefone: item.destino, conexaoId: clinica.merge_connection_id },
        textoWhatsApp(mensagem, link),
        quando
      );
      await marcar(r.enviado ? (quando.getTime() > Date.now() ? "programado" : "enviado") : "falhou", {
        referencia: r.enviado ? r.referencia ?? null : null,
        erro: r.enviado ? null : `${r.motivo}${"detalhe" in r && r.detalhe ? `: ${r.detalhe}` : ""}`,
      });
    } else {
      const m = emailDisparo(
        { clinica: clinica.nome, logoUrl: clinica.logo_url, emailClinica: clinica.email, telefoneClinica: clinica.telefone },
        { assunto: preencher(d.assunto || d.nome, { nome: item.nome, clinica: clinica.nome }), texto: mensagem, linkSair: link }
      );
      await enfileirar([
        {
          organizationId: d.organization_id,
          evento: "disparo",
          canal: "email",
          publico: "paciente",
          destino: item.destino,
          destinoNome: item.nome,
          assunto: m.assunto,
          conteudo: m.texto,
          payload: { html: m.html, remetenteNome: clinica.nome },
          chave: `disparo:${item.id}`,
          agendadoPara: quando,
        },
      ]);
      await marcar("programado");
    }
    total++;
    if (d.status === "agendado") {
      await admin.from("disparos").update({ status: "enviando" }).eq("id", d.id).eq("status", "agendado");
      d.status = "enviando";
    }
  }
  await fecharConcluidos();
  return total;
}

/** Disparo sem nada pendente está concluído. */
async function fecharConcluidos() {
  const admin = createAdminClient();
  const { data: abertos } = await admin.from("disparos").select("id").in("status", ["agendado", "enviando"]).limit(50);
  for (const d of abertos ?? []) {
    const { count } = await admin
      .from("disparo_destinatarios")
      .select("id", { count: "exact", head: true })
      .eq("disparo_id", d.id)
      .eq("status", "pendente");
    if (count === 0) await admin.from("disparos").update({ status: "concluido", concluido_em: new Date().toISOString() }).eq("id", d.id);
  }
}

/* ------------------------------------------------------------------ */
/* Resultados                                                          */
/* ------------------------------------------------------------------ */

export type Resultado = {
  total: number;
  pendentes: number;
  enviados: number;
  falhas: number;
  ignorados: number;
  cancelados: number;
  descadastros: number;
  consultas: number;
  faturamento: number;
  /** Última mensagem prevista: quando o disparo termina. */
  terminaEm: string | null;
};

export type DisparoComResultado = Disparo & { resultado: Resultado };

const vazio = (): Resultado => ({
  total: 0,
  pendentes: 0,
  enviados: 0,
  falhas: 0,
  ignorados: 0,
  cancelados: 0,
  descadastros: 0,
  consultas: 0,
  faturamento: 0,
  terminaEm: null,
});

/** Disparos da clínica com o resultado de cada um. */
export async function getDisparos(): Promise<{ instalado: boolean; lista: DisparoComResultado[] }> {
  if (await emModoDemo()) return { instalado: true, lista: disparosDemo() };
  const supabase = await createClient();
  const { data, error } = await supabase.from("disparos").select("*").order("created_at", { ascending: false }).limit(100);
  if (error) return { instalado: false, lista: [] };
  const lista: DisparoComResultado[] = [];
  for (const d of (data ?? []) as Disparo[]) lista.push({ ...d, resultado: await resultadoDe(d) });
  return { instalado: true, lista };
}

export async function getDisparo(id: string) {
  if (await emModoDemo()) {
    const d = disparosDemo().find((x) => x.id === id);
    return d ? { disparo: d, destinatarios: destinatariosDemo(d) } : null;
  }
  const supabase = await createClient();
  const { data: d } = await supabase.from("disparos").select("*").eq("id", id).maybeSingle();
  if (!d) return null;
  const { data: dest } = await supabase
    .from("disparo_destinatarios")
    .select("id,paciente_id,nome,destino,status,previsto_para,processado_em,erro")
    .eq("disparo_id", id)
    .order("previsto_para")
    .limit(MAX_DESTINATARIOS);
  return { disparo: { ...(d as Disparo), resultado: await resultadoDe(d as Disparo) }, destinatarios: dest ?? [] };
}

async function resultadoDe(d: Disparo): Promise<Resultado> {
  const supabase = await createClient();
  const r = vazio();
  const { data: dest } = await supabase
    .from("disparo_destinatarios")
    .select("paciente_id,status,previsto_para")
    .eq("disparo_id", d.id)
    .limit(MAX_DESTINATARIOS);
  const agora = Date.now();
  for (const x of dest ?? []) {
    r.total++;
    if (x.status === "pendente") r.pendentes++;
    else if (x.status === "enviado" || (x.status === "programado" && Date.parse(x.previsto_para) <= agora)) r.enviados++;
    else if (x.status === "programado") r.pendentes++;
    else if (x.status === "falhou") r.falhas++;
    else if (x.status === "ignorado") r.ignorados++;
    else if (x.status === "cancelado") r.cancelados++;
    if (!r.terminaEm || x.previsto_para > r.terminaEm) r.terminaEm = x.previsto_para;
  }
  const ids = [...new Set((dest ?? []).filter((x) => x.status !== "cancelado" && x.status !== "ignorado").map((x) => x.paciente_id))];
  if (!ids.length) return r;

  const ate = new Date(Date.parse(d.inicio) + DIAS_ATRIBUICAO * 86400_000).toISOString();
  for (let i = 0; i < ids.length; i += 300) {
    const lote = ids.slice(i, i + 300);
    const [{ data: cons }, { count: saiu }] = await Promise.all([
      supabase
        .from("consultas")
        .select("id")
        .in("paciente_id", lote)
        .gte("created_at", d.inicio)
        .lte("created_at", ate)
        .neq("status", "cancelada"),
      supabase.from("pacientes").select("id", { count: "exact", head: true }).in("id", lote).gte("descadastrado_em", d.inicio),
    ]);
    r.consultas += cons?.length ?? 0;
    r.descadastros += saiu ?? 0;
    const cIds = (cons ?? []).map((c) => c.id);
    if (cIds.length) {
      const { data: lanc } = await supabase.from("lancamentos").select("valor,desconto,status").in("consulta_id", cIds).neq("status", "cancelado");
      r.faturamento += (lanc ?? []).reduce((s, l) => s + Math.max(Number(l.valor ?? 0) - Number(l.desconto ?? 0), 0), 0);
    }
  }
  return r;
}

/* ---------------------------- Demonstração ---------------------------- */

/** Dia `n` atrás, às 10h de Brasília: dentro da janela de envio. */
const diasAtras = (n: number) => {
  const d = new Date(Date.now() - Math.floor(n) * 86400_000);
  d.setUTCHours(13, 0, 0, 0);
  return d.toISOString();
};

function disparosDemo(): DisparoComResultado[] {
  const base = {
    organization_id: DEMO_ORG_ID,
    assunto: null,
    criado_por: DEMO_USER_ID,
    cancelado_em: null,
  };
  return [
    {
      ...base,
      id: "disparo-demo-1",
      nome: "Volta às consultas: pacientes sem retorno",
      canal: "whatsapp",
      finalidade: "cuidado",
      mensagem: "Oi, {nome}! Aqui é da {clinica}. Faz um tempinho desde a sua última consulta. Que tal marcar um retorno para ver como está tudo? Temos horários nesta semana.",
      filtros: { situacao: "sem-retorno" },
      segmento_nome: "Sem retorno",
      status: "concluido",
      inicio: diasAtras(12),
      total: 86,
      concluido_em: diasAtras(11),
      created_at: diasAtras(12),
      resultado: { ...vazio(), total: 86, enviados: 83, falhas: 3, descadastros: 2, consultas: 14, faturamento: 5180, terminaEm: diasAtras(11) },
    },
    {
      ...base,
      id: "disparo-demo-2",
      nome: "Novembro: protocolo de verão",
      canal: "whatsapp",
      finalidade: "marketing",
      mensagem: "Oi, {nome}! O verão está chegando e preparamos condições especiais no protocolo de cuidados com a pele em novembro. Quer saber mais? É só responder esta mensagem.",
      filtros: { tag: "Estética" },
      segmento_nome: "Etiqueta: Estética",
      status: "enviando",
      inicio: diasAtras(0.2),
      total: 64,
      concluido_em: null,
      created_at: diasAtras(0.3),
      resultado: { ...vazio(), total: 64, enviados: 41, pendentes: 23, consultas: 3, faturamento: 1350, terminaEm: new Date(Date.now() + 5 * 3600_000).toISOString() },
    },
  ];
}

function destinatariosDemo(d: DisparoComResultado) {
  const nomes = ["Ana Ribeiro", "Bruno Almeida", "Larissa Pinto", "Helena Martins", "Igor Barbosa", "Fernanda Dias", "Carlos Menezes", "Tatiana Reis"];
  return nomes.map((nome, i) => ({
    id: `${d.id}-dest-${i}`,
    paciente_id: `demo-${i}`,
    nome,
    destino: `(11) 9${String(91000000 + i * 1111).slice(0, 4)}-${String(1000 + i * 37).slice(0, 4)}`,
    status: (d.status === "enviando" && i > 4 ? "pendente" : i === 3 && d.status === "concluido" ? "falhou" : "enviado") as StatusDestinatario,
    previsto_para: new Date(Date.parse(d.inicio) + i * 55_000).toISOString(),
    processado_em: null,
    erro: i === 3 && d.status === "concluido" ? "Número sem WhatsApp" : null,
  }));
}
