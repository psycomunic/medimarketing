import "server-only";

import { normalizarTelefone } from "@/lib/lembretes";

/**
 * CLIENTE DA API DO MERGE
 *
 * O Merge é a plataforma de atendimento onde cada clínica conecta o
 * próprio número de WhatsApp por QR code. Isso muda uma coisa
 * importante em relação ao e-mail: lá a mensagem sai de um endereço
 * nosso com o nome da clínica; aqui ela sai do número da clínica
 * mesmo. Para o paciente é a conversa de sempre, no mesmo fio.
 *
 * A chave da API é da conta da agência e vale para todas as conexões.
 * Quem separa uma clínica da outra é o `connectionId` — por isso ele
 * fica guardado em `organizations.merge_connection_id`, e nenhuma
 * função aqui adivinha qual usar: quem chama informa.
 *
 * Como a conexão é por QR code (não é a Cloud API da Meta), não existe
 * janela de 24 horas nem template aprovado: texto livre a qualquer
 * hora. Em compensação o número é o real da clínica, então volume e
 * bom senso importam — quem manda spam perde o número.
 */

const BASE = process.env.MERGE_API_URL?.replace(/\/$/, "") ?? "https://api.merge.wirdo.com.br";

export function mergeConfigurado(): boolean {
  return !!process.env.MERGE_API_KEY;
}

/** O slug identifica a empresa da agência dentro do Merge. */
function slug(): string | null {
  return process.env.MERGE_SLUG?.trim() || null;
}

type Resposta<T> = { ok: true; dados: T } | { ok: false; erro: string; status?: number };

/**
 * Chamada crua à API.
 *
 * Nunca lança: mensagem é efeito colateral: a consulta já foi
 * confirmada, o aviso no painel já está lá. Quem chama decide se o
 * silêncio importa.
 */
async function chamar<T>(
  caminho: string,
  init?: { metodo?: string; corpo?: unknown }
): Promise<Resposta<T>> {
  if (!mergeConfigurado()) return { ok: false, erro: "MERGE_API_KEY ausente" };

  try {
    const resp = await fetch(`${BASE}${caminho}`, {
      method: init?.metodo ?? "GET",
      headers: {
        Authorization: `Bearer ${process.env.MERGE_API_KEY}`,
        "Content-Type": "application/json",
      },
      ...(init?.corpo ? { body: JSON.stringify(init.corpo) } : {}),
      cache: "no-store",
    });

    const texto = await resp.text();
    const corpo = texto ? JSON.parse(texto) : null;

    if (!resp.ok) {
      const erro = corpo?.message ?? corpo?.erro ?? `HTTP ${resp.status}`;
      console.error(`[merge] ${caminho} recusado:`, resp.status, String(erro).slice(0, 200));
      return { ok: false, erro: String(erro), status: resp.status };
    }

    return { ok: true, dados: corpo as T };
  } catch (e) {
    const erro = e instanceof Error ? e.message : "falha de rede";
    console.error(`[merge] ${caminho} falhou:`, erro);
    return { ok: false, erro };
  }
}

/* ------------------------------------------------------------------ */
/* Conexões — os números de WhatsApp ligados à conta                   */
/* ------------------------------------------------------------------ */

export type Conexao = {
  id: number;
  nome: string;
  numero: string;
  /** Pareado e pronto para enviar. */
  conectada: boolean;
  /**
   * "wpp" é o celular lido por QR code — texto livre a qualquer hora.
   * "meta" é a Cloud API oficial, que só aceita texto livre dentro de
   * 24h da última mensagem do paciente. A diferença muda o que dá para
   * prometer, então ela sobe até a tela de configuração.
   */
  provedor: "wpp" | "meta" | string;
};

/**
 * A API devolve os campos com outros nomes do que a documentação
 * publicada sugere — `identifier` no lugar de `number`, status em
 * maiúsculas, e a lista embrulhada em `{ connections: [...] }`.
 * A tradução mora aqui para não vazar essa diferença adiante.
 */
type ConexaoCrua = {
  id: number;
  name?: string;
  identifier?: string;
  number?: string;
  status?: string;
  provider?: string;
};

function traduzir(c: ConexaoCrua): Conexao {
  return {
    id: c.id,
    nome: c.name ?? "Sem nome",
    numero: c.identifier ?? c.number ?? "",
    conectada: (c.status ?? "").toUpperCase() === "CONNECTED",
    provedor: c.provider ?? "wpp",
  };
}

/**
 * Números disponíveis na conta.
 *
 * Serve à tela de configuração: o dono da clínica escolhe na lista
 * qual número é o dele, em vez de digitar um id numérico.
 */
export async function listarConexoes(): Promise<Conexao[]> {
  const r = await chamar<{ connections?: ConexaoCrua[] } | ConexaoCrua[]>(
    "/v1/connections/"
  );
  if (!r.ok) return [];

  const lista = Array.isArray(r.dados) ? r.dados : (r.dados?.connections ?? []);
  return lista.map(traduzir);
}

export async function conexaoAtiva(id: number): Promise<boolean> {
  const conexoes = await listarConexoes();
  return conexoes.some((c) => c.id === id && c.conectada);
}

/* ------------------------------------------------------------------ */
/* Contatos                                                            */
/* ------------------------------------------------------------------ */

/**
 * Número em formato aceitável, ou nada.
 *
 * Cadastro de paciente vem cheio de telefone pela metade. Mandar um
 * número truncado para a API vira contato lixo na conta da clínica,
 * então o corte é aqui: DDI + DDD + 8 ou 9 dígitos.
 */
function numeroValido(telefone: string): string | null {
  const numero = normalizarTelefone(telefone);
  return /^55\d{10,11}$/.test(numero) ? numero : null;
}

/**
 * Encontra o contato pelo número, criando se ainda não existir.
 *
 * O envio de texto pede um id numérico, e a rota que cria o contato
 * devolve um uuid — por isso a busca vem depois do cadastro, e não no
 * lugar dele. Nenhuma das duas é destrutiva: a criação atualiza um
 * contato existente sem sobrescrever o que já estiver preenchido.
 *
 * Devolve `null` se não deu para resolver. Quem chama tem um plano B:
 * o agendamento cria o contato sozinho, sem precisar do slug.
 */
export async function garantirContato(
  nome: string,
  telefone: string
): Promise<number | null> {
  const numero = numeroValido(telefone);
  if (!numero) return null;

  const achado = await buscarContato(numero);
  if (achado) return achado;

  const empresa = slug();
  if (!empresa) return null;

  await chamar(`/v1/contacts/company/${encodeURIComponent(empresa)}`, {
    metodo: "POST",
    corpo: { name: nome, number: numero },
  });

  return buscarContato(numero);
}

/**
 * O mesmo celular escrito das duas formas que existem no Brasil.
 *
 * Desde 2016 o celular tem nove dígitos, mas o identificador que o
 * WhatsApp usa para números antigos de muitos DDDs continua com oito.
 * O cadastro da clínica costuma ter a forma nova; a conversa que já
 * existe no Merge, a antiga. Procurar só pelo que está no cadastro
 * criaria um contato novo do lado de uma conversa que já existe — o
 * paciente vira duas pessoas, e o histórico que a recepção enxerga
 * fica partido em dois.
 */
function variantes(numero: string): string[] {
  const ddd = numero.slice(2, 4);
  const resto = numero.slice(4);
  const formas = new Set([numero]);

  if (resto.length === 9 && resto.startsWith("9")) {
    formas.add(`55${ddd}${resto.slice(1)}`);
  } else if (resto.length === 8) {
    formas.add(`55${ddd}9${resto}`);
  }

  return [...formas];
}

async function buscarContato(numero: string): Promise<number | null> {
  // Os oito dígitos finais são o que as duas formas têm em comum
  const sufixo = numero.slice(-8);

  const r = await chamar<{ data?: Array<{ id: number; number: string }> }>(
    `/v1/contacts/?search=${encodeURIComponent(sufixo)}&limit=20`
  );
  if (!r.ok) return null;

  const aceitos = new Set(variantes(numero));
  const achado = (r.dados?.data ?? []).find((c) =>
    aceitos.has(normalizarTelefone(c.number))
  );
  return achado?.id ?? null;
}

/* ------------------------------------------------------------------ */
/* Envio                                                               */
/* ------------------------------------------------------------------ */

export type EnvioMerge =
  | { enviado: true; messageUuid: string }
  | { enviado: false; motivo: string };

/**
 * Manda uma mensagem de texto agora, pelo número da clínica.
 *
 * O Merge registra a mensagem no atendimento aberto do contato ou abre
 * um novo — é o que faz a agência conseguir acompanhar a conversa
 * depois, no mesmo lugar onde a secretária atende.
 */
export async function enviarTexto(args: {
  conexaoId: number;
  nome: string;
  telefone: string;
  texto: string;
}): Promise<EnvioMerge> {
  const contatoId = await garantirContato(args.nome, args.telefone);

  // Paciente que nunca falou com a clínica ainda não é contato lá. A
  // rota de agendamento cria o contato a partir do número, então ela
  // resolve o primeiro envio — com um minuto de atraso, que numa
  // mensagem de lembrete não muda nada.
  if (!contatoId) {
    return agendarTexto({ ...args, quando: new Date(Date.now() + 60_000) });
  }

  const r = await chamar<{ messageUuid: string }>(`/v1/messages/text/${contatoId}`, {
    metodo: "POST",
    corpo: { connectionId: args.conexaoId, text: args.texto },
  });

  if (!r.ok) return { enviado: false, motivo: r.erro };
  return { enviado: true, messageUuid: r.dados.messageUuid };
}

/**
 * Deixa a mensagem programada para uma data futura.
 *
 * É o caminho certo para o lembrete de consulta: o cron da Vercel roda
 * uma vez por dia, então sem agendamento a mensagem sairia na hora da
 * passada da manhã, não na hora escolhida pela clínica. Aqui o Merge
 * segura e dispara no minuto certo.
 *
 * Diferente do envio imediato, esta rota aceita o contato pelos dados
 * — não é preciso resolver o id antes.
 */
export async function agendarTexto(args: {
  conexaoId: number;
  nome: string;
  telefone: string;
  texto: string;
  quando: Date;
}): Promise<EnvioMerge> {
  const numero = numeroValido(args.telefone);
  if (!numero) return { enviado: false, motivo: "telefone inválido" };
  if (args.quando.getTime() <= Date.now()) {
    return { enviado: false, motivo: "horário no passado" };
  }

  const r = await chamar<{ id: number }>("/v1/scheduled-messages/", {
    metodo: "POST",
    corpo: {
      type: "message",
      whatsappId: args.conexaoId,
      contactData: { name: args.nome, number: numero },
      body: args.texto,
      sendAt: args.quando.toISOString(),
      timezone: "America/Sao_Paulo",
    },
  });

  if (!r.ok) return { enviado: false, motivo: r.erro };
  return { enviado: true, messageUuid: String(r.dados?.id ?? "") };
}
