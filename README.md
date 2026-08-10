# Medi Marketing

Site comercial de alta conversão + **plataforma SaaS multi-módulo** para clínicas e
profissionais de saúde: marketing, comercial, atendimento, agenda, retenção,
treinamento e dados num só lugar.

Estética médica premium (azul-médico + teal + coral), Next.js 14 (App Router),
TypeScript, Tailwind CSS, Supabase (Auth + Postgres com RLS) e deploy na Vercel.

---

## ✨ Estado atual — Fase 1 concluída

### Parte A — Site comercial
Hero · Prova social (números editáveis) · Dores · **O Método** (Diagnóstico → 30 →
90 → 180 → 360 dias) · **Soluções** (7 pilares) · **A Plataforma** (mockup + módulos) ·
**Academy** (trilhas + isca) · Como funciona · Diferenciais · **Planos** (3 níveis) ·
Resultados/Depoimentos · FAQ · CTA final com **formulário de diagnóstico** · Footer.

SEO técnico: metadata + Open Graph, `sitemap.xml` e `robots.txt` (área logada fora
do índice).

### Parte B — Plataforma
- **Multi-tenant**: cada clínica é uma `organization`, isolada por RLS.
- **4 papéis**: `super_admin` (equipe Medi Marketing), `gestor`, `secretaria`, `medico`.
- **Shell completo do painel**: sidebar agrupada (Operação / Crescimento / Conta),
  filtrada por papel, com guard de rota em cada módulo.
- **Módulos com dados reais**: Início, Agenda (mês/semana/dia, status, criar consulta,
  anexos), Disponibilidade, Perfil.
- **Módulos navegáveis com escopo declarado** (entram nas fases 2–5): CRM e Funil,
  Atendimento, Retenção, Marketing, Indicadores, Academy, Financeiro, Configurações,
  Clínicas.

### Roadmap
| Fase | Escopo | Status |
| ---- | ------ | ------ |
| 1 | Site comercial completo + captura de lead + auth e shell com papéis | ✅ |
| 2 | Agenda (evolução) + CRM/Funil + Dashboard por papel | ⏳ |
| 3 | Central de Atendimento omnichannel + Retenção/Reabordagem | ⏳ |
| 4 | Marketing (Ads/GA4) + BI/Indicadores | ⏳ |
| 5 | Academy + Financeiro leve + Configurações e integrações reais | ⏳ |

---

## 🧱 Stack

| Camada        | Tecnologia                                   |
| ------------- | -------------------------------------------- |
| Framework     | Next.js 14 (App Router) + TypeScript         |
| Estilo        | Tailwind CSS + design tokens (paleta médica) |
| UI            | shadcn/ui (customizado) + Radix + lucide     |
| Animações     | Framer Motion (sutil)                        |
| Formulários   | react-hook-form + zod                        |
| Auth + Banco  | Supabase (Auth + Postgres + RLS + Storage)   |
| Deploy        | Vercel                                       |

---

## 🚀 Rodando localmente

### 1. Pré-requisitos
- Node.js 18.17+ (recomendado 20+)
- Uma conta no [Supabase](https://supabase.com) (opcional — ver modo demonstração)

### 2. Instalar dependências
```bash
npm install
```

### 3. Configurar variáveis de ambiente
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

### 4. Iniciar
```bash
npm run dev
```
http://localhost:3000 · área do cliente em http://localhost:3000/login

### 🔓 Modo demonstração
**Sem as variáveis do Supabase**, a plataforma entra em modo demonstração: dados
fictícios e uma conta de teste por papel (senha `demo1234` em todas):

| E-mail | Papel | O que enxerga |
| ------ | ----- | ------------- |
| `medico@teste.com` | Médico(a) | Própria agenda, indicadores e Academy |
| `secretaria@teste.com` | Atendimento | Agenda, CRM, atendimento e retenção |
| `gestor@teste.com` | Gestor(a) | Tudo da clínica, incluindo marketing e financeiro |
| `admin@teste.com` | Equipe Medi Marketing | Todas as clínicas |

Alterações não são persistidas nesse modo.

---

## 🗄️ Configurando o Supabase

1. Crie um projeto em https://supabase.com.
2. Em **Project Settings → API**, copie a `URL`, a `anon key` e a `service_role key`.
3. Em **SQL Editor**, cole e execute [`supabase/schema.sql`](./supabase/schema.sql).
   O script é **idempotente**: pode ser re-executado sobre uma base existente
   (inclusive a versão single-tenant anterior, que ganha uma organização padrão e
   tem os dados migrados automaticamente).

O script cria `organizations`, `profiles`, `consultas`, `anexos`, `disponibilidade`,
`bloqueios` e `leads`, as funções de acesso, as políticas de **RLS**, o bucket
privado `anexos` e o trigger que cria o `profile` a cada novo usuário.

### Criando a primeira clínica e o time
```sql
-- 1. a clínica
insert into public.organizations (nome, slug, especialidade, plano)
values ('Clínica Exemplo', 'clinica-exemplo', 'Dermatologia', 'performance');

-- 2. crie os usuários em Authentication → Users → Add user
--    (o trigger cria o profile como 'medico' sem organização)

-- 3. vincule cada um à clínica e ao papel correto
update public.profiles
   set organization_id = 'UUID-DA-ORGANIZATION', role = 'gestor'
 where id = 'UUID-DO-USUARIO';

-- papéis válidos: 'super_admin' | 'gestor' | 'secretaria' | 'medico'
```
> No convite pelo Supabase, dá para já passar `role` e `organization_id` em
> *user metadata* — o trigger `handle_new_user` respeita ambos.

### Modelo de acesso (RLS)
- Cada usuário só enxerga registros da própria `organization_id`.
- `super_admin` enxerga todas as clínicas.
- Médico vê as próprias consultas; `gestor` e `secretaria` veem as da clínica inteira.
- `leads` do site entram **sem** `organization_id` e só o `super_admin` lê. O visitante
  anônimo consegue inserir apenas leads sem organização — não dá para plantar lead
  dentro da clínica de outra pessoa.
- Funções auxiliares: `minha_org()`, `meu_papel()`, `is_super_admin()`, `is_gestor()`,
  `is_operacional()`.

---

## ☁️ Deploy na Vercel

1. Suba o repositório para o GitHub.
2. Em https://vercel.com, **Add New → Project** e importe o repositório.
3. Em **Environment Variables**, adicione as mesmas chaves do `.env.local`.
4. Em **Supabase → Authentication → URL Configuration**, adicione a URL da Vercel
   em *Site URL* e *Redirect URLs* (necessário para o reset de senha).
5. Deploy. A cada `git push` a Vercel publica automaticamente.

---

## 📁 Estrutura

```
app/
  (marketing)/            → site comercial (layout com Header + Footer)
    page.tsx              → seções da landing
    privacidade/          → política de privacidade e cookies (placeholder)
  login/                  → tela de login (com contas de demonstração)
  app/                    → plataforma (protegida por middleware + layout + guard)
    page.tsx              → início, adaptado ao papel
    agenda/ disponibilidade/ perfil/          → módulos da Fase 1
    crm/ clinicas/                            → Fase 2
    atendimento/ retencao/                    → Fase 3
    marketing/ indicadores/                   → Fase 4
    academy/ financeiro/ configuracoes/       → Fase 5
  sitemap.ts robots.ts    → SEO técnico
components/
  ui/                     → primitivos shadcn (button, card, dialog, select…)
  marketing/              → seções da landing + mockup do painel
  app/                    → sidebar, calendário, diálogos e placeholder de módulo
  auth/                   → formulário de login
lib/
  rbac.ts                 → módulos do painel e permissões por papel
  acesso.ts               → guard das páginas (exigirModulo / exigirSessao)
  demo.ts                 → modo demonstração (uma conta por papel)
  supabase/               → client (browser/server), middleware, tipos, queries
  actions/                → server actions (auth, leads, consultas, disponibilidade)
  agenda.ts, site.ts, conteudo.ts, utils.ts
supabase/schema.sql       → tabelas + RLS + funções + triggers
middleware.ts             → refresh de sessão + proteção de /app
tailwind.config.ts        → design tokens (paleta médica + fontes)
```

**Para criar um módulo novo**: registre-o em `lib/rbac.ts` (label, rota, ícone,
papéis, fase, grupo) e crie a página chamando `exigirModulo("id")`. A sidebar e o
guard passam a respeitá-lo automaticamente.

---

## ✅ TODO / Decisões pendentes

- [ ] **Provedor de WhatsApp** (Cloud API oficial) para a central de atendimento — Fase 3.
- [ ] **Escopo final do Financeiro** (confirmar se entra) — Fase 5.
- [ ] **Preços dos planos** em `lib/conteudo.ts` (hoje são placeholders).
- [ ] **Números reais** de prova social (`numeros` em `lib/conteudo.ts`).
- [ ] **Depoimentos reais** com foto e autorização de uso.
- [ ] **Logo** oficial (hoje é logotipo textual em `components/logo.tsx`).
- [ ] **Compliance publicitário** (CFM) — revisar textos de marketing e FAQ.
- [ ] **Política de Privacidade/Cookies** definitiva, revisada juridicamente.
- [ ] **CNPJ, endereço e redes sociais** reais no `lib/site.ts`.
- [ ] **Notificação de lead** por e-mail/WhatsApp ao receber formulário.
- [ ] Configurar variáveis do Supabase e domínio final na Vercel.

---

## 📝 Scripts

```bash
npm run dev      # desenvolvimento
npm run build    # build de produção
npm run start    # servir o build
npm run lint     # lint
```
