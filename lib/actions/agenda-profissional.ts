"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, adminDisponivel } from "@/lib/supabase/admin";
import { emModoDemo } from "@/lib/supabase/queries";
import { minutosDe } from "@/lib/agenda-horarios";
import { paredeEmBrasilia, formatarData, formatarHora } from "@/lib/lembretes";
import { slugAgenda } from "@/lib/agendar-slug";

export type ActionResult = { ok: true } | { ok: false; erro: string };

const MSG_DEMO =
  "Modo demonstração: nada é salvo aqui. Numa conta de verdade, esta alteração já estaria valendo.";

/**
 * Quem pode mexer na agenda de um profissional: ele mesmo, a recepção e
 * o gestor da clínica dele, e a equipe Medi. A RLS repete a regra; aqui
 * ela vem antes para a mensagem de erro dizer o porquê.
 */
async function autorizar(medicoId: string, so: "operacional" | "gestor" = "operacional") {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { erro: "Sessão expirada." } as const;

  const [{ data: eu }, { data: alvo }] = await Promise.all([
    supabase.from("profiles").select("id,role,organization_id").eq("id", user.id).maybeSingle(),
    supabase.from("profiles").select("id,nome,organization_id").eq("id", medicoId).maybeSingle(),
  ]);
  if (!eu || !alvo?.organization_id) return { erro: "Profissional não encontrado." } as const;

  const superAdmin = eu.role === "super_admin";
  const mesmaClinica = eu.organization_id === alvo.organization_id;
  const pode =
    superAdmin ||
    (mesmaClinica &&
      (so === "gestor" ? eu.role === "gestor" : eu.id === alvo.id || eu.role === "gestor" || eu.role === "secretaria"));
  if (!pode) {
    return {
      erro: so === "gestor" ? "Só o gestor da clínica muda os serviços de um profissional." : "Você não pode mudar a agenda desse profissional.",
    } as const;
  }
  return { supabase, eu, alvo: { ...alvo, organization_id: alvo.organization_id } } as const;
}

function revalidar() {
  revalidatePath("/app/disponibilidade");
  revalidatePath("/app/agenda");
}

/* ------------------------------------------------------------------ */
/* Serviços que o profissional atende                                  */
/* ------------------------------------------------------------------ */

export async function salvarServicosDoProfissional(medicoId: string, servicoIds: string[]): Promise<ActionResult> {
  if (await emModoDemo()) return { ok: false, erro: MSG_DEMO };
  const r = await autorizar(medicoId, "gestor");
  if ("erro" in r) return { ok: false, erro: r.erro! };

  // Só serviços da tabela da própria clínica
  const { data: validos } = await r.supabase
    .from("tabela_precos")
    .select("id")
    .eq("organization_id", r.alvo.organization_id)
    .in("id", servicoIds.length ? servicoIds : ["00000000-0000-0000-0000-000000000000"]);
  const ids = (validos ?? []).map((v) => v.id);

  const del = await r.supabase.from("profissional_servicos").delete().eq("medico_id", medicoId);
  if (del.error) {
    return { ok: false, erro: "Não foi possível salvar. Rode antes o SQL da agenda por serviço." };
  }
  if (ids.length) {
    const { error } = await r.supabase.from("profissional_servicos").insert(
      ids.map((servico_id) => ({ medico_id: medicoId, servico_id, organization_id: r.alvo.organization_id }))
    );
    if (error) return { ok: false, erro: "Não foi possível salvar os serviços." };
  }
  revalidar();
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Fechamentos                                                         */
/* ------------------------------------------------------------------ */

export type FechamentoInput = {
  medicoId: string;
  /** Nulo = todos os serviços do profissional. */
  servicoId: string | null;
  /** Um dos dois: toda semana ou uma data ("AAAA-MM-DD"). */
  diaSemana: number | null;
  data: string | null;
  inicio: string;
  fim: string;
  motivo?: string;
  /** Já viu o aviso das consultas marcadas no período e quer salvar. */
  confirmar?: boolean;
};

export async function criarFechamento(
  input: FechamentoInput
): Promise<ActionResult | { ok: false; erro: string; codigo: "conflito"; consultas: string[] }> {
  if (await emModoDemo()) return { ok: false, erro: MSG_DEMO };
  if ((input.diaSemana === null) === (input.data === null)) {
    return { ok: false, erro: "Escolha toda semana ou uma data." };
  }
  if (!/^\d{2}:\d{2}$/.test(input.inicio) || !/^\d{2}:\d{2}$/.test(input.fim) || input.inicio >= input.fim) {
    return { ok: false, erro: "O horário de início precisa ser antes do fim." };
  }
  const r = await autorizar(input.medicoId);
  if ("erro" in r) return { ok: false, erro: r.erro! };

  // Consultas já marcadas dentro do que vai fechar: avisa antes, nunca cancela
  if (!input.confirmar) {
    const db = adminDisponivel() ? createAdminClient() : r.supabase;
    const agora = new Date();
    const ate = input.data
      ? new Date(`${input.data}T23:59:59-03:00`)
      : new Date(agora.getTime() + 120 * 86_400_000);
    const { data: marcadas } = await db
      .from("consultas")
      .select("paciente_nome,data_hora,duracao_min,servico_id")
      .eq("medico_id", input.medicoId)
      .neq("status", "cancelada")
      .gte("data_hora", agora.toISOString())
      .lte("data_hora", ate.toISOString())
      .order("data_hora");

    const ini = minutosDe(input.inicio);
    const fim = minutosDe(input.fim);
    const dentro = (marcadas ?? []).filter((c) => {
      const p = paredeEmBrasilia(new Date(c.data_hora));
      const mesmoDia = input.data ? p.dia === input.data : p.semana === input.diaSemana;
      const servico = input.servicoId === null || c.servico_id === input.servicoId;
      return mesmoDia && servico && p.minutos < fim && p.minutos + (c.duracao_min ?? 30) > ini;
    });
    if (dentro.length) {
      return {
        ok: false,
        codigo: "conflito",
        erro: `${dentro.length === 1 ? "Já existe 1 consulta marcada" : `Já existem ${dentro.length} consultas marcadas`} nesse horário. Elas continuam na agenda: remarque se precisar.`,
        consultas: dentro.slice(0, 6).map((c) => `${formatarData(c.data_hora)} ${formatarHora(c.data_hora)} · ${c.paciente_nome}`),
      };
    }
  }

  const { error } = await r.supabase.from("fechamentos").insert({
    organization_id: r.alvo.organization_id,
    medico_id: input.medicoId,
    servico_id: input.servicoId,
    dia_semana: input.diaSemana,
    data: input.data,
    hora_inicio: input.inicio,
    hora_fim: input.fim,
    motivo: input.motivo?.trim() || null,
    criado_por: r.eu.id,
  });
  if (error) {
    console.error("[fechamentos]", error.message);
    return { ok: false, erro: "Não foi possível fechar a agenda. Rode antes o SQL da agenda por serviço." };
  }
  revalidar();
  return { ok: true };
}

export async function removerFechamento(id: string): Promise<ActionResult> {
  if (await emModoDemo()) return { ok: false, erro: MSG_DEMO };
  const supabase = await createClient();
  const { data: f } = await supabase.from("fechamentos").select("medico_id").eq("id", id).maybeSingle();
  if (!f) return { ok: false, erro: "Fechamento não encontrado." };
  const r = await autorizar(f.medico_id);
  if ("erro" in r) return { ok: false, erro: r.erro! };

  const { error } = await r.supabase.from("fechamentos").delete().eq("id", id);
  if (error) return { ok: false, erro: "Não foi possível reabrir." };
  revalidar();
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Link público de agendamento                                         */
/* ------------------------------------------------------------------ */

export async function salvarLinkAgenda(input: {
  medicoId: string;
  ativo: boolean;
  slug?: string;
}): Promise<{ ok: true; slug: string } | { ok: false; erro: string }> {
  if (await emModoDemo()) return { ok: false, erro: MSG_DEMO };
  const r = await autorizar(input.medicoId);
  if ("erro" in r) return { ok: false, erro: r.erro! };

  // O perfil de outra pessoa só se escreve com o cliente admin
  if (!adminDisponivel()) return { ok: false, erro: "Servidor sem acesso administrativo configurado." };
  const admin = createAdminClient();

  const base = slugAgenda(input.slug?.trim() || r.alvo.nome || "profissional");
  if (!base) return { ok: false, erro: "Escolha um endereço com letras ou números." };

  // Endereço único dentro da clínica: dr-fulano, dr-fulano-2…
  const { data: usados } = await admin
    .from("profiles")
    .select("id,slug_agenda")
    .eq("organization_id", r.alvo.organization_id)
    .like("slug_agenda", `${base}%`);
  const tomados = new Set((usados ?? []).filter((u) => u.id !== input.medicoId).map((u) => u.slug_agenda));
  let slug = base;
  for (let n = 2; tomados.has(slug); n++) slug = `${base}-${n}`;

  const { error } = await admin
    .from("profiles")
    .update({ slug_agenda: slug, agenda_publica: input.ativo })
    .eq("id", input.medicoId);
  if (error) {
    console.error("[link-agenda]", error.message);
    return { ok: false, erro: "Não foi possível salvar o link. Rode antes o SQL da agenda por serviço." };
  }
  revalidar();
  return { ok: true, slug };
}
