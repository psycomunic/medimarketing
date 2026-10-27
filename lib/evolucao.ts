/**
 * EVOLUÇÃO DO CLIENTE
 *
 * O diagnóstico é o marco zero: os três meses que a clínica informou
 * viram a base, e cada mês lançado depois é comparado com ela e com a
 * meta combinada. Funções puras — servem ao painel da clínica, ao
 * detalhe da carteira e à tela de importação.
 */
import { calcularKpis, variacao, type Kpis } from "@/lib/indicadores";
import { inteiro, lerValor, type ValorLido } from "@/lib/formularios/numeros";
import {
  linhasMensais,
  valorMensal,
  valorTexto,
  type CampoMensal,
  type Respostas,
  type SchemaFormulario,
} from "@/lib/formularios/tipos";
import type { IndicadorMensal, PlanoCliente } from "@/lib/supabase/types";

/* ------------------------------------------------------------------ */
/* Importação                                                          */
/* ------------------------------------------------------------------ */

export type CampoIndicador =
  | "faturamento"
  | "investimento"
  | "leads"
  | "agendamentos"
  | "comparecimentos"
  | "pacientes_unicos"
  | "novos_pacientes"
  | "atendimentos"
  | "ticket_medio"
  | "gasto_medio_paciente";

/** Linha do diagnóstico → coluna de `indicadores_mensais`. */
export const CAMPOS_IMPORTACAO: {
  linha: string;
  campo: CampoIndicador;
  rotulo: string;
  moeda: boolean;
  /** Coluna obrigatória no banco: "não medimos" grava zero e fica marcado. */
  obrigatorio: boolean;
}[] = [
  { linha: "faturamento_total", campo: "faturamento", rotulo: "Faturamento total", moeda: true, obrigatorio: true },
  { linha: "investimento_anuncios", campo: "investimento", rotulo: "Investimento em anúncios", moeda: true, obrigatorio: true },
  { linha: "novos_interessados", campo: "leads", rotulo: "Novos interessados (leads)", moeda: false, obrigatorio: true },
  { linha: "consultas_agendadas", campo: "agendamentos", rotulo: "Primeiras consultas agendadas", moeda: false, obrigatorio: true },
  { linha: "consultas_realizadas", campo: "comparecimentos", rotulo: "Primeiras consultas realizadas", moeda: false, obrigatorio: true },
  { linha: "pacientes_unicos", campo: "pacientes_unicos", rotulo: "Pacientes únicos", moeda: false, obrigatorio: false },
  { linha: "novos_pacientes", campo: "novos_pacientes", rotulo: "Novos pacientes", moeda: false, obrigatorio: false },
  { linha: "total_atendimentos", campo: "atendimentos", rotulo: "Total de atendimentos", moeda: false, obrigatorio: false },
  { linha: "ticket_medio", campo: "ticket_medio", rotulo: "Ticket médio por atendimento", moeda: true, obrigatorio: false },
  { linha: "gasto_medio_paciente", campo: "gasto_medio_paciente", rotulo: "Gasto médio por paciente", moeda: true, obrigatorio: false },
];

export type CelulaImportacao = ValorLido & { texto: string };

export type MesImportacao = {
  /** "YYYY-MM-01" */
  mes: string;
  campos: Record<CampoIndicador, CelulaImportacao>;
  receitas: Record<string, CelulaImportacao>;
};

/** Os meses da Etapa 05, já lidos como número, para a equipe revisar. */
export function propostaImportacao(
  schema: SchemaFormulario,
  respostas: Respostas
): MesImportacao[] {
  const campo = schema.etapas
    .flatMap((e) => e.campos)
    .find((c): c is CampoMensal => c.tipo === "tabela_mensal");
  if (!campo) return [];

  const valor = valorMensal(respostas, campo);
  const linhas = linhasMensais(schema, respostas, campo);

  return valor.meses
    .map((mes, i) => {
      if (!/^\d{4}-\d{2}$/.test(mes)) return null;
      const celula = (chave: string, contagem: boolean): CelulaImportacao => {
        const texto = valor.linhas[chave]?.[i] ?? "";
        const lido = lerValor(texto);
        return { ...(contagem ? inteiro(lido) : lido), texto };
      };

      const campos = {} as Record<CampoIndicador, CelulaImportacao>;
      for (const c of CAMPOS_IMPORTACAO) campos[c.campo] = celula(c.linha, !c.moeda);

      const receitas: Record<string, CelulaImportacao> = {};
      for (const l of linhas) {
        const [tabela, ...nome] = l.chave.split(":");
        if (nome.length && tabela) receitas[nome.join(":")] = celula(l.chave, false);
      }

      return { mes: `${mes}-01`, campos, receitas };
    })
    .filter((m): m is MesImportacao => m !== null)
    .sort((a, b) => a.mes.localeCompare(b.mes));
}

/** O que o diagnóstico já diz sobre o plano, para a equipe partir dali. */
export function planoSugerido(respostas: Respostas) {
  const meta = valorTexto(respostas, "meta_faturamento");
  return {
    metaTexto: meta,
    metaSugerida: lerValor(meta).valor,
    criterio: valorTexto(respostas, "fonte_dados"),
    prioridades: valorTexto(respostas, "servicos_prioritarios"),
    obstaculo: valorTexto(respostas, "principal_obstaculo"),
  };
}

/* ------------------------------------------------------------------ */
/* Comparação com o marco zero                                         */
/* ------------------------------------------------------------------ */

export type Comparacao = {
  rotulo: string;
  base: number;
  atual: number;
  variacao: number;
  moeda: boolean;
  /** Em percentual (taxa de conversão). */
  percentual?: boolean;
  estimado: boolean;
};

export type Evolucao = {
  /** Meses que formam o marco zero. */
  base: IndicadorMensal[];
  /** Média mensal do marco zero. */
  mediaBase: Kpis;
  /** Último mês lançado depois do marco zero (nulo se ainda não houver). */
  atual: IndicadorMensal | null;
  kpiAtual: Kpis | null;
  comparacoes: Comparacao[];
  meta: {
    valor: number;
    atual: number;
    base: number;
    /** 0 a 100: quanto do caminho entre a base e a meta já foi feito. */
    progresso: number;
    prazo: string | null;
  } | null;
  receitas: { servico: string; base: number; atual: number | null }[];
  mesesDepois: number;
};

/** Média mensal: soma os meses e divide as grandezas pela quantidade. */
function media(meses: IndicadorMensal[]): Kpis {
  const k = calcularKpis(meses);
  const n = Math.max(meses.length, 1);
  return {
    ...k,
    investimento: k.investimento / n,
    leads: k.leads / n,
    agendamentos: k.agendamentos / n,
    comparecimentos: k.comparecimentos / n,
    faturamento: k.faturamento / n,
  };
}

const estimado = (m: IndicadorMensal | null | undefined, campo: string) =>
  !!m?.campos_estimados?.includes(campo);

export function calcularEvolucao(
  meses: IndicadorMensal[],
  plano: PlanoCliente | null
): Evolucao | null {
  if (!plano?.base_inicio || !plano.base_fim) return null;
  const ini = plano.base_inicio;
  const fim = plano.base_fim;

  const emOrdem = [...meses].sort((a, b) => a.mes.localeCompare(b.mes));
  const base = emOrdem.filter((m) => m.mes >= ini && m.mes <= fim);
  if (base.length === 0) return null;

  const depois = emOrdem.filter((m) => m.mes > fim);
  const atual = depois[depois.length - 1] ?? null;
  const mediaBase = media(base);
  const kpiAtual = atual ? calcularKpis([atual]) : null;

  const baseEstimada = (campo: string) => base.some((m) => estimado(m, campo));

  const comparacoes: Comparacao[] = kpiAtual
    ? [
        { rotulo: "Faturamento", base: mediaBase.faturamento, atual: kpiAtual.faturamento, moeda: true, campo: "faturamento" },
        { rotulo: "Leads", base: mediaBase.leads, atual: kpiAtual.leads, moeda: false, campo: "leads" },
        { rotulo: "Consultas agendadas", base: mediaBase.agendamentos, atual: kpiAtual.agendamentos, moeda: false, campo: "agendamentos" },
        { rotulo: "Consultas realizadas", base: mediaBase.comparecimentos, atual: kpiAtual.comparecimentos, moeda: false, campo: "comparecimentos" },
      ]
        .map((c): Comparacao => ({
          rotulo: c.rotulo,
          base: c.base,
          atual: c.atual,
          moeda: c.moeda,
          variacao: variacao(c.atual, c.base),
          estimado: baseEstimada(c.campo) || estimado(atual, c.campo),
        }))
        .concat({
          rotulo: "Lead que vira consulta",
          base: mediaBase.taxaLeadPaciente,
          atual: kpiAtual.taxaLeadPaciente,
          moeda: false,
          percentual: true,
          variacao: kpiAtual.taxaLeadPaciente - mediaBase.taxaLeadPaciente,
          estimado: baseEstimada("leads") || baseEstimada("comparecimentos"),
        })
    : [];

  const metaValor = plano.meta_faturamento ? Number(plano.meta_faturamento) : null;
  const ultimoFaturamento = Number((atual ?? base[base.length - 1]).faturamento);
  const meta =
    metaValor && metaValor > 0
      ? {
          valor: metaValor,
          atual: ultimoFaturamento,
          base: mediaBase.faturamento,
          progresso:
            metaValor > mediaBase.faturamento
              ? Math.max(0, Math.min(100, ((ultimoFaturamento - mediaBase.faturamento) / (metaValor - mediaBase.faturamento)) * 100))
              : ultimoFaturamento >= metaValor
                ? 100
                : 0,
          prazo: plano.prazo,
        }
      : null;

  const servicos = new Set<string>();
  for (const m of [...base, ...(atual ? [atual] : [])]) {
    for (const s of Object.keys(m.receitas_servico ?? {})) servicos.add(s);
  }
  const receitas = [...servicos]
    .map((servico) => ({
      servico,
      base: base.reduce((s, m) => s + Number(m.receitas_servico?.[servico] ?? 0), 0) / base.length,
      atual: atual ? Number(atual.receitas_servico?.[servico] ?? 0) : null,
    }))
    .filter((r) => r.base > 0 || (r.atual ?? 0) > 0)
    .sort((a, b) => (b.atual ?? b.base) - (a.atual ?? a.base));

  return { base, mediaBase, atual, kpiAtual, comparacoes, meta, receitas, mesesDepois: depois.length };
}
