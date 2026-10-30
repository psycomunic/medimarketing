import { bruto } from "@/lib/financeiro/calculos";
import { catalogoServicos, type Servico } from "@/lib/servicos";
import { textoValor } from "@/lib/financeiro/precos";
import { rotuloTipo } from "@/lib/agenda";
import type { Consulta, Lancamento, PrecoProcedimento } from "@/lib/supabase/types";

/**
 * SERVIÇOS: PROCURA E RENDA
 *
 * Junta consultas (procura) e receitas (dinheiro) por serviço da Tabela
 * de preços. A consulta diz o serviço pelo `servico_id`; a receita, pelo
 * `servico_id` ou, nas lançadas à mão e nas antigas, pelo nome do
 * procedimento quando ele bate com um serviço da tabela.
 */

export const SEM_SERVICO = "__sem";

export type LinhaServico = {
  chave: string;
  nome: string;
  categoria: string | null;
  /** Existe na Tabela de preços (os outros vêm de receitas lançadas com outro nome). */
  naTabela: boolean;
  precoTabela: string | null;
  marcadas: number;
  realizadas: number;
  faltas: number;
  canceladas: number;
  taxaFaltas: number | null;
  faturamento: number;
  atendimentos: number;
  ticket: number;
  custo: number;
  margem: number | null;
  participacao: number;
  /** Faturamento contra o mesmo trecho do período anterior. */
  variacao: number | null;
  futuras: number;
  valorFuturo: number;
  /** Primeiras consultas: o serviço como porta de entrada. */
  novos: number;
  /** Dos novos que já foram atendidos, quantos marcaram de novo. */
  voltaram: number;
  novosAtendidos: number;
  /** Serviço mais comum na volta. */
  depois: string | null;
};

export type AnaliseServicos = {
  linhas: LinhaServico[];
  faturamento: number;
  marcadas: number;
  ticket: number;
  margem: number | null;
  futuras: number;
  valorFuturo: number;
  /** Consultas do período sem serviço definido (antes da Fase 1, ou "outro"). */
  semServico: number;
  /** Procura por dia da semana (domingo = 0) e por hora do dia. */
  porDiaSemana: number[];
  porHora: { hora: number; n: number }[];
  /** Faturamento mês a mês dos principais serviços. */
  mensal: { meses: string[]; series: { chave: string; nome: string; valores: number[] }[] };
  /** Faturamento por serviço × profissional e × convênio. */
  porProfissional: Matriz;
  porConvenio: Matriz;
};

export type Matriz = { colunas: string[]; linhas: { nome: string; valores: number[]; total: number }[] };

const chaveNome = (s: string) => s.trim().toLocaleLowerCase("pt-BR");
const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const ativa = (c: Consulta) => c.status !== "cancelada" && c.status !== "faltou";
const ROTULOS_TIPO = new Set(Object.values(rotuloTipo).map(chaveNome));

/** Quem é o paciente, para saber se voltou. */
function chavePaciente(c: Consulta): string {
  if (c.paciente_id) return `p:${c.paciente_id}`;
  const tel = (c.paciente_telefone ?? "").replace(/\D/g, "");
  if (tel.length >= 8) return `t:${tel.slice(-8)}`;
  return `n:${chaveNome(c.paciente_nome)}`;
}

export function analisarServicos({
  precos,
  consultas,
  receitas,
  ini,
  fim,
  antIni,
  agora,
  nomesProfissionais,
}: {
  precos: PrecoProcedimento[];
  /** Do começo do período até uns meses à frente (para "voltaram" e agendados). */
  consultas: Consulta[];
  /** Do começo da série mensal (12 meses) até o fim do período. */
  receitas: Lancamento[];
  ini: Date;
  fim: Date;
  antIni: Date;
  agora: Date;
  nomesProfissionais: Record<string, string>;
}): AnaliseServicos {
  const catalogo = catalogoServicos(precos);
  const porId = new Map<string, Servico>();
  const porNome = new Map<string, Servico>();
  for (const s of catalogo) {
    porNome.set(chaveNome(s.nome), s);
    for (const l of s.linhas) porId.set(l.id, s);
  }

  /* ---------- Identifica o serviço de cada consulta e receita ---------- */
  const servicoDaConsulta = (c: Consulta): { chave: string; nome: string; s: Servico | null } => {
    const s = (c.servico_id && porId.get(c.servico_id)) || (c.servico_nome && porNome.get(chaveNome(c.servico_nome))) || null;
    if (s) return { chave: s.id, nome: s.nome, s };
    if (c.servico_nome?.trim()) return { chave: `n:${chaveNome(c.servico_nome)}`, nome: c.servico_nome.trim(), s: null };
    return { chave: SEM_SERVICO, nome: "Sem serviço definido", s: null };
  };
  const servicoDaReceita = (l: Lancamento): { chave: string; nome: string; s: Servico | null } => {
    const s = l.servico_id ? porId.get(l.servico_id) : undefined;
    if (s) return { chave: s.id, nome: s.nome, s };
    const base = (l.procedimento ?? "").split(" · ")[0].trim();
    const pelo = porNome.get(chaveNome(base)) ?? porNome.get(chaveNome(l.procedimento ?? ""));
    if (pelo) return { chave: pelo.id, nome: pelo.nome, s: pelo };
    // Receita da agenda sem serviço vem como "Primeira consulta · ...": não é um serviço
    if (!base || l.origem === "agenda" || ROTULOS_TIPO.has(chaveNome(base))) return { chave: SEM_SERVICO, nome: "Sem serviço definido", s: null };
    return { chave: `n:${chaveNome(base)}`, nome: base, s: null };
  };

  const amanha0 = new Date(agora);
  amanha0.setHours(0, 0, 0, 0);
  amanha0.setDate(amanha0.getDate() + 1);
  const corte = fim < amanha0 ? fim : amanha0;
  const dias = Math.max(Math.round((corte.getTime() - ini.getTime()) / 864e5), 0);
  const antFim = new Date(antIni);
  antFim.setDate(antFim.getDate() + dias);
  const [a, b, aCorte, antA, antB] = [iso(ini), iso(fim), iso(corte), iso(antIni), iso(antFim)];

  const validas = receitas.filter((l) => l.status !== "cancelado");
  const doPeriodo = validas.filter((l) => l.data_competencia >= a && l.data_competencia < b);
  const consultasPeriodo = consultas.filter((c) => {
    const d = new Date(c.data_hora);
    return d >= ini && d < fim;
  });

  const linhas = new Map<string, LinhaServico>();
  const linha = (id: { chave: string; nome: string; s: Servico | null }) => {
    let l = linhas.get(id.chave);
    if (!l) {
      const particular = id.s ? id.s.linhas.find((x) => !x.convenio) ?? id.s.linhas[0] : null;
      l = {
        chave: id.chave,
        nome: id.nome,
        categoria: id.s?.categoria ?? null,
        naTabela: !!id.s,
        precoTabela: particular && (Number(particular.valor) || particular.valor_max) ? textoValor(particular) : null,
        marcadas: 0,
        realizadas: 0,
        faltas: 0,
        canceladas: 0,
        taxaFaltas: null,
        faturamento: 0,
        atendimentos: 0,
        ticket: 0,
        custo: 0,
        margem: null,
        participacao: 0,
        variacao: null,
        futuras: 0,
        valorFuturo: 0,
        novos: 0,
        voltaram: 0,
        novosAtendidos: 0,
        depois: null,
      };
      linhas.set(id.chave, l);
    }
    return l;
  };
  // Todo serviço da tabela aparece, mesmo sem movimento: mostra o que não vende
  for (const s of catalogo) linha({ chave: s.id, nome: s.nome, s });

  /* ---------- Procura ---------- */
  const porDiaSemana = [0, 0, 0, 0, 0, 0, 0];
  const horas = new Map<number, number>();
  for (const c of consultasPeriodo) {
    const l = linha(servicoDaConsulta(c));
    if (c.status === "cancelada") l.canceladas += 1;
    else {
      l.marcadas += 1;
      const d = new Date(c.data_hora);
      porDiaSemana[d.getDay()] += 1;
      horas.set(d.getHours(), (horas.get(d.getHours()) ?? 0) + 1);
    }
    if (c.status === "realizada") l.realizadas += 1;
    if (c.status === "faltou") l.faltas += 1;
  }

  /* ---------- Agenda à frente (fica fora do recorte: é o que vem) ---------- */
  const fimFuturo = new Date(agora.getTime() + 30 * 864e5);
  for (const c of consultas) {
    const d = new Date(c.data_hora);
    if (d < agora || d >= fimFuturo || !ativa(c)) continue;
    const l = linha(servicoDaConsulta(c));
    l.futuras += 1;
    l.valorFuturo += Number(c.valor ?? 0) || 0;
  }

  /* ---------- Dinheiro ---------- */
  for (const r of doPeriodo) {
    const l = linha(servicoDaReceita(r));
    const v = bruto(r);
    l.faturamento += v;
    l.custo += Number(r.custo ?? 0) || 0;
    if (v > 0) l.atendimentos += 1;
  }
  const antes = new Map<string, number>();
  const atual = new Map<string, number>();
  for (const r of validas) {
    if (r.data_competencia >= antA && r.data_competencia < antB) {
      const k = servicoDaReceita(r).chave;
      antes.set(k, (antes.get(k) ?? 0) + bruto(r));
    } else if (r.data_competencia >= a && r.data_competencia < aCorte) {
      const k = servicoDaReceita(r).chave;
      atual.set(k, (atual.get(k) ?? 0) + bruto(r));
    }
  }
  // Sem lançamentos desde o começo do período anterior, a comparação engana
  const primeiro = validas.reduce((m, l) => (l.data_competencia < m ? l.data_competencia : m), "9999-12-31");
  const comparavel = dias > 0 && primeiro <= iso(new Date(antIni.getTime() + 7 * 864e5));

  /* ---------- Porta de entrada: quem chegou por este serviço voltou? ---------- */
  const historia = new Map<string, Consulta[]>();
  for (const c of [...consultas].sort((x, y) => x.data_hora.localeCompare(y.data_hora))) {
    if (!ativa(c)) continue;
    const k = chavePaciente(c);
    historia.set(k, [...(historia.get(k) ?? []), c]);
  }
  const depoisDe = new Map<string, Map<string, number>>();
  for (const c of consultasPeriodo) {
    if (c.tipo !== "primeira" || !ativa(c)) continue;
    const id = servicoDaConsulta(c);
    const l = linha(id);
    l.novos += 1;
    if (c.status !== "realizada") continue;
    l.novosAtendidos += 1;
    const seguinte = (historia.get(chavePaciente(c)) ?? []).find((x) => x.data_hora > c.data_hora && x.id !== c.id);
    if (seguinte) {
      l.voltaram += 1;
      const nome = servicoDaConsulta(seguinte).nome;
      const m = depoisDe.get(id.chave) ?? new Map<string, number>();
      m.set(nome, (m.get(nome) ?? 0) + 1);
      depoisDe.set(id.chave, m);
    }
  }

  /* ---------- Totais e derivados ---------- */
  const faturamento = [...linhas.values()].reduce((s, l) => s + l.faturamento, 0);
  for (const l of linhas.values()) {
    l.taxaFaltas = l.realizadas + l.faltas ? (l.faltas / (l.realizadas + l.faltas)) * 100 : null;
    l.ticket = l.atendimentos ? l.faturamento / l.atendimentos : 0;
    l.margem = l.faturamento > 0 ? ((l.faturamento - l.custo) / l.faturamento) * 100 : null;
    l.participacao = faturamento ? (l.faturamento / faturamento) * 100 : 0;
    const ant = antes.get(l.chave) ?? 0;
    l.variacao = comparavel && ant > 0 ? (((atual.get(l.chave) ?? 0) - ant) / ant) * 100 : null;
    const m = depoisDe.get(l.chave);
    l.depois = m ? [...m.entries()].sort((x, y) => y[1] - x[1])[0][0] : null;
  }
  const lista = [...linhas.values()]
    // "Sem serviço" só aparece se tiver movimento
    .filter((l) => l.chave !== SEM_SERVICO || l.marcadas + l.faturamento + l.futuras > 0)
    .sort((x, y) => y.faturamento - x.faturamento || y.marcadas - x.marcadas || x.nome.localeCompare(y.nome, "pt-BR"));

  const custo = lista.reduce((s, l) => s + l.custo, 0);
  const atendimentos = lista.reduce((s, l) => s + l.atendimentos, 0);

  /* ---------- Série mensal: 12 meses até o fim do período ---------- */
  const ultimoMes = new Date(fim.getTime() - 864e5);
  const meses = Array.from({ length: 12 }, (_, i) => iso(new Date(ultimoMes.getFullYear(), ultimoMes.getMonth() - 11 + i, 1)).slice(0, 7));
  const principais = lista.filter((l) => l.chave !== SEM_SERVICO && l.faturamento > 0).slice(0, 5);
  // A cor segue o serviço: ordem da tabela, não do ranking
  const ordemTabela = new Map(catalogo.map((s, i) => [s.id, i]));
  principais.sort((x, y) => (ordemTabela.get(x.chave) ?? 999) - (ordemTabela.get(y.chave) ?? 999) || x.nome.localeCompare(y.nome, "pt-BR"));
  const mensal = {
    meses,
    series: principais.map((p) => ({
      chave: p.chave,
      nome: p.nome,
      valores: meses.map((m) =>
        validas.filter((r) => r.data_competencia.startsWith(m) && servicoDaReceita(r).chave === p.chave).reduce((s, r) => s + bruto(r), 0)
      ),
    })),
  };

  /* ---------- Matrizes ---------- */
  const topo = lista.filter((l) => l.faturamento > 0).slice(0, 10);
  const matriz = (coluna: (r: Lancamento) => string, maxColunas: number): Matriz => {
    const somaCol = new Map<string, number>();
    for (const r of doPeriodo) somaCol.set(coluna(r), (somaCol.get(coluna(r)) ?? 0) + bruto(r));
    let colunas = [...somaCol.entries()].filter(([, v]) => v > 0).sort((x, y) => y[1] - x[1]).map(([k]) => k);
    const outras = colunas.length > maxColunas;
    if (outras) colunas = [...colunas.slice(0, maxColunas - 1), "Outros"];
    const idx = (k: string) => {
      const i = colunas.indexOf(k);
      return i >= 0 ? i : colunas.length - 1;
    };
    return {
      colunas,
      linhas: topo.map((t) => {
        const valores = colunas.map(() => 0);
        for (const r of doPeriodo) if (servicoDaReceita(r).chave === t.chave) valores[idx(coluna(r))] += bruto(r);
        return { nome: t.nome, valores, total: t.faturamento };
      }),
    };
  };
  const porProfissional = matriz((r) => (r.medico_id ? nomesProfissionais[r.medico_id] ?? "Outro profissional" : "Sem profissional"), 6);
  const porConvenio = matriz((r) => r.convenio?.trim() || (r.forma_pagamento === "convenio" ? "Convênio" : "Particular"), 5);

  return {
    linhas: lista,
    faturamento,
    marcadas: lista.reduce((s, l) => s + l.marcadas, 0),
    ticket: atendimentos ? faturamento / atendimentos : 0,
    margem: faturamento > 0 ? ((faturamento - custo) / faturamento) * 100 : null,
    futuras: lista.reduce((s, l) => s + l.futuras, 0),
    valorFuturo: lista.reduce((s, l) => s + l.valorFuturo, 0),
    semServico: linhas.get(SEM_SERVICO)?.marcadas ?? 0,
    porDiaSemana,
    porHora: [...horas.entries()].sort((x, y) => x[0] - y[0]).map(([hora, n]) => ({ hora, n })),
    mensal,
    porProfissional,
    porConvenio,
  };
}
