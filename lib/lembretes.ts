/**
 * Regras do lembrete de confirmação.
 *
 * Funções puras, sem banco e sem rede: são usadas tanto pela rotina de
 * disparo quanto pela tela do painel, e precisam dar o mesmo resultado
 * nos dois lugares.
 */
import type { Organization } from "@/lib/supabase/types";

/** Sábado e domingo. Feriado não entra: exigiria calendário por cidade. */
function ehFimDeSemana(d: Date): boolean {
  const dia = d.getDay();
  return dia === 0 || dia === 6;
}

/**
 * Quando o lembrete de uma consulta deve sair.
 *
 * Anda `diasUteis` para trás pulando fim de semana, e fixa o horário
 * escolhido pela clínica. É por isso que a contagem é em dias úteis e
 * não em horas: consulta de segunda de manhã precisa avisar na sexta,
 * senão a mensagem cai no sábado e ninguém lê a tempo.
 */
export function calcularDisparo(
  dataConsulta: Date,
  diasUteis: number,
  hora: number
): Date {
  const d = new Date(dataConsulta);
  d.setHours(hora, 0, 0, 0);

  let restantes = Math.max(1, diasUteis);
  while (restantes > 0) {
    d.setDate(d.getDate() - 1);
    if (!ehFimDeSemana(d)) restantes--;
  }

  return d;
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

const DIAS = [
  "domingo", "segunda-feira", "terça-feira", "quarta-feira",
  "quinta-feira", "sexta-feira", "sábado",
];

export function formatarData(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

export function formatarHora(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function diaDaSemana(iso: string): string {
  return DIAS[new Date(iso).getDay()];
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
      .replaceAll("{paciente}", d.paciente)
      .replaceAll("{data}", data)
      .replaceAll("{hora}", hora)
      .replaceAll("{clinica}", d.clinica)
      .replaceAll("{profissional}", d.medico ?? "")
      .replaceAll("{link}", d.link);

    return texto.includes(d.link)
      ? texto
      : `${texto}\n\nConfirme sua presença: ${d.link}`;
  }

  const linhas = [
    `Olá, ${d.paciente}! 👋`,
    "",
    "Sua consulta está agendada para:",
    "",
    `📅 Data: ${data} (${diaDaSemana(d.dataHora)})`,
    `🕐 Horário: ${hora}`,
  ];

  if (d.medico) linhas.push(`👨‍⚕️ Profissional: ${d.medico}`);
  if (d.endereco) linhas.push(`📍 Local: ${d.endereco}`);

  linhas.push(
    "",
    "✅ Para confirmar sua presença, clique no link abaixo:",
    d.link,
    "",
    "🕐 Recomendamos chegar com 15 minutos de antecedência.",
    "ℹ️ Se precisar reagendar ou tiver dúvidas, é só responder esta mensagem.",
    "",
    `Aguardamos você! 💚`,
    d.clinica
  );

  return linhas.join("\n");
}

/**
 * Link do WhatsApp com a mensagem pronta.
 *
 * É o caminho que a recepção usa enquanto a API oficial não está
 * conectada: abre a conversa com o texto já digitado, bastando enviar.
 */
export function linkWhatsApp(telefone: string, texto: string): string {
  const numero = normalizarTelefone(telefone);
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
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
export function urlConfirmacao(token: string): string {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "http://localhost:3000");

  return `${base}/confirmar/${token}`;
}
