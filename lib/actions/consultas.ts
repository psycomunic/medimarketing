"use server";

import { revalidatePath } from "next/cache";
import { comunicarConsulta } from "@/lib/comunicacao/consulta";
import { comunicarOcupacao } from "@/lib/comunicacao/ocupacao";
import { lerVaga, recusarVaga, type RecusaVaga } from "@/lib/agenda-vaga";
import { sincronizarReceita } from "@/lib/financeiro/agenda";
import { programarPesquisa, suspenderPesquisa } from "@/lib/avaliacoes";
import { createAdminClient, adminDisponivel } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { emModoDemo } from "@/lib/supabase/queries";
import type { Consulta, StatusConsulta, TipoConsulta } from "@/lib/supabase/types";

export type ActionResult = { ok: true } | { ok: false; erro: string };

const MSG_DEMO =
  "Modo demonstração: nada é salvo aqui. Numa conta de verdade, esta alteração já estaria valendo.";

async function getUserId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, userId: user?.id };
}

/**
 * Atualiza o status de uma consulta (ex.: marcar como realizada).
 *
 * Cancelar e confirmar pela agenda comunicam como os mesmos eventos do
 * link do paciente: o profissional é avisado, e no cancelamento o
 * paciente também, quando `avisarPaciente` não vier desligado.
 */
export async function atualizarStatus(
  id: string,
  status: StatusConsulta,
  opcoes: { avisarPaciente?: boolean } = {},
): Promise<ActionResult> {
  if (await emModoDemo()) return { ok: false, erro: MSG_DEMO };
  const { supabase, userId } = await getUserId();
  if (!userId) return { ok: false, erro: "Sessão expirada." };

  const { data: antes } = await supabase
    .from("consultas")
    .select("status")
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabase
    .from("consultas")
    .update({ status })
    .eq("id", id);

  if (error) {
    // O status "faltou" depende do SQL de 2026-10-29 (Painel do dono)
    if (status === "faltou" && error.code === "22P02") {
      return { ok: false, erro: "O status \"Faltou\" ainda não foi ativado no banco. Rode o SQL da atualização do painel." };
    }
    return { ok: false, erro: "Não foi possível atualizar o status." };
  }

  if (antes && antes.status !== status) {
    // A receita da consulta acompanha o status (cancelada sai das contas)
    await sincronizarReceita(id);
    // Atendimento concluído: a pesquisa de satisfação sai algumas horas depois
    if (status === "realizada") await programarPesquisa(id);
    else if (antes.status === "realizada") await suspenderPesquisa(id);
    if (status === "cancelada") {
      await comunicarConsulta(id, {
        tipo: "cancelada",
        atorId: userId,
        avisarPaciente: opcoes.avisarPaciente ?? true,
      });
      await comunicarOcupacao(id, { tipo: "saiu", atorId: userId });
    } else if (status === "confirmada") {
      // Confirmada por telefone ou no balcão: o lembrete não precisa sair
      if (adminDisponivel()) {
        await createAdminClient()
          .from("confirmacoes")
          .update({ status: "confirmado", respondido_em: new Date().toISOString() })
          .eq("consulta_id", id)
          .in("status", ["pendente", "enviado"]);
      }
      await comunicarConsulta(id, { tipo: "resposta", resposta: "confirmado", atorId: userId });
    }
  }

  revalidatePath("/app/agenda");
  revalidatePath("/app/confirmacoes");
  revalidatePath("/app");
  return { ok: true };
}

/** Salva/atualiza a observação de uma consulta. */
export async function salvarObservacao(
  id: string,
  observacao: string,
): Promise<ActionResult> {
  if (await emModoDemo()) return { ok: false, erro: MSG_DEMO };
  const { supabase, userId } = await getUserId();
  if (!userId) return { ok: false, erro: "Sessão expirada." };

  const { error } = await supabase
    .from("consultas")
    .update({ observacao })
    .eq("id", id);

  if (error)
    return { ok: false, erro: "Não foi possível salvar a observação." };
  revalidatePath("/app/agenda");
  return { ok: true };
}

/**
 * Cria uma consulta. No fluxo real isso é feito pela equipe de atendimento,
 * mas deixamos disponível para o médico testar/registrar encaixes.
 */
export async function criarConsulta(input: {
  paciente_nome: string;
  paciente_telefone?: string;
  paciente_email?: string;
  paciente_nascimento?: string;
  convenio?: string;
  data_hora: string; // ISO
  duracao_min?: number;
  tipo: TipoConsulta;
  motivo?: string;
  observacao?: string;
  valor?: number;
  /** Linha da Tabela de preços escolhida como serviço. */
  servico_id?: string;
  /** Profissional que vai atender. Sem isso, é quem está criando. */
  medico_id?: string;
  /** Clínica da consulta. Obrigatória para quem não pertence a nenhuma. */
  organization_id?: string;
  /** Falso segura a mensagem de agendamento ao paciente. */
  avisar_paciente?: boolean;
  /** "Salvar mesmo assim": encaixe acima do limite ou sobre outra consulta do profissional. */
  encaixe?: boolean;
}): Promise<{ ok: true; id: string } | { ok: false; erro: string; codigo?: RecusaVaga["codigo"] }> {
  if (await emModoDemo()) return { ok: false, erro: MSG_DEMO };
  const { supabase, userId } = await getUserId();
  if (!userId) return { ok: false, erro: "Sessão expirada." };
  if (!input.paciente_nome?.trim())
    return { ok: false, erro: "Informe o nome do paciente." };

  const { data: perfil } = await supabase
    .from("profiles")
    .select("organization_id,role")
    .eq("id", userId)
    .single();

  const ehSuperAdmin = perfil?.role === "super_admin";

  /*
   * A clínica da consulta é o que a RLS usa para isolar os tenants, e o
   * que liga a consulta a financeiro, indicadores e confirmações.
   *
   * Quem pertence a uma clínica escreve sempre na dela. O super admin
   * não pertence a nenhuma, então precisa dizer qual — sem isso a
   * consulta nasceria órfã e nunca entraria em nenhum desses módulos.
   */
  const organizationId = ehSuperAdmin
    ? (input.organization_id ?? null)
    : (perfil?.organization_id ?? null);

  if (!organizationId) {
    return {
      ok: false,
      erro: ehSuperAdmin
        ? "Escolha a clínica da consulta."
        : "Sua conta não está vinculada a uma clínica.",
    };
  }
  if (
    !ehSuperAdmin &&
    input.organization_id &&
    input.organization_id !== perfil?.organization_id
  ) {
    return { ok: false, erro: "Você só marca consultas na sua clínica." };
  }

  /*
   * O profissional é quem atende, não quem digita: a secretária marca
   * para o médico. Sem escolha explícita mantemos quem está criando,
   * que é o caso do médico registrando o próprio encaixe.
   */
  const medicoId = input.medico_id || userId;

  // A validação vale também para o padrão: o super admin não pertence a
  // clínica nenhuma, então ele nunca pode ficar como o profissional.
  const { data: alvo } = await supabase
    .from("profiles")
    .select("organization_id,nome")
    .eq("id", medicoId)
    .maybeSingle();

  if (!alvo) return { ok: false, erro: "Profissional não encontrado." };
  if (alvo.organization_id !== organizationId) {
    return {
      ok: false,
      erro: input.medico_id
        ? "Esse profissional não é da clínica escolhida."
        : "Escolha o profissional que vai atender: sua conta não atende nesta clínica.",
    };
  }

  // Vaga: o profissional livre e a clínica abaixo do limite do horário
  const duracao = input.duracao_min ?? 30;
  const vaga = await lerVaga({ organizationId, medicoId, dataHora: input.data_hora, duracaoMin: duracao });
  const recusa = recusarVaga(vaga, {
    gestor: ehSuperAdmin || perfil?.role === "gestor",
    ehOProfissional: medicoId === userId,
    encaixe: !!input.encaixe,
    nomeProfissional: alvo.nome,
  });
  if (recusa) return recusa;

  // O serviço vem da tabela da própria clínica; o nome fica gravado na consulta
  let servico: { servico_id: string; servico_nome: string } | null = null;
  if (input.servico_id) {
    const { data: s } = await supabase
      .from("tabela_precos")
      .select("id,procedimento,organization_id")
      .eq("id", input.servico_id)
      .maybeSingle();
    if (!s || s.organization_id !== organizationId) return { ok: false, erro: "Serviço não encontrado na tabela da clínica." };
    servico = { servico_id: s.id, servico_nome: s.procedimento };
  }

  const registro = {
      organization_id: organizationId,
      medico_id: medicoId,
      criado_por: userId,
      paciente_nome: input.paciente_nome.trim(),
      paciente_telefone: input.paciente_telefone || null,
      paciente_email: input.paciente_email || null,
      paciente_nascimento: input.paciente_nascimento || null,
      convenio: input.convenio || null,
      data_hora: input.data_hora,
      duracao_min: duracao,
      tipo: input.tipo,
      status: "pendente" as StatusConsulta,
      motivo: input.motivo || null,
      observacao: input.observacao || null,
      valor: input.valor ?? null,
  };
  let { data: criada, error } = await supabase
    .from("consultas")
    .insert({ ...registro, ...servico })
    .select("id")
    .single();
  // Banco sem as colunas de serviço ainda: marca sem ele, que é melhor que não marcar
  if (error && servico && /servico_/.test(error.message)) {
    ({ data: criada, error } = await supabase.from("consultas").insert(registro).select("id").single());
  }

  if (error || !criada) return { ok: false, erro: "Não foi possível criar a consulta." };

  // O paciente recebe o comprovante; o profissional e a equipe, o aviso
  // da consulta nova. Nada disso derruba o agendamento se falhar.
  await sincronizarReceita(criada.id);
  await comunicarConsulta(criada.id, {
      tipo: "nova",
      atorId: userId,
      avisarPaciente: input.avisar_paciente !== false,
    });
  // Com esta, o horário lotou ou passou do limite: gestor e recepção ficam sabendo
  await comunicarOcupacao(criada.id, { tipo: "entrou", antes: vaga.simultaneas, limite: vaga.limite, atorId: userId });

  revalidatePath("/app/agenda");
  revalidatePath("/app");
  return { ok: true, id: criada.id };
}

/**
 * Troca o serviço de uma consulta marcada. Com preço fixo na tabela, o
 * valor acompanha; com faixa, fica o que veio (ou o informado). A receita
 * prevista da consulta é refeita junto.
 */
export async function trocarServico(
  id: string,
  servicoId: string | null,
  valor?: number | null,
): Promise<ActionResult> {
  if (await emModoDemo()) return { ok: false, erro: MSG_DEMO };
  const { supabase, userId } = await getUserId();
  if (!userId) return { ok: false, erro: "Sessão expirada." };

  const { data: c } = await supabase.from("consultas").select("id,organization_id").eq("id", id).maybeSingle();
  if (!c) return { ok: false, erro: "Consulta não encontrada." };

  let mudar: Partial<Consulta> = { servico_id: null, servico_nome: null };
  if (servicoId) {
    const { data: s } = await supabase
      .from("tabela_precos")
      .select("id,procedimento,organization_id,duracao_min")
      .eq("id", servicoId)
      .maybeSingle();
    if (!s || s.organization_id !== c.organization_id) return { ok: false, erro: "Serviço não encontrado na tabela da clínica." };
    mudar = { servico_id: s.id, servico_nome: s.procedimento };
  }
  if (valor !== undefined) mudar.valor = valor;

  const { error } = await supabase.from("consultas").update(mudar).eq("id", id);
  if (error && /servico_/.test(error.message))
    return { ok: false, erro: "Para guardar o serviço da consulta, rode antes o SQL dos serviços (Fase 1)." };
  if (error) return { ok: false, erro: "Não foi possível trocar o serviço." };

  await sincronizarReceita(id);
  revalidatePath("/app/agenda");
  revalidatePath("/app");
  return { ok: true };
}

/**
 * Passa a consulta para outro profissional, no mesmo horário.
 *
 * Com vários profissionais atendendo ao mesmo tempo, é a troca mais comum
 * do dia: o horário não muda, então o limite da clínica também não — só a
 * agenda de quem entra precisa estar livre. Quem saiu, quem entrou e o
 * paciente são avisados (ver comunicacao/consulta.ts, evento "trocado").
 */
export async function trocarProfissional(
  id: string,
  medicoId: string,
  opcoes: { encaixe?: boolean; avisarPaciente?: boolean } = {},
): Promise<ActionResult | RecusaVaga> {
  if (await emModoDemo()) return { ok: false, erro: MSG_DEMO };
  const { supabase, userId } = await getUserId();
  if (!userId) return { ok: false, erro: "Sessão expirada." };

  const [{ data: c }, { data: perfil }, { data: alvo }] = await Promise.all([
    supabase
      .from("consultas")
      .select("id,organization_id,medico_id,data_hora,duracao_min,status")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("profiles").select("role").eq("id", userId).maybeSingle(),
    supabase.from("profiles").select("organization_id,nome,ativo").eq("id", medicoId).maybeSingle(),
  ]);
  if (!c?.organization_id) return { ok: false, erro: "Consulta não encontrada." };
  if (c.medico_id === medicoId) return { ok: true };
  if (!alvo || !alvo.ativo || alvo.organization_id !== c.organization_id) {
    return { ok: false, erro: "Esse profissional não é da clínica da consulta." };
  }

  if (c.status !== "cancelada") {
    const vaga = await lerVaga({
      organizationId: c.organization_id,
      medicoId,
      dataHora: c.data_hora,
      duracaoMin: c.duracao_min ?? 30,
      ignorarId: c.id,
    });
    // A própria consulta já ocupa o horário: o limite não muda com a troca
    const recusa = recusarVaga(
      { ...vaga, limite: null },
      {
        gestor: perfil?.role === "gestor" || perfil?.role === "super_admin",
        ehOProfissional: medicoId === userId,
        encaixe: !!opcoes.encaixe,
        nomeProfissional: alvo.nome,
      }
    );
    if (recusa) return recusa;
  }

  const { error } = await supabase.from("consultas").update({ medico_id: medicoId }).eq("id", id);
  if (error) return { ok: false, erro: "Não foi possível trocar o profissional." };

  // Repasse e receita seguem o profissional novo
  await sincronizarReceita(id);
  await comunicarConsulta(id, {
    tipo: "trocado",
    atorId: userId,
    anteriorId: c.medico_id,
    avisarPaciente: opcoes.avisarPaciente !== false,
  });

  revalidatePath("/app/agenda");
  revalidatePath("/app");
  return { ok: true };
}
