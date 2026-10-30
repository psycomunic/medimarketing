/**
 * Dados de demonstração do financeiro: 12 meses de clínica e de agência.
 *
 * Determinísticos (gerador com semente fixa): a mesma visita vê sempre
 * os mesmos números, e um print de hoje bate com o de amanhã.
 */
import { DEMO_ORG_ID, DEMO_ORGANIZACOES } from "@/lib/demo";
import type {
  ComposicaoFinanceira,
  FechamentoFinanceiro,
  ConfigFinanceira,
  Contrato,
  ContratoEvento,
  CustoAgencia,
  Despesa,
  Fatura,
  FormaPagamento,
  Lancamento,
  PrecoProcedimento,
  RegraRepasse,
  Repasse,
} from "@/lib/supabase/types";

function gerador(semente: number) {
  let s = semente >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const MEDICOS = ["00000000-0000-0000-0000-000000000000", "med-vd-2"];

const PROCEDIMENTOS: [string, string, number, number][] = [
  ["Consulta dermatológica", "Consultas", 380, 0],
  ["Retorno", "Consultas", 0, 0],
  ["Teleconsulta", "Consultas", 280, 0],
  ["Toxina botulínica", "Estética", 1800, 620],
  ["Preenchimento com ácido hialurônico", "Estética", 2400, 980],
  ["Peeling químico", "Estética", 780, 145],
  ["Laser para melasma", "Estética", 1200, 210],
  ["Microagulhamento", "Estética", 950, 180],
  ["Biópsia de pele", "Procedimentos", 640, 190],
  ["Cauterização de lesão", "Procedimentos", 480, 90],
];

const CONVENIOS = ["Unimed", "Bradesco Saúde", "SulAmérica", "Amil"];

const PACIENTES = [
  "Ana Ribeiro", "Carlos Menezes", "Juliana Faria", "Marcos Lima", "Beatriz Souza", "Rafael Costa",
  "Patrícia Gomes", "Fernanda Dias", "Gustavo Rocha", "Helena Martins", "Larissa Pinto", "Bruno Almeida",
  "Vanessa Lopes", "Otávio Brandão", "Camila Nogueira", "Tatiana Reis", "Rodrigo Salles", "Luana Teixeira",
  "Sérgio Prado", "Mariana Campos", "Eduardo Viana", "Isabela Moura", "Felipe Duarte", "Aline Barros",
];

const FORMAS: FormaPagamento[] = [
  "pix", "cartao_credito", "cartao_credito", "convenio", "pix", "cartao_debito", "convenio", "dinheiro", "boleto",
];
const TAXA: Record<FormaPagamento, number> = {
  pix: 0, dinheiro: 0, cartao_debito: 1.6, cartao_credito: 3.5, boleto: 2, convenio: 0,
};

let cacheLanc: Lancamento[] | null = null;

/** 12 meses de receita, crescendo aos poucos (efeito do marketing). */
export function demoReceitas(): Lancamento[] {
  if (cacheLanc) return cacheLanc;
  const r = gerador(42);
  const hoje = new Date();
  const lista: Lancamento[] = [];
  let k = 0;
  // Pouco mais de um ano para trás: o painel compara com o mesmo mês do ano anterior
  for (let dia = 430; dia >= -21; dia--) {
    const d = new Date(hoje);
    d.setDate(d.getDate() - dia);
    if (d.getDay() === 0) continue;
    const crescimento = 1 + (364 - Math.max(dia, 0)) / 520;
    const porDia = Math.round((2 + r() * 3) * crescimento * (d.getDay() === 6 ? 0.5 : 1));
    for (let j = 0; j < porDia; j++) {
      const [proc, categoria, valor, custo] = PROCEDIMENTOS[Math.floor(r() * PROCEDIMENTOS.length)];
      const forma = FORMAS[Math.floor(r() * FORMAS.length)];
      const competencia = iso(d);
      const futuro = dia < 0;
      const prazo = forma === "convenio" ? 30 + Math.floor(r() * 15) : forma === "boleto" ? 8 : forma === "cartao_credito" ? 30 : 0;
      // Uma parte do que já venceu não foi paga: vira atraso
      const caloteiro = !futuro && dia >= prazo && dia < 120 && r() < 0.05;
      const recebido = !futuro && dia >= prazo && !caloteiro;
      const atrasado = caloteiro;
      const glosa = forma === "convenio" && r() < 0.12 ? Math.round(valor * (0.2 + r() * 0.5)) : 0;
      const desconto = forma !== "convenio" && r() < 0.08 ? Math.round(valor * 0.1) : 0;
      const pago = new Date(d);
      pago.setDate(pago.getDate() + prazo);
      lista.push({
        id: `dfin-${k}`,
        organization_id: DEMO_ORG_ID,
        consulta_id: null,
        paciente_nome: PACIENTES[Math.floor(r() * PACIENTES.length)],
        procedimento: proc,
        categoria,
        valor,
        custo,
        forma_pagamento: forma,
        status: valor === 0 ? "recebido" : futuro ? "previsto" : recebido ? "recebido" : atrasado ? "atrasado" : "previsto",
        data_competencia: competencia,
        data_recebimento: recebido ? iso(pago) : null,
        observacao: null,
        created_at: new Date(`${competencia}T12:00:00`).toISOString(),
        medico_id: MEDICOS[Math.floor(r() * MEDICOS.length)],
        convenio: forma === "convenio" ? CONVENIOS[Math.floor(r() * CONVENIOS.length)] : null,
        desconto,
        taxa: Math.round((valor - desconto) * TAXA[forma]) / 100,
        parcelas: forma === "cartao_credito" && valor > 1000 ? 3 : 1,
        glosa,
        glosa_motivo: glosa ? "Procedimento sem autorização prévia" : null,
        previsao_recebimento: recebido ? null : iso(pago),
        origem: "agenda",
      });
      k++;
    }
  }
  cacheLanc = lista.sort((a, b) => b.data_competencia.localeCompare(a.data_competencia));
  return cacheLanc;
}

let cacheDesp: Despesa[] | null = null;

export function demoDespesas(): Despesa[] {
  if (cacheDesp) return cacheDesp;
  const r = gerador(7);
  const hoje = new Date();
  const lista: Despesa[] = [];
  const FIXAS: [string, Despesa["categoria"], number, number, string][] = [
    ["Aluguel da sala", "aluguel", 6800, 5, "Imobiliária Jardins"],
    ["Condomínio", "aluguel", 1450, 10, "Condomínio Oscar Freire"],
    ["Salários da recepção", "equipe", 7600, 5, "Equipe"],
    ["Pró-labore", "pro_labore", 9000, 5, "Sócios"],
    ["Medi Marketing", "marketing", 3500, 10, "Medi Marketing"],
    ["Anúncios Meta e Google", "marketing", 2800, 15, "Meta / Google"],
    ["Sistema e prontuário", "sistemas", 480, 12, "Software"],
    ["Contabilidade", "outros", 950, 20, "Escritório contábil"],
  ];
  let k = 0;
  for (let m = -11; m <= 1; m++) {
    const base = new Date(hoje.getFullYear(), hoje.getMonth() + m, 1);
    for (const [desc, cat, valor, dia, forn] of FIXAS) {
      const venc = new Date(base.getFullYear(), base.getMonth(), dia);
      const passou = venc < hoje;
      lista.push(despesa(k++, desc, cat, valor, venc, passou, true, forn));
    }
    // Variáveis: insumos, laboratório, manutenção, impostos
    const variaveis: [string, Despesa["categoria"], number][] = [
      ["Insumos e descartáveis", "insumos", 1800 + r() * 1400],
      ["Laboratório de análises", "laboratorio", 700 + r() * 900],
      ["DAS — Simples Nacional", "impostos", 3900 + r() * 1600],
      ["Tarifas bancárias", "taxas", 120 + r() * 80],
    ];
    if (r() < 0.4) variaveis.push(["Manutenção do laser", "manutencao", 900 + r() * 1500]);
    for (const [desc, cat, valor] of variaveis) {
      const venc = new Date(base.getFullYear(), base.getMonth(), 8 + Math.floor(r() * 18));
      lista.push(despesa(k++, desc, cat, Math.round(valor), venc, venc < hoje, false, null));
    }
  }
  cacheDesp = lista.sort((a, b) => b.vencimento.localeCompare(a.vencimento));
  return cacheDesp;
}

function despesa(
  k: number,
  descricao: string,
  categoria: Despesa["categoria"],
  valor: number,
  venc: Date,
  paga: boolean,
  fixa: boolean,
  fornecedor: string | null
): Despesa {
  return {
    id: `ddesp-${k}`,
    organization_id: DEMO_ORG_ID,
    descricao,
    categoria,
    fornecedor,
    valor,
    vencimento: iso(venc),
    pago_em: paga ? iso(venc) : null,
    status: paga ? "paga" : "aberta",
    fixa,
    recorrente: fixa,
    grupo: null,
    parcela: null,
    parcelas: null,
    forma_pagamento: paga ? "pix" : null,
    comprovante: null,
    observacao: null,
    created_at: new Date().toISOString(),
  };
}

export function demoConfigFinanceira(): ConfigFinanceira {
  return {
    organization_id: DEMO_ORG_ID,
    taxas: TAXA,
    imposto: 6,
    reserva_glosa: 7,
    saldo_inicial: 48500,
    meta_lucro: 30000,
    atualizado_em: new Date().toISOString(),
  };
}

export function demoPrecos(): PrecoProcedimento[] {
  const lista: PrecoProcedimento[] = PROCEDIMENTOS.map(([proc, cat, valor, custo], i) => ({
    id: `dpreco-${i}`,
    organization_id: DEMO_ORG_ID,
    procedimento: proc,
    categoria: cat,
    convenio: null,
    valor,
    custo,
    duracao_min: cat === "Consultas" ? 30 : 60,
    // Exemplos de faixa: o valor e o tempo mudam conforme a área tratada
    ...(proc === "Toxina botulínica" && { valor_max: 2600, duracao_max: 60, duracao_min: 30 }),
    ...(proc === "Laser para melasma" && { valor_max: 1800 }),
    // Retorno recomendado: alimenta a lista de contatos da Retenção
    ...(proc === "Toxina botulínica" && { retorno_dias: 120 }),
    ...(proc === "Peeling químico" && { retorno_dias: 30 }),
    ...(proc === "Consulta dermatológica" && { retorno_dias: 180 }),
    ativo: true,
    created_at: new Date().toISOString(),
  }));
  CONVENIOS.forEach((c, i) =>
    lista.push({
      id: `dpreco-c${i}`,
      organization_id: DEMO_ORG_ID,
      procedimento: "Consulta dermatológica",
      categoria: "Consultas",
      convenio: c,
      valor: [190, 165, 210, 175][i],
      custo: 0,
      duracao_min: 30,
      ativo: true,
      created_at: new Date().toISOString(),
    })
  );
  return lista;
}

export function demoRegrasRepasse(): RegraRepasse[] {
  return [
    { id: "drr-1", organization_id: DEMO_ORG_ID, medico_id: MEDICOS[1], tipo: "percentual", valor: 40, base: "liquido", so_recebido: true },
  ];
}

export function demoRepassesFechados(): Repasse[] {
  return [];
}

/* ============================== AGÊNCIA ============================== */

/** Clínicas que já foram clientes: entram só no histórico. */
export const DEMO_EX_CLIENTES: Record<string, string> = {
  "ex-1": "Clínica Bem Estar",
  "ex-2": "Studio Pele & Laser",
  "ex-3": "Ortoclin Santos",
};

export function demoNomeCliente(id: string): string {
  return DEMO_ORGANIZACOES.find((o) => o.id === id)?.nome ?? DEMO_EX_CLIENTES[id] ?? "Clínica";
}

const PRECO_PLANO: Record<string, number> = { essencial: 1900, performance: 3500, full: 5800 };

let cacheAgencia: { contratos: Contrato[]; eventos: ContratoEvento[] } | null = null;

export function demoContratos(): { contratos: Contrato[]; eventos: ContratoEvento[] } {
  if (cacheAgencia) return cacheAgencia;
  const hoje = new Date();
  const mes = (m: number, dia = 3) => iso(new Date(hoje.getFullYear(), hoje.getMonth() + m, dia));
  const contratos: Contrato[] = [];
  const eventos: ContratoEvento[] = [];
  let e = 0;
  const ev = (contrato_id: string, tipo: ContratoEvento["tipo"], data: string, antes: number, depois: number) =>
    eventos.push({
      id: `dev-${e++}`,
      contrato_id,
      tipo,
      data,
      mrr_antes: antes,
      mrr_depois: depois,
      observacao: null,
      created_at: `${data}T12:00:00Z`,
    });
  const novo = (
    id: string,
    org: string,
    plano: Contrato["plano"],
    inicio: string,
    status: Contrato["status"] = "ativo",
    mensalidade = PRECO_PLANO[plano]
  ) => {
    contratos.push({
      id,
      organization_id: org,
      plano,
      mensalidade,
      implantacao: 2500,
      inicio,
      fidelidade_meses: 12,
      dia_vencimento: 10,
      reajuste: "IPCA",
      status,
      cancelado_em: null,
      motivo_saida: null,
      responsavel: "Equipe Medi",
      observacao: null,
      created_at: `${inicio}T12:00:00Z`,
      atualizado_em: `${inicio}T12:00:00Z`,
    });
    ev(id, "novo", inicio, 0, mensalidade);
  };

  novo("dc-1", DEMO_ORG_ID, "essencial", mes(-13));
  ev("dc-1", "upgrade", mes(-6), 1900, 3500);
  contratos[0].plano = "performance";
  contratos[0].mensalidade = 3500;
  novo("dc-2", "org-2", "full", mes(-11));
  novo("dc-3", "org-3", "essencial", mes(-9));
  novo("dc-4", "org-4", "performance", mes(-7));
  ev("dc-4", "downgrade", mes(-2), 3500, 1900);
  contratos[3].plano = "essencial";
  contratos[3].mensalidade = 1900;
  novo("dc-5", "org-5", "performance", mes(-3));
  novo("dc-6", "ex-1", "essencial", mes(-12), "cancelado");
  ev("dc-6", "cancelamento", mes(-5), 1900, 0);
  contratos[5].cancelado_em = mes(-5);
  contratos[5].motivo_saida = "Corte de custos";
  novo("dc-7", "ex-2", "performance", mes(-10), "cancelado");
  ev("dc-7", "cancelamento", mes(-1), 3500, 0);
  contratos[6].cancelado_em = mes(-1);
  contratos[6].motivo_saida = "Mudou de cidade";
  novo("dc-8", "ex-3", "essencial", mes(-8), "pausado");
  ev("dc-8", "pausa", mes(-1, 15), 1900, 0);

  cacheAgencia = { contratos, eventos };
  return cacheAgencia;
}

export function demoFaturas(): Fatura[] {
  const { contratos, eventos } = demoContratos();
  const hoje = new Date();
  const lista: Fatura[] = [];
  let k = 0;
  for (const c of contratos) {
    for (let m = -12; m <= 0; m++) {
      const comp = new Date(hoje.getFullYear(), hoje.getMonth() + m, 1);
      const compIso = iso(comp);
      // Valor vigente no mês, pelo histórico
      const vigentes = eventos.filter((e) => e.contrato_id === c.id && e.data <= iso(new Date(comp.getFullYear(), comp.getMonth() + 1, 0)));
      const ultimo = vigentes.sort((a, b) => a.data.localeCompare(b.data)).pop();
      const valor = ultimo?.mrr_depois ?? 0;
      if (!valor) continue;
      const venc = new Date(comp.getFullYear(), comp.getMonth(), c.dia_vencimento);
      const atrasada = (c.organization_id === "org-4" && m >= -1) || (c.organization_id === "org-3" && m === 0);
      const paga = venc < hoje && !atrasada;
      lista.push({
        id: `dfat-${k++}`,
        organization_id: c.organization_id,
        contrato_id: c.id,
        competencia: compIso,
        descricao: "Mensalidade",
        valor,
        vencimento: iso(venc),
        status: paga ? "paga" : "aberta",
        pago_em: paga ? iso(new Date(venc.getFullYear(), venc.getMonth(), venc.getDate() + (k % 3))) : null,
        forma_pagamento: paga ? "pix" : null,
        tipo: "mensalidade",
        created_at: compIso,
      });
    }
  }
  return lista;
}

export function demoCustosAgencia(): CustoAgencia[] {
  const hoje = new Date();
  const lista: CustoAgencia[] = [];
  let k = 0;
  for (let m = -11; m <= 0; m++) {
    const comp = iso(new Date(hoje.getFullYear(), hoje.getMonth() + m, 1));
    const fixos: [string, CustoAgencia["categoria"], number, string | null][] = [
      ["Supabase", "ferramentas", 140, null],
      ["Vercel", "ferramentas", 110, null],
      ["Resend", "ferramentas", 60, null],
      ["WhatsApp (Merge)", "ferramentas", 290, null],
      ["Equipe de tráfego", "equipe", 6500, null],
      ["Designer", "equipe", 3200, null],
      ["Anúncios da agência", "midia", 1800, null],
      ["Impostos", "impostos", 1350, null],
      ["Gestor dedicado Odonto Sorriso", "equipe", 1400, "org-2"],
    ];
    for (const [d, cat, v, org] of fixos) {
      lista.push({
        id: `dca-${k++}`,
        descricao: d,
        categoria: cat,
        valor: v,
        competencia: comp,
        recorrente: true,
        organization_id: org,
        created_at: comp,
      });
    }
  }
  return lista;
}

/* ======================== HISTÓRICO DE CAIXA ======================== */

/** Fechamentos fictícios de nove meses, para a demonstração. */
export function demoHistorico(): { fechamentos: FechamentoFinanceiro[]; composicoes: ComposicaoFinanceira[] } {
  const ano = new Date().getFullYear();
  const entradas = [61200, 64800, 70350, 72900, 60100, 76400, 73800, 75200, 71900];
  const saidas = [57900, 68100, 71200, 66800, 67300, 74100, 70900, 68400, 72800];
  let saldo = 31500;
  const fechamentos: FechamentoFinanceiro[] = [
    { id: "dh-0", organization_id: DEMO_ORG_ID, mes: `${ano - 1}-12-01`, entradas: null, saidas: null, saldo_final: saldo, receita_operacional: null, observacao: "Saldo inicial", origem: "importado", created_at: "" },
  ];
  entradas.forEach((e, i) => {
    saldo = Math.round((saldo + e - saidas[i]) * 100) / 100;
    fechamentos.push({
      id: `dh-${i + 1}`,
      organization_id: DEMO_ORG_ID,
      mes: `${ano}-${String(i + 1).padStart(2, "0")}-01`,
      entradas: e,
      saidas: saidas[i],
      saldo_final: saldo,
      receita_operacional: e - 2000,
      observacao: null,
      origem: "importado",
      created_at: "",
    });
  });
  const comp = (tipo: "receita" | "saida", item: string, valor: number, natureza: ComposicaoFinanceira["natureza"], k: number): ComposicaoFinanceira => ({
    id: `dc-${tipo}-${k}`,
    organization_id: DEMO_ORG_ID,
    inicio: `${ano}-01-01`,
    fim: `${ano}-09-30`,
    tipo,
    item,
    valor,
    percentual: null,
    natureza,
    estimado: false,
    observacao: null,
    ordem: k,
  });
  return {
    fechamentos,
    composicoes: [
      comp("receita", "Convênio principal", 178400, "convenio", 0),
      comp("receita", "Consultas particulares", 152300, "particular", 1),
      comp("receita", "Procedimentos estéticos", 101900, "particular", 2),
      comp("receita", "Outros convênios", 52600, "convenio", 3),
      comp("receita", "Outras receitas", 22450, "outras", 4),
      comp("saida", "Salários", 168200, "operacional", 0),
      comp("saida", "Distribuição de lucros", 121000, "socios", 1),
      comp("saida", "Administrativo", 92600, "operacional", 2),
      comp("saida", "Empréstimos", 61300, "financeiro", 3),
      comp("saida", "Investimentos", 48900, "investimento", 4),
      comp("saida", "Comercial", 25500, "operacional", 5),
    ],
  };
}
