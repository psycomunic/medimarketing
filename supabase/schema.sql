-- =====================================================================
-- Medi Marketing — Schema do banco (Supabase / Postgres)
-- FASE 1: multi-tenant (organizations) + papéis + leads da landing
--
-- Execute no SQL Editor do Supabase (uma vez) ou via CLI:
--   supabase db push
--
-- Este arquivo é IDEMPOTENTE: pode ser re-executado sobre uma base
-- existente (versão single-tenant) sem perder dados.
-- =====================================================================

create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------------------
-- Tipos enumerados (agenda). O papel do usuário usa `text` + CHECK,
-- porque enums não aceitam novos valores dentro da mesma transação —
-- o que quebraria a evolução do produto a cada fase.
-- ---------------------------------------------------------------------
do $$ begin
  create type status_consulta as enum ('pendente', 'confirmada', 'cancelada', 'realizada');
exception when duplicate_object then null; end $$;

do $$ begin
  create type tipo_consulta as enum ('primeira', 'retorno', 'teleconsulta');
exception when duplicate_object then null; end $$;

-- =====================================================================
-- ORGANIZATIONS — cada clínica/consultório é um tenant
-- =====================================================================
create table if not exists public.organizations (
  id            uuid primary key default uuid_generate_v4(),
  nome          text not null,
  slug          text unique,
  especialidade text,
  plano         text not null default 'essencial'
                  check (plano in ('essencial', 'performance', 'full')),
  cidade        text,
  telefone      text,
  email         text,
  ativo         boolean not null default true,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- profiles — 1:1 com auth.users, sempre vinculado a uma organization
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  nome            text,
  especialidade   text,
  crm             text,
  telefone        text,
  foto_url        text,
  role            text not null default 'medico',
  ativo           boolean not null default true,
  created_at      timestamptz not null default now()
);

alter table public.profiles add column if not exists organization_id uuid references public.organizations(id) on delete set null;
alter table public.profiles add column if not exists ativo boolean not null default true;

-- Quem se cadastrou sozinho pela tela pública entra aqui como true e fica
-- sem acesso até um administrador definir o papel. Distingue "ainda não
-- foi liberado" de "teve o acesso cortado" — os dois têm ativo = false,
-- mas significam coisas opostas para quem olha a lista.
alter table public.profiles add column if not exists aguardando_liberacao boolean not null default false;

-- Converte `role` de enum para text (bases criadas na versão anterior)
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles'
      and column_name = 'role' and data_type = 'USER-DEFINED'
  ) then
    alter table public.profiles alter column role drop default;
    alter table public.profiles alter column role type text using role::text;
    alter table public.profiles alter column role set default 'medico';
  end if;
end $$;

-- 'admin' da versão anterior vira 'super_admin' (equipe Medi Marketing)
update public.profiles set role = 'super_admin' where role = 'admin';

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('super_admin', 'gestor', 'secretaria', 'medico'));

create index if not exists idx_profiles_org on public.profiles (organization_id);

-- ---------------------------------------------------------------------
-- consultas — núcleo da agenda
-- ---------------------------------------------------------------------
create table if not exists public.consultas (
  id                  uuid primary key default uuid_generate_v4(),
  organization_id     uuid references public.organizations(id) on delete cascade,
  medico_id           uuid not null references public.profiles(id) on delete cascade,
  paciente_nome       text not null,
  paciente_telefone   text,
  paciente_email      text,
  paciente_nascimento date,
  convenio            text,
  data_hora           timestamptz not null,
  duracao_min         integer default 30,
  tipo                tipo_consulta not null default 'primeira',
  status              status_consulta not null default 'pendente',
  motivo              text,
  observacao          text,
  valor               numeric(10,2),
  criado_por          uuid references public.profiles(id),
  created_at          timestamptz not null default now()
);
create index if not exists idx_consultas_medico_data
  on public.consultas (medico_id, data_hora);

-- Colunas adicionais (para bases criadas antes desta versão)
alter table public.consultas add column if not exists organization_id     uuid references public.organizations(id) on delete cascade;
alter table public.consultas add column if not exists paciente_email      text;
alter table public.consultas add column if not exists paciente_nascimento date;
alter table public.consultas add column if not exists convenio            text;
alter table public.consultas add column if not exists duracao_min         integer default 30;
alter table public.consultas add column if not exists motivo              text;
alter table public.consultas add column if not exists valor               numeric(10,2);

create index if not exists idx_consultas_org_data
  on public.consultas (organization_id, data_hora);

-- ---------------------------------------------------------------------
-- anexos — documentos das consultas (exames, encaminhamentos, receitas)
-- ---------------------------------------------------------------------
create table if not exists public.anexos (
  id          uuid primary key default uuid_generate_v4(),
  consulta_id uuid not null references public.consultas(id) on delete cascade,
  medico_id   uuid not null references public.profiles(id) on delete cascade,
  nome        text not null,
  caminho     text not null,           -- path no Storage (bucket "anexos")
  tipo        text,                    -- mime type
  tamanho     bigint,                  -- bytes
  created_at  timestamptz not null default now()
);
create index if not exists idx_anexos_consulta on public.anexos (consulta_id);

-- ---------------------------------------------------------------------
-- disponibilidade — horários de atendimento semanais
-- ---------------------------------------------------------------------
create table if not exists public.disponibilidade (
  id          uuid primary key default uuid_generate_v4(),
  medico_id   uuid not null references public.profiles(id) on delete cascade,
  dia_semana  smallint not null check (dia_semana between 0 and 6), -- 0=domingo
  hora_inicio time not null,
  hora_fim    time not null
);

-- ---------------------------------------------------------------------
-- bloqueios — períodos indisponíveis (férias, folga)
-- ---------------------------------------------------------------------
create table if not exists public.bloqueios (
  id          uuid primary key default uuid_generate_v4(),
  medico_id   uuid not null references public.profiles(id) on delete cascade,
  data_inicio timestamptz not null,
  data_fim    timestamptz not null,
  motivo      text
);

-- ---------------------------------------------------------------------
-- leads — formulário de diagnóstico da landing + futuro CRM (Fase 2)
--
-- `organization_id` nulo  = lead comercial da própria Medi Marketing
--                            (vindo do site institucional).
-- `organization_id` preenchido = lead/paciente de uma clínica cliente.
-- ---------------------------------------------------------------------
create table if not exists public.leads (
  id                   uuid primary key default uuid_generate_v4(),
  organization_id      uuid references public.organizations(id) on delete cascade,
  nome                 text not null,
  especialidade        text,
  whatsapp             text not null,
  email                text,
  cidade               text,
  faturamento_medio    text,       -- faixa declarada no formulário
  tem_equipe_comercial boolean,
  mensagem             text,
  origem               text default 'landing',
  etapa_funil          text not null default 'novo'
                         check (etapa_funil in ('novo','em_contato','agendado','compareceu','em_tratamento','perdido')),
  status               text not null default 'aberto'
                         check (status in ('aberto','ganho','perdido')),
  consentimento_lgpd   boolean not null default false,
  created_at           timestamptz not null default now()
);

alter table public.leads add column if not exists organization_id      uuid references public.organizations(id) on delete cascade;
alter table public.leads add column if not exists email                text;
alter table public.leads add column if not exists faturamento_medio    text;
alter table public.leads add column if not exists tem_equipe_comercial boolean;
alter table public.leads add column if not exists mensagem             text;
alter table public.leads add column if not exists etapa_funil          text not null default 'novo';
alter table public.leads add column if not exists status               text not null default 'aberto';
alter table public.leads add column if not exists consentimento_lgpd   boolean not null default false;

alter table public.leads drop constraint if exists leads_etapa_funil_check;
alter table public.leads add constraint leads_etapa_funil_check
  check (etapa_funil in ('novo','em_contato','agendado','compareceu','em_tratamento','perdido'));

alter table public.leads drop constraint if exists leads_status_check;
alter table public.leads add constraint leads_status_check
  check (status in ('aberto','ganho','perdido'));

create index if not exists idx_leads_org_criado on public.leads (organization_id, created_at desc);

-- =====================================================================
-- FUNÇÕES AUXILIARES DE ACESSO
-- security definer para não recursar nas policies da própria `profiles`.
-- =====================================================================
create or replace function public.meu_papel()
returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.minha_org()
returns uuid
language sql stable security definer set search_path = public as $$
  select organization_id from public.profiles where id = auth.uid();
$$;

create or replace function public.is_super_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.meu_papel() = 'super_admin', false);
$$;

-- Mantida por compatibilidade com policies/consultas antigas
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_super_admin();
$$;

-- Gestor ou super admin: acesso amplo dentro da clínica
create or replace function public.is_gestor()
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.meu_papel() in ('gestor', 'super_admin'), false);
$$;

-- Quem pode operar agenda/CRM da clínica (todos menos visitantes)
create or replace function public.is_operacional()
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.meu_papel() in ('gestor', 'secretaria', 'super_admin'), false);
$$;

-- =====================================================================
-- ROW LEVEL SECURITY
-- Regra geral: super_admin vê tudo; os demais só a própria organization.
-- =====================================================================
alter table public.organizations   enable row level security;
alter table public.profiles        enable row level security;
alter table public.consultas       enable row level security;
alter table public.disponibilidade enable row level security;
alter table public.bloqueios       enable row level security;
alter table public.leads           enable row level security;
alter table public.anexos          enable row level security;

-- ---- organizations ----
drop policy if exists "org_select" on public.organizations;
create policy "org_select" on public.organizations
  for select using (id = public.minha_org() or public.is_super_admin());

drop policy if exists "org_update" on public.organizations;
create policy "org_update" on public.organizations
  for update using (
    (id = public.minha_org() and public.is_gestor()) or public.is_super_admin()
  );

drop policy if exists "org_insert" on public.organizations;
create policy "org_insert" on public.organizations
  for insert with check (public.is_super_admin());

drop policy if exists "org_delete" on public.organizations;
create policy "org_delete" on public.organizations
  for delete using (public.is_super_admin());

-- ---- profiles ---- (vejo a mim mesmo e os colegas da minha clínica)
drop policy if exists "profiles_self_select" on public.profiles;
create policy "profiles_self_select" on public.profiles
  for select using (
    id = auth.uid()
    or (organization_id is not null and organization_id = public.minha_org())
    or public.is_super_admin()
  );

drop policy if exists "profiles_self_update" on public.profiles;
create policy "profiles_self_update" on public.profiles
  for update using (
    id = auth.uid()
    or (organization_id = public.minha_org() and public.is_gestor())
    or public.is_super_admin()
  );

drop policy if exists "profiles_admin_insert" on public.profiles;
create policy "profiles_admin_insert" on public.profiles
  for insert with check (
    id = auth.uid()
    or (organization_id = public.minha_org() and public.is_gestor())
    or public.is_super_admin()
  );

-- ---- consultas ----
-- Médico vê as próprias; secretária/gestor veem as da clínica inteira.
drop policy if exists "consultas_select" on public.consultas;
create policy "consultas_select" on public.consultas
  for select using (
    medico_id = auth.uid()
    or (organization_id = public.minha_org() and public.is_operacional())
    or public.is_super_admin()
  );

drop policy if exists "consultas_update" on public.consultas;
create policy "consultas_update" on public.consultas
  for update using (
    medico_id = auth.uid()
    or (organization_id = public.minha_org() and public.is_operacional())
    or public.is_super_admin()
  );

drop policy if exists "consultas_insert" on public.consultas;
create policy "consultas_insert" on public.consultas
  for insert with check (
    medico_id = auth.uid()
    or (organization_id = public.minha_org() and public.is_operacional())
    or public.is_super_admin()
  );

drop policy if exists "consultas_delete" on public.consultas;
create policy "consultas_delete" on public.consultas
  for delete using (
    (organization_id = public.minha_org() and public.is_gestor())
    or public.is_super_admin()
  );

-- ---- disponibilidade ---- (médico gerencia a própria; equipe da clínica lê)
drop policy if exists "disp_all" on public.disponibilidade;
create policy "disp_all" on public.disponibilidade
  for all using (
    medico_id = auth.uid()
    or public.is_super_admin()
    or (public.is_operacional() and exists (
      select 1 from public.profiles p
      where p.id = disponibilidade.medico_id and p.organization_id = public.minha_org()
    ))
  )
  with check (
    medico_id = auth.uid()
    or public.is_super_admin()
    or (public.is_operacional() and exists (
      select 1 from public.profiles p
      where p.id = disponibilidade.medico_id and p.organization_id = public.minha_org()
    ))
  );

-- ---- bloqueios ---- (mesma regra da disponibilidade)
drop policy if exists "bloq_all" on public.bloqueios;
create policy "bloq_all" on public.bloqueios
  for all using (
    medico_id = auth.uid()
    or public.is_super_admin()
    or (public.is_operacional() and exists (
      select 1 from public.profiles p
      where p.id = bloqueios.medico_id and p.organization_id = public.minha_org()
    ))
  )
  with check (
    medico_id = auth.uid()
    or public.is_super_admin()
    or (public.is_operacional() and exists (
      select 1 from public.profiles p
      where p.id = bloqueios.medico_id and p.organization_id = public.minha_org()
    ))
  );

-- ---- leads ----
-- Visitante anônimo do site só consegue inserir lead SEM organization_id
-- (lead comercial da Medi Marketing). Não consegue plantar lead em clínica.
drop policy if exists "leads_public_insert" on public.leads;
create policy "leads_public_insert" on public.leads
  for insert to anon
  with check (organization_id is null and origem is not null);

drop policy if exists "leads_auth_insert" on public.leads;
create policy "leads_auth_insert" on public.leads
  for insert to authenticated
  with check (
    organization_id is null
    or (organization_id = public.minha_org() and public.is_operacional())
    or public.is_super_admin()
  );

drop policy if exists "leads_admin_select" on public.leads;
create policy "leads_admin_select" on public.leads
  for select using (
    (organization_id is not null and organization_id = public.minha_org() and public.is_operacional())
    or public.is_super_admin()
  );

drop policy if exists "leads_update" on public.leads;
create policy "leads_update" on public.leads
  for update using (
    (organization_id = public.minha_org() and public.is_operacional())
    or public.is_super_admin()
  );

-- ---- anexos ---- (médico gerencia os anexos das próprias consultas)
drop policy if exists "anexos_all" on public.anexos;
create policy "anexos_all" on public.anexos
  for all using (medico_id = auth.uid() or public.is_super_admin())
  with check (medico_id = auth.uid() or public.is_super_admin());

-- =====================================================================
-- STORAGE: bucket privado "anexos" para documentos das consultas
-- Estrutura de path: {medico_id}/{consulta_id}/{arquivo}
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('anexos', 'anexos', false)
on conflict (id) do nothing;

-- Cada médico só acessa arquivos dentro da própria pasta ({uid}/...)
drop policy if exists "anexos_storage_select" on storage.objects;
create policy "anexos_storage_select" on storage.objects
  for select using (
    bucket_id = 'anexos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "anexos_storage_insert" on storage.objects;
create policy "anexos_storage_insert" on storage.objects
  for insert with check (
    bucket_id = 'anexos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "anexos_storage_delete" on storage.objects;
create policy "anexos_storage_delete" on storage.objects
  for delete using (
    bucket_id = 'anexos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- =====================================================================
-- TRIGGER: cria profile automaticamente ao registrar um usuário
--
-- ATENÇÃO — o trigger NÃO lê papel nem clínica dos metadados.
--
-- `raw_user_meta_data` é preenchido por quem chama a API de cadastro, ou
-- seja, pelo próprio visitante quando o cadastro público está aberto.
-- Confiar nele significaria aceitar `{"role":"super_admin"}` de qualquer
-- um e entregar a carteira inteira.
--
-- Aqui o perfil nasce sempre no menor privilégio possível: sem clínica e
-- como 'medico'. Quem de fato concede acesso são os caminhos confiáveis
-- do servidor, que rodam com a service role logo após o cadastro:
--   - lib/actions/usuarios.ts  (admin criando alguém da equipe)
--   - lib/actions/cadastro.ts  (dono de clínica se cadastrando)
-- =====================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nome, role, organization_id)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data->>'nome'), ''), new.email),
    'medico',
    null
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =====================================================================
-- BACKFILL: bases single-tenant ganham uma organization padrão
-- =====================================================================
do $$
declare
  org_id uuid;
begin
  if exists (select 1 from public.profiles where organization_id is null) then
    select id into org_id from public.organizations where slug = 'clinica-padrao';
    if org_id is null then
      insert into public.organizations (nome, slug, plano)
      values ('Clínica padrão', 'clinica-padrao', 'essencial')
      returning id into org_id;
    end if;

    update public.profiles set organization_id = org_id
      where organization_id is null and role <> 'super_admin';
  end if;

  update public.consultas c
    set organization_id = p.organization_id
    from public.profiles p
    where c.medico_id = p.id and c.organization_id is null;
end $$;

-- =====================================================================
-- ACADEMY — trilhas, aulas, progresso e comentários
-- Conteúdo é global (produzido pela Medi Marketing) e consumido por
-- todas as clínicas. Só o super admin cria e edita.
-- =====================================================================
create table if not exists public.courses (
  id          uuid primary key default uuid_generate_v4(),
  slug        text unique not null,
  titulo      text not null,
  resumo      text,
  descricao   text,
  nivel       text not null default 'essencial'
                check (nivel in ('essencial', 'intermediario', 'avancado')),
  -- Papéis que enxergam a trilha (ex.: trilha de gestão só para gestor)
  papeis      text[] not null default '{gestor,secretaria,medico}',
  ordem       integer not null default 0,
  publicado   boolean not null default false,
  created_at  timestamptz not null default now()
);

create table if not exists public.lessons (
  id           uuid primary key default uuid_generate_v4(),
  course_id    uuid not null references public.courses(id) on delete cascade,
  slug         text not null,
  titulo       text not null,
  descricao    text,
  -- Link do vídeo: YouTube, Vimeo ou arquivo direto (mp4)
  video_url    text,
  material_url text,
  duracao_min  integer,
  ordem        integer not null default 0,
  publicado    boolean not null default true,
  created_at   timestamptz not null default now(),
  unique (course_id, slug)
);
create index if not exists idx_lessons_course on public.lessons (course_id, ordem);

create table if not exists public.lesson_progress (
  id           uuid primary key default uuid_generate_v4(),
  lesson_id    uuid not null references public.lessons(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  concluida    boolean not null default true,
  concluida_em timestamptz not null default now(),
  unique (lesson_id, user_id)
);
create index if not exists idx_progress_user on public.lesson_progress (user_id);

create table if not exists public.lesson_comments (
  id              uuid primary key default uuid_generate_v4(),
  lesson_id       uuid not null references public.lessons(id) on delete cascade,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  -- Guarda a clínica do autor para o isolamento entre tenants.
  -- Na resposta do super admin, herda a organização do comentário original.
  organization_id uuid references public.organizations(id) on delete cascade,
  parent_id       uuid references public.lesson_comments(id) on delete cascade,
  conteudo        text not null check (length(trim(conteudo)) > 0),
  created_at      timestamptz not null default now()
);
create index if not exists idx_comments_lesson on public.lesson_comments (lesson_id, created_at);

-- =====================================================================
-- INDICADORES — lançamento mensal por clínica
-- Enquanto as integrações de Ads não estão conectadas (Fase 4), os
-- números entram manualmente. As APIs vão alimentar esta mesma tabela.
-- =====================================================================
create table if not exists public.indicadores_mensais (
  id              uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  mes             date not null,                    -- sempre o dia 1 do mês
  investimento    numeric(12,2) not null default 0, -- em marketing
  leads           integer not null default 0,
  agendamentos    integer not null default 0,
  comparecimentos integer not null default 0,
  faturamento     numeric(12,2) not null default 0,
  observacao      text,
  atualizado_em   timestamptz not null default now(),
  unique (organization_id, mes)
);
create index if not exists idx_indicadores_org_mes
  on public.indicadores_mensais (organization_id, mes desc);

-- ---------------------------------------------------------------------
-- RLS da Academy e dos indicadores
-- ---------------------------------------------------------------------
alter table public.courses             enable row level security;
alter table public.lessons             enable row level security;
alter table public.lesson_progress     enable row level security;
alter table public.lesson_comments     enable row level security;
alter table public.indicadores_mensais enable row level security;

-- ---- courses ---- (todo mundo lê o que está publicado e é do seu papel)
drop policy if exists "courses_select" on public.courses;
create policy "courses_select" on public.courses
  for select to authenticated
  using (
    public.is_super_admin()
    or (publicado and public.meu_papel() = any(papeis))
  );

drop policy if exists "courses_admin_write" on public.courses;
create policy "courses_admin_write" on public.courses
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- ---- lessons ----
drop policy if exists "lessons_select" on public.lessons;
create policy "lessons_select" on public.lessons
  for select to authenticated
  using (
    public.is_super_admin()
    or (publicado and exists (
      select 1 from public.courses c
      where c.id = lessons.course_id
        and c.publicado
        and public.meu_papel() = any(c.papeis)
    ))
  );

drop policy if exists "lessons_admin_write" on public.lessons;
create policy "lessons_admin_write" on public.lessons
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- ---- lesson_progress ---- (cada um controla o próprio progresso)
drop policy if exists "progress_all" on public.lesson_progress;
create policy "progress_all" on public.lesson_progress
  for all to authenticated
  using (user_id = auth.uid() or public.is_super_admin())
  with check (user_id = auth.uid() or public.is_super_admin());

-- ---- lesson_comments ----
-- A dúvida de uma clínica não aparece para outra: a leitura é limitada à
-- própria organização (mais as respostas da equipe, que herdam a org).
drop policy if exists "comments_select" on public.lesson_comments;
create policy "comments_select" on public.lesson_comments
  for select to authenticated
  using (
    public.is_super_admin()
    or user_id = auth.uid()
    or (organization_id is not null and organization_id = public.minha_org())
  );

drop policy if exists "comments_insert" on public.lesson_comments;
create policy "comments_insert" on public.lesson_comments
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and (
      public.is_super_admin()
      or (organization_id is not null and organization_id = public.minha_org())
    )
  );

drop policy if exists "comments_update" on public.lesson_comments;
create policy "comments_update" on public.lesson_comments
  for update to authenticated
  using (user_id = auth.uid() or public.is_super_admin());

drop policy if exists "comments_delete" on public.lesson_comments;
create policy "comments_delete" on public.lesson_comments
  for delete to authenticated
  using (user_id = auth.uid() or public.is_super_admin());

-- ---- indicadores_mensais ---- (a clínica inteira lê; gestor e equipe lançam)
drop policy if exists "indicadores_select" on public.indicadores_mensais;
create policy "indicadores_select" on public.indicadores_mensais
  for select to authenticated
  using (organization_id = public.minha_org() or public.is_super_admin());

drop policy if exists "indicadores_write" on public.indicadores_mensais;
create policy "indicadores_write" on public.indicadores_mensais
  for all to authenticated
  using (
    (organization_id = public.minha_org() and public.is_gestor())
    or public.is_super_admin()
  )
  with check (
    (organization_id = public.minha_org() and public.is_gestor())
    or public.is_super_admin()
  );

-- =====================================================================
-- FASE 3 — CRM, atendimento, retenção, marketing, financeiro e ajustes
-- Todas as tabelas abaixo são por clínica (organization_id obrigatório)
-- e isoladas por RLS. Super admin enxerga a carteira inteira.
-- =====================================================================

-- ---------------------------------------------------------------------
-- organizations: campos preenchidos na tela de Configurações
-- ---------------------------------------------------------------------
alter table public.organizations add column if not exists cnpj                    text;
alter table public.organizations add column if not exists endereco                text;
alter table public.organizations add column if not exists responsavel             text;
alter table public.organizations add column if not exists site                    text;
alter table public.organizations add column if not exists instagram               text;
alter table public.organizations add column if not exists mensagem_lembrete       text;
alter table public.organizations add column if not exists antecedencia_lembrete_h integer not null default 24;

-- ---------------------------------------------------------------------
-- leads: campos de trabalho do funil
-- ---------------------------------------------------------------------
alter table public.leads add column if not exists responsavel_id  uuid references public.profiles(id) on delete set null;
alter table public.leads add column if not exists valor_estimado  numeric(12,2);
alter table public.leads add column if not exists tags            text[] not null default '{}';
alter table public.leads add column if not exists proximo_contato timestamptz;
alter table public.leads add column if not exists ultimo_contato  timestamptz;
alter table public.leads add column if not exists motivo_perda    text;

create index if not exists idx_leads_etapa on public.leads (organization_id, etapa_funil);

-- ---------------------------------------------------------------------
-- lead_interacoes — histórico e tarefas de cada lead
-- ---------------------------------------------------------------------
create table if not exists public.lead_interacoes (
  id              uuid primary key default uuid_generate_v4(),
  lead_id         uuid not null references public.leads(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  autor_id        uuid references public.profiles(id) on delete set null,
  tipo            text not null default 'nota'
                    check (tipo in ('nota','mensagem','ligacao','tarefa')),
  canal           text check (canal in ('whatsapp','instagram','facebook','telefone','email','presencial')),
  conteudo        text not null check (length(trim(conteudo)) > 0),
  concluida       boolean not null default false,
  vence_em        timestamptz,
  created_at      timestamptz not null default now()
);
create index if not exists idx_interacoes_lead on public.lead_interacoes (lead_id, created_at desc);

-- ---------------------------------------------------------------------
-- conversas / mensagens — caixa de entrada dos canais
-- ---------------------------------------------------------------------
create table if not exists public.conversas (
  id                    uuid primary key default uuid_generate_v4(),
  organization_id       uuid not null references public.organizations(id) on delete cascade,
  lead_id               uuid references public.leads(id) on delete set null,
  canal                 text not null check (canal in ('whatsapp','instagram','facebook')),
  contato_nome          text not null,
  contato_identificador text not null,
  status                text not null default 'aberta'
                          check (status in ('aberta','pendente','resolvida')),
  atribuido_a           uuid references public.profiles(id) on delete set null,
  nao_lidas             integer not null default 0,
  ultima_mensagem       text,
  ultima_mensagem_em    timestamptz not null default now(),
  created_at            timestamptz not null default now()
);
create index if not exists idx_conversas_org on public.conversas (organization_id, ultima_mensagem_em desc);

create table if not exists public.mensagens (
  id          uuid primary key default uuid_generate_v4(),
  conversa_id uuid not null references public.conversas(id) on delete cascade,
  direcao     text not null check (direcao in ('entrada','saida')),
  autor_id    uuid references public.profiles(id) on delete set null,
  autor_nome  text,
  conteudo    text not null check (length(trim(conteudo)) > 0),
  created_at  timestamptz not null default now()
);
create index if not exists idx_mensagens_conversa on public.mensagens (conversa_id, created_at);

-- ---------------------------------------------------------------------
-- reguas / regua_passos / regua_execucoes — retenção
-- ---------------------------------------------------------------------
create table if not exists public.reguas (
  id              uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  tipo            text not null
                    check (tipo in ('reabordagem','no_show','reativacao','recall','pos_consulta')),
  nome            text not null,
  descricao       text,
  ativa           boolean not null default false,
  created_at      timestamptz not null default now()
);
create index if not exists idx_reguas_org on public.reguas (organization_id);

create table if not exists public.regua_passos (
  id            uuid primary key default uuid_generate_v4(),
  regua_id      uuid not null references public.reguas(id) on delete cascade,
  ordem         integer not null default 1,
  atraso_horas  integer not null default 24,
  canal         text not null default 'whatsapp'
                  check (canal in ('whatsapp','instagram','facebook','telefone','email','presencial')),
  mensagem      text not null check (length(trim(mensagem)) > 0)
);
create index if not exists idx_passos_regua on public.regua_passos (regua_id, ordem);

create table if not exists public.regua_execucoes (
  id              uuid primary key default uuid_generate_v4(),
  regua_id        uuid not null references public.reguas(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lead_id         uuid references public.leads(id) on delete set null,
  passo           integer not null default 1,
  status          text not null default 'enviado'
                    check (status in ('enviado','respondido','convertido','cancelado')),
  executado_em    timestamptz not null default now()
);
create index if not exists idx_execucoes_regua on public.regua_execucoes (regua_id, executado_em desc);

-- ---------------------------------------------------------------------
-- campanhas — mídia paga (Meta e Google), lançamento manual até a Fase 4
-- ---------------------------------------------------------------------
create table if not exists public.campanhas (
  id              uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  plataforma      text not null check (plataforma in ('meta','google','organico','outro')),
  nome            text not null,
  objetivo        text,
  status          text not null default 'ativa'
                    check (status in ('ativa','pausada','encerrada')),
  inicio          date not null default current_date,
  fim             date,
  investimento    numeric(12,2) not null default 0,
  impressoes      bigint not null default 0,
  cliques         integer not null default 0,
  leads           integer not null default 0,
  agendamentos    integer not null default 0,
  created_at      timestamptz not null default now()
);
create index if not exists idx_campanhas_org on public.campanhas (organization_id, inicio desc);

-- ---------------------------------------------------------------------
-- lancamentos — receita por procedimento
-- ---------------------------------------------------------------------
create table if not exists public.lancamentos (
  id               uuid primary key default uuid_generate_v4(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  consulta_id      uuid references public.consultas(id) on delete set null,
  paciente_nome    text not null,
  procedimento     text not null,
  categoria        text,
  valor            numeric(12,2) not null default 0,
  custo            numeric(12,2) not null default 0,
  forma_pagamento  text not null default 'pix'
                     check (forma_pagamento in ('pix','dinheiro','cartao_credito','cartao_debito','convenio','boleto')),
  status           text not null default 'previsto'
                     check (status in ('previsto','recebido','atrasado','cancelado')),
  data_competencia date not null default current_date,
  data_recebimento date,
  observacao       text,
  created_at       timestamptz not null default now()
);
create index if not exists idx_lancamentos_org_data
  on public.lancamentos (organization_id, data_competencia desc);

-- ---------------------------------------------------------------------
-- integracoes — estado das conexões externas da clínica
-- ---------------------------------------------------------------------
create table if not exists public.integracoes (
  id              uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provedor        text not null
                    check (provedor in ('meta_ads','google_ads','ga4','whatsapp','instagram')),
  conectado       boolean not null default false,
  identificador   text,
  atualizado_em   timestamptz not null default now(),
  unique (organization_id, provedor)
);

-- ---------------------------------------------------------------------
-- RLS dos módulos da Fase 3
-- Padrão: leitura e escrita para quem é da clínica e é operacional;
-- super admin passa por cima. Médico não mexe em CRM nem em financeiro.
-- ---------------------------------------------------------------------
alter table public.lead_interacoes  enable row level security;
alter table public.conversas        enable row level security;
alter table public.mensagens        enable row level security;
alter table public.reguas           enable row level security;
alter table public.regua_passos     enable row level security;
alter table public.regua_execucoes  enable row level security;
alter table public.campanhas        enable row level security;
alter table public.lancamentos      enable row level security;
alter table public.integracoes      enable row level security;

drop policy if exists "interacoes_all" on public.lead_interacoes;
create policy "interacoes_all" on public.lead_interacoes
  for all to authenticated
  using ((organization_id = public.minha_org() and public.is_operacional()) or public.is_super_admin())
  with check ((organization_id = public.minha_org() and public.is_operacional()) or public.is_super_admin());

drop policy if exists "conversas_all" on public.conversas;
create policy "conversas_all" on public.conversas
  for all to authenticated
  using ((organization_id = public.minha_org() and public.is_operacional()) or public.is_super_admin())
  with check ((organization_id = public.minha_org() and public.is_operacional()) or public.is_super_admin());

-- Mensagem não tem organization_id: o acesso é herdado da conversa.
drop policy if exists "mensagens_all" on public.mensagens;
create policy "mensagens_all" on public.mensagens
  for all to authenticated
  using (exists (
    select 1 from public.conversas c
    where c.id = mensagens.conversa_id
      and ((c.organization_id = public.minha_org() and public.is_operacional()) or public.is_super_admin())
  ))
  with check (exists (
    select 1 from public.conversas c
    where c.id = mensagens.conversa_id
      and ((c.organization_id = public.minha_org() and public.is_operacional()) or public.is_super_admin())
  ));

drop policy if exists "reguas_all" on public.reguas;
create policy "reguas_all" on public.reguas
  for all to authenticated
  using ((organization_id = public.minha_org() and public.is_operacional()) or public.is_super_admin())
  with check ((organization_id = public.minha_org() and public.is_operacional()) or public.is_super_admin());

drop policy if exists "passos_all" on public.regua_passos;
create policy "passos_all" on public.regua_passos
  for all to authenticated
  using (exists (
    select 1 from public.reguas r
    where r.id = regua_passos.regua_id
      and ((r.organization_id = public.minha_org() and public.is_operacional()) or public.is_super_admin())
  ))
  with check (exists (
    select 1 from public.reguas r
    where r.id = regua_passos.regua_id
      and ((r.organization_id = public.minha_org() and public.is_operacional()) or public.is_super_admin())
  ));

drop policy if exists "execucoes_all" on public.regua_execucoes;
create policy "execucoes_all" on public.regua_execucoes
  for all to authenticated
  using ((organization_id = public.minha_org() and public.is_operacional()) or public.is_super_admin())
  with check ((organization_id = public.minha_org() and public.is_operacional()) or public.is_super_admin());

-- Campanhas e financeiro: leitura da clínica inteira, escrita só do gestor.
drop policy if exists "campanhas_select" on public.campanhas;
create policy "campanhas_select" on public.campanhas
  for select to authenticated
  using (organization_id = public.minha_org() or public.is_super_admin());

drop policy if exists "campanhas_write" on public.campanhas;
create policy "campanhas_write" on public.campanhas
  for all to authenticated
  using ((organization_id = public.minha_org() and public.is_gestor()) or public.is_super_admin())
  with check ((organization_id = public.minha_org() and public.is_gestor()) or public.is_super_admin());

drop policy if exists "lancamentos_select" on public.lancamentos;
create policy "lancamentos_select" on public.lancamentos
  for select to authenticated
  using (organization_id = public.minha_org() or public.is_super_admin());

drop policy if exists "lancamentos_write" on public.lancamentos;
create policy "lancamentos_write" on public.lancamentos
  for all to authenticated
  using ((organization_id = public.minha_org() and public.is_gestor()) or public.is_super_admin())
  with check ((organization_id = public.minha_org() and public.is_gestor()) or public.is_super_admin());

drop policy if exists "integracoes_select" on public.integracoes;
create policy "integracoes_select" on public.integracoes
  for select to authenticated
  using (organization_id = public.minha_org() or public.is_super_admin());

drop policy if exists "integracoes_write" on public.integracoes;
create policy "integracoes_write" on public.integracoes
  for all to authenticated
  using ((organization_id = public.minha_org() and public.is_gestor()) or public.is_super_admin())
  with check ((organization_id = public.minha_org() and public.is_gestor()) or public.is_super_admin());

-- =====================================================================
-- CONFIRMAÇÃO DE CONSULTA
--
-- O paciente recebe um link único e confirma a presença sem precisar de
-- conta. O disparo sai 1 dia útil antes, no horário escolhido pela
-- clínica.
-- =====================================================================

-- Preferências de disparo (a antecedencia_lembrete_h vira legado: passou
-- a ser contada em dias úteis, e não em horas corridas, porque consulta
-- de segunda precisa avisar na sexta)
alter table public.organizations add column if not exists lembrete_dias_uteis integer not null default 1;
alter table public.organizations add column if not exists lembrete_hora       integer not null default 9
  check (lembrete_hora between 0 and 23);
alter table public.organizations add column if not exists lembrete_ativo      boolean not null default true;

create table if not exists public.confirmacoes (
  id              uuid primary key default uuid_generate_v4(),
  consulta_id     uuid not null unique references public.consultas(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,

  -- Segredo que abre a página pública. Gerado no servidor com bytes
  -- aleatórios: é a única credencial do paciente, então precisa ser
  -- longo o bastante para não ser adivinhado.
  token           text not null unique,

  -- Quando o lembrete deve sair (1 dia útil antes, no horário da clínica)
  agendado_para   timestamptz not null,
  enviado_em      timestamptz,
  canal           text check (canal in ('whatsapp','manual','email')),

  status          text not null default 'pendente'
                    check (status in ('pendente','enviado','confirmado','reagendar','recusado','cancelado')),
  respondido_em   timestamptz,
  observacao      text,
  -- Quantas vezes a mensagem saiu, para não insistir sem limite
  tentativas      integer not null default 0,
  created_at      timestamptz not null default now()
);

create index if not exists idx_confirmacoes_envio
  on public.confirmacoes (organization_id, agendado_para)
  where status = 'pendente';

create index if not exists idx_confirmacoes_consulta
  on public.confirmacoes (consulta_id);

-- ---------------------------------------------------------------------
-- RLS
--
-- A página do paciente NÃO passa por aqui: ela roda no servidor com a
-- service role e busca pelo token exato. É de propósito — liberar select
-- para `anon` deixaria qualquer visitante varrer a agenda inteira das
-- clínicas, e um filtro por token no client não impede isso.
-- ---------------------------------------------------------------------
alter table public.confirmacoes enable row level security;

drop policy if exists "confirmacoes_all" on public.confirmacoes;
create policy "confirmacoes_all" on public.confirmacoes
  for all to authenticated
  using ((organization_id = public.minha_org() and public.is_operacional()) or public.is_super_admin())
  with check ((organization_id = public.minha_org() and public.is_operacional()) or public.is_super_admin());

-- =====================================================================
-- NOTIFICAÇÕES
--
-- Avisa a equipe do que aconteceu sem que ninguém precise abrir tela por
-- tela. Uma notificação é endereçada a papéis dentro de uma clínica (ou
-- à equipe Medi Marketing, quando a organização é nula), e não a uma
-- pessoa: quem responde é quem estiver de plantão.
--
-- Por isso a leitura fica numa tabela à parte — a mesma notificação pode
-- estar lida para a secretária e não lida para a gestora.
-- =====================================================================

create table if not exists public.notificacoes (
  id              uuid primary key default uuid_generate_v4(),
  -- Nulo = notificação da plataforma, só para o super admin
  organization_id uuid references public.organizations(id) on delete cascade,
  -- Quem enxerga. Super admin enxerga tudo, independente desta lista.
  papeis          text[] not null default '{gestor,secretaria}',

  tipo            text not null
                    check (tipo in (
                      'reagendamento','confirmacao','cancelamento',
                      'lembrete_atrasado','lead_novo','mensagem_nova',
                      'cadastro_pendente','sistema'
                    )),
  prioridade      text not null default 'normal'
                    check (prioridade in ('alta','normal')),
  titulo          text not null,
  descricao       text,
  -- Para onde o clique leva
  href            text,
  -- Id do registro que originou (consulta, lead, conversa...)
  entidade_id     uuid,
  created_at      timestamptz not null default now()
);

create index if not exists idx_notificacoes_org
  on public.notificacoes (organization_id, created_at desc);

create table if not exists public.notificacao_leituras (
  notificacao_id uuid not null references public.notificacoes(id) on delete cascade,
  user_id        uuid not null references public.profiles(id) on delete cascade,
  lida_em        timestamptz not null default now(),
  primary key (notificacao_id, user_id)
);

create index if not exists idx_leituras_user
  on public.notificacao_leituras (user_id);

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.notificacoes        enable row level security;
alter table public.notificacao_leituras enable row level security;

-- Leitura: da minha clínica e endereçada ao meu papel. O super admin vê
-- tudo, inclusive as da plataforma (organization_id nulo).
drop policy if exists "notificacoes_select" on public.notificacoes;
create policy "notificacoes_select" on public.notificacoes
  for select to authenticated
  using (
    public.is_super_admin()
    or (organization_id = public.minha_org() and public.meu_papel() = any(papeis))
  );

-- A criação acontece pelos caminhos de servidor (service role). Deixamos
-- a porta aberta para a própria clínica registrar avisos internos.
drop policy if exists "notificacoes_insert" on public.notificacoes;
create policy "notificacoes_insert" on public.notificacoes
  for insert to authenticated
  with check (
    public.is_super_admin()
    or (organization_id = public.minha_org() and public.is_operacional())
  );

-- Cada um controla apenas as próprias leituras
drop policy if exists "leituras_all" on public.notificacao_leituras;
create policy "leituras_all" on public.notificacao_leituras
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- =====================================================================
-- IDENTIDADE DA CLÍNICA
--
-- A logo aparece no painel da equipe e, principalmente, na página que o
-- paciente abre para confirmar. Para o paciente, quem atende é a
-- clínica — a plataforma não precisa aparecer ali.
-- =====================================================================

alter table public.organizations add column if not exists logo_url text;

-- ---------------------------------------------------------------------
-- Bucket público de logos
--
-- Público de propósito: o link de confirmação é aberto por quem não tem
-- conta, muitas vezes dentro do WhatsApp, onde não há sessão para
-- assinar uma URL. O que vai aqui é material de marca, feito para ser
-- visto — diferente do bucket `anexos`, que é privado porque guarda
-- documento clínico.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('logos', 'logos', true)
on conflict (id) do update set public = true;

-- Qualquer um lê (é o que torna a logo visível ao paciente)
drop policy if exists "logos_leitura_publica" on storage.objects;
create policy "logos_leitura_publica" on storage.objects
  for select using (bucket_id = 'logos');

-- Escrita restrita: só gestor ou super admin, e apenas na pasta da
-- própria clínica. O path é {organization_id}/arquivo.
drop policy if exists "logos_escrita" on storage.objects;
create policy "logos_escrita" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'logos'
    and (
      public.is_super_admin()
      or (
        public.is_gestor()
        and (storage.foldername(name))[1] = public.minha_org()::text
      )
    )
  );

drop policy if exists "logos_atualizacao" on storage.objects;
create policy "logos_atualizacao" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'logos'
    and (
      public.is_super_admin()
      or (
        public.is_gestor()
        and (storage.foldername(name))[1] = public.minha_org()::text
      )
    )
  );

drop policy if exists "logos_remocao" on storage.objects;
create policy "logos_remocao" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'logos'
    and (
      public.is_super_admin()
      or (
        public.is_gestor()
        and (storage.foldername(name))[1] = public.minha_org()::text
      )
    )
  );
