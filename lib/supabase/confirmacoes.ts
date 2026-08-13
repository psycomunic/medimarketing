import { randomBytes } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, adminDisponivel } from "@/lib/supabase/admin";
import { emModoDemo, supabaseConfigurado } from "@/lib/supabase/queries";
import { demoOrganization } from "@/lib/demo";
import { demoConfirmacoes } from "@/lib/demo-modulos";
import {
  calcularDisparo,
  montarMensagem,
  montarMensagemReagendada,
  urlConfirmacao,
} from "@/lib/lembretes";
import type {
  Confirmacao,
  ConfirmacaoComConsulta,
  Organization,
  StatusConfirmacao,
} from "@/lib/supabase/types";

/** Token do paciente: 32 bytes aleatórios, impossível de adivinhar. */
export function gerarToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * A estrutura do banco está no ar?
 *
 * Sem esta checagem o cron devolveria "0 enviados" com a tabela
 * inexistente — sucesso aparente com nada acontecendo, que é o pior
 * jeito de uma rotina agendada falhar.
 */
export async function estruturaPronta(): Promise<
  { pronta: true } | { pronta: false; motivo: string }
> {
  if (!adminDisponivel()) {
    return { pronta: false, motivo: "SUPABASE_SERVICE_ROLE_KEY ausente." };
  }

  const admin = createAdminClient();
  const { error } = await admin.from("confirmacoes").select("id").limit(1);

  if (error) {
    return {
      pronta: false,
      motivo:
        "A tabela `confirmacoes` não existe. Rode o bloco de 2026-08-11 de supabase/atualizacoes.sql no SQL Editor.",
    };
  }

  return { pronta: true };
}

/* ------------------------------------------------------------------ */
/* Painel                                                              */
/* ------------------------------------------------------------------ */

/**
 * Confirmações da clínica numa janela de datas de consulta.
 *
 * O join é feito em memória porque a agenda de alguns dias é pequena e
 * assim a mesma função serve tanto ao painel quanto à rotina de disparo,
 * sem depender de view.
 */
export async function getConfirmacoes(
  organizationId: string | null,
  deISO: string,
  ateISO: string
): Promise<ConfirmacaoComConsulta[]> {
  if (await emModoDemo()) {
    return demoConfirmacoes().filter(
      (c) => c.data_hora >= deISO && c.data_hora <= ateISO
    );
  }
  if (!organizationId) return [];

  const supabase = await createClient();

  const { data: consultas } = await supabase
    .from("consultas")
    .select("*")
    .eq("organization_id", organizationId)
    .gte("data_hora", deISO)
    .lte("data_hora", ateISO)
    .order("data_hora", { ascending: true });

  if (!consultas?.length) return [];

  const [{ data: confirmacoes }, { data: perfis }] = await Promise.all([
    supabase
      .from("confirmacoes")
      .select("*")
      .in("consulta_id", consultas.map((c) => c.id)),
    supabase
      .from("profiles")
      .select("id,nome")
      .in("id", [...new Set(consultas.map((c) => c.medico_id))]),
  ]);

  const nomeMedico = new Map((perfis ?? []).map((p) => [p.id, p.nome ?? null]));

  return (confirmacoes ?? []).flatMap((conf) => {
    const consulta = consultas.find((c) => c.id === conf.consulta_id);
    if (!consulta) return [];
    return [
      {
        ...conf,
        paciente_nome: consulta.paciente_nome,
        paciente_telefone: consulta.paciente_telefone,
        data_hora: consulta.data_hora,
        medico_nome: nomeMedico.get(consulta.medico_id) ?? null,
        tipo: consulta.tipo,
        status_consulta: consulta.status,
      },
    ];
  });
}

export type ResumoConfirmacoes = {
  total: number;
  aguardandoEnvio: number;
  enviados: number;
  confirmados: number;
  reagendar: number;
  recusados: number;
  /** Já passou da hora de disparar e ainda não saiu. */
  atrasados: number;
  taxaConfirmacao: number;
};

export function resumirConfirmacoes(
  lista: ConfirmacaoComConsulta[]
): ResumoConfirmacoes {
  const agora = new Date().toISOString();
  const respondidos = lista.filter((c) =>
    ["confirmado", "reagendar", "recusado"].includes(c.status)
  ).length;
  const enviados = lista.filter((c) => c.enviado_em).length;

  return {
    total: lista.length,
    aguardandoEnvio: lista.filter((c) => c.status === "pendente").length,
    enviados,
    confirmados: lista.filter((c) => c.status === "confirmado").length,
    reagendar: lista.filter((c) => c.status === "reagendar").length,
    recusados: lista.filter((c) => c.status === "recusado").length,
    atrasados: lista.filter(
      (c) => c.status === "pendente" && c.agendado_para <= agora
    ).length,
    taxaConfirmacao: enviados ? (respondidos / enviados) * 100 : 0,
  };
}

/* ------------------------------------------------------------------ */
/* Página pública do paciente                                          */
/* ------------------------------------------------------------------ */

export type ConfirmacaoPublica = {
  token: string;
  status: StatusConfirmacao;
  paciente: string;
  dataHora: string;
  medico: string | null;
  tipo: string;
  clinica: string;
  /** Logo da clínica: é a marca dela que o paciente precisa reconhecer. */
  logoClinica: string | null;
  endereco: string | null;
  telefoneClinica: string | null;
  /** A consulta já foi cancelada ou o horário já passou. */
  encerrada: boolean;
};

/**
 * Busca a confirmação pelo token, para a página pública.
 *
 * Usa a service role de propósito: liberar `select` para o papel `anon`
 * permitiria varrer a agenda inteira de todas as clínicas. Aqui a
 * consulta é sempre por token exato e devolve só o que o paciente já
 * sabe sobre a própria consulta.
 */
export async function getConfirmacaoPorToken(
  token: string
): Promise<ConfirmacaoPublica | null> {
  if (!token) return null;

  // Em demonstração o link também abre, para dar para mostrar a tela do
  // paciente numa reunião sem precisar de banco.
  //
  // Aqui o critério é a ausência de Supabase, e não `emModoDemo()`: esta
  // é a única página sem sessão do sistema, e aquela função exige o
  // cookie de demonstração para responder true.
  if (!supabaseConfigurado()) {
    const conf = demoConfirmacoes().find((c) => c.token === token);
    if (!conf) return null;

    return {
      token: conf.token,
      status: conf.status,
      paciente: conf.paciente_nome,
      dataHora: conf.data_hora,
      medico: conf.medico_nome,
      tipo: conf.tipo,
      clinica: demoOrganization.nome,
      logoClinica: demoOrganization.logo_url,
      endereco:
        [demoOrganization.endereco, demoOrganization.cidade]
          .filter(Boolean)
          .join(", ") || null,
      telefoneClinica: demoOrganization.telefone,
      encerrada: new Date(conf.data_hora).getTime() < Date.now(),
    };
  }

  // Token real tem 43 caracteres (32 bytes em base64url); abaixo disso
  // não vale nem consultar o banco.
  if (token.length < 20) return null;
  if (!adminDisponivel()) return null;

  const admin = createAdminClient();

  const { data: conf } = await admin
    .from("confirmacoes")
    .select("*")
    .eq("token", token)
    .maybeSingle();

  if (!conf) return null;

  const { data: consulta } = await admin
    .from("consultas")
    .select("*")
    .eq("id", conf.consulta_id)
    .maybeSingle();

  if (!consulta) return null;

  const [{ data: org }, { data: medico }] = await Promise.all([
    admin
      .from("organizations")
      .select("nome,endereco,cidade,telefone,logo_url")
      .eq("id", conf.organization_id)
      .maybeSingle(),
    admin.from("profiles").select("nome").eq("id", consulta.medico_id).maybeSingle(),
  ]);

  const partes = [org?.endereco, org?.cidade].filter(Boolean);

  return {
    token: conf.token,
    status: conf.status,
    paciente: consulta.paciente_nome,
    dataHora: consulta.data_hora,
    medico: medico?.nome ?? null,
    tipo: consulta.tipo,
    clinica: org?.nome ?? "a clínica",
    logoClinica: org?.logo_url ?? null,
    endereco: partes.length ? partes.join(", ") : null,
    telefoneClinica: org?.telefone ?? null,
    encerrada:
      consulta.status === "cancelada" ||
      new Date(consulta.data_hora).getTime() < Date.now(),
  };
}

/* ------------------------------------------------------------------ */
/* Ficha da consulta                                                   */
/* ------------------------------------------------------------------ */

export type ConfirmacaoDaConsulta = {
  id: string;
  token: string;
  status: StatusConfirmacao;
  agendadoPara: string;
  enviadoEm: string | null;
  respondidoEm: string | null;
  canal: string | null;
  observacao: string | null;
  mensagem: string;
  mensagemReagendada: string;
  url: string;
};

/**
 * Confirmações das consultas da agenda, indexadas por consulta.
 *
 * A mensagem já sai montada daqui para que o botão de WhatsApp da ficha
 * mande exatamente o mesmo texto que a rotina automática enviaria.
 */
export async function getConfirmacoesDaAgenda(
  consultas: { id: string; organization_id: string | null; paciente_nome: string; data_hora: string; medico_id: string }[]
): Promise<Record<string, ConfirmacaoDaConsulta>> {
  if (!consultas.length) return {};

  const mapa: Record<string, ConfirmacaoDaConsulta> = {};

  const monta = (
    conf: Pick<
      Confirmacao,
      "id" | "token" | "status" | "agendado_para" | "enviado_em" | "respondido_em" | "canal" | "observacao" | "consulta_id"
    >,
    dados: { paciente: string; dataHora: string; medico: string | null; clinica: string; endereco: string | null; modelo: string | null }
  ) => {
    const url = urlConfirmacao(conf.token);
    mapa[conf.consulta_id] = {
      id: conf.id,
      token: conf.token,
      status: conf.status,
      agendadoPara: conf.agendado_para,
      enviadoEm: conf.enviado_em,
      respondidoEm: conf.respondido_em,
      canal: conf.canal,
      observacao: conf.observacao,
      url,
      mensagem: montarMensagem({ ...dados, link: url }),
      mensagemReagendada: montarMensagemReagendada({ ...dados, link: url }),
    };
  };

  if (await emModoDemo()) {
    for (const c of demoConfirmacoes()) {
      monta(c, {
        paciente: c.paciente_nome,
        dataHora: c.data_hora,
        medico: c.medico_nome,
        clinica: demoOrganization.nome,
        endereco:
          [demoOrganization.endereco, demoOrganization.cidade].filter(Boolean).join(", ") || null,
        modelo: demoOrganization.mensagem_lembrete,
      });
    }
    return mapa;
  }

  if (!adminDisponivel()) return {};

  const admin = createAdminClient();
  const { data: confs, error } = await admin
    .from("confirmacoes")
    .select("*")
    .in("consulta_id", consultas.map((c) => c.id));

  // Estrutura ausente no banco: a ficha mostra "sem confirmação" em vez
  // de estourar. O aviso do que fazer fica na tela de Confirmações.
  if (error || !confs?.length) return {};

  const orgIds = [...new Set(consultas.map((c) => c.organization_id).filter(Boolean))] as string[];
  const medicoIds = [...new Set(consultas.map((c) => c.medico_id))];

  const [{ data: orgs }, { data: perfis }] = await Promise.all([
    orgIds.length
      ? admin.from("organizations").select("id,nome,endereco,cidade,mensagem_lembrete").in("id", orgIds)
      : Promise.resolve({ data: [] as { id: string; nome: string; endereco: string | null; cidade: string | null; mensagem_lembrete: string | null }[] }),
    admin.from("profiles").select("id,nome").in("id", medicoIds),
  ]);

  const porOrg = new Map((orgs ?? []).map((o) => [o.id, o]));
  const nomeMedico = new Map((perfis ?? []).map((p) => [p.id, p.nome]));

  for (const conf of confs) {
    const consulta = consultas.find((c) => c.id === conf.consulta_id);
    if (!consulta) continue;
    const org = consulta.organization_id ? porOrg.get(consulta.organization_id) : null;

    monta(conf, {
      paciente: consulta.paciente_nome,
      dataHora: consulta.data_hora,
      medico: nomeMedico.get(consulta.medico_id) ?? null,
      clinica: org?.nome ?? "a clínica",
      endereco: [org?.endereco, org?.cidade].filter(Boolean).join(", ") || null,
      modelo: org?.mensagem_lembrete ?? null,
    });
  }

  return mapa;
}

/* ------------------------------------------------------------------ */
/* Geração                                                             */
/* ------------------------------------------------------------------ */

/**
 * Garante uma confirmação para cada consulta futura que ainda não tem.
 *
 * Roda no cron e também quando o painel abre, para que uma consulta
 * marcada agora já apareça na fila sem esperar o próximo ciclo.
 * Devolve quantas foram criadas.
 */
export async function gerarPendentes(
  org: Pick<Organization, "id" | "lembrete_dias_uteis" | "lembrete_hora">,
  ate: Date
): Promise<number> {
  if (!adminDisponivel()) return 0;

  const admin = createAdminClient();
  const agora = new Date();

  const { data: consultas } = await admin
    .from("consultas")
    .select("id,data_hora,status")
    .eq("organization_id", org.id)
    .gte("data_hora", agora.toISOString())
    .lte("data_hora", ate.toISOString())
    // Cancelada não precisa de confirmação; realizada já passou
    .in("status", ["pendente", "confirmada"]);

  if (!consultas?.length) return 0;

  const { data: existentes } = await admin
    .from("confirmacoes")
    .select("consulta_id")
    .in("consulta_id", consultas.map((c) => c.id));

  const jaTem = new Set((existentes ?? []).map((c) => c.consulta_id));
  const novas = consultas.filter((c) => !jaTem.has(c.id));
  if (!novas.length) return 0;

  const { error } = await admin.from("confirmacoes").insert(
    novas.map((c) => ({
      consulta_id: c.id,
      organization_id: org.id,
      token: gerarToken(),
      agendado_para: calcularDisparo(
        new Date(c.data_hora),
        org.lembrete_dias_uteis ?? 1,
        org.lembrete_hora ?? 9
      ).toISOString(),
      canal: null,
      enviado_em: null,
      respondido_em: null,
      observacao: null,
    }))
  );

  if (error) {
    console.error("[confirmacoes] Erro ao gerar:", error.message);
    return 0;
  }

  return novas.length;
}

/**
 * Fim do dia de hoje — o corte usado pela rotina de disparo.
 *
 * A rotina roda uma vez por dia, de manhã. Se o corte fosse "agora", um
 * lembrete marcado para as 09:00 não seria pego na passada das 08:00 e
 * só sairia no dia seguinte, atrasado. Pegando tudo que vence hoje, ele
 * sai algumas horas antes do horário escolhido — o que é certo — em vez
 * de um dia depois.
 */
export function fimDeHoje(): string {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

/** Confirmações prontas para disparar, em todas as clínicas ativas. */
export async function getDevidas(
  ate: string = fimDeHoje(),
  limite = 200
): Promise<(Confirmacao & { organizacao: Organization })[]> {
  if (!adminDisponivel()) return [];

  const admin = createAdminClient();

  const { data: pendentes } = await admin
    .from("confirmacoes")
    .select("*")
    .eq("status", "pendente")
    .lte("agendado_para", ate)
    .order("agendado_para", { ascending: true })
    .limit(limite);

  if (!pendentes?.length) return [];

  const { data: orgs } = await admin
    .from("organizations")
    .select("*")
    .in("id", [...new Set(pendentes.map((c) => c.organization_id))]);

  const porId = new Map((orgs ?? []).map((o) => [o.id, o]));

  return pendentes.flatMap((c) => {
    const organizacao = porId.get(c.organization_id);
    // Clínica inativa ou com lembrete desligado não dispara
    if (!organizacao || !organizacao.ativo || !organizacao.lembrete_ativo) return [];
    return [{ ...c, organizacao }];
  });
}
