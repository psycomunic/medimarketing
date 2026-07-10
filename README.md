# Medi Marketing

Site institucional + landing page de vendas e **área logada do médico** (agenda de
consultas) para a **Medi Marketing** — atendimento/secretariado remoto e marketing
médico (Google Ads e Meta Ads) para médicos e clínicas.

Estética médica premium (azul-médico + teal), Next.js 14 (App Router), TypeScript,
Tailwind CSS, Supabase (Auth + Postgres com RLS) e deploy na Vercel.

---

## ✨ O que já está pronto

- **Landing page** completa e responsiva (one-page com âncoras):
  Hero · Barra de credibilidade · Dores · 3 Soluções (Atendimento, Agenda, Marketing) ·
  Como funciona · Diferenciais · Depoimentos · FAQ · CTA final com formulário de lead · Footer.
- **Autenticação** por e-mail/senha (Supabase Auth) com rota protegida `/app`.
- **Área do médico**: dashboard com métricas, **agenda** (visões mês/semana/dia,
  detalhe da consulta, alterar status, observações, criar consulta) e **disponibilidade**
  (horários semanais + bloqueios de período).
- **Placeholders da Fase 2**: Relatórios de marketing e Perfil (layout pronto).
- **Banco + RLS**: script SQL completo em [`supabase/schema.sql`](./supabase/schema.sql).

---

## 🧱 Stack

| Camada        | Tecnologia                                   |
| ------------- | -------------------------------------------- |
| Framework     | Next.js 14 (App Router) + TypeScript         |
| Estilo        | Tailwind CSS + design tokens (paleta médica) |
| UI            | shadcn/ui (customizado) + Radix + lucide     |
| Animações     | Framer Motion (sutil)                        |
| Formulários   | react-hook-form + zod                        |
| Auth + Banco  | Supabase (Auth + Postgres + RLS)             |
| Deploy        | Vercel                                       |

---

## 🚀 Rodando localmente

### 1. Pré-requisitos
- Node.js 18.17+ (recomendado 20+)
- Uma conta no [Supabase](https://supabase.com) (gratuita)

### 2. Instalar dependências
```bash
npm install
```

### 3. Configurar variáveis de ambiente
Copie o exemplo e preencha com os dados do seu projeto Supabase:
```bash
cp .env.example .env.local
```
```env
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-anon-key
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key
NEXT_PUBLIC_WHATSAPP=5511999999999
NEXT_PUBLIC_EMAIL_CONTATO=contato@medimarketing.com.br
```
> As variáveis `NEXT_PUBLIC_*` ficam no [`lib/site.ts`](./lib/site.ts). Sem o Supabase
> configurado o site roda normalmente; os formulários de lead apenas não persistem.

### 4. Iniciar o servidor de desenvolvimento
```bash
npm run dev
```
Acesse http://localhost:3000 · Área do médico em http://localhost:3000/login

---

## 🗄️ Configurando o Supabase

1. Crie um projeto em https://supabase.com.
2. Em **Project Settings → API**, copie a `URL`, a `anon key` e a `service_role key`
   para o seu `.env.local`.
3. Em **SQL Editor**, cole e execute o conteúdo de
   [`supabase/schema.sql`](./supabase/schema.sql). Isso cria as tabelas
   (`profiles`, `consultas`, `disponibilidade`, `bloqueios`, `leads`), os enums,
   as políticas de **Row Level Security** e o trigger que cria o `profile`
   automaticamente a cada novo usuário.

### Criando um médico (enquanto o cadastro é feito pela equipe)
Em **Authentication → Users → Add user**, crie um usuário com e-mail e senha.
O trigger cria o `profile` como `medico`. Para promover alguém a **admin**
(equipe de atendimento, que enxerga tudo), rode no SQL Editor:
```sql
update public.profiles set role = 'admin' where id = 'UUID-DO-USUARIO';
```

### Dados de teste (opcional)
Depois de logar, use o botão **“Nova consulta”** na agenda para criar consultas
de teste — elas respeitam o RLS e ficam vinculadas ao médico logado.

### Modelo de dados (RLS)
- Um médico só lê/edita registros onde `medico_id = auth.uid()`.
- **Admin** (equipe) enxerga e edita tudo (função `is_admin()`).
- `leads`: **INSERT público** (formulários da landing); leitura só para admin.

---

## ☁️ Deploy na Vercel

1. Suba o repositório para o GitHub.
2. Em https://vercel.com, **Add New → Project** e importe o repositório.
3. Em **Environment Variables**, adicione as mesmas chaves do `.env.local`
   (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_WHATSAPP`, `NEXT_PUBLIC_EMAIL_CONTATO`).
4. Em **Supabase → Authentication → URL Configuration**, adicione a URL da Vercel
   em *Site URL* e *Redirect URLs* (necessário para o reset de senha).
5. Deploy. A cada `git push` a Vercel publica automaticamente.

---

## 📁 Estrutura

```
app/
  (marketing)/            → landing page pública (layout com Header + Footer)
    page.tsx              → seções da landing
    privacidade/          → política de privacidade (placeholder)
  login/                  → tela de login
  app/                    → área logada (protegida por middleware + layout)
    page.tsx              → dashboard
    agenda/               → agenda (mês/semana/dia)
    disponibilidade/      → horários + bloqueios
    relatorios/ perfil/   → placeholders da Fase 2
components/
  ui/                     → primitivos shadcn (button, card, dialog, accordion…)
  marketing/              → seções da landing
  app/                    → sidebar, calendário e diálogos da área logada
  auth/                   → formulário de login
lib/
  supabase/               → client (browser/server), middleware, tipos, queries
  actions/                → server actions (auth, leads, consultas, disponibilidade)
  agenda.ts, site.ts, conteudo.ts, utils.ts
supabase/schema.sql       → tabelas + RLS + triggers
middleware.ts             → refresh de sessão + proteção de /app
tailwind.config.ts        → design tokens (paleta médica + fontes)
```

---

## ✅ TODO / Decisões pendentes

- [ ] **Logo** oficial (hoje é logotipo textual em `components/logo.tsx`).
- [ ] **Copy real** de depoimentos, métricas ("+120 médicos") e logos de parceiros.
- [ ] Definir **planos com preço** vs. orçamento sob demanda (seção opcional).
- [ ] **Compliance publicitário** (CFM/CRM) — revisar textos de marketing e FAQ.
- [ ] **Fluxo de cadastro** do médico: convite por admin vs. autocadastro.
- [ ] **Notificação de lead** por e-mail/WhatsApp ao receber formulário (Fase 2 —
      ver `lib/actions/leads.ts`).
- [ ] **Painel administrativo** interno (equipe cria consultas) — Fase 2.
- [ ] **Relatórios** de Google/Meta Ads na área do médico — Fase 2 (layout pronto
      em `app/app/relatorios`).
- [ ] **Política de Privacidade** (LGPD) definitiva — hoje é placeholder.
- [ ] **CNPJ, endereço e redes sociais** reais no `lib/site.ts`.
- [ ] Configurar variáveis do Supabase e domínio final na Vercel.

---

## 📝 Scripts

```bash
npm run dev      # desenvolvimento
npm run build    # build de produção
npm run start    # servir o build
npm run lint     # lint
```
