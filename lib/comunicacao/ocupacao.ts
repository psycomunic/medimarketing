import "server-only";

import { createAdminClient, adminDisponivel } from "@/lib/supabase/admin";
import { emailEquipe } from "@/lib/email-modelos";
import { diaDaSemana, diaRelativo, formatarData, formatarHora, urlPainel } from "@/lib/lembretes";
import { avisarEquipe, clinicaParaEnvio, membrosDaClinica } from "@/lib/comunicacao/equipe";
import { lerVaga } from "@/lib/agenda-vaga";

/**
 * O QUE A OCUPAÇÃO DE UM HORÁRIO COMUNICA
 *
 * Com vários profissionais atendendo ao mesmo tempo, a recepção precisa
 * saber de três viradas, e só delas:
 *
 *   - lotou: a consulta que acabou de entrar fechou o horário;
 *   - passou do limite: alguém encaixou acima dele (fica registrado);
 *   - abriu vaga: um horário que estava lotado perdeu uma consulta.
 *
 * Cada virada sai uma vez. Uma consulta a mais num horário que já tinha
 * folga, ou a quarta saída de um horário vazio, não interessa a ninguém.
 * Como o resto da comunicação, nunca lança.
 */

export type EventoOcupacao =
  /** A consulta entrou no horário dela. `antes` = simultâneas sem ela. */
  | { tipo: "entrou"; antes: number; limite: number | null; atorId: string | null }
  /** A consulta saiu do horário (cancelada ou remarcada). `dataHora` = horário que ela ocupava. */
  | { tipo: "saiu"; dataHora?: string; atorId: string | null };

export async function comunicarOcupacao(consultaId: string, ev: EventoOcupacao): Promise<void> {
  if (!adminDisponivel()) return;
  try {
    await comunicar(consultaId, ev);
  } catch (e) {
    console.error("[comunicacao/ocupacao] Falha:", e instanceof Error ? e.message : e);
  }
}

async function comunicar(consultaId: string, ev: EventoOcupacao): Promise<void> {
  const admin = createAdminClient();
  const { data: c } = await admin
    .from("consultas")
    .select("id,organization_id,medico_id,paciente_nome,data_hora,duracao_min,servico_nome")
    .eq("id", consultaId)
    .maybeSingle();
  if (!c?.organization_id) return;

  const dataHora = ev.tipo === "saiu" ? (ev.dataHora ?? c.data_hora) : c.data_hora;
  // Horário que já passou não tem mais o que encaixar
  if (new Date(dataHora).getTime() < Date.now()) return;

  const duracao = c.duracao_min ?? 30;
  let limite: number | null;
  let virada: "lotou" | "acima" | "abriu" | null = null;
  let agora: number;

  if (ev.tipo === "entrou") {
    limite = ev.limite;
    if (limite === null) return;
    agora = ev.antes + 1;
    if (agora > limite) virada = "acima";
    else if (agora === limite) virada = "lotou";
  } else {
    // Sem a consulta que saiu: se ficou um abaixo do limite, ela era a que lotava
    const vaga = await lerVaga({
      organizationId: c.organization_id,
      medicoId: c.medico_id,
      dataHora,
      duracaoMin: duracao,
      ignorarId: c.id,
    });
    limite = vaga.limite;
    if (limite === null) return;
    agora = vaga.simultaneas;
    if (agora === limite - 1) virada = "abriu";
  }
  if (!virada) return;

  const [clinica, membros, { data: ocupando }, { data: medico }, { data: ator }] = await Promise.all([
    clinicaParaEnvio(c.organization_id),
    membrosDaClinica(c.organization_id),
    admin
      .from("consultas")
      .select("id,medico_id,data_hora,duracao_min")
      .eq("organization_id", c.organization_id)
      .neq("status", "cancelada")
      .gte("data_hora", new Date(new Date(dataHora).getTime() - 8 * 3600000).toISOString())
      .lt("data_hora", new Date(new Date(dataHora).getTime() + duracao * 60000).toISOString()),
    admin.from("profiles").select("nome").eq("id", c.medico_id).maybeSingle(),
    ev.atorId ? admin.from("profiles").select("nome").eq("id", ev.atorId).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  if (!clinica) return;

  // Quem atende e ainda está livre nesse horário: é o que a recepção oferece
  const ini = new Date(dataHora).getTime();
  const fim = ini + duracao * 60000;
  const ocupados = new Set(
    (ocupando ?? [])
      .filter((o) => o.id !== c.id || virada !== "abriu")
      .filter((o) => {
        const a = new Date(o.data_hora).getTime();
        return a < fim && a + (o.duracao_min ?? 30) * 60000 > ini;
      })
      .map((o) => o.medico_id)
  );
  const livres = membros
    .filter((m) => (m.role === "medico" || m.role === "gestor") && !ocupados.has(m.id))
    .map((m) => m.nome);

  const marca = {
    clinica: clinica.nome,
    logoUrl: clinica.logo_url,
    emailClinica: clinica.email,
    telefoneClinica: clinica.telefone,
  };
  const data = formatarData(dataHora);
  const hora = formatarHora(dataHora);
  const quando = diaRelativo(dataHora);
  const dia = `${data} (${diaDaSemana(dataHora)})`;
  const contagem = `${agora} de ${limite}`;
  const painel = urlPainel("/app/agenda");
  const nomeAtor = ator?.nome ?? null;
  const livresTxt = livres.length ? livres.join(", ") : null;

  const porVirada = {
    lotou: {
      evento: "horario_lotado" as const,
      tipoPainel: "agenda" as const,
      prioridade: "normal" as const,
      titulo: `Horário lotado: ${quando}, ${hora}`,
      descricao: `${data} às ${hora} chegou a ${contagem} consultas. A última foi ${c.paciente_nome}${medico?.nome ? ` com ${medico.nome}` : ""}.`,
      faixa: { texto: `Horário lotado (${contagem})`, cor: "#B45309", fundo: "#FEF3C7" },
      frase: `O horário de ${data} às ${hora} chegou ao limite da clínica. Novas consultas nesse horário só como encaixe do gestor.`,
      nota: null as string | null,
    },
    acima: {
      evento: "encaixe_acima_limite" as const,
      tipoPainel: "agenda" as const,
      prioridade: "alta" as const,
      titulo: `Encaixe acima do limite: ${quando}, ${hora}`,
      descricao: `${data} às ${hora} está com ${contagem} consultas${nomeAtor ? `. Encaixe de ${nomeAtor}` : ""}: ${c.paciente_nome}${medico?.nome ? ` com ${medico.nome}` : ""}.`,
      faixa: { texto: `Encaixe acima do limite (${contagem})`, cor: "#B91C1C", fundo: "#FEE2E2" },
      frase: `${nomeAtor ?? "Alguém da equipe"} marcou ${c.paciente_nome} além do limite de ${limite} consultas no mesmo horário.`,
      nota: "Confira se a estrutura da clínica comporta (salas, aparelhos, recepção) ou remarque uma das consultas.",
    },
    abriu: {
      evento: "vaga_aberta" as const,
      tipoPainel: "agenda" as const,
      prioridade: quando === "hoje" || quando === "amanhã" ? ("alta" as const) : ("normal" as const),
      titulo: `Vaga aberta: ${quando}, ${hora}`,
      descricao: `${data} às ${hora} voltou a ter vaga (${contagem}).${livresTxt ? ` Livres: ${livresTxt}.` : ""}`,
      faixa: { texto: `Vaga aberta (${contagem})` },
      frase: `O horário de ${data} às ${hora}, que estava lotado, voltou a ter vaga: saiu a consulta de ${c.paciente_nome}${medico?.nome ? ` com ${medico.nome}` : ""}.`,
      nota: "Dá para encaixar alguém da lista de espera ou adiantar um retorno.",
    },
  }[virada];

  const email = emailEquipe(marca, {
    assunto: `${porVirada.titulo} (${data})`,
    faixa: porVirada.faixa,
    frase: porVirada.frase,
    dados: [
      ["Data", dia],
      ["Horário", hora],
      ["Ocupação", `${contagem} consultas`],
      [virada === "abriu" ? "Saiu" : "Entrou", `${c.paciente_nome}${c.servico_nome ? ` · ${c.servico_nome}` : ""}${medico?.nome ? ` · ${medico.nome}` : ""}`],
      ["Profissionais livres", livresTxt],
    ],
    nota: porVirada.nota,
    botao: { texto: "Abrir a agenda", url: painel },
  });

  await avisarEquipe({
    organizationId: c.organization_id,
    evento: porVirada.evento,
    // Uma virada por horário e por contagem: salvar duas vezes não repete
    chave: `${porVirada.evento}:${c.organization_id}:${new Date(dataHora).toISOString()}:${agora}:${c.id}`,
    consultaId: c.id,
    atorId: ev.atorId,
    titulo: porVirada.titulo,
    descricao: porVirada.descricao,
    href: "/app/agenda",
    tipoPainel: porVirada.tipoPainel,
    prioridade: porVirada.prioridade,
    whatsapp: `${porVirada.titulo}. ${porVirada.descricao}\n${painel}`,
    email,
    membros,
    clinica,
  });
}
