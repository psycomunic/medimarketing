-- =====================================================================
-- Medi Marketing — Schema do banco (Supabase / Postgres)
-- Execute no SQL Editor do Supabase (uma vez) ou via CLI:
--   supabase db push
-- =====================================================================

-- Extensões úteis
create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------------------
-- Tipos enumerados
-- ---------------------------------------------------------------------
do $$ begin
  create type role_usuario as enum ('medico', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type status_consulta as enum ('pendente', 'confirmada', 'cancelada', 'realizada');
exception when duplicate_object then null; end $$;

do $$ begin
  create type tipo_consulta as enum ('primeira', 'retorno', 'teleconsulta');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- profiles — 1:1 com auth.users
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  nome          text,
  especialidade text,
  crm           text,
  telefone      text,
  foto_url      text,
  role          role_usuario not null default 'medico',
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- consultas — núcleo da agenda
-- ---------------------------------------------------------------------
create table if not exists public.consultas (
  id                  uuid primary key default uuid_generate_v4(),
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
alter table public.consultas add column if not exists paciente_email      text;
alter table public.consultas add column if not exists paciente_nascimento date;
alter table public.consultas add column if not exists convenio            text;
alter table public.consultas add column if not exists duracao_min         integer default 30;
alter table public.consultas add column if not exists motivo              text;
alter table public.consultas add column if not exists valor               numeric(10,2);

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
-- leads — formulários da landing page
-- ---------------------------------------------------------------------
create table if not exists public.leads (
  id            uuid primary key default uuid_generate_v4(),
  nome          text not null,
  especialidade text,
  whatsapp      text not null,
  cidade        text,
  origem        text default 'landing',
  created_at    timestamptz not null default now()
);

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================
alter table public.profiles       enable row level security;
alter table public.consultas      enable row level security;
alter table public.disponibilidade enable row level security;
alter table public.bloqueios      enable row level security;
alter table public.leads          enable row level security;
alter table public.anexos         enable row level security;

-- Função auxiliar: verifica se o usuário atual é admin
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ---- profiles ----
drop policy if exists "profiles_self_select" on public.profiles;
create policy "profiles_self_select" on public.profiles
  for select using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles_self_update" on public.profiles;
create policy "profiles_self_update" on public.profiles
  for update using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles_admin_insert" on public.profiles;
create policy "profiles_admin_insert" on public.profiles
  for insert with check (id = auth.uid() or public.is_admin());

-- ---- consultas ---- (médico vê/edita só as suas; admin vê tudo)
drop policy if exists "consultas_select" on public.consultas;
create policy "consultas_select" on public.consultas
  for select using (medico_id = auth.uid() or public.is_admin());

drop policy if exists "consultas_update" on public.consultas;
create policy "consultas_update" on public.consultas
  for update using (medico_id = auth.uid() or public.is_admin());

drop policy if exists "consultas_insert" on public.consultas;
create policy "consultas_insert" on public.consultas
  for insert with check (medico_id = auth.uid() or public.is_admin());

drop policy if exists "consultas_delete" on public.consultas;
create policy "consultas_delete" on public.consultas
  for delete using (public.is_admin());

-- ---- disponibilidade ---- (médico gerencia a própria)
drop policy if exists "disp_all" on public.disponibilidade;
create policy "disp_all" on public.disponibilidade
  for all using (medico_id = auth.uid() or public.is_admin())
  with check (medico_id = auth.uid() or public.is_admin());

-- ---- bloqueios ---- (médico gerencia os próprios)
drop policy if exists "bloq_all" on public.bloqueios;
create policy "bloq_all" on public.bloqueios
  for all using (medico_id = auth.uid() or public.is_admin())
  with check (medico_id = auth.uid() or public.is_admin());

-- ---- leads ---- (INSERT público via anon; leitura só admin)
drop policy if exists "leads_public_insert" on public.leads;
create policy "leads_public_insert" on public.leads
  for insert with check (true);

drop policy if exists "leads_admin_select" on public.leads;
create policy "leads_admin_select" on public.leads
  for select using (public.is_admin());

-- ---- anexos ---- (médico gerencia os anexos das próprias consultas)
drop policy if exists "anexos_all" on public.anexos;
create policy "anexos_all" on public.anexos
  for all using (medico_id = auth.uid() or public.is_admin())
  with check (medico_id = auth.uid() or public.is_admin());

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
-- =====================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nome, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', new.email),
    'medico'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
