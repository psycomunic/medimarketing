import type { PrecoProcedimento } from "@/lib/supabase/types";
import { temFaixa, textoDuracao, textoValor } from "@/lib/financeiro/precos";

/**
 * SERVIÇOS DA CLÍNICA
 *
 * Os serviços são os procedimentos da Tabela de preços. Cada um pode ter
 * uma linha particular e linhas por convênio; aqui eles viram uma lista
 * única para escolher na consulta, e o preço certo sai do convênio do
 * paciente.
 */

export type Servico = {
  /** Linha que representa o serviço: a particular, ou a primeira que houver. */
  id: string;
  nome: string;
  categoria: string | null;
  linhas: PrecoProcedimento[];
};

const chave = (s: string) => s.trim().toLocaleLowerCase("pt-BR");

/** Serviços únicos, em ordem de categoria e nome. */
export function catalogoServicos(precos: PrecoProcedimento[]): Servico[] {
  const mapa = new Map<string, Servico>();
  for (const p of precos) {
    if (p.ativo === false) continue;
    const k = chave(p.procedimento);
    const s = mapa.get(k);
    if (!s) mapa.set(k, { id: p.id, nome: p.procedimento.trim(), categoria: p.categoria, linhas: [p] });
    else {
      s.linhas.push(p);
      // A linha particular é a referência do serviço
      if (!p.convenio) {
        s.id = p.id;
        s.categoria = p.categoria ?? s.categoria;
      }
    }
  }
  return [...mapa.values()].sort(
    (a, b) => (a.categoria ?? "~").localeCompare(b.categoria ?? "~", "pt-BR") || a.nome.localeCompare(b.nome, "pt-BR")
  );
}

/** Por categoria, para listas agrupadas. */
export function porCategoria(servicos: Servico[]): [string, Servico[]][] {
  const grupos = new Map<string, Servico[]>();
  for (const s of servicos) {
    const c = s.categoria?.trim() || "Outros serviços";
    grupos.set(c, [...(grupos.get(c) ?? []), s]);
  }
  return [...grupos.entries()];
}

const ehParticular = (convenio: string | null | undefined) => !convenio || chave(convenio) === "particular";

/** Preço do serviço para o convênio do paciente; sem preço próprio, o particular. */
export function precoDoServico(s: Servico, convenio: string | null | undefined): PrecoProcedimento {
  const particular = s.linhas.find((l) => !l.convenio) ?? s.linhas[0];
  if (ehParticular(convenio)) return particular;
  return s.linhas.find((l) => l.convenio && chave(l.convenio) === chave(convenio!)) ?? particular;
}

/** "R$ 350 · 60 min" */
export function resumoPreco(p: PrecoProcedimento): string {
  return [Number(p.valor) || temFaixa(p) ? textoValor(p) : null, textoDuracao(p)].filter(Boolean).join(" · ");
}
