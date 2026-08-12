# Modelos de e-mail da conta

Gerados por `npm run emails:auth` a partir de `lib/email-auth.ts`.
Não edite os `.html` à mão: a próxima geração sobrescreve.

Para aplicar, no painel do Supabase em **Authentication → Emails**,
abra cada modelo, cole o assunto e o corpo, e salve.

| Modelo no painel | Arquivo | Assunto |
| --- | --- | --- |
| Confirm signup | `confirmacao-cadastro.html` | Confirme seu e-mail para ativar sua conta |
| Reset Password | `recuperar-senha.html` | Criar uma nova senha |
| Magic Link | `link-de-acesso.html` | Seu link de acesso ao painel |
| Change Email Address | `troca-de-email.html` | Confirme seu novo e-mail |
| Invite user | `convite.html` | Você foi convidado para o painel da sua clínica |
| Reauthentication | `reautenticacao.html` | Seu código de confirmação |
