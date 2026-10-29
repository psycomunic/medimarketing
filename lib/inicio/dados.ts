import "server-only";
import { createClient } from "@/lib/supabase/server";

import { emModoDemo, getConsultas } from "@/lib/supabase/queries";
import { getPainel, type PendenciaPainel } from "@/lib/supabase/painel";
import { getIndicadores, getClientes } from "@/lib/supabase/indicadores";
import { getPlano } from "@/lib/supabase/evolucao";
import { getMeuFormulario, getFormulariosAdmin } from "@/lib/supabase/formularios";
import { SLUG_DIAGNOSTICO } from "@/lib/formularios/diagnostico-clinica";
import { getPropostas } from "@/lib/supabase/propostas";
import { getUsuarios } from "@/lib/supabase/usuarios";
import {
  financeiroInstalado,
  getAgencia,
  getConfigFinanceira,
  getContasAbertas,
  getDespesas,
  getMeusRepasses,
  getPrecos,
  getProfissionais,
  getReceitas,
  getRegrasRepasse,
} from "@/lib/supabase/financeiro-dados";
import {
  bruto,
  calcularRepasses,
  hojeIso,
  mesAnterior,
  resumoMes,
  somarDias,
  ultimosMeses,
  type ResumoMes,
} from "@/lib/financeiro/calculos";
import {
  fimFidelidade,
  indicadoresAgencia,
  resumoFaturas,
  riscoDoCliente,
  serieMrr,
  vencida,
  type Indicadores,
  type Risco,
} from "@/lib/financeiro/agencia";
import type { Consulta, Contrato, IndicadorMensal, Organization, PlanoCliente, Profile, Repasse, Role } from "@/lib/supabase/types";

/**
 * DADOS DO INÍCIO
 *
 * Cada papel abre o sistema com uma pergunta diferente: o dono quer
 * saber se o dia e o mês vão bem, a atendente o que tem para fazer, o
 * médico quem vem a seguir, e a agência quais clientes pedem atenção.
 */

const mesDe = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const n = (v: unknown) => Number(v ?? 0) || 0;

function inicioDoDia(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export type DiaSemana = { rotulo: string; dia: string; agendadas: number; atendidas: number; hoje: boolean };

export type PassoChecklist = { chave: string; titulo: string; detalhe: string; href: string; feito: boolean };

export type DadosClinica = {
  pendencias: PendenciaPainel[];
  hoje: Consulta[];
  proximos: Consulta[];
  semana: DiaSemana[];
  indicadores: IndicadorMensal[];
  plano: PlanoCliente | null;
  consultasMes: { agendadas: number; realizadas: number; canceladas: number };
  financeiro: {
    atual: ResumoMes;
    anterior: ResumoMes;
    serieFaturamento: number[];
    serieLucro: number[];
    previstoHoje: number;
    recebidoHoje: number;
    saldoCaixa: number;
    metaLucro: number | null;
  } | null;
  checklist: PassoChecklist[];
  repasses: Repasse[];
  /** Números do painel principal do dono (só gestor). */
  painel: PainelNumeros | null;
};

export type PainelNumeros = {
  /** Faturamento acumulado dia a dia: este mês (até hoje) e o anterior. */
  ritmo: { dia: number; atual: number | null; anterior: number }[];
  faturamentoMes: number;
  /** O mês anterior até o mesmo dia, para comparar ritmo. */
  anteriorMesmoDia: number;
  anteriorTotal: number;
  faturamentoHoje: number;
  recebidoMes: number;
  aReceberMes: number;
  ticketMedio: number;
  /** Ticket médio dos últimos 6 meses. */
  serieTicket: number[];
  /** Parte do faturamento do mês que vem de hoje para trás. */
  ateHoje: number;
  reservas: { quantidade: number; valor: number; confirmadas: number };
  proximos14: { rotulo: string; confirmadas: number; aConfirmar: number }[];
  status: { confirmadas: number; pendentes: number; realizadas: number; canceladas: number };
  tipos: { primeira: number; retorno: number; teleconsulta: number };
  novosPacientes: number;
  porProfissional: { medicoId: string; valor: number; atendimentos: number }[];
};

export async function dadosClinica(role: Role, profile: Profile, org: Organization | null): Promise<DadosClinica> {
  const orgId = org?.id ?? null;
  const agora = new Date();
  const hoje0 = inicioDoDia(agora);
  // Semana de domingo a sábado
  const domingo = new Date(hoje0);
  domingo.setDate(domingo.getDate() - domingo.getDay());
  const fimJanela = new Date(hoje0);
  // 31 dias à frente: a agenda futura vira "reservas" no painel do dono
  fimJanela.setDate(fimJanela.getDate() + 31);
  const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
  const desde = domingo < inicioMes ? domingo : inicioMes;

  const [painel, consultas, indicadores, plano] = await Promise.all([
    getPainel(role, orgId),
    getConsultas(desde.toISOString(), fimJanela.toISOString()),
    role === "secretaria" ? Promise.resolve([] as IndicadorMensal[]) : getIndicadores(orgId, 12),
    role === "gestor" ? getPlano(orgId) : Promise.resolve(null),
  ]);

  // O médico vê só a própria agenda no Início
  const minhas = role === "medico" ? consultas.filter((c) => c.medico_id === profile.id) : consultas;
  const amanha0 = new Date(hoje0);
  amanha0.setDate(amanha0.getDate() + 1);
  const hoje = minhas.filter((c) => new Date(c.data_hora) >= hoje0 && new Date(c.data_hora) < amanha0);
  const proximos = minhas.filter((c) => new Date(c.data_hora) >= amanha0 && c.status !== "cancelada").slice(0, 8);

  const nomes = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
  const semana: DiaSemana[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(domingo);
    d.setDate(d.getDate() + i);
    const doDia = minhas.filter((c) => new Date(c.data_hora).toDateString() === d.toDateString() && c.status !== "cancelada");
    return {
      rotulo: `${nomes[i]} ${d.getDate()}`,
      dia: d.toISOString().slice(0, 10),
      agendadas: doDia.length,
      atendidas: doDia.filter((c) => c.status === "realizada").length,
      hoje: d.toDateString() === agora.toDateString(),
    };
  });

  const inicioProxMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 1);
  const doMes = minhas.filter((c) => {
    const d = new Date(c.data_hora);
    return d >= inicioMes && d < inicioProxMes;
  });
  const consultasMes = {
    agendadas: doMes.filter((c) => c.status !== "cancelada").length,
    realizadas: doMes.filter((c) => c.status === "realizada").length,
    canceladas: doMes.filter((c) => c.status === "cancelada").length,
  };

  let financeiro: DadosClinica["financeiro"] = null;
  let painelNumeros: PainelNumeros | null = null;
  let checklist: PassoChecklist[] = [];
  const pendencias = [...painel.pendencias];

  if (role === "gestor" && orgId) {
    const mes = mesDe(agora);
    const meses = ultimosMeses(mes, 6);
    const ate = somarDias(`${mes}-01`, 40);
    const [instalado, receitas, despesas, config, contas, regras, precos, profissionais] = await Promise.all([
      financeiroInstalado(),
      getReceitas(orgId, `${meses[0]}-01`, ate),
      getDespesas(orgId, `${meses[0]}-01`, ate),
      getConfigFinanceira(orgId),
      getContasAbertas(orgId),
      getRegrasRepasse(orgId),
      getPrecos(orgId),
      getProfissionais(orgId),
    ]);
    const resumoDe = (m: string) => {
      const r = receitas.filter((l) => l.data_competencia.startsWith(m));
      const d = despesas.filter((x) => x.vencimento.startsWith(m));
      return resumoMes(r, d, config, calcularRepasses(r, regras).reduce((s, x) => s + x.valor, 0));
    };
    const hojeStr = hojeIso();
    const series = meses.map(resumoDe);
    financeiro = {
      atual: resumoDe(mes),
      anterior: resumoDe(mesAnterior(mes)),
      serieFaturamento: series.map((s) => s.receitaBruta),
      serieLucro: series.map((s) => s.lucro),
      previstoHoje: hoje.filter((c) => c.status !== "cancelada").reduce((s, c) => s + n(c.valor), 0),
      recebidoHoje: receitas.filter((l) => l.status === "recebido" && l.data_recebimento === hojeStr).reduce((s, l) => s + bruto(l), 0),
      saldoCaixa: n(config?.saldo_inicial),
      metaLucro: config?.meta_lucro ? n(config.meta_lucro) : null,
    };

    // Painel principal: ritmo do mês, hoje, reservas e composição
    const [ano, mesNum] = mes.split("-").map(Number);
    const diasNoMes = new Date(ano, mesNum, 0).getDate();
    const mesAnt = mesAnterior(mes);
    const validasR = receitas.filter((l) => l.status !== "cancelado");
    const porDia = (m: string, d: number) =>
      validasR.filter((l) => l.data_competencia === `${m}-${String(d).padStart(2, "0")}`).reduce((s, l) => s + bruto(l), 0);
    const diaHoje = agora.getDate();
    let acA = 0;
    let acB = 0;
    const ritmo = Array.from({ length: diasNoMes }, (_, i) => {
      const d = i + 1;
      acB += porDia(mesAnt, d);
      if (d <= diaHoje) acA += porDia(mes, d);
      return { dia: d, atual: d <= diaHoje ? acA : null, anterior: acB };
    });
    const doMesR = validasR.filter((l) => l.data_competencia.startsWith(mes));
    const cobrados = doMesR.filter((l) => bruto(l) > 0);
    const futuras = minhas.filter((c) => new Date(c.data_hora) >= agora && c.status !== "cancelada");
    const proximos14 = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(hoje0);
      d.setDate(d.getDate() + i);
      const doDia = minhas.filter((c) => new Date(c.data_hora).toDateString() === d.toDateString() && c.status !== "cancelada");
      return {
        rotulo: i === 0 ? "hoje" : `${d.getDate()}/${d.getMonth() + 1}`,
        confirmadas: doDia.filter((c) => c.status === "confirmada" || c.status === "realizada").length,
        aConfirmar: doDia.filter((c) => c.status === "pendente").length,
      };
    });
    const profs = new Map<string, { valor: number; atendimentos: number }>();
    for (const l of doMesR) {
      if (!l.medico_id) continue;
      const a = profs.get(l.medico_id) ?? { valor: 0, atendimentos: 0 };
      a.valor += bruto(l);
      a.atendimentos += 1;
      profs.set(l.medico_id, a);
    }
    painelNumeros = {
      ritmo,
      // Mês inteiro por competência, como no financeiro: inclui o que já está agendado
      faturamentoMes: doMesR.reduce((s, l) => s + bruto(l), 0),
      anteriorMesmoDia: ritmo[Math.min(diaHoje, diasNoMes) - 1]?.anterior ?? 0,
      anteriorTotal: acB,
      faturamentoHoje: porDia(mes, diaHoje),
      recebidoMes: doMesR.filter((l) => l.status === "recebido").reduce((s, l) => s + bruto(l), 0),
      aReceberMes: doMesR.filter((l) => l.status !== "recebido").reduce((s, l) => s + bruto(l), 0),
      serieTicket: series.map((s) => s.ticketMedio),
      ateHoje: acA,
      ticketMedio: cobrados.length ? cobrados.reduce((s, l) => s + bruto(l), 0) / cobrados.length : 0,
      reservas: {
        quantidade: futuras.length,
        valor: futuras.reduce((s, c) => s + n(c.valor), 0),
        confirmadas: futuras.filter((c) => c.status === "confirmada").length,
      },
      proximos14,
      status: {
        confirmadas: doMes.filter((c) => c.status === "confirmada").length,
        pendentes: doMes.filter((c) => c.status === "pendente").length,
        realizadas: doMes.filter((c) => c.status === "realizada").length,
        canceladas: doMes.filter((c) => c.status === "cancelada").length,
      },
      tipos: {
        primeira: doMes.filter((c) => c.status !== "cancelada" && c.tipo === "primeira").length,
        retorno: doMes.filter((c) => c.status !== "cancelada" && c.tipo === "retorno").length,
        teleconsulta: doMes.filter((c) => c.status !== "cancelada" && c.tipo === "teleconsulta").length,
      },
      novosPacientes: doMes.filter((c) => c.status !== "cancelada" && c.tipo === "primeira").length,
      porProfissional: [...profs.entries()].map(([medicoId, v]) => ({ medicoId, ...v })).sort((a, b) => b.valor - a.valor),
    };

    // Pendências do dinheiro, no topo da lista quando vencidas
    if (instalado) {
      const vencidas = contas.filter((c) => c.vencimento < hojeStr);
      const semana7 = contas.filter((c) => c.vencimento >= hojeStr && c.vencimento <= somarDias(hojeStr, 7));
      const semPagamento = receitas.filter(
        (l) => l.origem === "agenda" && l.status === "previsto" && l.forma_pagamento !== "convenio" && l.data_competencia < hojeStr && bruto(l) > 0
      );
      if (vencidas.length)
        pendencias.unshift({
          chave: "contas-vencidas",
          titulo: `${vencidas.length} conta${vencidas.length > 1 ? "s" : ""} vencida${vencidas.length > 1 ? "s" : ""}`,
          detalhe: `${fmtReais(vencidas.reduce((s, c) => s + n(c.valor), 0))} esperando pagamento.`,
          href: "/app/financeiro/despesas",
          quantidade: vencidas.length,
          urgente: true,
        });
      if (semPagamento.length)
        pendencias.push({
          chave: "sem-pagamento",
          titulo: `${semPagamento.length} atendimento${semPagamento.length > 1 ? "s" : ""} sem pagamento registrado`,
          detalhe: `${fmtReais(semPagamento.reduce((s, l) => s + bruto(l), 0))} de consultas que já aconteceram.`,
          href: "/app/financeiro/receitas",
          quantidade: semPagamento.length,
          urgente: false,
        });
      if (semana7.length)
        pendencias.push({
          chave: "contas-semana",
          titulo: `${semana7.length} conta${semana7.length > 1 ? "s" : ""} vence${semana7.length > 1 ? "m" : ""} nesta semana`,
          detalhe: `${fmtReais(semana7.reduce((s, c) => s + n(c.valor), 0))} nos próximos 7 dias.`,
          href: "/app/financeiro/despesas",
          quantidade: semana7.length,
          urgente: false,
        });
    }

    // Primeiros passos de uma clínica recém-chegada
    const [formulario, temConsulta] = await Promise.all([
      getMeuFormulario(profile, SLUG_DIAGNOSTICO).catch(() => null),
      existeConsulta(orgId),
    ]);
    checklist = [
      { chave: "logo", titulo: "Enviar a logo da clínica", detalhe: "Aparece no painel, nos e-mails e na página do paciente.", href: "/app/configuracoes", feito: !!org?.logo_url },
      { chave: "whatsapp", titulo: "Conectar o WhatsApp", detalhe: "Para os lembretes e avisos saírem sozinhos.", href: "/app/configuracoes", feito: !!org?.merge_connection_id },
      { chave: "equipe", titulo: "Cadastrar a equipe", detalhe: "Médicos e atendentes com acesso próprio.", href: "/app/configuracoes", feito: profissionais.length > 1 },
      { chave: "precos", titulo: "Preencher a tabela de preços", detalhe: "O valor entra sozinho em cada consulta.", href: "/app/financeiro/configuracoes", feito: precos.length > 0 },
      { chave: "caixa", titulo: "Informar o saldo em caixa", detalhe: "Base da previsão de caixa.", href: "/app/financeiro/configuracoes", feito: n(config?.saldo_inicial) !== 0 },
      {
        chave: "diagnostico",
        titulo: "Responder o diagnóstico",
        detalhe: "Ponto de partida do plano com a Medi Marketing.",
        href: "/app/diagnostico",
        feito: !formulario || formulario.resposta.status !== "rascunho",
      },
      { chave: "consulta", titulo: "Marcar a primeira consulta", detalhe: "A agenda dispara confirmação e financeiro.", href: "/app/agenda?novo=1", feito: temConsulta },
    ];
  }

  const repasses = role === "medico" ? await getMeusRepasses(profile.id) : [];

  return { pendencias, hoje, proximos, semana, indicadores, plano, consultasMes, financeiro, checklist, repasses, painel: painelNumeros };
}

async function existeConsulta(orgId: string): Promise<boolean> {
  if (await emModoDemo()) return true;
  const supabase = await createClient();
  const { count } = await supabase.from("consultas").select("id", { count: "exact", head: true }).eq("organization_id", orgId).limit(1);
  return (count ?? 0) > 0;
}

function fmtReais(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

/* ============================== AGÊNCIA ============================== */

export type LinhaCarteira = {
  id: string;
  nome: string;
  logo: string | null;
  plano: string;
  mensalidade: number | null;
  faturamento: number;
  leads: number;
  consultas: number;
  risco: Risco | null;
  ultimoAcesso: string | null;
  checkinPendente: boolean;
};

export type DadosAgencia = {
  pendencias: PendenciaPainel[];
  ind: Indicadores;
  serieMrr: number[];
  inadimplencia: number;
  inadimplentes: number;
  carteira: LinhaCarteira[];
  resultado: { meses: string[]; faturamento: number[]; investimento: number[]; leads: number[] };
  propostas: { abertas: number; valor: number; vistas: number };
  faturamentoCarteira: number;
};

export async function dadosAgencia(): Promise<DadosAgencia> {
  const agora = new Date();
  const mes = mesDe(agora);
  const meses = ultimosMeses(mes, 12);
  const [painel, agencia, clientes, usuarios, propostas, formularios] = await Promise.all([
    getPainel("super_admin", null),
    getAgencia(),
    getClientes(),
    getUsuarios({ organizationId: null, ehSuperAdmin: true }),
    getPropostas().catch(() => []),
    getFormulariosAdmin(SLUG_DIAGNOSTICO).catch(() => []),
  ]);
  const { contratos, eventos, faturas } = agencia;
  const hoje = hojeIso();
  const ativos = clientes.filter((c) => c.ativo);

  // Indicadores mensais de cada clínica ativa (carteira pequena: em paralelo)
  const porClinica = await Promise.all(ativos.map((c) => getIndicadores(c.id, 13).catch(() => [] as IndicadorMensal[])));
  const mesPassado = `${mesAnterior(mes)}-01`;

  const acesso = new Map<string, string>();
  for (const u of usuarios) {
    if (!u.organization_id || !u.ultimo_acesso) continue;
    const a = acesso.get(u.organization_id);
    if (!a || u.ultimo_acesso > a) acesso.set(u.organization_id, u.ultimo_acesso);
  }

  const contratoDe = (orgId: string) => contratos.find((c) => c.organization_id === orgId && c.status !== "cancelado") ?? null;

  const carteira: LinhaCarteira[] = ativos
    .map((c, i) => {
      const ct: Contrato | null = contratoDe(c.id);
      const ua = acesso.get(c.id) ?? null;
      const dias = ua ? Math.round((Date.parse(hoje) - Date.parse(ua.slice(0, 10))) / 86400000) : null;
      const inds = porClinica[i];
      const ult = inds.filter((x) => x.mes < `${mes}-01`).slice(-2);
      const retornoCaindo =
        ult.length === 2 && n(ult[0].investimento) > 0 && n(ult[1].investimento) > 0
          ? n(ult[1].faturamento) / n(ult[1].investimento) < (n(ult[0].faturamento) / n(ult[0].investimento)) * 0.85
          : false;
      return {
        id: c.id,
        nome: c.nome,
        logo: c.logo_url,
        plano: ct?.plano ?? c.plano,
        mensalidade: ct ? n(ct.mensalidade) : null,
        faturamento: n(c.faturamento_mes),
        leads: n(c.leads_mes),
        consultas: n(c.consultas_mes),
        risco: ct ? riscoDoCliente(ct, faturas, { diasSemAcesso: dias, retornoCaindo }) : null,
        ultimoAcesso: ua,
        checkinPendente: !inds.some((x) => x.mes === mesPassado),
      };
    })
    .sort((a, b) => (b.risco?.pontos ?? 0) - (a.risco?.pontos ?? 0) || b.faturamento - a.faturamento);

  // Soma do que as clínicas da carteira faturaram, mês a mês
  const resultado = {
    meses,
    faturamento: meses.map((m) => porClinica.reduce((s, l) => s + n(l.find((x) => x.mes.startsWith(m))?.faturamento), 0)),
    investimento: meses.map((m) => porClinica.reduce((s, l) => s + n(l.find((x) => x.mes.startsWith(m))?.investimento), 0)),
    leads: meses.map((m) => porClinica.reduce((s, l) => s + n(l.find((x) => x.mes.startsWith(m))?.leads), 0)),
  };

  const fat = resumoFaturas(faturas, mes);
  const pendencias = [...painel.pendencias];
  const vencidas = faturas.filter((f) => vencida(f, hoje));
  if (vencidas.length)
    pendencias.unshift({
      chave: "faturas-vencidas",
      titulo: `${vencidas.length} fatura${vencidas.length > 1 ? "s" : ""} vencida${vencidas.length > 1 ? "s" : ""}`,
      detalhe: `${fmtReais(fat.vencido)} de ${fat.clientesInadimplentes} cliente${fat.clientesInadimplentes > 1 ? "s" : ""} para cobrar.`,
      href: "/app/admin/financeiro/faturas",
      quantidade: vencidas.length,
      urgente: true,
    });
  const altos = carteira.filter((c) => c.risco?.nivel === "alto");
  if (altos.length)
    pendencias.unshift({
      chave: "risco-alto",
      titulo: `${altos.length} cliente${altos.length > 1 ? "s" : ""} com risco alto de saída`,
      detalhe: altos.map((c) => c.nome).slice(0, 3).join(", "),
      href: "/app/admin/financeiro/clientes",
      quantidade: altos.length,
      urgente: true,
    });
  const renovar = contratos.filter((c) => c.status === "ativo" && c.fidelidade_meses && fimFidelidade(c) >= hoje && fimFidelidade(c) <= somarDias(hoje, 60));
  if (renovar.length)
    pendencias.push({
      chave: "renovacoes",
      titulo: `${renovar.length} renovaç${renovar.length > 1 ? "ões" : "ão"} de contrato em 60 dias`,
      detalhe: "Fidelidades terminando: bom momento para a reunião de resultado.",
      href: "/app/admin/financeiro/contratos",
      quantidade: renovar.length,
      urgente: false,
    });
  const semCheckin = carteira.filter((c) => c.checkinPendente);
  if (semCheckin.length)
    pendencias.push({
      chave: "checkins",
      titulo: `${semCheckin.length} check-in${semCheckin.length > 1 ? "s" : ""} do mês passado sem lançar`,
      detalhe: semCheckin.map((c) => c.nome).slice(0, 3).join(", "),
      href: "/app/clinicas",
      quantidade: semCheckin.length,
      urgente: false,
    });
  const aRevisar = formularios.filter((f) => f.status === "enviado");
  if (aRevisar.length)
    pendencias.push({
      chave: "diagnosticos",
      titulo: `${aRevisar.length} diagnóstico${aRevisar.length > 1 ? "s" : ""} esperando revisão`,
      detalhe: aRevisar.map((f) => f.clinica).slice(0, 3).join(", "),
      href: "/app/admin/diagnosticos",
      quantidade: aRevisar.length,
      urgente: false,
    });

  const abertas = propostas.filter((p) => p.status === "enviada" || p.status === "vista");
  const precoDestaque = (p: (typeof propostas)[number]) =>
    n(p.plano_destaque === "full" ? p.preco_full : p.plano_destaque === "performance" ? p.preco_performance : p.preco_essencial);

  return {
    pendencias,
    ind: indicadoresAgencia(contratos, eventos, mes),
    serieMrr: serieMrr(eventos, meses).map((p) => p.mrr),
    inadimplencia: fat.vencido,
    inadimplentes: fat.clientesInadimplentes,
    carteira,
    resultado,
    propostas: { abertas: abertas.length, valor: abertas.reduce((s, p) => s + precoDestaque(p), 0), vistas: abertas.filter((p) => p.status === "vista").length },
    faturamentoCarteira: ativos.reduce((s, c) => s + n(c.faturamento_mes), 0),
  };
}


