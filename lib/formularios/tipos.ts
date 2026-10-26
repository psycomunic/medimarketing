/**
 * FORMULÁRIOS GERADOS POR SCHEMA
 *
 * O formulário inteiro mora num JSON guardado em `formularios_modelos`:
 * etapas, perguntas e tabelas. A tela só sabe desenhar três tipos de
 * campo. Um formulário novo é uma linha nova no banco, não um deploy.
 *
 * As chaves das respostas são os `id` dos campos, nunca o número que
 * aparece na tela. A numeração é calculada na hora: reordenar ou inserir
 * uma pergunta não embaralha o que já foi respondido.
 *
 * Este arquivo não importa nada de servidor nem de React — a mesma conta
 * de progresso roda no navegador (para a barra) e na server action (para
 * o que fica gravado).
 */

export type CampoTexto = {
  tipo: "texto";
  id: string;
  pergunta: string;
  ajuda?: string;
  /** Mostra o envio de arquivos abaixo da pergunta. */
  anexos?: boolean;
};

export type Coluna = { id: string; titulo: string };

export type CampoTabela = {
  tipo: "tabela";
  id: string;
  /** Título da primeira coluna, a do rótulo da linha. */
  rotulo: string;
  colunas: Coluna[];
  /** Linhas com que a tabela começa. */
  linhas: string[];
  permite_linhas?: boolean;
  rotulo_editavel?: boolean;
  nota?: string;
};

export type LinhaMensal =
  | { id: string; rotulo: string }
  /** Uma linha por linha preenchida de outra tabela do formulário. */
  | { por_tabela: string; modelo: string; ignorar?: string[] };

export type CampoMensal = {
  tipo: "tabela_mensal";
  id: string;
  rotulo: string;
  meses: number;
  linhas: LinhaMensal[];
  nota?: string;
};

export type Campo = CampoTexto | CampoTabela | CampoMensal;

export type Etapa = {
  id: string;
  /** Nome curto, para a navegação. */
  rotulo: string;
  titulo: string;
  instrucao?: string;
  nota_final?: string;
  campos: Campo[];
};

export type SchemaFormulario = {
  intro: {
    eyebrow: string;
    titulo: string;
    destaque: string;
    /** Aceita {clinica}. */
    texto: string;
  };
  aviso: string;
  agradecimento: string;
  etapas: Etapa[];
};

/* ------------------------------------------------------------------ */
/* Respostas                                                           */
/* ------------------------------------------------------------------ */

export type LinhaTabela = { rotulo: string } & Record<string, string>;
export type ValorMensal = { meses: string[]; linhas: Record<string, string[]> };
export type Anexo = { nome: string; caminho: string; tamanho: number };

export type Respostas = {
  [campo: string]: unknown;
  anexos?: Record<string, Anexo[]>;
};

export function substituirClinica(texto: string, clinica: string): string {
  return texto.replaceAll("{clinica}", clinica);
}

/** Só as perguntas abertas recebem número, como no questionário impresso. */
export function numeracao(schema: SchemaFormulario): Map<string, number> {
  const mapa = new Map<string, number>();
  let n = 0;
  for (const etapa of schema.etapas) {
    for (const campo of etapa.campos) {
      if (campo.tipo === "texto") mapa.set(campo.id, ++n);
    }
  }
  return mapa;
}

export function totalPerguntas(schema: SchemaFormulario): number {
  return numeracao(schema).size;
}

/* ------------------------------------------------------------------ */
/* Leitura tolerante dos valores                                       */
/*                                                                     */
/* O JSON vem do banco e pode ter sido gravado por uma versão anterior */
/* da tela. Tudo o que não tiver o formato esperado vira "vazio".      */
/* ------------------------------------------------------------------ */

export function valorTexto(r: Respostas, id: string): string {
  const v = r[id];
  return typeof v === "string" ? v : "";
}

export function linhasTabela(r: Respostas, campo: CampoTabela): LinhaTabela[] {
  const v = r[campo.id];
  if (Array.isArray(v)) {
    return v
      .filter((l): l is Record<string, unknown> => !!l && typeof l === "object")
      .map((l) => {
        const linha: LinhaTabela = { rotulo: typeof l.rotulo === "string" ? l.rotulo : "" };
        for (const c of campo.colunas) {
          linha[c.id] = typeof l[c.id] === "string" ? (l[c.id] as string) : "";
        }
        return linha;
      });
  }
  return campo.linhas.map((rotulo) => {
    const linha: LinhaTabela = { rotulo };
    for (const c of campo.colunas) linha[c.id] = "";
    return linha;
  });
}

/** Os três últimos meses completos, do mais antigo para o mais novo. */
export function mesesPadrao(quantos: number, hoje = new Date()): string[] {
  const meses: string[] = [];
  for (let i = quantos; i >= 1; i--) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    meses.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return meses;
}

export function valorMensal(r: Respostas, campo: CampoMensal): ValorMensal {
  const v = r[campo.id] as Partial<ValorMensal> | undefined;
  const meses =
    Array.isArray(v?.meses) && v.meses.length === campo.meses
      ? v.meses.map((m) => (typeof m === "string" ? m : ""))
      : mesesPadrao(campo.meses);
  const linhas: Record<string, string[]> = {};
  if (v?.linhas && typeof v.linhas === "object") {
    for (const [k, vals] of Object.entries(v.linhas)) {
      if (Array.isArray(vals)) {
        linhas[k] = Array.from({ length: campo.meses }, (_, i) =>
          typeof vals[i] === "string" ? vals[i] : ""
        );
      }
    }
  }
  return { meses, linhas };
}

export type LinhaMensalResolvida = { chave: string; rotulo: string; orfa?: boolean };

/**
 * Linhas da tabela mensal para estas respostas.
 *
 * As linhas "por tabela" saem do que a clínica preencheu na tabela de
 * serviços: quem não tem Pilates não vê "Receita de Pilates", e quem tem
 * Acupuntura vê a dela. Se um serviço for renomeado depois de os números
 * já terem sido digitados, a linha antiga continua aparecendo enquanto
 * tiver valor — renomear não pode apagar dado em silêncio.
 */
export function linhasMensais(
  schema: SchemaFormulario,
  r: Respostas,
  campo: CampoMensal
): LinhaMensalResolvida[] {
  const valor = valorMensal(r, campo);
  const resultado: LinhaMensalResolvida[] = [];
  const usadas = new Set<string>();

  for (const linha of campo.linhas) {
    if ("id" in linha) {
      resultado.push({ chave: linha.id, rotulo: linha.rotulo });
      usadas.add(linha.id);
      continue;
    }

    const tabela = acharCampo(schema, linha.por_tabela);
    if (!tabela || tabela.tipo !== "tabela") continue;
    const ignorar = new Set((linha.ignorar ?? []).map(normalizar));
    const vistos = new Set<string>();

    for (const l of linhasTabela(r, tabela)) {
      const nome = l.rotulo.trim();
      if (!nome || ignorar.has(normalizar(nome)) || vistos.has(normalizar(nome))) continue;
      vistos.add(normalizar(nome));
      const chave = `${linha.por_tabela}:${nome}`;
      resultado.push({ chave, rotulo: linha.modelo.replace("{item}", nome) });
      usadas.add(chave);
    }

    // Linhas de serviços que mudaram de nome, mas ainda têm números
    for (const [chave, vals] of Object.entries(valor.linhas)) {
      if (!chave.startsWith(`${linha.por_tabela}:`) || usadas.has(chave)) continue;
      if (!vals.some((x) => x.trim())) continue;
      const nome = chave.slice(linha.por_tabela.length + 1);
      resultado.push({ chave, rotulo: linha.modelo.replace("{item}", nome), orfa: true });
      usadas.add(chave);
    }
  }

  return resultado;
}

function normalizar(s: string): string {
  return s.trim().toLocaleLowerCase("pt-BR");
}

export function acharCampo(schema: SchemaFormulario, id: string): Campo | undefined {
  for (const e of schema.etapas) {
    const c = e.campos.find((x) => x.id === id);
    if (c) return c;
  }
  return undefined;
}

/* ------------------------------------------------------------------ */
/* Progresso                                                           */
/* ------------------------------------------------------------------ */

/** Uma tabela conta como respondida com uma célula preenchida que seja. */
export function campoRespondido(
  schema: SchemaFormulario,
  r: Respostas,
  campo: Campo
): boolean {
  if (campo.tipo === "texto") return valorTexto(r, campo.id).trim() !== "";
  if (campo.tipo === "tabela") {
    return linhasTabela(r, campo).some((l) =>
      campo.colunas.some((c) => (l[c.id] ?? "").trim() !== "")
    );
  }
  const v = valorMensal(r, campo);
  return linhasMensais(schema, r, campo).some((l) =>
    (v.linhas[l.chave] ?? []).some((x) => x.trim() !== "")
  );
}

export function progresso(schema: SchemaFormulario, r: Respostas): number {
  const campos = schema.etapas.flatMap((e) => e.campos);
  if (campos.length === 0) return 0;
  const feitos = campos.filter((c) => campoRespondido(schema, r, c)).length;
  return Math.round((feitos / campos.length) * 100);
}

export type Pendencia = { etapa: string; campo: string; titulo: string };

export function pendencias(schema: SchemaFormulario, r: Respostas): Pendencia[] {
  const nums = numeracao(schema);
  const lista: Pendencia[] = [];
  for (const etapa of schema.etapas) {
    for (const campo of etapa.campos) {
      if (campoRespondido(schema, r, campo)) continue;
      lista.push({
        etapa: etapa.id,
        campo: campo.id,
        titulo:
          campo.tipo === "texto"
            ? `${nums.get(campo.id)}. ${campo.pergunta}`
            : `Tabela: ${etapa.titulo}`,
      });
    }
  }
  return lista;
}

export function etapaCompleta(schema: SchemaFormulario, r: Respostas, etapa: Etapa): boolean {
  return etapa.campos.every((c) => campoRespondido(schema, r, c));
}
