/**
 * E-MAILS DE CONTA — os que o Supabase Auth dispara
 *
 * Confirmação de cadastro, recuperação de senha, troca de endereço.
 * Diferente dos e-mails de consulta, estes não falam em nome de uma
 * clínica: quem escreve é a plataforma, e quem lê é o médico ou o dono
 * da clínica. Por isso a marca aqui é a Medi Marketing.
 *
 * O corpo sai com as variáveis do Supabase intactas — `{{ .Token }}`,
 * `{{ .ConfirmationURL }}` — porque é ele quem preenche na hora do
 * envio. Isso obriga um cuidado: nada de escapar essas marcas, e nada
 * de interpolar valor nenhum onde elas ficam.
 *
 * Os arquivos prontos para colar no painel ficam em `supabase/emails/`
 * e são gerados por `npm run emails:auth`.
 */

import {
  AZUL,
  BORDA,
  CINZA,
  FUNDO,
  MENTA,
  TEAL,
  TEXTO,
  botao,
  faixa,
} from "@/lib/email-modelos";

/**
 * Cabeçalho com a logo da plataforma.
 *
 * É PNG e não SVG porque cliente de e-mail não renderiza vetor de
 * forma confiável: o Gmail simplesmente descarta. O arquivo é gerado
 * a partir do SVG oficial em dobro do tamanho, para não borrar em tela
 * retina, e mora no domínio público para o e-mail poder buscá-lo.
 *
 * O texto alternativo é o nome da marca: quem bloqueia imagens, e é
 * muita gente, ainda lê de quem veio a mensagem.
 */
function cabecalho(): string {
  const logo = `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://medimarketing.com.br"}/logo-medimarketing-email.png`;

  return `
  <tr>
    <td style="padding:28px 32px 20px;border-bottom:1px solid ${BORDA};">
      <img src="${logo}" alt="Medi Marketing" height="34"
        style="display:block;height:34px;width:auto;border:0;" />
    </td>
  </tr>`;
}

/**
 * Rodapé.
 *
 * Sempre com a linha de "não foi você": e-mail de conta é o alvo
 * preferido de quem tenta invadir, e a pessoa precisa saber num
 * relance que pode simplesmente ignorar.
 */
function rodape(seguranca: string): string {
  return `
  <tr>
    <td style="padding:20px 32px 28px;border-top:1px solid ${BORDA};">
      <p style="margin:0;font-size:13px;color:${CINZA};line-height:1.5;">
        ${seguranca}
      </p>
      <p style="margin:12px 0 0;font-size:11px;color:#9AAAB2;line-height:1.5;">
        Este e-mail é automático e não recebe respostas.<br />
        Medi Marketing &nbsp;·&nbsp; contato@medimarketing.com.br
      </p>
    </td>
  </tr>`;
}

function layout(conteudo: string, seguranca: string): string {
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
        ${cabecalho()}
        ${conteudo}
        ${rodape(seguranca)}
      </table>
    </td></tr>
  </table>
</body></html>`;
}

/** Caixa com o código de seis dígitos, para quem prefere digitar. */
function codigo(): string {
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
    style="background:${MENTA};border-radius:8px;margin:18px 0;">
    <tr><td align="center" style="padding:18px;">
      <span style="font-size:12px;color:${CINZA};display:block;margin-bottom:6px;">
        Ou digite este código
      </span>
      <span style="font-size:28px;letter-spacing:6px;font-weight:700;color:${AZUL};
        font-family:'Courier New',monospace;">{{ .Token }}</span>
    </td></tr>
  </table>`;
}

/**
 * Parágrafo padrão. Existe para o corpo dos modelos ficar legível —
 * sem ele, cada linha de texto carrega trinta caracteres de estilo.
 */
function p(texto: string, cor = CINZA): string {
  return `<p style="margin:0 0 12px;font-size:15px;color:${cor};line-height:1.6;">${texto}</p>`;
}

function bloco(conteudo: string): string {
  return `<tr><td style="padding:24px 32px;">${conteudo}</td></tr>`;
}

export type ModeloAuth = {
  /** Nome do modelo no painel do Supabase. */
  painel: string;
  arquivo: string;
  assunto: string;
  html: string;
};

/* ------------------------------------------------------------------ */
/* Os modelos                                                          */
/* ------------------------------------------------------------------ */

const NAO_FOI_VOCE_IGNORE =
  "Se você não fez esta solicitação, pode ignorar este e-mail. Nada acontece sem a confirmação acima.";

export const MODELOS_AUTH: ModeloAuth[] = [
  {
    painel: "Confirm signup",
    arquivo: "confirmacao-cadastro.html",
    assunto: "Confirme seu e-mail para ativar sua conta",
    html: layout(
      bloco(`
        ${faixa(TEAL, MENTA, "Bem-vindo à Medi Marketing")}
        ${p(`Seu cadastro foi criado. Falta um passo: confirmar que este endereço é seu.`, TEXTO)}
        ${p("Depois disso, sua conta fica aguardando a liberação da nossa equipe, e avisamos assim que estiver pronta.")}
        ${botao("Confirmar meu e-mail", "{{ .ConfirmationURL }}")}
        ${codigo()}
        ${p(`<span style="font-size:13px;">O link vale por 24 horas.</span>`)}
      `),
      "Se você não criou esta conta, ignore este e-mail. Nenhum acesso é liberado sem a confirmação."
    ),
  },
  {
    painel: "Reset Password",
    arquivo: "recuperar-senha.html",
    assunto: "Criar uma nova senha",
    html: layout(
      bloco(`
        ${faixa(AZUL, MENTA, "Recuperação de senha")}
        ${p("Recebemos um pedido para trocar a senha da sua conta.", TEXTO)}
        ${p("Clique no botão abaixo para escolher uma nova. A senha atual continua valendo até você concluir.")}
        ${botao("Criar nova senha", "{{ .ConfirmationURL }}")}
        ${codigo()}
        ${p(`<span style="font-size:13px;">O link vale por 1 hora e só pode ser usado uma vez.</span>`)}
      `),
      "Se não foi você que pediu, ignore este e-mail. Sua senha atual continua valendo e ninguém teve acesso à sua conta."
    ),
  },
  {
    painel: "Magic Link",
    arquivo: "link-de-acesso.html",
    assunto: "Seu link de acesso ao painel",
    html: layout(
      bloco(`
        ${p("Use o botão abaixo para entrar no painel sem digitar senha.", TEXTO)}
        ${botao("Entrar no painel", "{{ .ConfirmationURL }}")}
        ${codigo()}
        ${p(`<span style="font-size:13px;">O link vale por 1 hora e só funciona uma vez.</span>`)}
      `),
      NAO_FOI_VOCE_IGNORE
    ),
  },
  {
    painel: "Change Email Address",
    arquivo: "troca-de-email.html",
    assunto: "Confirme seu novo e-mail",
    html: layout(
      bloco(`
        ${faixa(AZUL, MENTA, "Alteração de e-mail")}
        ${p(`Você pediu para trocar o e-mail da conta de <strong style="color:${TEXTO};">{{ .Email }}</strong> para <strong style="color:${TEXTO};">{{ .NewEmail }}</strong>.`)}
        ${p("Confirme para concluir a troca. Até lá, o endereço antigo continua sendo o da conta.")}
        ${botao("Confirmar novo e-mail", "{{ .ConfirmationURL }}")}
        ${codigo()}
      `),
      "Se você não pediu esta alteração, ignore este e-mail e troque sua senha por precaução."
    ),
  },
  {
    painel: "Invite user",
    arquivo: "convite.html",
    assunto: "Você foi convidado para o painel da sua clínica",
    html: layout(
      bloco(`
        ${faixa(TEAL, MENTA, "Convite de acesso")}
        ${p("Alguém da sua clínica criou um acesso para você no painel da Medi Marketing.", TEXTO)}
        ${p("No botão abaixo você define sua senha e já entra. Agenda, confirmações e relatórios ficam disponíveis conforme a função que te deram.")}
        ${botao("Aceitar convite e criar senha", "{{ .ConfirmationURL }}")}
      `),
      "Se você não esperava este convite, ignore este e-mail. Nenhum acesso é criado sem você definir a senha."
    ),
  },
  {
    painel: "Reauthentication",
    arquivo: "reautenticacao.html",
    assunto: "Seu código de confirmação",
    html: layout(
      bloco(`
        ${p("Para concluir esta operação, digite o código abaixo na tela em que você está.", TEXTO)}
        ${codigo()}
        ${p(`<span style="font-size:13px;">O código vale por poucos minutos.</span>`)}
      `),
      "Se você não está tentando fazer nada agora, ignore este código e troque sua senha por precaução."
    ),
  },
];
