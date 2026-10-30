import { bruto } from "@/lib/financeiro/calculos";
import { catalogoServicos, type Servico } from "@/lib/servicos";
import { rotuloTipo } from "@/lib/agenda";
import type { Consulta, Lancamento, PrecoProcedimento } from "@/lib/supabase/types";

/**
 * CLASSIFICAR O PASSADO
 *
 * Consultas e receitas de antes dos serviços não dizem qual serviço foi.
 * Aqui elas viram grupos por texto parecido ("Retorno", "Primeira
 * consulta · dor lombar", "Quiropraxia"...), cada um com uma sugestão de
 * serviço da tabela, para o dono confirmar em lote.
 */

export type Confianca = "alta" | "media";

export type GrupoClassificar = {
  chave: string;
  texto: string;
  consultaIds: string[];
  /** Receitas avulsas (sem consulta) e as das consultas do grupo. */
  receitaIds: string[];
  consultas: number;
  receitas: number;
  valor: number;
  ultima: string;
  exemplos: string[];
  sugestao: string | null;
  confianca: Confianca | null;
};

const PALAVRAS_VAZIAS = new Set(["consulta", "sessao", "sessoes", "avaliacao", "primeira", "para", "com", "sem", "dos", "das", "de", "da", "do", "e"]);

/** Sem acento, minúsculo, só letras e números. */
export const normalizar = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const tokens = (s: string) => normalizar(s).split(" ").filter((t) => t.length >= 4 && !PALAVRAS_VAZIAS.has(t));

/** Qual serviço da tabela o texto parece ser. */
export function sugerirServico(texto: string, catalogo: Servico[]): { id: string; confianca: Confianca } | null {
  const t = normalizar(texto);
  const base = normalizar(texto.split(" · ")[0]);
  if (!t) return null;
  const exato = catalogo.find((s) => normalizar(s.nome) === base || normalizar(s.nome) === t);
  if (exato) return { id: exato.id, confianca: "alta" };
  // O nome do serviço aparece no texto ("Primeira consulta · Quiropraxia lombar")
  const contidos = catalogo.filter((s) => normalizar(s.nome).length >= 4 && ` ${t} `.includes(` ${normalizar(s.nome)} `));
  if (contidos.length) {
    const maior = contidos.sort((a, b) => normalizar(b.nome).length - normalizar(a.nome).length)[0];
    return { id: maior.id, confianca: contidos.length === 1 ? "alta" : "media" };
  }
  // Palavras em comum ("pilates solo" ↔ "Pilates")
  const doTexto = new Set(tokens(texto));
  let melhor: { s: Servico; n: number } | null = null;
  for (const s of catalogo) {
    const n = tokens(s.nome).filter((x) => doTexto.has(x)).length;
    if (n > 0 && (!melhor || n > melhor.n)) melhor = { s, n };
  }
  if (melhor) return { id: melhor.s.id, confianca: "media" };
  // Pelo tipo da consulta, quando a tabela tem um serviço com o mesmo nome
  if (base.startsWith("retorno")) {
    const r = catalogo.find((s) => normalizar(s.nome).includes("retorno"));
    if (r) return { id: r.id, confianca: "media" };
  }
  if (base.startsWith("teleconsulta")) {
    const r = catalogo.find((s) => normalizar(s.nome).includes("tele"));
    if (r) return { id: r.id, confianca: "media" };
  }
  return null;
}

const textoDaConsulta = (c: Consulta) => {
  const tipo = rotuloTipo[c.tipo] ?? "Consulta";
  return c.motivo?.trim() ? `${tipo} · ${c.motivo.trim()}` : tipo;
};

export function agruparSemServico({
  precos,
  consultas,
  receitas,
}: {
  precos: PrecoProcedimento[];
  consultas: Consulta[];
  receitas: Lancamento[];
}): { grupos: GrupoClassificar[]; catalogo: Servico[] } {
  const catalogo = catalogoServicos(precos);
  const grupos = new Map<string, GrupoClassificar>();
  const grupo = (texto: string, chave = normalizar(texto)) => {
    let g = grupos.get(chave);
    if (!g) {
      const s = sugerirServico(texto, catalogo);
      g = {
        chave,
        texto,
        consultaIds: [],
        receitaIds: [],
        consultas: 0,
        receitas: 0,
        valor: 0,
        ultima: "",
        exemplos: [],
        sugestao: s?.id ?? null,
        confianca: s?.confianca ?? null,
      };
      grupos.set(chave, g);
    }
    return g;
  };
  const exemplo = (g: GrupoClassificar, nome: string, quando: string) => {
    if (g.exemplos.length < 3 && !g.exemplos.includes(nome)) g.exemplos.push(nome);
    if (quando > g.ultima) g.ultima = quando;
  };

  const porId = new Map(consultas.map((c) => [c.id, c]));
  const servicoPorId = new Map(catalogo.flatMap((s) => s.linhas.map((l) => [l.id, s] as const)));

  // Consultas sem serviço (canceladas não contam: não viraram atendimento)
  const grupoDaConsulta = new Map<string, GrupoClassificar>();
  for (const c of consultas) {
    if (c.servico_id || c.servico_nome || c.status === "cancelada") continue;
    const g = grupo(textoDaConsulta(c));
    g.consultaIds.push(c.id);
    g.consultas += 1;
    g.valor += Number(c.valor ?? 0) || 0;
    exemplo(g, c.paciente_nome, c.data_hora.slice(0, 10));
    grupoDaConsulta.set(c.id, g);
  }

  for (const r of receitas) {
    if (r.servico_id || r.status === "cancelado") continue;
    const c = r.consulta_id ? porId.get(r.consulta_id) : undefined;
    // Receita de consulta que já tem serviço: só falta copiar
    const s = c?.servico_id ? servicoPorId.get(c.servico_id) : undefined;
    if (s) {
      const g = grupo(s.nome, `consulta:${s.id}`);
      g.texto = `Receitas de consultas de ${s.nome}`;
      g.sugestao = s.id;
      g.confianca = "alta";
      g.receitaIds.push(r.id);
      g.receitas += 1;
      g.valor += bruto(r);
      exemplo(g, r.paciente_nome, r.data_competencia);
      continue;
    }
    // Receita da consulta do grupo: vai junto (o valor já conta pela consulta)
    const daConsulta = r.consulta_id ? grupoDaConsulta.get(r.consulta_id) : undefined;
    if (daConsulta) {
      daConsulta.receitaIds.push(r.id);
      continue;
    }
    const g = grupo((r.procedimento ?? "").trim() || "Sem descrição");
    g.receitaIds.push(r.id);
    g.receitas += 1;
    g.valor += bruto(r);
    exemplo(g, r.paciente_nome, r.data_competencia);
  }

  const lista = [...grupos.values()]
    .filter((g) => g.consultas + g.receitas > 0)
    .sort((a, b) => b.consultas + b.receitas - (a.consultas + a.receitas) || b.valor - a.valor);
  return { grupos: lista, catalogo };
}
