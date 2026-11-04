/**
 * OCUPAÇÃO DE UM HORÁRIO
 *
 * A clínica atende várias consultas ao mesmo tempo, cada uma com o seu
 * profissional, até o limite que ela mesma define. Duas regras:
 *
 *   1. o profissional não atende duas pessoas ao mesmo tempo;
 *   2. a clínica não passa de `limite` consultas simultâneas.
 *
 * "Simultâneas" é o pico dentro do intervalo, e não a soma de tudo que
 * encosta nele: uma consulta de 10:00 a 10:30 e outra de 10:30 a 11:00
 * nunca estão juntas. Canceladas não ocupam lugar.
 *
 * Funções puras: o formulário, o calendário e o servidor usam as mesmas,
 * e por isso não podem discordar sobre o que é lotado.
 */

export type ConsultaOcupando = {
  id: string;
  medico_id: string;
  data_hora: string;
  duracao_min: number | null;
  status: string;
};

type Intervalo = { id: string; medico: string; ini: number; fim: number };

function intervalos(consultas: ConsultaOcupando[], ignorarId?: string | null): Intervalo[] {
  return consultas
    .filter((c) => c.status !== "cancelada" && c.id !== ignorarId)
    .map((c) => {
      const ini = new Date(c.data_hora).getTime();
      return { id: c.id, medico: c.medico_id, ini, fim: ini + (c.duracao_min ?? 30) * 60000 };
    });
}

export type Ocupacao = {
  /** Pico de consultas ao mesmo tempo dentro do intervalo, sem contar a nova. */
  simultaneas: number;
  /** Profissionais com consulta que encosta no intervalo. */
  ocupados: Set<string>;
};

/** Ocupação do intervalo [inicio, inicio + duração). */
export function ocupacaoDoIntervalo(
  consultas: ConsultaOcupando[],
  inicio: Date,
  duracaoMin: number,
  ignorarId?: string | null
): Ocupacao {
  const ini = inicio.getTime();
  const fim = ini + duracaoMin * 60000;
  const dentro = intervalos(consultas, ignorarId).filter((c) => c.ini < fim && c.fim > ini);

  // O pico só muda onde alguma consulta começa: basta olhar esses pontos
  const pontos = [ini, ...dentro.map((c) => c.ini).filter((t) => t > ini && t < fim)];
  let simultaneas = 0;
  for (const p of pontos) {
    const n = dentro.filter((c) => c.ini <= p && c.fim > p).length;
    if (n > simultaneas) simultaneas = n;
  }

  return { simultaneas, ocupados: new Set(dentro.map((c) => c.medico)) };
}

/** Limite efetivo: nulo, ausente ou inválido = sem limite. */
export function limiteValido(limite: number | null | undefined): number | null {
  return typeof limite === "number" && limite >= 1 ? limite : null;
}

export function lotado(ocupacao: Ocupacao, limite: number | null | undefined): boolean {
  const l = limiteValido(limite);
  return l !== null && ocupacao.simultaneas >= l;
}

/**
 * Cores fixas por profissional: a mesma pessoa tem a mesma cor em todas
 * as telas, porque a cor vem da ordem do nome e não da posição na tela.
 * São tons do próprio painel, claros o bastante para o texto escuro.
 */
export const CORES_PROFISSIONAL = [
  { ponto: "bg-teal", fundo: "bg-teal/10", borda: "border-teal/40", texto: "text-teal" },
  { ponto: "bg-sky-500", fundo: "bg-sky-500/10", borda: "border-sky-500/40", texto: "text-sky-700" },
  { ponto: "bg-violet-500", fundo: "bg-violet-500/10", borda: "border-violet-500/40", texto: "text-violet-700" },
  { ponto: "bg-amber-500", fundo: "bg-amber-500/10", borda: "border-amber-500/40", texto: "text-amber-700" },
  { ponto: "bg-rose-500", fundo: "bg-rose-500/10", borda: "border-rose-500/40", texto: "text-rose-700" },
  { ponto: "bg-emerald-600", fundo: "bg-emerald-600/10", borda: "border-emerald-600/40", texto: "text-emerald-700" },
  { ponto: "bg-indigo-500", fundo: "bg-indigo-500/10", borda: "border-indigo-500/40", texto: "text-indigo-700" },
  { ponto: "bg-orange-500", fundo: "bg-orange-500/10", borda: "border-orange-500/40", texto: "text-orange-700" },
] as const;

export type CorProfissional = (typeof CORES_PROFISSIONAL)[number];

/** Mapa id → cor, estável para a mesma lista de profissionais. */
export function coresDosProfissionais(
  profissionais: { id: string; nome: string }[]
): Map<string, CorProfissional> {
  const ordem = [...profissionais].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR") || a.id.localeCompare(b.id));
  return new Map(ordem.map((p, i) => [p.id, CORES_PROFISSIONAL[i % CORES_PROFISSIONAL.length]]));
}
