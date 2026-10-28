import "server-only";

import { createAdminClient, adminDisponivel } from "@/lib/supabase/admin";
import { enviarEmail, emailConfigurado, type ResultadoEmail } from "@/lib/email";
import { emailAcesso } from "@/lib/email-modelos";
import { urlBase } from "@/lib/lembretes";

/**
 * E-mails de acesso (convite e senha nova) pelo Resend.
 *
 * O envio padrão do Supabase, sem SMTP próprio, só entrega para quem é
 * da equipe do projeto e no máximo algumas mensagens por hora: na
 * prática, o cliente nunca recebia. Aqui o Supabase só gera o token e
 * quem entrega é o Resend, o mesmo dos lembretes.
 *
 * O link aponta para /nova-senha com o `token_hash`, que a própria tela
 * troca por uma sessão — não depende do fluxo de redirect do Supabase.
 */
export async function enviarLinkDeSenha(d: {
  email: string;
  /** Sem nome, usa o dos metadados da conta. */
  nome?: string | null;
  tipo: "convite" | "redefinir";
  clinica?: string | null;
}): Promise<ResultadoEmail> {
  if (!emailConfigurado()) return { enviado: false, motivo: "RESEND_API_KEY ausente" };
  if (!adminDisponivel()) return { enviado: false, motivo: "SUPABASE_SERVICE_ROLE_KEY ausente" };

  const { data, error } = await createAdminClient().auth.admin.generateLink({
    type: "recovery",
    email: d.email,
  });
  const token = data?.properties?.hashed_token;
  if (error || !token) {
    return { enviado: false, motivo: error?.message ?? "não foi possível gerar o link" };
  }

  const meta = data.user?.user_metadata as { nome?: string } | undefined;
  const nome = d.nome || meta?.nome || d.email.split("@")[0];

  const link = `${urlBase()}/nova-senha?token_hash=${encodeURIComponent(token)}&type=recovery`;
  const modelo = emailAcesso(d.tipo, { nome, clinica: d.clinica, link, email: d.email });
  return enviarEmail({ para: d.email, assunto: modelo.assunto, html: modelo.html, texto: modelo.texto });
}
