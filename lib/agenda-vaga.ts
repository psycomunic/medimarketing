import "server-only";

import { createAdminClient, adminDisponivel } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { limiteValido, ocupacaoDoIntervalo, type ConsultaOcupando } from "@/lib/agenda-capacidade";
import { fechamentoNoIntervalo, type RegraFechamento } from "@/lib/agenda-horarios";
import { paredeEmBrasilia } from "@/lib/lembretes";

/**
 * Conferência de vaga no servidor, antes de gravar.
 *
 * A tela já mostra o que está lotado, mas é aqui que a regra vale: duas
 * recepcionistas salvando ao mesmo tempo, ou uma aba aberta desde cedo,
 * não podem passar do limite da clínica.
 *
 * Lê com o cliente admin quando existe, porque a RLS do médico esconde as
 * consultas dos colegas — e são elas que ocupam o horário.
 */

export type Vaga = {
  limite: number | null;
  /** Pico de consultas no intervalo, sem a que está sendo marcada. */
  simultaneas: number;
  profissionalOcupado: boolean;
  /** O profissional fechou a agenda desse serviço nesse horário: o motivo (ou "Agenda fechada"). */
  fechado: string | null;
};

export type RecusaVaga = {
  ok: false;
  erro: string;
  codigo: "lotado" | "profissional_ocupado" | "fechado";
};

const JANELA_MAX_MIN = 8 * 60; // nenhuma consulta dura mais que isso

export async function lerVaga(p: {
  organizationId: string;
  medicoId: string;
  dataHora: string;
  duracaoMin: number;
  ignorarId?: string | null;
  /** Serviço da consulta, para os fechamentos de um serviço só. */
  servicoId?: string | null;
}): Promise<Vaga> {
  const db = adminDisponivel() ? createAdminClient() : await createClient();
  const inicio = new Date(p.dataHora);
  const fim = new Date(inicio.getTime() + p.duracaoMin * 60000);
  const desde = new Date(inicio.getTime() - JANELA_MAX_MIN * 60000);

  const [{ data: org }, { data: consultas }, { data: fechamentos }] = await Promise.all([
    db.from("organizations").select("*").eq("id", p.organizationId).maybeSingle(),
    db
      .from("consultas")
      .select("id,medico_id,data_hora,duracao_min,status")
      .eq("organization_id", p.organizationId)
      .neq("status", "cancelada")
      .gte("data_hora", desde.toISOString())
      .lt("data_hora", fim.toISOString()),
    // Sem a tabela (SQL ainda não rodou), vem erro e nenhum fechamento
    db.from("fechamentos").select("*").eq("medico_id", p.medicoId),
  ]);

  // Fechamentos são hora de parede de Brasília, como o expediente
  const parede = paredeEmBrasilia(inicio);
  const fech = fechamentoNoIntervalo((fechamentos ?? []) as RegraFechamento[], {
    medicoId: p.medicoId,
    servicoId: p.servicoId ?? null,
    dia: parede.dia,
    semana: parede.semana,
    ini: parede.minutos,
    fim: parede.minutos + p.duracaoMin,
  });

  const oc = ocupacaoDoIntervalo((consultas ?? []) as ConsultaOcupando[], inicio, p.duracaoMin, p.ignorarId);
  return {
    // "*" para não quebrar antes do SQL da coluna rodar
    limite: limiteValido((org as { max_consultas_horario?: number | null } | null)?.max_consultas_horario),
    simultaneas: oc.simultaneas,
    profissionalOcupado: oc.ocupados.has(p.medicoId),
    fechado: fech ? fech.motivo || "Agenda fechada" : null,
  };
}

/**
 * Aplica as duas regras. `encaixe` é o "salvar mesmo assim" da tela:
 * vale para o gestor nos dois casos, e para o próprio profissional só
 * dentro da agenda dele — ele pode se espremer, mas não lotar a clínica.
 */
export function recusarVaga(
  v: Vaga,
  quem: { gestor: boolean; ehOProfissional: boolean; encaixe: boolean; nomeProfissional?: string | null }
): RecusaVaga | null {
  if (v.limite !== null && v.simultaneas >= v.limite && !(quem.encaixe && quem.gestor)) {
    return {
      ok: false,
      codigo: "lotado",
      erro: quem.gestor
        ? `Esse horário já tem ${v.simultaneas} de ${v.limite} consultas. Confirme o encaixe para salvar acima do limite.`
        : `Esse horário está lotado (${v.simultaneas} de ${v.limite} consultas). Escolha outro horário ou peça ao gestor para encaixar.`,
    };
  }
  if (v.fechado && !(quem.encaixe && (quem.gestor || quem.ehOProfissional))) {
    const nome = quem.nomeProfissional ?? "O profissional";
    return {
      ok: false,
      codigo: "fechado",
      erro:
        quem.gestor || quem.ehOProfissional
          ? `${nome} fechou a agenda desse serviço nesse horário (${v.fechado}). Confirme o encaixe para salvar assim mesmo.`
          : `${nome} fechou a agenda desse serviço nesse horário (${v.fechado}). Escolha outro horário ou outro profissional.`,
    };
  }
  if (v.profissionalOcupado && !(quem.encaixe && (quem.gestor || quem.ehOProfissional))) {
    const nome = quem.nomeProfissional ?? "O profissional";
    return {
      ok: false,
      codigo: "profissional_ocupado",
      erro:
        quem.gestor || quem.ehOProfissional
          ? `${nome} já tem consulta nesse horário. Confirme o encaixe para salvar assim mesmo.`
          : `${nome} já tem consulta nesse horário. Escolha outro profissional ou outro horário.`,
    };
  }
  return null;
}
