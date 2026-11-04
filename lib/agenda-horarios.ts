/**
 * HORÁRIOS LIVRES DE UM PROFISSIONAL
 *
 * Um horário só é oferecido se passar por tudo, nesta ordem:
 *
 *   1. está dentro do expediente semanal do profissional;
 *   2. não cai num fechamento daquele serviço (ou de todos);
 *   3. não cai num bloqueio de período (férias, folga);
 *   4. o profissional não tem consulta nele;
 *   5. a clínica não está lotada nele;
 *   6. respeita a antecedência mínima.
 *
 * Funções puras e sem fuso: quem chama diz como transformar "dia +
 * minutos" num instante — o navegador usa a hora local, o servidor usa
 * Brasília. Assim o formulário interno, a conferência ao salvar e o link
 * público usam exatamente a mesma regra.
 */

import { lotado, ocupacaoDoIntervalo, type ConsultaOcupando } from "@/lib/agenda-capacidade";

export type Janela = { ini: number; fim: number };

export type RegraFechamento = {
  id?: string;
  medico_id: string;
  servico_id: string | null;
  dia_semana: number | null;
  data: string | null;
  hora_inicio: string;
  hora_fim: string;
  motivo: string | null;
};

export type HorarioCalculado = {
  hora: string;
  minutos: number;
  /** Instante do início, em ISO. */
  iso: string;
  livre: boolean;
  motivo?: "ocupado" | "fechado" | "bloqueado" | "lotado" | "passou";
  /** Texto curto para a equipe ("Maria Souza", "Curso", "5/5"). */
  detalhe?: string;
  /** Consultas da clínica ao mesmo tempo nesse horário. */
  ocupacao: number;
};

/** "08:30" ou "08:30:00" → minutos do dia. */
export function minutosDe(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function hhmm(minutos: number): string {
  return `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`;
}

/**
 * Fechamento que pega o intervalo [ini, fim) daquele dia, para aquele
 * serviço. Fechamento sem serviço vale para todos; serviço nulo na
 * consulta só é pego por fechamento de todos os serviços.
 */
export function fechamentoNoIntervalo(
  fechamentos: RegraFechamento[],
  p: { medicoId: string; servicoId: string | null; dia: string; semana: number; ini: number; fim: number }
): RegraFechamento | null {
  return (
    fechamentos.find(
      (f) =>
        f.medico_id === p.medicoId &&
        (f.servico_id === null || f.servico_id === p.servicoId) &&
        (f.data ? f.data === p.dia : f.dia_semana === p.semana) &&
        p.ini < minutosDe(f.hora_fim) &&
        p.fim > minutosDe(f.hora_inicio)
    ) ?? null
  );
}

export function horariosDoDia(p: {
  dia: string;
  /** Dia da semana do `dia` (0 = domingo). */
  semana: number;
  medicoId: string;
  servicoId: string | null;
  duracao: number;
  /** Expediente do profissional nesse dia da semana. */
  janelas: Janela[];
  fechamentos: RegraFechamento[];
  bloqueios: { medico_id: string; data_inicio: string; data_fim: string; motivo?: string | null }[];
  /** Consultas da clínica (todas, de qualquer profissional) perto desse dia. */
  consultas: (ConsultaOcupando & { paciente_nome?: string })[];
  limite: number | null;
  agora: Date;
  /** Minutos mínimos entre agora e o início. */
  antecedenciaMin?: number;
  instante: (dia: string, minutos: number) => Date;
}): HorarioCalculado[] {
  const passo = p.duracao <= 20 ? p.duracao : 30;
  const doMedico = p.consultas.filter((c) => c.medico_id === p.medicoId && c.status !== "cancelada");
  const bloqueios = p.bloqueios
    .filter((b) => b.medico_id === p.medicoId)
    .map((b) => ({ a: new Date(b.data_inicio).getTime(), b: new Date(b.data_fim).getTime(), motivo: b.motivo }));
  const limiteAgora = p.agora.getTime() + (p.antecedenciaMin ?? 0) * 60000;

  const lista: HorarioCalculado[] = [];
  for (const j of [...p.janelas].sort((a, b) => a.ini - b.ini)) {
    for (let m = j.ini; m + p.duracao <= j.fim; m += passo) {
      const inicio = p.instante(p.dia, m);
      const ini = inicio.getTime();
      const fim = ini + p.duracao * 60000;

      const consulta = doMedico.find((c) => {
        const a = new Date(c.data_hora).getTime();
        return a < fim && a + (c.duracao_min ?? 30) * 60000 > ini;
      });
      const fech = fechamentoNoIntervalo(p.fechamentos, {
        medicoId: p.medicoId,
        servicoId: p.servicoId,
        dia: p.dia,
        semana: p.semana,
        ini: m,
        fim: m + p.duracao,
      });
      const bloq = bloqueios.find((b) => b.a < fim && b.b > ini);
      const oc = ocupacaoDoIntervalo(p.consultas, inicio, p.duracao);
      const cheio = lotado(oc, p.limite);
      const passou = ini < limiteAgora;

      const motivo: HorarioCalculado["motivo"] = consulta
        ? "ocupado"
        : fech
          ? "fechado"
          : bloq
            ? "bloqueado"
            : cheio
              ? "lotado"
              : passou
                ? "passou"
                : undefined;

      lista.push({
        hora: hhmm(m),
        minutos: m,
        iso: inicio.toISOString(),
        livre: !motivo,
        motivo,
        detalhe: consulta
          ? consulta.paciente_nome
          : fech
            ? fech.motivo || "Agenda fechada"
            : bloq
              ? bloq.motivo || "Bloqueado"
              : cheio
                ? `Lotado (${oc.simultaneas}/${p.limite})`
                : passou
                  ? "Já passou"
                  : undefined,
        ocupacao: oc.simultaneas,
      });
    }
  }
  return lista;
}

/** Manhã, tarde e noite, como o paciente pensa no horário. */
export function periodoDe(minutos: number): "manha" | "tarde" | "noite" {
  return minutos < 12 * 60 ? "manha" : minutos < 18 * 60 ? "tarde" : "noite";
}

/** Texto legível de um fechamento ("Toda sexta, 13:00–18:00"). */
export function descreverFechamento(
  f: Pick<RegraFechamento, "dia_semana" | "data" | "hora_inicio" | "hora_fim">,
  diasSemana: readonly string[]
): string {
  const horas = `${f.hora_inicio.slice(0, 5)}–${f.hora_fim.slice(0, 5)}`;
  if (f.data) {
    const [a, m, d] = f.data.split("-");
    return `${d}/${m}/${a}, ${horas}`;
  }
  const d = f.dia_semana ?? 0;
  // Sábado e domingo são masculinos: "todo sábado", "toda sexta"
  return `${d === 0 || d === 6 ? "Todo" : "Toda"} ${diasSemana[d].toLowerCase()}, ${horas}`;
}
