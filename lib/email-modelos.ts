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
};

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

  const marca = m.logoUrl
    ? `<img src="${esc(m.logoUrl)}" alt="${nome}" height="48"
         style="display:block;max-height:48px;width:auto;border:0;" />`
    : `<span style="display:inline-block;width:48px;height:48px;line-height:48px;
         border-radius:10px;background:${AZUL};color:#fff;font-size:22px;
         font-weight:700;text-align:center;">${nome.charAt(0).toUpperCase()}</span>`;

  return `
  <tr>
    <td style="padding:28px 32px 20px;border-bottom:1px solid ${BORDA};">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="padding-right:12px;vertical-align:middle;">${marca}</td>
          <td style="vertical-align:middle;">
            <span style="font-size:17px;font-weight:700;color:${AZUL};">${nome}</span>
          </td>
        </tr>
      </table>
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
    ${faixa(AZUL, MENTA, "Sua consulta é amanhã")}
    <p style="margin:0 0 4px;font-size:16px;color:${TEXTO};">
      Olá, ${esc(d.paciente)}!
    </p>
    <p style="margin:0;font-size:15px;color:${CINZA};line-height:1.6;">
      Passando para lembrar da sua consulta e confirmar se está tudo
      certo para amanhã:
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
    assunto: `${d.paciente}, podemos confirmar sua consulta de amanhã?`,
    html: layout(m, corpo),
    texto: `Ola, ${d.paciente}! Sua consulta na ${m.clinica} e amanha, ${d.data} as ${d.hora}${d.medico ? ` com ${d.medico}` : ""}. Confirme sua presenca ou peca outro horario em: ${d.link ?? ""}`,
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
