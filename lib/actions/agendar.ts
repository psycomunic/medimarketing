"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient, adminDisponivel } from "@/lib/supabase/admin";
import { carregarAgendaPublica } from "@/lib/agendar";
import { comunicarConsulta } from "@/lib/comunicacao/consulta";
import { comunicarOcupacao } from "@/lib/comunicacao/ocupacao";
import { sincronizarReceita } from "@/lib/financeiro/agenda";
import { lerVaga } from "@/lib/agenda-vaga";
import type { TipoConsulta } from "@/lib/supabase/types";

/**
 * O paciente marca sozinho, pelo link do profissional.
 *
 * Nada do que vem do navegador é confiado: o horário pedido precisa estar
 * na lista de livres calculada de novo agora, com a mesma regra da agenda.
 * Depois de gravar, uma segunda conferência resolve o empate de dois
 * pacientes clicando no mesmo horário ao mesmo tempo — fica quem gravou
 * primeiro.
 */

export type ResultadoAgendamento =
  | { ok: true; resumo: { data: string; hora: string; inicio: string; fim: string } }
  | { ok: false; erro: string; ocupado?: boolean };

const POR_TELEFONE_24H = 2;

function telefoneFormatado(bruto: string): string | null {
  let d = bruto.replace(/\D/g, "");
  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) d = d.slice(2);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return null;
}

function tipoDoServico(nome: string): TipoConsulta {
  const n = nome.toLowerCase();
  if (n.includes("tele")) return "teleconsulta";
  if (n.includes("retorno")) return "retorno";
  return "primeira";
}

export async function agendarPeloLink(input: {
  clinica: string;
  profissional: string;
  servicoSlug: string;
  inicio: string;
  nome: string;
  telefone: string;
  email?: string;
  convenio?: string;
  aceite: boolean;
  /** Campo escondido: gente não preenche, robô preenche. */
  empresa?: string;
  /** Quando a página abriu (ms): resposta em menos de 3 s é robô. */
  abertoEm: number;
}): Promise<ResultadoAgendamento> {
  // Robô: finge que deu certo e não grava nada
  if (input.empresa?.trim() || Date.now() - input.abertoEm < 3000) {
    return { ok: false, erro: "Não foi possível concluir. Atualize a página e tente de novo." };
  }

  const nome = input.nome.trim().replace(/\s+/g, " ");
  if (nome.length < 3 || !nome.includes(" ")) return { ok: false, erro: "Escreva seu nome e sobrenome." };
  const telefone = telefoneFormatado(input.telefone);
  if (!telefone) return { ok: false, erro: "Confira o WhatsApp: DDD e número, como (47) 99999-9999." };
  const email = input.email?.trim() || null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { ok: false, erro: "Confira o e-mail." };
  if (!input.aceite) return { ok: false, erro: "Para marcar, autorize o contato da clínica sobre a consulta." };

  const r = await carregarAgendaPublica(input.clinica, input.profissional);
  if (!r.ok) return { ok: false, erro: "Esta agenda não está disponível no momento. Fale com a clínica." };
  const { agenda } = r;
  if (agenda.demo) {
    return { ok: false, erro: "Este é o link de demonstração: nada é marcado aqui. Numa clínica de verdade, a consulta já estaria na agenda." };
  }

  const servico = agenda.servicos.find((s) => s.slug === input.servicoSlug);
  if (!servico) return { ok: false, erro: "Esse serviço não está mais disponível. Atualize a página." };
  const livre = servico.dias.some((d) => d.horarios.some((h) => h.iso === input.inicio));
  if (!livre) {
    return { ok: false, ocupado: true, erro: "Esse horário acabou de ser ocupado. Escolha outro, por favor." };
  }

  if (!adminDisponivel()) return { ok: false, erro: "Agendamento indisponível no momento. Fale com a clínica." };
  const admin = createAdminClient();

  // O mesmo telefone não marca mais que duas por dia pelo link
  const { count } = await admin
    .from("consultas")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", agenda.clinica.id)
    .eq("paciente_telefone", telefone)
    .eq("origem", "link")
    .neq("status", "cancelada")
    .gte("created_at", new Date(Date.now() - 86_400_000).toISOString());
  if ((count ?? 0) >= POR_TELEFONE_24H) {
    return { ok: false, erro: "Você já marcou consultas hoje por este link. Para marcar mais, fale com a clínica." };
  }

  const vaga = await lerVaga({
    organizationId: agenda.clinica.id,
    medicoId: agenda.profissional.id,
    dataHora: input.inicio,
    duracaoMin: servico.duracao,
    servicoId: servico.id,
  });

  const { data: criada, error } = await admin
    .from("consultas")
    .insert({
      organization_id: agenda.clinica.id,
      medico_id: agenda.profissional.id,
      criado_por: null,
      paciente_nome: nome,
      paciente_telefone: telefone,
      paciente_email: email,
      paciente_nascimento: null,
      motivo: null,
      observacao: null,
      convenio: input.convenio?.trim() || "Particular",
      data_hora: input.inicio,
      duracao_min: servico.duracao,
      tipo: tipoDoServico(servico.nome),
      status: "pendente",
      valor: servico.valor,
      servico_id: servico.id,
      servico_nome: servico.id ? servico.nome : null,
      origem: "link",
    })
    .select("id,created_at")
    .single();
  if (error || !criada) {
    console.error("[agendar]", error?.message);
    return { ok: false, erro: "Não foi possível marcar agora. Tente de novo em instantes." };
  }

  // Empate: alguém gravou o mesmo horário do profissional antes? Fica o primeiro
  const ini = new Date(input.inicio).getTime();
  const fim = ini + servico.duracao * 60000;
  const { data: vizinhas } = await admin
    .from("consultas")
    .select("id,created_at,data_hora,duracao_min,medico_id")
    .eq("organization_id", agenda.clinica.id)
    .neq("status", "cancelada")
    .neq("id", criada.id)
    .gte("data_hora", new Date(ini - 8 * 3600000).toISOString())
    .lt("data_hora", new Date(fim).toISOString());
  const antes = (vizinhas ?? []).filter((v) => {
    const a = new Date(v.data_hora).getTime();
    const encosta = a < fim && a + (v.duracao_min ?? 30) * 60000 > ini;
    const primeiro = v.created_at < criada.created_at || (v.created_at === criada.created_at && v.id < criada.id);
    return encosta && primeiro;
  });
  const perdeuProfissional = antes.some((v) => v.medico_id === agenda.profissional.id);
  const perdeuLimite = vaga.limite !== null && antes.length >= vaga.limite;
  if (perdeuProfissional || perdeuLimite) {
    await admin.from("consultas").delete().eq("id", criada.id);
    return { ok: false, ocupado: true, erro: "Esse horário acabou de ser ocupado. Escolha outro, por favor." };
  }

  // Receita prevista, aviso ao paciente e à equipe, ocupação do horário
  await sincronizarReceita(criada.id);
  await comunicarConsulta(criada.id, { tipo: "nova", atorId: null, avisarPaciente: true, viaLink: true });
  await comunicarOcupacao(criada.id, { tipo: "entrou", antes: vaga.simultaneas, limite: vaga.limite, atorId: null });

  revalidatePath("/app/agenda");
  const fimConsulta = new Date(fim);
  return {
    ok: true,
    resumo: {
      data: input.inicio.slice(0, 10),
      hora: new Date(input.inicio).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }),
      inicio: input.inicio,
      fim: fimConsulta.toISOString(),
    },
  };
}
