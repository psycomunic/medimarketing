/**
 * BIBLIOTECA DE MENSAGENS AO PACIENTE
 *
 * Todo texto que sai da clínica para o paciente nasce aqui. Centralizar
 * evita o que costuma acontecer: cada tela inventando um tom diferente,
 * uma dizendo "Sr." e outra chamando pelo primeiro nome.
 *
 * A régua de escrita, tirada da trilha "Secretária Vendedora":
 *
 *   - Uma ação clara por mensagem. Duas perguntas confundem.
 *   - Sem pressão e sem urgência artificial: é saúde, não liquidação.
 *   - Sempre assinada pela clínica, para o paciente saber quem escreve.
 *   - Sem emoji nos modelos padrão. Ver `somenteLatin1` logo abaixo.
 */

/**
 * O WhatsApp Desktop decodifica o `wa.me?text=` como Latin-1, e não como
 * UTF-8. Consequência medida em mensagem real: acentos chegam certos
 * (cabem em Latin-1) e qualquer caractere acima de U+00FF — todo emoji,
 * travessão, aspas curvas, bullet — vira um losango de erro.
 *
 * A codificação do nosso lado está correta; o cliente é que erra. Como
 * não dá para consertar o WhatsApp dos outros, a saída é não depender do
 * que ele quebra: neste caminho a mensagem é reduzida a Latin-1.
 *
 * A API oficial não tem esse problema, então lá o texto vai inteiro.
 */
export function somenteLatin1(texto: string): string {
  const trocas: Record<string, string> = {
    "—": "-",
    "–": "-",
    "•": "-",
    "…": "...",
    "“": '"',
    "”": '"',
    "‘": "'",
    "’": "'",
    " ": " ",
  };

  return [...texto]
    .map((c) => {
      if (trocas[c]) return trocas[c];
      return (c.codePointAt(0) ?? 0) <= 0xff ? c : "";
    })
    .join("")
    // Emoji removido no meio da frase deixa espaço duplo
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ +$/gm, "");
}

/* ------------------------------------------------------------------ */
/* Dados que as mensagens usam                                         */
/* ------------------------------------------------------------------ */

export type DadosConsulta = {
  paciente: string;
  clinica: string;
  data: string;
  hora: string;
  diaSemana: string;
  medico?: string | null;
  endereco?: string | null;
  telefoneClinica?: string | null;
  link?: string | null;
};

/** Primeiro nome, para a mensagem não parecer formulário. */
export function primeiroNome(nome: string): string {
  const limpo = nome.trim().replace(/^(dr|dra|sr|sra)\.?\s+/i, "");
  const primeiro = limpo.split(/\s+/)[0] ?? limpo;
  // Nome todo em maiúscula (comum em importação) fica gritado
  return primeiro === primeiro.toUpperCase()
    ? primeiro.charAt(0) + primeiro.slice(1).toLowerCase()
    : primeiro;
}

/** Junta as linhas descartando as vazias do início e do fim. */
function montar(linhas: (string | null | false)[]): string {
  return linhas
    .filter((l): l is string => typeof l === "string")
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Bloco de dados que aparece em quase toda mensagem de consulta. */
function blocoConsulta(d: DadosConsulta): string[] {
  return [
    `Data: ${d.data} (${d.diaSemana})`,
    `Horário: ${d.hora}`,
    d.medico ? `Profissional: ${d.medico}` : null,
    d.endereco ? `Local: ${d.endereco}` : null,
  ].filter((l): l is string => l !== null);
}

/* ------------------------------------------------------------------ */
/* Consulta                                                            */
/* ------------------------------------------------------------------ */

/**
 * Lembrete da véspera, com o link de confirmação.
 *
 * A pergunta é uma só: você vem? O link resolve em um toque, e quem
 * preferir responder por texto também é atendido — obrigar o clique
 * perderia justamente o paciente com menos intimidade com o celular.
 */
export function msgConfirmacao(d: DadosConsulta): string {
  return montar([
    `Olá, ${primeiroNome(d.paciente)}! Aqui é da ${d.clinica}.`,
    "",
    "Passando para lembrar da sua consulta:",
    "",
    ...blocoConsulta(d),
    "",
    d.link ? "Para confirmar sua presença, é só tocar no link:" : null,
    d.link ? d.link : null,
    d.link ? "" : null,
    "Pedimos que chegue com 15 minutos de antecedência.",
    "Se precisar remarcar ou tiver qualquer dúvida, responda por aqui que a gente resolve.",
    "",
    `Até lá!`,
    d.clinica,
  ]);
}

/** Enviada logo depois de marcar, para o paciente ter o registro. */
export function msgAgendada(d: DadosConsulta): string {
  return montar([
    `Olá, ${primeiroNome(d.paciente)}! Aqui é da ${d.clinica}.`,
    "",
    "Sua consulta ficou marcada:",
    "",
    ...blocoConsulta(d),
    "",
    "Guarde esta mensagem. Enviaremos um lembrete na véspera para você confirmar.",
    "Se precisar mudar alguma coisa, é só responder por aqui.",
    "",
    `Até breve!`,
    d.clinica,
  ]);
}

/**
 * Novo horário depois de um pedido de remarcação.
 *
 * Começa reconhecendo o pedido: o paciente pediu, e a primeira coisa que
 * ele quer saber é se foi atendido.
 */
export function msgReagendada(d: DadosConsulta): string {
  return montar([
    `Olá, ${primeiroNome(d.paciente)}! Aqui é da ${d.clinica}.`,
    "",
    "Conseguimos remarcar sua consulta. Ficou assim:",
    "",
    ...blocoConsulta(d),
    "",
    d.link ? "Se este horário funcionar, confirme por aqui:" : null,
    d.link ? d.link : null,
    d.link ? "" : null,
    "Caso ainda não seja o melhor dia, me diga qual período prefere que eu procuro outra opção.",
    "",
    d.clinica,
  ]);
}

/** Confirmação de que a consulta foi cancelada, sem cobrança nem culpa. */
export function msgCancelada(d: DadosConsulta): string {
  return montar([
    `Olá, ${primeiroNome(d.paciente)}! Aqui é da ${d.clinica}.`,
    "",
    `Sua consulta de ${d.data}, às ${d.hora}, foi cancelada conforme você pediu.`,
    "",
    "Quando quiser remarcar, é só me chamar por aqui. Fica tudo registrado, você não precisa explicar de novo.",
    "",
    "Cuide-se!",
    d.clinica,
  ]);
}

/* ------------------------------------------------------------------ */
/* Réguas de relacionamento                                            */
/* ------------------------------------------------------------------ */

/**
 * Modelos das cadências automáticas.
 *
 * Usam `{paciente}` e `{clinica}`, trocados na hora do disparo. Escritos
 * para serem editados: a clínica ajusta o tom, e o que está aqui é um
 * ponto de partida que já funciona.
 */
export const MODELOS_REGUA = {
  reabordagem: [
    {
      atrasoHoras: 48,
      canal: "whatsapp" as const,
      mensagem:
        "Oi, {paciente}! Passando para saber se ficou alguma dúvida sobre o que conversamos. Se quiser, posso explicar melhor qualquer parte do tratamento, sem compromisso.",
    },
    {
      atrasoHoras: 96,
      canal: "whatsapp" as const,
      mensagem:
        "{paciente}, lembrei de você hoje. Separei um caso bem parecido com o seu, com antes e depois. Quer que eu mande para você ver o resultado?",
    },
    {
      atrasoHoras: 168,
      canal: "whatsapp" as const,
      mensagem:
        "Oi, {paciente}! Vou parar por aqui para não incomodar. Deixo a porta aberta: quando fizer sentido para você, me chama que retomo de onde paramos. Um abraço da equipe {clinica}.",
    },
  ],

  no_show: [
    {
      atrasoHoras: 2,
      canal: "whatsapp" as const,
      mensagem:
        "Oi, {paciente}! Você tinha horário com a gente hoje e acabou não conseguindo vir. Está tudo bem? Se quiser, consigo te encaixar ainda esta semana.",
    },
    {
      atrasoHoras: 24,
      canal: "telefone" as const,
      mensagem:
        "Ligação de recuperação: entender o que aconteceu e já oferecer dois horários concretos, em vez de perguntar quando ele pode.",
    },
    {
      atrasoHoras: 72,
      canal: "whatsapp" as const,
      mensagem:
        "{paciente}, abriram dois horários novos na agenda. Quer que eu reserve um para você? Só me dizer qual período prefere.",
    },
  ],

  reativacao: [
    {
      atrasoHoras: 0,
      canal: "whatsapp" as const,
      mensagem:
        "Oi, {paciente}! Faz um tempo que você não aparece por aqui e lembrei de você. Como está indo o seu tratamento?",
    },
    {
      atrasoHoras: 120,
      canal: "whatsapp" as const,
      mensagem:
        "{paciente}, este mês a avaliação de retorno é por nossa conta para quem já é paciente da casa. Se quiser aproveitar, me diga qual semana fica melhor.",
    },
  ],

  recall: [
    {
      atrasoHoras: 168,
      canal: "whatsapp" as const,
      mensagem:
        "Oi, {paciente}! Já faz uma semana do seu procedimento. Como você está se sentindo? Qualquer coisa fora do esperado, me avise.",
    },
    {
      atrasoHoras: 720,
      canal: "whatsapp" as const,
      mensagem:
        "{paciente}, chegou o momento da sua revisão. É rapidinha e serve para conferir se está tudo evoluindo bem. Qual dia da semana costuma ser melhor para você?",
    },
  ],

  pos_consulta: [
    {
      atrasoHoras: 24,
      canal: "whatsapp" as const,
      mensagem:
        "Oi, {paciente}! Tudo certo depois da consulta de ontem? Se surgir qualquer dúvida sobre os cuidados, é só me chamar.",
    },
    {
      atrasoHoras: 120,
      canal: "whatsapp" as const,
      mensagem:
        "{paciente}, se o atendimento foi bom para você, uma avaliação no Google ajuda muito outras pessoas a encontrarem a gente. Se preferir, também adoramos ouvir sua opinião por aqui mesmo.",
    },
  ],
} as const;

/**
 * Troca as variáveis de um modelo de régua.
 *
 * Aceita chaves entre chaves ({paciente}) porque é o formato que a
 * clínica vê e edita na tela de Retenção.
 */
export function preencherModelo(
  modelo: string,
  vars: { paciente: string; clinica: string; data?: string; hora?: string }
): string {
  return modelo
    .replaceAll("{paciente}", primeiroNome(vars.paciente))
    .replaceAll("{clinica}", vars.clinica)
    .replaceAll("{data}", vars.data ?? "")
    .replaceAll("{hora}", vars.hora ?? "");
}
