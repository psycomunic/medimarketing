/**
 * MODELOS DE E-MAIL
 *
 * Cada mensagem sai com a marca da clínica: logo dela no topo e nome
 * dela no remetente. A plataforma só assina discretamente no rodapé —
 * para o paciente, quem cuida dele é a clínica.
 *
 * Nenhuma delas aceita resposta. Quem envia é a caixa da plataforma,
 * que ninguém acompanha, então toda saída é botão: o paciente vai para
 * o link dele, a clínica vai para o painel.
 *
 * Todo estilo é inline. Clientes de e-mail descartam <style> no head,
 * e o Gmail remove classes: o que não estiver no atributo `style` do
 * próprio elemento simplesmente não é aplicado.
 */

export const AZUL = "#0B4F6C";
export const TEAL = "#1A9E8F";
export const MENTA = "#E8F6F3";
export const CINZA = "#6B7A82";
export const TEXTO = "#2E3A40";
export const BORDA = "#E2ECEF";
export const FUNDO = "#F8FBFC";

export type MarcaEmail = {
  clinica: string;
  logoUrl?: string | null;
  /** Para onde o destinatário responde. */
  emailClinica?: string | null;
  telefoneClinica?: string | null;
  /**
   * E-mail do sistema (convite, senha, avisos da plataforma): sai com a
   * identidade da Medi Marketing, não com a de uma clínica.
   */
  sistema?: boolean;
};

/** Logo da Medi Marketing para e-mail: PNG, porque o Gmail descarta SVG. */
export const LOGO_MEDI_EMAIL = `${(
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://medimarketing.com.br"
).replace(/\/$/, "")}/logo-medimarketing-email.png`;

/** A marca dos e-mails que a plataforma manda para os usuários. */
export const MARCA_MEDI: MarcaEmail = {
  clinica: "Medi Marketing",
  logoUrl: LOGO_MEDI_EMAIL,
  emailClinica: "contato@medimarketing.com.br",
  sistema: true,
};

/**
 * Logo da clínica que um cliente de e-mail consegue mostrar. SVG o
 * Gmail descarta, e a imagem quebrada fica pior que o monograma.
 */
function logoUtilizavel(url?: string | null): string | null {
  if (!url) return null;
  return /\.svg(\?|$)/i.test(url) ? null : url;
}

/** Escapa texto que vai para dentro do HTML. */
export function esc(t: string): string {
  return t
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Cabeçalho com a logo, ou o monograma quando ela não existe. */
function cabecalho(m: MarcaEmail): string {
  const nome = esc(m.clinica);

  // A logo da Medi Marketing já traz o nome: vai sozinha
  if (m.sistema) {
    return `
  <tr>
    <td style="padding:28px 32px 20px;border-bottom:1px solid ${BORDA};">
      <img src="${esc(LOGO_MEDI_EMAIL)}" alt="Medi Marketing" width="133" height="23"
        style="display:block;width:133px;height:23px;max-width:133px;border:0;" />
    </td>
  </tr>`;
  }

  // Para o paciente, quem fala é a clínica: logo grande e centralizada,
  // com o nome logo abaixo.
  const logo = logoUtilizavel(m.logoUrl);
  const marca = logo
    ? `<img src="${esc(logo)}" alt="${nome}" height="72"
         style="display:block;margin:0 auto;height:auto;max-height:72px;max-width:240px;width:auto;border:0;" />`
    : `<span style="display:inline-block;width:64px;height:64px;line-height:64px;
         border-radius:14px;background:${AZUL};color:#fff;font-size:28px;
         font-weight:700;text-align:center;">${nome.charAt(0).toUpperCase()}</span>`;

  return `
  <tr>
    <td align="center" style="padding:32px 32px 22px;border-bottom:1px solid ${BORDA};text-align:center;">
      ${marca}
      <p style="margin:12px 0 0;font-size:18px;font-weight:700;color:${AZUL};line-height:1.3;">${nome}</p>
    </td>
  </tr>`;
}

/**
 * Rodapé.
 *
 * Diz explicitamente que a caixa não recebe resposta. O remetente é o
 * endereço da plataforma, que ninguém acompanha: convidar a responder
 * mandaria o paciente falar com uma parede. Toda ação vira botão.
 */
function rodape(m: MarcaEmail): string {
  if (m.sistema) {
    return `
  <tr>
    <td style="padding:20px 32px 28px;border-top:1px solid ${BORDA};">
      <p style="margin:0;font-size:13px;color:${CINZA};line-height:1.5;">
        Medi Marketing &nbsp;·&nbsp;
        <a href="https://medimarketing.com.br" style="color:${TEAL};text-decoration:none;">medimarketing.com.br</a>
      </p>
      <p style="margin:12px 0 0;font-size:11px;color:#9AAAB2;line-height:1.5;">
        Este e-mail é automático e não recebe respostas.
        Dúvidas: contato@medimarketing.com.br
      </p>
    </td>
  </tr>`;
  }

  const contato = [m.telefoneClinica, m.emailClinica]
    .filter(Boolean)
    .map((c) => esc(String(c)))
    .join(" &nbsp;·&nbsp; ");

  return `
  <tr>
    <td style="padding:20px 32px 28px;border-top:1px solid ${BORDA};">
      <p style="margin:0;font-size:13px;color:${CINZA};line-height:1.5;">
        ${esc(m.clinica)}${contato ? `<br />${contato}` : ""}
      </p>
      <p style="margin:12px 0 0;font-size:11px;color:#9AAAB2;line-height:1.5;">
        Este e-mail é automático e não recebe respostas.
        Use os botões acima para qualquer solicitação.
      </p>
      <p style="margin:6px 0 0;font-size:11px;color:#9AAAB2;">
        Agenda gerenciada com Medi Marketing
      </p>
    </td>
  </tr>`;
}

/** Molde comum: largura fixa, fundo claro, cartão branco centralizado. */
function layout(m: MarcaEmail, conteudo: string): string {
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
</head>
<body style="margin:0;padding:24px 12px;background:${FUNDO};
  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560"
        style="max-width:560px;width:100%;background:#fff;border:1px solid ${BORDA};
        border-radius:12px;overflow:hidden;">
        ${cabecalho(m)}
        ${conteudo}
        ${rodape(m)}
      </table>
    </td></tr>
  </table>
</body></html>`;
}

/** Bloco de dados da consulta, em linhas rótulo/valor. */
function blocoDados(itens: [string, string | null | undefined][]): string {
  const linhas = itens
    .filter(([, v]) => v)
    .map(
      ([r, v]) => `
      <tr>
        <td style="padding:6px 0;font-size:14px;color:${CINZA};width:120px;">${esc(r)}</td>
        <td style="padding:6px 0;font-size:14px;color:${TEXTO};font-weight:600;">${esc(String(v))}</td>
      </tr>`
    )
    .join("");

  return `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
    style="background:${MENTA};border-radius:8px;padding:14px 18px;margin:18px 0;">
    <tr><td>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
        ${linhas}
      </table>
    </td></tr>
  </table>`;
}

export function botao(texto: string, url: string, cor = TEAL): string {
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0 8px;">
    <tr><td style="background:${cor};border-radius:999px;">
      <a href="${esc(url)}" style="display:inline-block;padding:12px 26px;font-size:15px;
        font-weight:600;color:#fff;text-decoration:none;">${esc(texto)}</a>
    </td></tr>
  </table>`;
}

/** Link secundário, para a segunda ação sem competir com o botão. */
export function linkSecundario(texto: string, url: string): string {
  return `
  <p style="margin:0 0 4px;font-size:14px;">
    <a href="${esc(url)}" style="color:${TEAL};text-decoration:underline;">${esc(texto)}</a>
  </p>`;
}

export function faixa(cor: string, fundo: string, texto: string): string {
  return `
  <p style="margin:0 0 18px;padding:10px 14px;border-radius:8px;background:${fundo};
    color:${cor};font-size:14px;font-weight:600;">${esc(texto)}</p>`;
}

/* ------------------------------------------------------------------ */
/* Dados                                                               */
/* ------------------------------------------------------------------ */

export type DadosEmailConsulta = {
  paciente: string;
  data: string;
  hora: string;
  diaSemana: string;
  medico?: string | null;
  endereco?: string | null;
  link?: string | null;
  /** "hoje", "amanhã", "na segunda-feira" — usado no lembrete. */
  quando?: string | null;
};

export type Modelo = { assunto: string; html: string; texto: string };

/* ------------------------------------------------------------------ */
/* Para o paciente                                                     */
/* ------------------------------------------------------------------ */

/**
 * Confirmação de que a consulta foi marcada.
 *
 * Sai no momento do agendamento, não na véspera: o paciente acabou de
 * combinar por telefone ou no balcão e ainda não tem nada por escrito.
 * Esta é a mensagem que ele guarda — por isso traz o endereço e não
 * pede ação nenhuma. A cobrança de confirmação vem depois, no lembrete.
 */
export function emailPacienteAgendada(
  m: MarcaEmail,
  d: DadosEmailConsulta
): Modelo {
  const corpo = `
  <tr><td style="padding:24px 32px;">
    ${faixa(TEAL, MENTA, "Consulta marcada")}
    <p style="margin:0 0 4px;font-size:16px;color:${TEXTO};">
      Olá, ${esc(d.paciente)}!
    </p>
    <p style="margin:0;font-size:15px;color:${CINZA};line-height:1.6;">
      Sua consulta na ${esc(m.clinica)} está agendada:
    </p>
    ${blocoDados([
      ["Data", `${d.data} (${d.diaSemana})`],
      ["Horário", d.hora],
      ["Profissional", d.medico],
      ["Local", d.endereco],
    ])}
    <p style="margin:0 0 4px;font-size:15px;color:${CINZA};line-height:1.6;">
      Guarde este e-mail. Na véspera enviamos um lembrete para você
      confirmar presença.
    </p>
    <p style="margin:0;font-size:15px;color:${CINZA};line-height:1.6;">
      Pedimos que chegue com 15 minutos de antecedência.
    </p>
    ${d.link ? botao("Ver os detalhes da consulta", d.link) : ""}
  </td></tr>`;

  return {
    assunto: `Consulta marcada para ${d.data}, às ${d.hora}`,
    html: layout(m, corpo),
    texto: `Ola, ${d.paciente}! Sua consulta na ${m.clinica} ficou marcada para ${d.data} as ${d.hora}${d.medico ? ` com ${d.medico}` : ""}. Na vespera enviamos um lembrete para confirmar.`,
  };
}

/**
 * Lembrete da véspera — o par por e-mail do que já ia por WhatsApp.
 *
 * Faz uma pergunta só: você vem? Tudo na mensagem existe para que a
 * resposta caiba num toque, e o botão é a primeira coisa depois dos
 * dados. Quem não clicar ainda tem o telefone da clínica no rodapé.
 *
 * O tom é de lembrança, não de cobrança: quem esqueceu não precisa se
 * explicar, e quem não puder vir só precisa dizer.
 */
export function emailPacienteLembrete(
  m: MarcaEmail,
  d: DadosEmailConsulta
): Modelo {
  const corpo = `
  <tr><td style="padding:24px 32px;">
    ${faixa(AZUL, MENTA, `Sua consulta é ${d.quando ?? "amanhã"}`)}
    <p style="margin:0 0 4px;font-size:16px;color:${TEXTO};">
      Olá, ${esc(d.paciente)}!
    </p>
    <p style="margin:0;font-size:15px;color:${CINZA};line-height:1.6;">
      Passando para lembrar da sua consulta e confirmar se está tudo
      certo para ${esc(d.quando ?? "amanhã")}:
    </p>
    ${blocoDados([
      ["Data", `${d.data} (${d.diaSemana})`],
      ["Horário", d.hora],
      ["Profissional", d.medico],
      ["Local", d.endereco],
    ])}
    ${d.link ? botao("Sim, confirmo minha presença", d.link) : ""}
    ${
      d.link
        ? linkSecundario("Preciso remarcar para outro dia", d.link)
        : ""
    }
    <p style="margin:14px 0 0;font-size:14px;color:${CINZA};line-height:1.6;">
      Pedimos que chegue com 15 minutos de antecedência. Se não puder
      vir, avisar com antecedência libera o horário para outro paciente.
    </p>
  </td></tr>`;

  return {
    // O assunto é texto puro: escapar aqui deixaria "&" e acento à mostra
    assunto: `${d.paciente}, podemos confirmar sua consulta ${!d.quando || d.quando === "amanhã" ? "de amanhã" : d.quando === "hoje" ? "de hoje" : d.quando}?`,
    html: layout(m, corpo),
    texto: `Ola, ${d.paciente}! Sua consulta na ${m.clinica} e ${d.quando ?? "amanha"}, ${d.data} as ${d.hora}${d.medico ? ` com ${d.medico}` : ""}. Confirme sua presenca ou peca outro horario em: ${d.link ?? ""}`,
  };
}

/** Recibo depois que o paciente confirma pelo link. */
export function emailPacienteConfirmou(
  m: MarcaEmail,
  d: DadosEmailConsulta
): Modelo {
  const corpo = `
  <tr><td style="padding:24px 32px;">
    ${faixa("#16A34A", "#DCFCE7", "Presença confirmada")}
    <p style="margin:0 0 4px;font-size:16px;color:${TEXTO};">
      Olá, ${esc(d.paciente)}!
    </p>
    <p style="margin:0;font-size:15px;color:${CINZA};line-height:1.6;">
      Recebemos sua confirmação. Nos vemos no horário combinado:
    </p>
    ${blocoDados([
      ["Data", `${d.data} (${d.diaSemana})`],
      ["Horário", d.hora],
      ["Profissional", d.medico],
      ["Local", d.endereco],
    ])}
    <p style="margin:0 0 4px;font-size:15px;color:${CINZA};line-height:1.6;">
      Pedimos que chegue com 15 minutos de antecedência.
    </p>
    <p style="margin:0;font-size:15px;color:${CINZA};line-height:1.6;">
      Precisa mudar de horário? Use o botão abaixo: a clínica recebe o
      pedido na hora.
    </p>
    ${d.link ? botao("Ver ou remarcar minha consulta", d.link) : ""}
  </td></tr>`;

  return {
    assunto: `Presença confirmada para ${d.data}, às ${d.hora}`,
    html: layout(m, corpo),
    texto: `Ola, ${d.paciente}! Recebemos sua confirmacao para ${d.data} as ${d.hora}${d.medico ? ` com ${d.medico}` : ""}. Chegue com 15 minutos de antecedencia. Para remarcar, acesse: ${d.link ?? ""}`,
  };
}

/** Novo horário depois que a clínica remarcou. */
export function emailPacienteRemarcada(
  m: MarcaEmail,
  d: DadosEmailConsulta
): Modelo {
  const corpo = `
  <tr><td style="padding:24px 32px;">
    <p style="margin:0 0 4px;font-size:16px;color:${TEXTO};">
      Olá, ${esc(d.paciente)}!
    </p>
    <p style="margin:0;font-size:15px;color:${CINZA};line-height:1.6;">
      Conseguimos remarcar sua consulta. Ficou assim:
    </p>
    ${blocoDados([
      ["Data", `${d.data} (${d.diaSemana})`],
      ["Horário", d.hora],
      ["Profissional", d.medico],
      ["Local", d.endereco],
    ])}
    ${d.link ? botao("Confirmar este horário", d.link) : ""}
    ${
      d.link
        ? linkSecundario("Este dia também não serve? Peça outro horário", d.link)
        : ""
    }
  </td></tr>`;

  return {
    assunto: `Sua consulta foi remarcada para ${d.data}`,
    html: layout(m, corpo),
    texto: `Ola, ${d.paciente}! Sua consulta foi remarcada para ${d.data} as ${d.hora}. Confirme ou peca outro horario em: ${d.link ?? ""}`,
  };
}

/* ------------------------------------------------------------------ */
/* Para a clínica                                                      */
/* ------------------------------------------------------------------ */

/** Aviso de que o paciente confirmou. */
export function emailClinicaConfirmou(
  m: MarcaEmail,
  d: DadosEmailConsulta & { telefone?: string | null; painel?: string | null }
): Modelo {
  const corpo = `
  <tr><td style="padding:24px 32px;">
    ${faixa("#16A34A", "#DCFCE7", "Paciente confirmou a presença")}
    <p style="margin:0;font-size:15px;color:${CINZA};line-height:1.6;">
      <strong style="color:${TEXTO};">${esc(d.paciente)}</strong>
      confirmou pelo link que recebeu.
    </p>
    ${blocoDados([
      ["Data", `${d.data} (${d.diaSemana})`],
      ["Horário", d.hora],
      ["Profissional", d.medico],
      ["Telefone", d.telefone],
    ])}
    <p style="margin:0;font-size:14px;color:${CINZA};line-height:1.6;">
      A agenda já foi atualizada. Nenhuma ação necessária.
    </p>
    ${d.painel ? botao("Abrir a agenda no painel", d.painel, AZUL) : ""}
  </td></tr>`;

  return {
    assunto: `${d.paciente} confirmou a consulta de ${d.data}, às ${d.hora}`,
    html: layout(m, corpo),
    texto: `${d.paciente} confirmou a presenca para ${d.data} as ${d.hora}. A agenda ja foi atualizada.`,
  };
}

/** Pedido de remarcação: o único que exige ação rápida. */
export function emailClinicaReagendar(
  m: MarcaEmail,
  d: DadosEmailConsulta & { telefone?: string | null; painel?: string | null }
): Modelo {
  const corpo = `
  <tr><td style="padding:24px 32px;">
    ${faixa("#B45309", "#FEF3C7", "Paciente pediu para reagendar")}
    <p style="margin:0;font-size:15px;color:${CINZA};line-height:1.6;">
      <strong style="color:${TEXTO};">${esc(d.paciente)}</strong>
      não poderá vir no horário marcado e pediu outro.
      O horário segue reservado até vocês combinarem.
    </p>
    ${blocoDados([
      ["Data atual", `${d.data} (${d.diaSemana})`],
      ["Horário", d.hora],
      ["Profissional", d.medico],
      ["Telefone", d.telefone],
    ])}
    <p style="margin:0 0 4px;font-size:15px;color:${TEXTO};font-weight:600;">
      Entre em contato o quanto antes.
    </p>
    <p style="margin:0;font-size:14px;color:${CINZA};line-height:1.6;">
      Quanto mais cedo, maior a chance de reaproveitar a vaga.
    </p>
    ${d.painel ? botao("Reagendar no painel", d.painel) : ""}
  </td></tr>`;

  return {
    assunto: `Ação: ${d.paciente} pediu para reagendar (${d.data})`,
    html: layout(m, corpo),
    texto: `${d.paciente} pediu para reagendar a consulta de ${d.data} as ${d.hora}. Telefone: ${d.telefone ?? "nao informado"}. Entre em contato o quanto antes.`,
  };
}

/** Cancelamento pelo paciente: libera a vaga para encaixe. */
export function emailClinicaCancelou(
  m: MarcaEmail,
  d: DadosEmailConsulta & { telefone?: string | null; painel?: string | null }
): Modelo {
  const corpo = `
  <tr><td style="padding:24px 32px;">
    ${faixa("#DC2626", "#FEE2E2", "Paciente não vai comparecer")}
    <p style="margin:0;font-size:15px;color:${CINZA};line-height:1.6;">
      <strong style="color:${TEXTO};">${esc(d.paciente)}</strong>
      avisou que não poderá comparecer. A consulta foi cancelada e o
      horário está livre.
    </p>
    ${blocoDados([
      ["Data", `${d.data} (${d.diaSemana})`],
      ["Horário", d.hora],
      ["Profissional", d.medico],
      ["Telefone", d.telefone],
    ])}
    <p style="margin:0;font-size:14px;color:${CINZA};line-height:1.6;">
      Vale oferecer a vaga a quem está na lista de espera.
    </p>
    ${d.painel ? botao("Ver a agenda do dia", d.painel, AZUL) : ""}
  </td></tr>`;

  return {
    assunto: `Cancelada: ${d.paciente}, ${d.data} às ${d.hora}`,
    html: layout(m, corpo),
    texto: `${d.paciente} avisou que nao podera comparecer em ${d.data} as ${d.hora}. O horario esta livre.`,
  };
}

/* ------------------------------------------------------------------ */
/* Acesso ao painel                                                    */
/* ------------------------------------------------------------------ */

/**
 * Convite de quem ganhou acesso, ou o pedido de senha nova.
 *
 * Nenhum dos dois leva senha no corpo: o botão abre a tela de criar
 * senha já autenticada. Assim o e-mail esquecido na caixa de entrada
 * não vira a chave da conta.
 */
export function emailAcesso(
  tipo: "convite" | "redefinir",
  d: { nome: string; clinica?: string | null; link: string; email: string }
): Modelo {
  const m = MARCA_MEDI;
  const convite = tipo === "convite";
  const corpo = `
  <tr><td style="padding:24px 32px;">
    ${faixa(TEAL, MENTA, convite ? "Seu acesso ao painel está pronto" : "Pedido de nova senha")}
    <p style="margin:0 0 4px;font-size:16px;color:${TEXTO};">
      Olá, ${esc(d.nome)}!
    </p>
    <p style="margin:0;font-size:15px;color:${CINZA};line-height:1.6;">
      ${
        convite
          ? `A equipe Medi Marketing criou seu acesso${d.clinica ? ` à ${esc(d.clinica)}` : ""}.
             Lá você acompanha o diagnóstico, os indicadores e a evolução da clínica.
             Para entrar, crie sua senha no botão abaixo.`
          : `Recebemos um pedido para trocar a senha da sua conta. Se foi você,
             crie a senha nova no botão abaixo. Se não foi, ignore este e-mail:
             a senha atual continua valendo.`
      }
    </p>
    ${blocoDados([["Login", d.email]])}
    ${botao(convite ? "Criar minha senha" : "Criar nova senha", d.link)}
    <p style="margin:12px 0 0;font-size:13px;color:${CINZA};line-height:1.6;">
      O link vale por 24 horas e funciona uma vez. Se expirar, use
      “Esqueci minha senha” na tela de login.
    </p>
  </td></tr>`;

  return {
    assunto: convite ? "Seu acesso ao painel Medi Marketing" : "Crie sua nova senha",
    html: layout(m, corpo),
    texto: `${convite ? "Seu acesso ao painel Medi Marketing esta pronto." : "Pedido de nova senha."} Login: ${d.email}. Crie sua senha em: ${d.link}`,
  };
}

/* ------------------------------------------------------------------ */
/* Avisos da equipe                                                    */
/* ------------------------------------------------------------------ */

/**
 * Molde dos avisos internos: faixa com o assunto, uma frase, os dados
 * da consulta e o botão para o painel. O médico lê entre um paciente e
 * outro — tudo o que importa cabe na primeira tela.
 */
export function emailEquipe(
  m: MarcaEmail,
  e: {
    assunto: string;
    faixa: { texto: string; cor?: string; fundo?: string };
    frase: string;
    dados: [string, string | null | undefined][];
    nota?: string | null;
    botao?: { texto: string; url: string } | null;
  }
): Modelo {
  const corpo = `
  <tr><td style="padding:24px 32px;">
    ${faixa(e.faixa.cor ?? TEAL, e.faixa.fundo ?? MENTA, e.faixa.texto)}
    <p style="margin:0;font-size:15px;color:${CINZA};line-height:1.6;">${esc(e.frase)}</p>
    ${blocoDados(e.dados)}
    ${e.nota ? `<p style="margin:0;font-size:14px;color:${CINZA};line-height:1.6;">${esc(e.nota)}</p>` : ""}
    ${e.botao ? botao(e.botao.texto, e.botao.url, AZUL) : ""}
  </td></tr>`;

  const texto = [
    e.faixa.texto,
    e.frase,
    ...e.dados.filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`),
    e.nota,
    e.botao?.url,
  ]
    .filter(Boolean)
    .join("\n");

  return { assunto: e.assunto, html: layout(m, corpo), texto };
}

export type ItemAgenda = { hora: string; paciente: string; situacao: string; tipo?: string | null };

/** Resumo da manhã: as consultas do dia de um profissional. */
export function emailAgendaDoDia(
  m: MarcaEmail,
  d: { nome: string; data: string; diaSemana: string; itens: ItemAgenda[]; painel: string }
): Modelo {
  const total = `${d.itens.length} consulta${d.itens.length === 1 ? "" : "s"}`;
  const linhas = d.itens
    .map(
      (i) => `
      <tr>
        <td style="padding:8px 0;font-size:14px;color:${AZUL};font-weight:700;width:64px;vertical-align:top;border-bottom:1px solid ${BORDA};">${esc(i.hora)}</td>
        <td style="padding:8px 0;font-size:14px;color:${TEXTO};vertical-align:top;border-bottom:1px solid ${BORDA};">
          ${esc(i.paciente)}${i.tipo ? `<span style="color:${CINZA};"> · ${esc(i.tipo)}</span>` : ""}
          <br /><span style="font-size:12px;color:${CINZA};">${esc(i.situacao)}</span>
        </td>
      </tr>`
    )
    .join("");

  const corpo = `
  <tr><td style="padding:24px 32px;">
    ${faixa(AZUL, MENTA, `Sua agenda de hoje: ${total}`)}
    <p style="margin:0 0 4px;font-size:16px;color:${TEXTO};">Bom dia, ${esc(d.nome)}!</p>
    <p style="margin:0;font-size:15px;color:${CINZA};line-height:1.6;">
      ${esc(d.diaSemana)}, ${esc(d.data)}.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:16px 0;">
      ${linhas}
    </table>
    ${botao("Abrir a agenda", d.painel, AZUL)}
  </td></tr>`;

  return {
    assunto: `Agenda de hoje (${d.data}): ${total}`,
    html: layout(m, corpo),
    texto: [`Agenda de hoje, ${d.data}:`, ...d.itens.map((i) => `${i.hora} ${i.paciente} (${i.situacao})`), d.painel].join("\n"),
  };
}

/** Consulta cancelada, para o paciente. Sem culpa e com o caminho de volta. */
export function emailPacienteCancelada(m: MarcaEmail, d: DadosEmailConsulta): Modelo {
  const corpo = `
  <tr><td style="padding:24px 32px;">
    ${faixa("#B45309", "#FEF3C7", "Consulta cancelada")}
    <p style="margin:0 0 4px;font-size:16px;color:${TEXTO};">Olá, ${esc(d.paciente)}!</p>
    <p style="margin:0;font-size:15px;color:${CINZA};line-height:1.6;">
      Sua consulta na ${esc(m.clinica)} foi cancelada:
    </p>
    ${blocoDados([
      ["Data", `${d.data} (${d.diaSemana})`],
      ["Horário", d.hora],
      ["Profissional", d.medico],
    ])}
    <p style="margin:0;font-size:15px;color:${CINZA};line-height:1.6;">
      Quando quiser remarcar, é só falar com a clínica${m.telefoneClinica ? ` pelo ${esc(m.telefoneClinica)}` : ""}.
    </p>
  </td></tr>`;

  return {
    assunto: `Consulta de ${d.data}, às ${d.hora}, cancelada`,
    html: layout(m, corpo),
    texto: `Ola, ${d.paciente}! Sua consulta na ${m.clinica} de ${d.data} as ${d.hora} foi cancelada. Quando quiser remarcar, fale com a clinica.`,
  };
}
