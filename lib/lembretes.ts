/**
 * Regras do lembrete de confirmação.
 *
 * Funções puras, sem banco e sem rede: são usadas tanto pela rotina de
 * disparo quanto pela tela do painel, e precisam dar o mesmo resultado
 * nos dois lugares.
 */
import type { Organization } from "@/lib/supabase/types";
import {
  msgConfirmacao,
  msgReagendada,
  primeiroNome,
  somenteLatin1,
} from "@/lib/mensagens";

/**
 * FUSO HORÁRIO
 *
 * Tudo que o paciente lê é hora de Brasília, sempre — e precisa ser
 * dito explicitamente. `getHours()` e companhia respondem no fuso de
 * quem está rodando o código: na máquina de desenvolvimento isso é
 * Brasília e tudo parece certo, mas o servidor da Vercel roda em UTC.
 * Uma consulta das 18:50 virava "21:50" no e-mail, e uma das 21:00
 * pulava para o dia seguinte.
 *
 * O horário de verão brasileiro está extinto desde 2019, mas usar o
 * nome do fuso em vez de somar três horas mantém isso correto caso
 * volte.
 */
const FUSO = "America/Sao_Paulo";

/** Partes da data já convertidas para o fuso de Brasília. */
function partesEmBrasilia(d: Date) {
  const fmt = new Intl.DateTimeFormat("pt-BR", {
    timeZone: FUSO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "long",
    hour12: false,
  });

  const p = Object.fromEntries(
    fmt.formatToParts(d).map((x) => [x.type, x.value])
  ) as Record<string, string>;

  return {
    dia: p.day,
    mes: p.month,
    ano: p.year,
    // À meia-noite o Intl devolve "24" em vez de "00"
    hora: p.hour === "24" ? "00" : p.hour,
    minuto: p.minute,
    diaSemana: p.weekday,
  };
}

/**
 * Quanto somar a uma hora de parede de Brasília para chegar ao UTC.
 *
 * Calculado a partir do próprio instante, e não fixado em três horas,
 * para não quebrar se o horário de verão voltar.
 */
function deslocamentoUtc(instante: Date): number {
  const comoUtc = new Date(instante.toLocaleString("en-US", { timeZone: "UTC" }));
  const comoBrasilia = new Date(instante.toLocaleString("en-US", { timeZone: FUSO }));
  return comoUtc.getTime() - comoBrasilia.getTime();
}

/** O instante exato de uma hora de parede brasileira. */
function deBrasilia(
  ano: number,
  mes: number,
  dia: number,
  hora: number,
  minuto = 0
): Date {
  const paredeComoUtc = Date.UTC(ano, mes - 1, dia, hora, minuto);
  return new Date(paredeComoUtc + deslocamentoUtc(new Date(paredeComoUtc)));
}

/** Sábado e domingo em Brasília, que é onde o paciente vive. */
function ehFimDeSemana(ano: number, mes: number, dia: number): boolean {
  // Meio-dia evita que o deslocamento de fuso mude o dia da semana
  const d = new Date(Date.UTC(ano, mes - 1, dia, 12));
  return d.getUTCDay() === 0 || d.getUTCDay() === 6;
}

/**
 * Quando o lembrete de uma consulta deve sair.
 *
 * Anda `diasUteis` para trás pulando fim de semana, e fixa o horário
 * escolhido pela clínica. É por isso que a contagem é em dias úteis e
 * não em horas: consulta de segunda de manhã precisa avisar na sexta,
 * senão a mensagem cai no sábado e ninguém lê a tempo.
 *
 * A conta inteira acontece no calendário de Brasília. Feita no fuso do
 * servidor, a hora escolhida pela clínica saía três horas mais cedo em
 * produção — "às 9h" virava 6h da manhã.
 */
export function calcularDisparo(
  dataConsulta: Date,
  diasUteis: number,
  hora: number
): Date {
  const p = partesEmBrasilia(dataConsulta);
  let ano = Number(p.ano);
  let mes = Number(p.mes);
  let dia = Number(p.dia);

  let restantes = Math.max(1, diasUteis);
  while (restantes > 0) {
    // Voltar um dia pelo calendário, sem depender do fuso local
    const anterior = new Date(Date.UTC(ano, mes - 1, dia - 1, 12));
    ano = anterior.getUTCFullYear();
    mes = anterior.getUTCMonth() + 1;
    dia = anterior.getUTCDate();
    if (!ehFimDeSemana(ano, mes, dia)) restantes--;
  }

  return deBrasilia(ano, mes, dia, hora);
}

/** Lê as preferências da clínica com defaults seguros. */
export function preferencias(org: Pick<
  Organization,
  "lembrete_dias_uteis" | "lembrete_hora" | "lembrete_ativo" | "mensagem_lembrete" | "nome"
>) {
  return {
    diasUteis: org.lembrete_dias_uteis ?? 1,
    hora: org.lembrete_hora ?? 9,
    ativo: org.lembrete_ativo ?? true,
    modelo: org.mensagem_lembrete,
    clinica: org.nome,
  };
}

/* ------------------------------------------------------------------ */
/* Mensagem                                                            */
/* ------------------------------------------------------------------ */

export type DadosMensagem = {
  paciente: string;
  dataHora: string;
  medico: string | null;
  clinica: string;
  endereco: string | null;
  link: string;
  /** Modelo próprio da clínica; sem ele, usamos o padrão. */
  modelo?: string | null;
};

export function formatarData(iso: string): string {
  const p = partesEmBrasilia(new Date(iso));
  return `${p.dia}/${p.mes}/${p.ano}`;
}

export function formatarHora(iso: string): string {
  const p = partesEmBrasilia(new Date(iso));
  return `${p.hora}:${p.minuto}`;
}

export function diaDaSemana(iso: string): string {
  return partesEmBrasilia(new Date(iso)).diaSemana;
}

/** Data em Brasília, "AAAA-MM-DD" (para chaves e comparações). */
export function diaEmBrasilia(d: Date = new Date()): string {
  const p = partesEmBrasilia(d);
  return `${p.ano}-${p.mes}-${p.dia}`;
}

/** Hora cheia de agora em Brasília (0-23). */
export function horaEmBrasilia(d: Date = new Date()): number {
  return Number(partesEmBrasilia(d).hora);
}

/** Início e fim de um dia de Brasília ("AAAA-MM-DD"), como instantes. */
export function limitesDoDia(dia: string): { inicio: Date; fim: Date } {
  const [ano, mes, d] = dia.split("-").map(Number);
  return { inicio: deBrasilia(ano, mes, d, 0), fim: deBrasilia(ano, mes, d + 1, 0) };
}

/** O próximo dia útil depois de hoje, em Brasília ("AAAA-MM-DD"). */
export function proximoDiaUtil(d: Date = new Date()): string {
  const p = partesEmBrasilia(d);
  let alvo = new Date(Date.UTC(Number(p.ano), Number(p.mes) - 1, Number(p.dia) + 1, 12));
  while (ehFimDeSemana(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, alvo.getUTCDate())) {
    alvo = new Date(alvo.getTime() + 86_400_000);
  }
  const dois = (n: number) => String(n).padStart(2, "0");
  return `${alvo.getUTCFullYear()}-${dois(alvo.getUTCMonth() + 1)}-${dois(alvo.getUTCDate())}`;
}

/**
 * "hoje", "amanhã" ou "na segunda-feira": como dizer o dia da consulta
 * a partir de quando a mensagem sai. O lembrete dizia sempre "amanhã",
 * mesmo o de sexta para a consulta de segunda.
 */
export function diaRelativo(iso: string, referencia: Date = new Date()): string {
  const [a1, m1, d1] = diaEmBrasilia(referencia).split("-").map(Number);
  const [a2, m2, d2] = diaEmBrasilia(new Date(iso)).split("-").map(Number);
  const dias = Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / 86_400_000);
  if (dias === 0) return "hoje";
  if (dias === 1) return "amanhã";
  const semana = diaDaSemana(iso);
  if (dias > 1 && dias < 7) return `${/sábado|domingo/.test(semana) ? "no" : "na"} ${semana}`;
  return `em ${formatarData(iso)}`;
}

/**
 * Monta o texto que vai para o paciente.
 *
 * Se a clínica escreveu o próprio modelo em Configurações, ele é usado e
 * as variáveis são trocadas. O link é acrescentado no fim quando o
 * modelo não o inclui — sem ele a mensagem perde a função.
 */
export function montarMensagem(d: DadosMensagem): string {
  const data = formatarData(d.dataHora);
  const hora = formatarHora(d.dataHora);

  if (d.modelo?.trim()) {
    const texto = d.modelo
      .replaceAll("{paciente}", primeiroNome(d.paciente))
      .replaceAll("{data}", data)
      .replaceAll("{hora}", hora)
      .replaceAll("{clinica}", d.clinica)
      .replaceAll("{profissional}", d.medico ?? "")
      .replaceAll("{link}", d.link);

    return texto.includes(d.link)
      ? texto
      : `${texto}\n\nConfirme sua presença: ${d.link}`;
  }

  return msgConfirmacao({
    paciente: d.paciente,
    clinica: d.clinica,
    data,
    hora,
    diaSemana: diaDaSemana(d.dataHora),
    medico: d.medico,
    endereco: d.endereco,
    link: d.link,
  });
}

/** Aviso do novo horário depois que a clínica remarca. */
export function montarMensagemReagendada(d: DadosMensagem): string {
  return msgReagendada({
    paciente: d.paciente,
    clinica: d.clinica,
    data: formatarData(d.dataHora),
    hora: formatarHora(d.dataHora),
    diaSemana: diaDaSemana(d.dataHora),
    medico: d.medico,
    endereco: d.endereco,
    link: d.link,
  });
}

/**
 * Link do WhatsApp com a mensagem pronta.
 *
 * É o caminho que a recepção usa enquanto a API oficial não está
 * conectada: abre a conversa com o texto já digitado, bastando enviar.
 *
 * O texto passa por `somenteLatin1` porque o WhatsApp Desktop decodifica
 * este parâmetro como Latin-1: acento chega certo, emoji vira losango de
 * erro. Nossa codificação está correta — é o cliente que erra —, então
 * limpamos o que ele não aguenta em vez de mandar lixo para o paciente.
 * A API oficial não tem esse problema e recebe o texto completo.
 */
export function linkWhatsApp(telefone: string, texto: string): string {
  const numero = normalizarTelefone(telefone);
  return `https://wa.me/${numero}?text=${encodeURIComponent(somenteLatin1(texto))}`;
}

/** Deixa só dígitos e garante o DDI do Brasil. */
export function normalizarTelefone(telefone: string): string {
  const digitos = telefone.replace(/\D/g, "");
  if (digitos.startsWith("55")) return digitos;
  // 10 (fixo com DDD) ou 11 (celular com DDD) dígitos = número nacional
  if (digitos.length === 10 || digitos.length === 11) return `55${digitos}`;
  return digitos;
}

/** A URL pública que o paciente abre. */
export function urlBase(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "http://localhost:3000")
  );
}

export function urlConfirmacao(token: string): string {
  return `${urlBase()}/confirmar/${token}`;
}

/**
 * Endereço de uma tela do painel, para os botões dos e-mails.
 *
 * Nenhum e-mail nosso aceita resposta: quando a clínica precisa agir, o
 * caminho é entrar no painel, onde estão a agenda e as configurações.
 */
export function urlPainel(caminho = "/app"): string {
  return `${urlBase()}${caminho.startsWith("/") ? caminho : `/${caminho}`}`;
}
