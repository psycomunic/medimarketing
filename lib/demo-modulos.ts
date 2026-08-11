/**
 * Dados fictícios do CRM, atendimento, retenção, marketing, financeiro e
 * integrações — o conteúdo que dá vida aos módulos da Fase 3 quando o
 * Supabase não está configurado.
 *
 * Mesma separação de lib/demo-dados.ts: fora de lib/demo.ts porque aquele
 * arquivo é carregado pelo middleware (Edge) e precisa ficar enxuto.
 */
import type {
  Campanha,
  Conversa,
  Integracao,
  Lancamento,
  LeadInteracao,
  Mensagem,
  Regua,
  ReguaComDesempenho,
  ReguaPasso,
} from "@/lib/supabase/types";
import { CONTAS_DEMO, DEMO_ORG_ID } from "@/lib/demo";

const SECRETARIA = CONTAS_DEMO[1].profile;
const GESTOR = CONTAS_DEMO[2].profile;

/** ISO de N horas atrás (negativo = futuro). */
function h(atras: number): string {
  return new Date(Date.now() - atras * 3600_000).toISOString();
}

/** "YYYY-MM-DD" de N dias atrás. */
function data(atras: number): string {
  const d = new Date();
  d.setDate(d.getDate() - atras);
  return d.toISOString().slice(0, 10);
}

/* ------------------------------------------------------------------ */
/* CRM — histórico e tarefas dos leads                                 */
/* ------------------------------------------------------------------ */

const INTERACOES: LeadInteracao[] = [
  {
    id: "i1", lead_id: "l3", organization_id: DEMO_ORG_ID, autor_id: SECRETARIA.id,
    tipo: "mensagem", canal: "whatsapp",
    conteudo: "Respondi explicando como funciona a avaliação e mandei os horários de quinta.",
    concluida: false, vence_em: null, created_at: h(20),
  },
  {
    id: "i2", lead_id: "l3", organization_id: DEMO_ORG_ID, autor_id: SECRETARIA.id,
    tipo: "nota", canal: null,
    conteudo: "Já fez botox em outra clínica e não gostou do resultado. Vale reforçar a avaliação com a Dra. Marina antes de falar de preço.",
    concluida: false, vence_em: null, created_at: h(19),
  },
  {
    id: "i3", lead_id: "l3", organization_id: DEMO_ORG_ID, autor_id: SECRETARIA.id,
    tipo: "tarefa", canal: "whatsapp",
    conteudo: "Confirmar se ela consegue vir na quinta às 15h.",
    concluida: false, vence_em: h(-26), created_at: h(18),
  },
  {
    id: "i4", lead_id: "l4", organization_id: DEMO_ORG_ID, autor_id: GESTOR.id,
    tipo: "ligacao", canal: "telefone",
    conteudo: "Liguei, não atendeu. Deixei mensagem no WhatsApp.",
    concluida: false, vence_em: null, created_at: h(40),
  },
  {
    id: "i5", lead_id: "l4", organization_id: DEMO_ORG_ID, autor_id: GESTOR.id,
    tipo: "tarefa", canal: "whatsapp",
    conteudo: "Segundo toque da régua de reabordagem — está atrasado.",
    concluida: false, vence_em: h(2), created_at: h(39),
  },
  {
    id: "i6", lead_id: "l5", organization_id: DEMO_ORG_ID, autor_id: SECRETARIA.id,
    tipo: "mensagem", canal: "whatsapp",
    conteudo: "Agendada para sexta às 10h. Enviei o endereço e as orientações de preparo.",
    concluida: false, vence_em: null, created_at: h(30),
  },
  {
    id: "i7", lead_id: "l7", organization_id: DEMO_ORG_ID, autor_id: GESTOR.id,
    tipo: "nota", canal: null,
    conteudo: "Fechou o protocolo completo em 6 sessões. Primeira já realizada.",
    concluida: false, vence_em: null, created_at: h(120),
  },
  {
    id: "i8", lead_id: "l8", organization_id: DEMO_ORG_ID, autor_id: SECRETARIA.id,
    tipo: "nota", canal: null,
    conteudo: "Disse que o valor ficou acima do que planejava. Ofereci parcelamento em 6x e mesmo assim não seguiu.",
    concluida: false, vence_em: null, created_at: h(200),
  },
  {
    id: "i9", lead_id: "l10", organization_id: DEMO_ORG_ID, autor_id: GESTOR.id,
    tipo: "mensagem", canal: "email",
    conteudo: "Mandei o material sobre tratamento de cicatriz de acne que ele pediu.",
    concluida: false, vence_em: null, created_at: h(60),
  },
  {
    id: "i10", lead_id: "l10", organization_id: DEMO_ORG_ID, autor_id: GESTOR.id,
    tipo: "tarefa", canal: "whatsapp",
    conteudo: "Retomar depois que ele ler o material.",
    concluida: false, vence_em: h(-12), created_at: h(59),
  },
  {
    id: "i11", lead_id: "l1", organization_id: DEMO_ORG_ID, autor_id: SECRETARIA.id,
    tipo: "tarefa", canal: "whatsapp",
    conteudo: "Primeiro contato — lead entrou hoje pelo anúncio de melasma.",
    concluida: false, vence_em: h(-3), created_at: h(1),
  },
  {
    id: "i12", lead_id: "l2", organization_id: DEMO_ORG_ID, autor_id: SECRETARIA.id,
    tipo: "tarefa", canal: "whatsapp",
    conteudo: "Primeiro contato — atrasado desde a manhã.",
    concluida: false, vence_em: h(5), created_at: h(8),
  },
  {
    id: "i13", lead_id: "l11", organization_id: DEMO_ORG_ID, autor_id: SECRETARIA.id,
    tipo: "mensagem", canal: "whatsapp",
    conteudo: "Veio por indicação da Vanessa. Já marcou avaliação para semana que vem.",
    concluida: true, vence_em: null, created_at: h(48),
  },
];

export function demoInteracoes(leadId?: string): LeadInteracao[] {
  const lista = leadId ? INTERACOES.filter((i) => i.lead_id === leadId) : INTERACOES;
  return [...lista].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

/* ------------------------------------------------------------------ */
/* Atendimento — conversas e mensagens                                 */
/* ------------------------------------------------------------------ */

const CONVERSAS: Conversa[] = [
  {
    id: "cv1", organization_id: DEMO_ORG_ID, lead_id: "l1", canal: "whatsapp",
    contato_nome: "Renata Prado", contato_identificador: "(11) 98811-2201",
    status: "aberta", atribuido_a: SECRETARIA.id, nao_lidas: 2,
    ultima_mensagem: "E consigo parcelar em quantas vezes?",
    ultima_mensagem_em: h(0.4), created_at: h(3),
  },
  {
    id: "cv2", organization_id: DEMO_ORG_ID, lead_id: "l3", canal: "instagram",
    contato_nome: "Sofia Camargo", contato_identificador: "@sofia.camargo",
    status: "aberta", atribuido_a: SECRETARIA.id, nao_lidas: 1,
    ultima_mensagem: "Consigo sim na quinta de tarde!",
    ultima_mensagem_em: h(1.2), created_at: h(22),
  },
  {
    id: "cv3", organization_id: DEMO_ORG_ID, lead_id: "l2", canal: "whatsapp",
    contato_nome: "Tiago Moreira", contato_identificador: "(11) 98822-3302",
    status: "pendente", atribuido_a: null, nao_lidas: 1,
    ultima_mensagem: "Oi, vi o anúncio de vocês sobre acne",
    ultima_mensagem_em: h(6), created_at: h(6),
  },
  {
    id: "cv4", organization_id: DEMO_ORG_ID, lead_id: "l10", canal: "facebook",
    contato_nome: "Fábio Queiroz", contato_identificador: "Fábio Queiroz",
    status: "aberta", atribuido_a: GESTOR.id, nao_lidas: 0,
    ultima_mensagem: "Perfeito, vou ler e te falo.",
    ultima_mensagem_em: h(58), created_at: h(96),
  },
  {
    id: "cv5", organization_id: DEMO_ORG_ID, lead_id: "l5", canal: "whatsapp",
    contato_nome: "Luana Teixeira", contato_identificador: "(11) 98855-6605",
    status: "resolvida", atribuido_a: SECRETARIA.id, nao_lidas: 0,
    ultima_mensagem: "Combinado, até sexta!",
    ultima_mensagem_em: h(30), created_at: h(72),
  },
  {
    id: "cv6", organization_id: DEMO_ORG_ID, lead_id: null, canal: "whatsapp",
    contato_nome: "Beatriz Souza", contato_identificador: "(11) 99444-5566",
    status: "pendente", atribuido_a: null, nao_lidas: 1,
    ultima_mensagem: "Doutora, o resultado da biópsia já saiu?",
    ultima_mensagem_em: h(4), created_at: h(4),
  },
];

const MENSAGENS: Record<string, Mensagem[]> = {
  cv1: [
    { id: "m1", conversa_id: "cv1", direcao: "entrada", autor_id: null, autor_nome: "Renata Prado", conteudo: "Oi! Vi o anúncio de vocês sobre tratamento de melasma. Como funciona?", created_at: h(3) },
    { id: "m2", conversa_id: "cv1", direcao: "saida", autor_id: SECRETARIA.id, autor_nome: SECRETARIA.nome, conteudo: "Olá, Renata! Que bom que você chegou até a gente 💚 O primeiro passo é uma avaliação com a Dra. Marina: ela examina a sua pele e monta o protocolo certo pro seu caso, porque melasma responde de formas bem diferentes de pessoa pra pessoa.", created_at: h(2.6) },
    { id: "m3", conversa_id: "cv1", direcao: "entrada", autor_id: null, autor_nome: "Renata Prado", conteudo: "Entendi. E quanto custa essa avaliação?", created_at: h(2.2) },
    { id: "m4", conversa_id: "cv1", direcao: "saida", autor_id: SECRETARIA.id, autor_nome: SECRETARIA.nome, conteudo: "A avaliação é R$ 350 e já inclui o mapeamento da pele. Se você fechar o tratamento na mesma semana, esse valor entra como crédito no protocolo. Tenho quinta às 15h ou sexta às 9h30 — qual fica melhor?", created_at: h(2) },
    { id: "m5", conversa_id: "cv1", direcao: "entrada", autor_id: null, autor_nome: "Renata Prado", conteudo: "Quinta funciona melhor pra mim.", created_at: h(0.6) },
    { id: "m6", conversa_id: "cv1", direcao: "entrada", autor_id: null, autor_nome: "Renata Prado", conteudo: "E consigo parcelar em quantas vezes?", created_at: h(0.4) },
  ],
  cv2: [
    { id: "m7", conversa_id: "cv2", direcao: "entrada", autor_id: null, autor_nome: "Sofia Camargo", conteudo: "Oi, vocês fazem botox? Já fiz em outro lugar e não gostei muito", created_at: h(22) },
    { id: "m8", conversa_id: "cv2", direcao: "saida", autor_id: SECRETARIA.id, autor_nome: SECRETARIA.nome, conteudo: "Oi, Sofia! Fazemos sim. E é bem comum ouvir isso — na maioria das vezes o problema não é o produto, é o planejamento do rosto todo. A Dra. Marina faz uma avaliação de expressão antes de aplicar qualquer coisa. Você consegue vir numa quinta à tarde?", created_at: h(20) },
    { id: "m9", conversa_id: "cv2", direcao: "entrada", autor_id: null, autor_nome: "Sofia Camargo", conteudo: "Consigo sim na quinta de tarde!", created_at: h(1.2) },
  ],
  cv3: [
    { id: "m10", conversa_id: "cv3", direcao: "entrada", autor_id: null, autor_nome: "Tiago Moreira", conteudo: "Oi, vi o anúncio de vocês sobre acne", created_at: h(6) },
  ],
  cv4: [
    { id: "m11", conversa_id: "cv4", direcao: "entrada", autor_id: null, autor_nome: "Fábio Queiroz", conteudo: "Boa tarde. Tenho cicatriz de acne bem antiga, ainda tem o que fazer?", created_at: h(96) },
    { id: "m12", conversa_id: "cv4", direcao: "saida", autor_id: GESTOR.id, autor_nome: GESTOR.nome, conteudo: "Boa tarde, Fábio! Tem sim, e bastante. Cicatriz antiga responde bem a protocolo combinado de laser com microagulhamento. Vou te mandar um material explicando os tipos de cicatriz e o que funciona em cada um.", created_at: h(90) },
    { id: "m13", conversa_id: "cv4", direcao: "entrada", autor_id: null, autor_nome: "Fábio Queiroz", conteudo: "Perfeito, vou ler e te falo.", created_at: h(58) },
  ],
  cv5: [
    { id: "m14", conversa_id: "cv5", direcao: "entrada", autor_id: null, autor_nome: "Luana Teixeira", conteudo: "Oi! A Vanessa me indicou vocês. Queria marcar uma avaliação", created_at: h(72) },
    { id: "m15", conversa_id: "cv5", direcao: "saida", autor_id: SECRETARIA.id, autor_nome: SECRETARIA.nome, conteudo: "Oi, Luana! A Vanessa é nossa paciente querida 💚 Tenho sexta às 10h, serve?", created_at: h(70) },
    { id: "m16", conversa_id: "cv5", direcao: "entrada", autor_id: null, autor_nome: "Luana Teixeira", conteudo: "Combinado, até sexta!", created_at: h(30) },
  ],
  cv6: [
    { id: "m17", conversa_id: "cv6", direcao: "entrada", autor_id: null, autor_nome: "Beatriz Souza", conteudo: "Doutora, o resultado da biópsia já saiu?", created_at: h(4) },
  ],
};

export function demoConversas(): Conversa[] {
  return [...CONVERSAS].sort((a, b) =>
    b.ultima_mensagem_em.localeCompare(a.ultima_mensagem_em)
  );
}

export function demoMensagens(conversaId: string): Mensagem[] {
  return MENSAGENS[conversaId] ?? [];
}

/* ------------------------------------------------------------------ */
/* Retenção — réguas de relacionamento                                 */
/* ------------------------------------------------------------------ */

type ReguaDemo = {
  regua: Omit<Regua, "created_at">;
  passos: Omit<ReguaPasso, "id" | "regua_id">[];
  desempenho: { enviados: number; respondidos: number; convertidos: number };
};

const REGUAS: ReguaDemo[] = [
  {
    regua: {
      id: "r1", organization_id: DEMO_ORG_ID, tipo: "reabordagem",
      nome: "Reabordagem de orçamento parado",
      descricao: "Para quem recebeu o valor e não respondeu. Três toques em uma semana, cada um trazendo informação nova.",
      ativa: true,
    },
    passos: [
      { ordem: 1, atraso_horas: 48, canal: "whatsapp", mensagem: "Oi, {paciente}! Passando aqui pra saber se ficou alguma dúvida sobre o que conversamos. Qualquer coisa é só me chamar 💚" },
      { ordem: 2, atraso_horas: 96, canal: "whatsapp", mensagem: "{paciente}, lembrei de você: separei um antes e depois de um caso bem parecido com o seu. Quer que eu mande?" },
      { ordem: 3, atraso_horas: 168, canal: "whatsapp", mensagem: "Oi, {paciente}! Vou parar de te escrever pra não incomodar. Deixo a agenda da Dra. Marina aberta pra quando fizer sentido pra você. Fico à disposição!" },
    ],
    desempenho: { enviados: 84, respondidos: 31, convertidos: 12 },
  },
  {
    regua: {
      id: "r2", organization_id: DEMO_ORG_ID, tipo: "no_show",
      nome: "Resgate de falta no mesmo dia",
      descricao: "A janela de ouro são as duas primeiras horas depois do horário perdido.",
      ativa: true,
    },
    passos: [
      { ordem: 1, atraso_horas: 2, canal: "whatsapp", mensagem: "Oi, {paciente}! Senti sua falta hoje 😟 Aconteceu alguma coisa? Consigo te encaixar ainda esta semana se quiser." },
      { ordem: 2, atraso_horas: 24, canal: "telefone", mensagem: "Ligação de recuperação: entender o motivo da falta e reagendar na hora." },
      { ordem: 3, atraso_horas: 72, canal: "whatsapp", mensagem: "{paciente}, tenho dois horários novos que abriram. Quer que eu reserve um pra você?" },
    ],
    desempenho: { enviados: 46, respondidos: 27, convertidos: 19 },
  },
  {
    regua: {
      id: "r3", organization_id: DEMO_ORG_ID, tipo: "reativacao",
      nome: "Reativação da base parada",
      descricao: "Pacientes sem retorno há mais de 8 meses. Roda uma vez por trimestre.",
      ativa: true,
    },
    passos: [
      { ordem: 1, atraso_horas: 0, canal: "whatsapp", mensagem: "Oi, {paciente}! Faz um tempinho que você não aparece por aqui. Como está a sua pele?" },
      { ordem: 2, atraso_horas: 120, canal: "whatsapp", mensagem: "{paciente}, este mês estamos com a avaliação de retorno sem custo pra quem já é da casa. Quer aproveitar?" },
    ],
    desempenho: { enviados: 213, respondidos: 58, convertidos: 24 },
  },
  {
    regua: {
      id: "r4", organization_id: DEMO_ORG_ID, tipo: "recall",
      nome: "Recall de retorno e revisão",
      descricao: "Dispara conforme o protocolo clínico de cada tratamento.",
      ativa: true,
    },
    passos: [
      { ordem: 1, atraso_horas: 168, canal: "whatsapp", mensagem: "Oi, {paciente}! Já faz uma semana do procedimento. Como você está se sentindo?" },
      { ordem: 2, atraso_horas: 720, canal: "whatsapp", mensagem: "{paciente}, chegou a hora da sua revisão. Tenho horários na próxima semana — qual dia fica melhor?" },
    ],
    desempenho: { enviados: 137, respondidos: 89, convertidos: 61 },
  },
  {
    regua: {
      id: "r5", organization_id: DEMO_ORG_ID, tipo: "pos_consulta",
      nome: "Pós-consulta e pedido de avaliação",
      descricao: "Cuidado no dia seguinte e convite para avaliar a clínica no Google.",
      ativa: false,
    },
    passos: [
      { ordem: 1, atraso_horas: 24, canal: "whatsapp", mensagem: "Oi, {paciente}! Tudo certo depois da consulta de ontem? Qualquer dúvida sobre os cuidados é só chamar." },
      { ordem: 2, atraso_horas: 120, canal: "whatsapp", mensagem: "{paciente}, se você gostou do atendimento, uma avaliação no Google ajuda demais outras pessoas a encontrarem a gente 💚" },
    ],
    desempenho: { enviados: 0, respondidos: 0, convertidos: 0 },
  },
];

export function demoReguas(): ReguaComDesempenho[] {
  return REGUAS.map((r, i) => ({
    ...r.regua,
    created_at: h(24 * (60 - i * 8)),
    passos: r.passos.map((p, j) => ({
      ...p,
      id: `${r.regua.id}-p${j + 1}`,
      regua_id: r.regua.id,
    })),
    ...r.desempenho,
  }));
}

/* ------------------------------------------------------------------ */
/* Marketing — campanhas                                               */
/* ------------------------------------------------------------------ */

export function demoCampanhas(): Campanha[] {
  const c = (
    id: string,
    plataforma: Campanha["plataforma"],
    nome: string,
    objetivo: string,
    status: Campanha["status"],
    diasAtras: number,
    nums: Pick<Campanha, "investimento" | "impressoes" | "cliques" | "leads" | "agendamentos">,
    fim: string | null = null
  ): Campanha => ({
    id,
    organization_id: DEMO_ORG_ID,
    plataforma,
    nome,
    objetivo,
    status,
    inicio: data(diasAtras),
    fim,
    ...nums,
    created_at: h(24 * diasAtras),
  });

  return [
    c("cp1", "meta", "Melasma — Público frio SP", "Geração de leads", "ativa", 34, {
      investimento: 2400, impressoes: 184_300, cliques: 3210, leads: 47, agendamentos: 29,
    }),
    c("cp2", "meta", "Remarketing — visitou e não agendou", "Conversão", "ativa", 34, {
      investimento: 900, impressoes: 42_100, cliques: 1580, leads: 31, agendamentos: 22,
    }),
    c("cp3", "google", "Pesquisa — dermatologista Jardins", "Intenção de busca", "ativa", 34, {
      investimento: 2100, impressoes: 28_400, cliques: 1940, leads: 33, agendamentos: 24,
    }),
    c("cp4", "google", "Pesquisa — tratamento de acne", "Intenção de busca", "pausada", 62, {
      investimento: 1100, impressoes: 19_700, cliques: 860, leads: 9, agendamentos: 3,
    }, data(30)),
    c("cp5", "meta", "Preenchimento facial — inverno", "Geração de leads", "encerrada", 95, {
      investimento: 1800, impressoes: 121_500, cliques: 2140, leads: 22, agendamentos: 11,
    }, data(58)),
    c("cp6", "organico", "Instagram — conteúdo da Dra. Marina", "Autoridade", "ativa", 180, {
      investimento: 0, impressoes: 96_800, cliques: 4120, leads: 18, agendamentos: 13,
    }),
  ];
}

/* ------------------------------------------------------------------ */
/* Financeiro — lançamentos por procedimento                           */
/* ------------------------------------------------------------------ */

export function demoLancamentos(): Lancamento[] {
  const PROCEDIMENTOS: [string, string, number, number][] = [
    // nome, categoria, valor, custo direto
    ["Consulta dermatológica", "Consultas", 350, 0],
    ["Retorno", "Consultas", 0, 0],
    ["Teleconsulta", "Consultas", 250, 0],
    ["Aplicação de toxina botulínica", "Estética", 1800, 620],
    ["Preenchimento com ácido hialurônico", "Estética", 2400, 980],
    ["Peeling químico", "Estética", 780, 145],
    ["Laser para melasma", "Estética", 1200, 210],
    ["Microagulhamento", "Estética", 950, 180],
    ["Biópsia de pele", "Procedimentos", 640, 190],
    ["Cauterização de lesão", "Procedimentos", 480, 90],
  ];

  const PACIENTES = [
    "Ana Ribeiro", "Carlos Menezes", "Juliana Faria", "Marcos Lima", "Beatriz Souza",
    "Rafael Costa", "Patrícia Gomes", "Fernanda Dias", "Gustavo Rocha", "Helena Martins",
    "Larissa Pinto", "Bruno Almeida", "Vanessa Lopes", "Otávio Brandão", "Camila Nogueira",
    "Tatiana Reis", "Rodrigo Salles", "Luana Teixeira",
  ];

  const FORMAS: Lancamento["forma_pagamento"][] = [
    "pix", "cartao_credito", "cartao_credito", "convenio", "dinheiro", "cartao_debito", "boleto",
  ];

  const lista: Lancamento[] = [];
  // ~90 dias de faturamento, com volume maior nos meses recentes
  let n = 0;
  for (let dia = 89; dia >= 0; dia--) {
    const d = new Date();
    d.setDate(d.getDate() - dia);
    const semana = d.getDay();
    if (semana === 0) continue; // clínica fechada aos domingos

    // Volume cresce ao longo do período (efeito do acompanhamento)
    const porDia = 2 + ((89 - dia) % 4) + (dia < 30 ? 1 : 0);
    for (let k = 0; k < porDia; k++) {
      const [proc, categoria, valor, custo] = PROCEDIMENTOS[n % PROCEDIMENTOS.length];
      const forma = FORMAS[n % FORMAS.length];
      const competencia = data(dia);

      // Convênio e boleto demoram a cair; o resto entra no dia
      const prazo = forma === "convenio" ? 35 : forma === "boleto" ? 10 : 0;
      const recebido = dia >= prazo;
      const atrasado = !recebido && dia < prazo && prazo - dia > 5;

      lista.push({
        id: `fin-${n}`,
        organization_id: DEMO_ORG_ID,
        consulta_id: null,
        paciente_nome: PACIENTES[n % PACIENTES.length],
        procedimento: proc,
        categoria,
        valor,
        custo,
        forma_pagamento: forma,
        status: valor === 0 ? "recebido" : recebido ? "recebido" : atrasado ? "atrasado" : "previsto",
        data_competencia: competencia,
        data_recebimento: recebido ? data(Math.max(dia - prazo, 0)) : null,
        observacao: null,
        created_at: new Date(`${competencia}T12:00:00`).toISOString(),
      });
      n++;
    }
  }

  return lista.sort((a, b) => b.data_competencia.localeCompare(a.data_competencia));
}

/* ------------------------------------------------------------------ */
/* Configurações — integrações                                         */
/* ------------------------------------------------------------------ */

export function demoIntegracoes(): Integracao[] {
  const i = (
    provedor: Integracao["provedor"],
    conectado: boolean,
    identificador: string | null
  ): Integracao => ({
    id: `int-${provedor}`,
    organization_id: DEMO_ORG_ID,
    provedor,
    conectado,
    identificador,
    atualizado_em: h(24 * 6),
  });

  return [
    i("meta_ads", true, "act_882014557"),
    i("google_ads", true, "410-882-9931"),
    i("ga4", true, "G-7QK2M4XZLP"),
    i("whatsapp", true, "(11) 3333-4444"),
    i("instagram", false, null),
  ];
}
