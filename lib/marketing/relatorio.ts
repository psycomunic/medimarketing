import { lerCsv } from "@/lib/csv";

/**
 * RELATÓRIOS DE ANÚNCIOS (planilha)
 *
 * Lê o CSV que o Gerenciador de Anúncios do Meta e o Google Ads exportam,
 * em português ou inglês, e devolve uma linha por campanha por dia. Vale
 * no navegador (prévia antes de importar) e no servidor.
 */

export type PlataformaMidia = "meta" | "google";

export type LinhaAnuncio = {
  plataforma: PlataformaMidia;
  contaId: string | null;
  /** Id da campanha na plataforma; sem ele, o nome normalizado. */
  campanhaId: string;
  campanhaNome: string;
  data: string; // YYYY-MM-DD
  investimento: number;
  impressoes: number;
  alcance: number;
  cliques: number;
  leads: number;
  conversas: number;
  conversoes: number;
};

export type LeituraRelatorio =
  | {
      ok: true;
      plataforma: PlataformaMidia;
      linhas: LinhaAnuncio[];
      /** O arquivo não tinha a coluna "Dia": o total foi espalhado pelos dias. */
      distribuido: boolean;
      avisos: string[];
    }
  | { ok: false; erro: string };

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

type Campo =
  | "nome"
  | "id"
  | "conta"
  | "dia"
  | "inicio"
  | "fim"
  | "investimento"
  | "impressoes"
  | "alcance"
  | "cliquesLink"
  | "cliques"
  | "leads"
  | "conversas"
  | "conversoes"
  | "resultados"
  | "indicador";

/** Como cada coluna aparece nos relatórios (já sem acento e minúsculo). */
const COLUNAS: Record<Campo, (h: string) => boolean> = {
  nome: (h) => ["nome da campanha", "campaign name", "campanha", "campaign"].includes(h),
  id: (h) => ["identificacao da campanha", "id da campanha", "campaign id"].includes(h),
  conta: (h) => ["identificacao da conta", "id da conta", "account id", "customer id", "id do cliente"].includes(h),
  dia: (h) => ["dia", "day", "data", "date"].includes(h),
  inicio: (h) => ["inicio dos relatorios", "reporting starts"].includes(h),
  fim: (h) => ["termino dos relatorios", "reporting ends"].includes(h),
  investimento: (h) => /^(valor usado|amount spent|custo|cost)( \(.*\))?$/.test(h),
  impressoes: (h) => ["impressoes", "impressions", "impr.", "impr"].includes(h),
  alcance: (h) => ["alcance", "reach"].includes(h),
  cliquesLink: (h) => ["cliques no link", "link clicks"].includes(h),
  cliques: (h) => ["cliques", "clicks", "cliques (todos)", "clicks (all)", "interacoes", "interactions"].includes(h),
  leads: (h) => ["leads", "leads no meta", "cadastros"].includes(h),
  conversas: (h) => ["conversas por mensagem iniciadas", "messaging conversations started"].includes(h),
  conversoes: (h) => ["conversoes", "conversions", "todas as conv.", "all conv."].includes(h),
  resultados: (h) => ["resultados", "results"].includes(h),
  indicador: (h) => ["indicador de resultados", "result indicator", "tipo de resultado", "result type"].includes(h),
};

const MESES: Record<string, number> = {
  jan: 1, fev: 2, feb: 2, mar: 3, abr: 4, apr: 4, mai: 5, may: 5, jun: 6, jul: 7, ago: 8, aug: 8, set: 9, sep: 9, out: 10, oct: 10, nov: 11, dez: 12, dec: 12,
};
const pad = (n: number) => String(n).padStart(2, "0");

/** "2026-10-01", "01/10/2026", "1 de out. de 2026", "Oct 1, 2026". */
export function lerData(bruto: string): string | null {
  const s = norm(bruto);
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return `${m[3]}-${pad(+m[2])}-${pad(+m[1])}`;
  m = s.match(/^(\d{1,2}) de ([a-z]{3})[a-z.]* de (\d{4})/);
  if (m && MESES[m[2]]) return `${m[3]}-${pad(MESES[m[2]])}-${pad(+m[1])}`;
  m = s.match(/^([a-z]{3})[a-z.]* (\d{1,2}), (\d{4})/);
  if (m && MESES[m[1]]) return `${m[3]}-${pad(MESES[m[1]])}-${pad(+m[2])}`;
  return null;
}

/** Número em "1.234,56", "1,234.56", "R$ 12", "--". `virgula`: a vírgula é o decimal. */
export function lerNumero(bruto: string | undefined, virgula: boolean): number {
  if (!bruto) return 0;
  let s = bruto.replace(/[R$\s%]|BRL/g, "").trim();
  if (!s || /^-+$/.test(s)) return 0;
  s = virgula ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

const somarDias = (s: string, n: number) => {
  const d = new Date(`${s}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export function lerRelatorio(texto: string, forcar?: PlataformaMidia): LeituraRelatorio {
  const tabela = lerCsv(texto);
  // O cabeçalho é a primeira linha com o nome da campanha e algum número de mídia
  const idx = tabela.findIndex((l) => {
    const h = l.map(norm);
    return h.some(COLUNAS.nome) && h.some((x) => COLUNAS.investimento(x) || COLUNAS.impressoes(x));
  });
  if (idx < 0) return { ok: false, erro: "Não achei as colunas de campanha e de investimento. Exporte o relatório de campanhas em CSV." };
  const cab = tabela[idx].map(norm);
  const col = (c: Campo) => cab.findIndex(COLUNAS[c]);
  const pos = Object.fromEntries((Object.keys(COLUNAS) as Campo[]).map((c) => [c, col(c)])) as Record<Campo, number>;
  if (pos.investimento < 0) return { ok: false, erro: "O relatório não tem a coluna de investimento (\"Valor usado\" no Meta, \"Custo\" no Google)." };

  const plataforma: PlataformaMidia =
    forcar ??
    (cab.some((h) => /^(valor usado|amount spent)/.test(h) || COLUNAS.alcance(h) || COLUNAS.conversas(h)) ? "meta" : "google");

  const corpo = tabela.slice(idx + 1).filter((l) => {
    const nome = (l[pos.nome] ?? "").trim();
    // Linhas de total do Google ("Total: conta", "Total: campanhas")
    return nome && !/^total/i.test(nome) && !/^--$/.test(nome);
  });
  if (!corpo.length) return { ok: false, erro: "O relatório não tem nenhuma campanha." };

  // Vírgula decimal? Olha os valores de investimento
  const virgula = corpo.some((l) => /,\d{1,2}$/.test((l[pos.investimento] ?? "").trim()));
  const num = (l: string[], c: Campo) => (pos[c] >= 0 ? lerNumero(l[pos[c]], virgula) : 0);

  const avisos: string[] = [];
  let distribuido = false;
  const linhas: LinhaAnuncio[] = [];
  for (const l of corpo) {
    const nome = l[pos.nome].trim();
    const idBruto = pos.id >= 0 ? (l[pos.id] ?? "").trim() : "";
    const campanhaId = idBruto && idBruto !== "--" ? idBruto : `nome:${norm(nome)}`;
    const indicador = pos.indicador >= 0 ? norm(l[pos.indicador] ?? "") : "";
    const resultados = num(l, "resultados");
    const leads =
      plataforma === "google"
        ? num(l, "conversoes")
        : pos.leads >= 0
          ? num(l, "leads")
          : /lead|cadastro/.test(indicador)
            ? resultados
            : 0;
    const conversas = pos.conversas >= 0 ? num(l, "conversas") : /messag|conversa/.test(indicador) ? resultados : 0;
    const base = {
      plataforma,
      contaId: pos.conta >= 0 ? (l[pos.conta] ?? "").trim() || null : null,
      campanhaId,
      campanhaNome: nome,
      investimento: num(l, "investimento"),
      impressoes: Math.round(num(l, "impressoes")),
      alcance: Math.round(num(l, "alcance")),
      cliques: Math.round(pos.cliquesLink >= 0 ? num(l, "cliquesLink") : num(l, "cliques")),
      leads: Math.round(leads),
      conversas: Math.round(conversas),
      conversoes: Math.round(num(l, "conversoes")),
    };

    const dia = pos.dia >= 0 ? lerData(l[pos.dia] ?? "") : null;
    if (dia) {
      linhas.push({ ...base, data: dia });
      continue;
    }
    // Sem a coluna "Dia": espalha o total pelos dias do relatório
    const ini = pos.inicio >= 0 ? lerData(l[pos.inicio] ?? "") : null;
    const fim = pos.fim >= 0 ? lerData(l[pos.fim] ?? "") : null;
    if (!ini || !fim) return { ok: false, erro: "O relatório não tem a coluna \"Dia\" nem o período. No Gerenciador, divida por Dia antes de exportar." };
    const dias = Math.round((new Date(`${fim}T12:00:00Z`).getTime() - new Date(`${ini}T12:00:00Z`).getTime()) / 864e5) + 1;
    if (dias > 1) distribuido = true;
    for (let i = 0; i < dias; i++) {
      // Inteiros: o resto fica no último dia, para a soma bater
      const parte = (v: number, inteiro: boolean) => {
        const b = inteiro ? Math.floor(v / dias) : Math.floor((v / dias) * 100) / 100;
        return i === dias - 1 ? Math.round((v - b * (dias - 1)) * 100) / 100 : b;
      };
      linhas.push({
        ...base,
        data: somarDias(ini, i),
        investimento: parte(base.investimento, false),
        impressoes: parte(base.impressoes, true),
        alcance: parte(base.alcance, true),
        cliques: parte(base.cliques, true),
        leads: parte(base.leads, true),
        conversas: parte(base.conversas, true),
        conversoes: parte(base.conversoes, true),
      });
    }
  }
  if (distribuido) avisos.push("O relatório veio sem a divisão por dia: o total de cada campanha foi espalhado igualmente pelos dias. Para gráficos exatos, exporte dividido por Dia.");

  // Mesma campanha e dia repetidos (ex.: dividido por conjunto de anúncios): soma
  const juntas = new Map<string, LinhaAnuncio>();
  for (const l of linhas) {
    const k = `${l.campanhaId}|${l.data}`;
    const j = juntas.get(k);
    if (!j) juntas.set(k, { ...l });
    else
      for (const c of ["investimento", "impressoes", "alcance", "cliques", "leads", "conversas", "conversoes"] as const) j[c] += l[c];
  }
  return { ok: true, plataforma, linhas: [...juntas.values()], distribuido, avisos };
}
