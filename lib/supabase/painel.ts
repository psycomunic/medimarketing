import { createClient } from "@/lib/supabase/server";
import { adminDisponivel, createAdminClient } from "@/lib/supabase/admin";
import { emModoDemo } from "@/lib/supabase/queries";
import { getConfirmacoes, resumirConfirmacoes } from "@/lib/supabase/confirmacoes";
import { getConversas, resumirAtendimento, getTodasMensagens } from "@/lib/supabase/atendimento";
import { getLeads, resumirFunil, getTodasInteracoes } from "@/lib/supabase/crm";
import { getLancamentos, limitesDoMes, mesCorrente, resumirFinanceiro } from "@/lib/supabase/financeiro";
import { getIndicadores } from "@/lib/supabase/indicadores";
import { calcularKpis } from "@/lib/indicadores";
import { getClientes } from "@/lib/supabase/indicadores";
import type { Role } from "@/lib/supabase/types";

/**
 * Dados do painel inicial.
 *
 * A tela deixou de ser um índice de módulos para virar a lista do que
 * precisa ser resolvido hoje. Por isso a coleta é por papel: cada um
 * abre o sistema com uma pergunta diferente na cabeça.
 */

export type PendenciaPainel = {
  chave: string;
  titulo: string;
  detalhe: string;
  href: string;
  quantidade: number;
  /** Vermelho quando é algo já vencido; âmbar quando é só atenção. */
  urgente: boolean;
};

export type NumeroPainel = {
  chave: string;
  rotulo: string;
  valor: string;
  nota?: string;
};

export type DadosPainel = {
  pendencias: PendenciaPainel[];
  numeros: NumeroPainel[];
  /** Título da faixa de números; muda conforme o papel. */
  tituloNumeros: string;
};

export async function getPainel(
  role: Role,
  organizationId: string | null
): Promise<DadosPainel> {
  return role === "super_admin"
    ? painelCarteira(organizationId)
    : painelClinica(role, organizationId);
}

/* ------------------------------------------------------------------ */
/* Equipe Medi Marketing: a carteira inteira                           */
/* ------------------------------------------------------------------ */

async function painelCarteira(organizationId: string | null): Promise<DadosPainel> {
  const clientes = await getClientes();
  const ativos = clientes.filter((c) => c.ativo);

  const totais = ativos.reduce(
    (a, c) => ({
      usuarios: a.usuarios + c.usuarios,
      consultas: a.consultas + c.consultas_mes,
      leads: a.leads + c.leads_mes,
      faturamento: a.faturamento + c.faturamento_mes,
    }),
    { usuarios: 0, consultas: 0, leads: 0, faturamento: 0 }
  );

  const pendencias: PendenciaPainel[] = [];

  // Cadastros esperando liberação — a fila que só o super admin resolve
  const aguardando = await contarAguardando();
  if (aguardando > 0) {
    pendencias.push({
      chave: "liberacao",
      titulo: `${aguardando} cadastro${aguardando === 1 ? "" : "s"} aguardando liberação`,
      detalhe: "Chegaram pela tela pública e não entram até você definir o papel.",
      href: "/app/admin/usuarios",
      quantidade: aguardando,
      urgente: true,
    });
  }

  // Dúvidas da Academy sem resposta da equipe
  const duvidas = await contarDuvidasSemResposta();
  if (duvidas > 0) {
    pendencias.push({
      chave: "duvidas",
      titulo: `${duvidas} dúvida${duvidas === 1 ? "" : "s"} sem resposta na Academy`,
      detalhe: "Perguntas de alunos das clínicas esperando a equipe.",
      href: "/app/admin/comentarios",
      quantidade: duvidas,
      urgente: false,
    });
  }

  // Clínicas cadastradas que ainda não foram ativadas
  const inativas = clientes.filter((c) => !c.ativo).length;
  if (inativas > 0) {
    pendencias.push({
      chave: "clinicas-inativas",
      titulo: `${inativas} clínica${inativas === 1 ? "" : "s"} inativa${inativas === 1 ? "" : "s"}`,
      detalhe: "Não contam na carteira nem recebem lembretes automáticos.",
      href: "/app/clinicas",
      quantidade: inativas,
      urgente: false,
    });
  }

  const { formatarNumero, formatarReais } = await import("@/lib/indicadores");

  return {
    tituloNumeros: "A carteira neste mês",
    pendencias,
    numeros: [
      { chave: "clinicas", rotulo: "clínicas ativas", valor: formatarNumero(ativos.length) },
      { chave: "usuarios", rotulo: "usuários na plataforma", valor: formatarNumero(totais.usuarios) },
      { chave: "consultas", rotulo: "consultas no mês", valor: formatarNumero(totais.consultas) },
      { chave: "leads", rotulo: "leads recebidos", valor: formatarNumero(totais.leads) },
      { chave: "faturamento", rotulo: "faturamento da carteira", valor: formatarReais(totais.faturamento) },
    ],
  };
}

async function contarAguardando(): Promise<number> {
  if (await emModoDemo()) return 1;
  if (!adminDisponivel()) return 0;

  const admin = createAdminClient();
  const { count } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("aguardando_liberacao", true);

  return count ?? 0;
}

async function contarDuvidasSemResposta(): Promise<number> {
  if (await emModoDemo()) {
    const { demoTodosComentarios } = await import("@/lib/demo-dados");
    const todos = demoTodosComentarios();
    return todos.filter(
      (c) => !c.parent_id && !(c.respostas ?? []).some((r) => r.autor_papel === "super_admin")
    ).length;
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("lesson_comments")
    .select("id,parent_id")
    .limit(500);

  if (!data?.length) return 0;
  const comResposta = new Set(data.map((c) => c.parent_id).filter(Boolean));
  return data.filter((c) => !c.parent_id && !comResposta.has(c.id)).length;
}

/* ------------------------------------------------------------------ */
/* Clínica: o que precisa acontecer hoje                               */
/* ------------------------------------------------------------------ */

async function painelClinica(
  role: Role,
  organizationId: string | null
): Promise<DadosPainel> {
  const pendencias: PendenciaPainel[] = [];
  const numeros: NumeroPainel[] = [];

  const { formatarNumero, formatarPercentual, formatarReais } = await import(
    "@/lib/indicadores"
  );

  const agora = new Date();
  const daquiA14 = new Date(agora);
  daquiA14.setDate(daquiA14.getDate() + 14);
  const ontem = new Date(agora);
  ontem.setDate(ontem.getDate() - 1);

  /* --- Confirmações: o lembrete que já venceu e não saiu --- */
  const confirmacoes = await getConfirmacoes(
    organizationId,
    ontem.toISOString(),
    daquiA14.toISOString()
  );
  const rc = resumirConfirmacoes(confirmacoes);

  if (rc.atrasados > 0) {
    pendencias.push({
      chave: "lembretes",
      titulo: `${rc.atrasados} lembrete${rc.atrasados === 1 ? "" : "s"} de confirmação para enviar`,
      detalhe: "Já passaram do horário programado e ainda não foram enviados.",
      href: "/app/confirmacoes",
      quantidade: rc.atrasados,
      urgente: true,
    });
  }
  if (rc.reagendar > 0) {
    pendencias.push({
      chave: "reagendar",
      titulo: `${rc.reagendar} paciente${rc.reagendar === 1 ? "" : "s"} pediu para reagendar`,
      detalhe: "O horário segue reservado até a clínica combinar outro.",
      href: "/app/confirmacoes",
      quantidade: rc.reagendar,
      urgente: true,
    });
  }

  /* --- CRM: tarefas e contatos vencidos --- */
  // Médico não opera o funil; não faz sentido cobrá-lo disso.
  if (role !== "medico") {
    const [leads, interacoes] = await Promise.all([
      getLeads(organizationId),
      getTodasInteracoes(organizationId),
    ]);
    const rf = resumirFunil(leads);

    const tarefasVencidas = interacoes.filter(
      (i) => i.tipo === "tarefa" && !i.concluida && i.vence_em && i.vence_em <= agora.toISOString()
    ).length;

    if (tarefasVencidas > 0) {
      pendencias.push({
        chave: "tarefas",
        titulo: `${tarefasVencidas} tarefa${tarefasVencidas === 1 ? "" : "s"} de CRM atrasada${tarefasVencidas === 1 ? "" : "s"}`,
        detalhe: "Follow-ups que passaram do prazo combinado.",
        href: "/app/crm",
        quantidade: tarefasVencidas,
        urgente: true,
      });
    }

    const semResponsavel = leads.filter(
      (l) => l.status === "aberto" && !l.responsavel_id
    ).length;
    if (semResponsavel > 0) {
      pendencias.push({
        chave: "leads-sem-dono",
        titulo: `${semResponsavel} lead${semResponsavel === 1 ? "" : "s"} sem responsável`,
        detalhe: "Ninguém está cuidando desses contatos.",
        href: "/app/crm",
        quantidade: semResponsavel,
        urgente: false,
      });
    }

    numeros.push(
      { chave: "leads", rotulo: "leads em aberto", valor: formatarNumero(rf.emAberto) },
      {
        chave: "negociacao",
        rotulo: "em negociação",
        valor: formatarReais(rf.valorEmAberto),
        nota: `${formatarPercentual(rf.taxaConversao)} de conversão`,
      }
    );

    /* --- Atendimento: conversas paradas --- */
    const conversas = await getConversas(organizationId);
    const mensagens = await getTodasMensagens(conversas);
    const ra = resumirAtendimento(conversas, mensagens);

    if (ra.naoLidas > 0) {
      pendencias.push({
        chave: "nao-lidas",
        titulo: `${ra.naoLidas} mensage${ra.naoLidas === 1 ? "m" : "ns"} sem resposta`,
        detalhe:
          ra.semResponsavel > 0
            ? `${ra.semResponsavel} conversa${ra.semResponsavel === 1 ? "" : "s"} ainda sem responsável.`
            : "Pacientes esperando retorno no WhatsApp, Instagram ou Facebook.",
        href: "/app/atendimento",
        quantidade: ra.naoLidas,
        urgente: true,
      });
    }
  }

  /* --- Agenda do dia --- */
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const amanha = new Date(hoje);
  amanha.setDate(amanha.getDate() + 1);

  const doDia = confirmacoes.filter(
    (c) => c.data_hora >= hoje.toISOString() && c.data_hora < amanha.toISOString()
  );
  const confirmadasHoje = doDia.filter((c) => c.status === "confirmado").length;

  numeros.unshift({
    chave: "hoje",
    rotulo: "consultas hoje",
    valor: formatarNumero(doDia.length),
    nota: doDia.length
      ? `${confirmadasHoje} com presença confirmada`
      : "agenda livre",
  });

  if (rc.enviados > 0) {
    numeros.push({
      chave: "confirmacao",
      rotulo: "taxa de resposta",
      valor: formatarPercentual(rc.taxaConfirmacao),
      nota: "dos lembretes enviados",
    });
  }

  /* --- Financeiro: só quem tem permissão vê dinheiro --- */
  if (role === "gestor") {
    const { de, ate } = limitesDoMes(mesCorrente());
    const [lancamentos, indicadores] = await Promise.all([
      getLancamentos(organizationId, de, ate),
      getIndicadores(organizationId, 1),
    ]);
    const rfin = resumirFinanceiro(lancamentos);

    if (rfin.atrasado > 0) {
      pendencias.push({
        chave: "atrasado",
        titulo: `${formatarReais(rfin.atrasado)} em recebimentos atrasados`,
        detalhe: "Convênios e boletos que passaram do prazo.",
        href: "/app/financeiro",
        quantidade: 1,
        urgente: false,
      });
    }

    if (rfin.bruto > 0) {
      numeros.push({
        chave: "faturamento",
        rotulo: "faturado no mês",
        valor: formatarReais(rfin.bruto),
        nota: `${formatarReais(rfin.aReceber)} a receber`,
      });
    }

    if (indicadores.length) {
      const k = calcularKpis(indicadores);
      if (k.investimento > 0) {
        numeros.push({
          chave: "roi",
          rotulo: "retorno do marketing",
          valor: `${k.roi.toFixed(1).replace(".", ",")}x`,
          nota: `${formatarReais(k.cpl, true)} por lead`,
        });
      }
    }
  }

  return {
    tituloNumeros: "Sua clínica hoje",
    pendencias,
    numeros,
  };
}
