-- =====================================================================
-- ATUALIZAÇÕES — para bancos que já rodaram o schema.sql
--
-- Cada bloco é datado e idempotente. Se você está montando um projeto do
-- zero, ignore este arquivo: o schema.sql já vem com tudo aplicado.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 2026-08-11 — Cadastro público de dono de clínica
--
-- Rode este bloco ANTES de abrir a tela de cadastro.
-- ---------------------------------------------------------------------

-- 1) Fila de liberação: separa "nunca foi aprovado" de "acesso cortado"
alter table public.profiles
  add column if not exists aguardando_liberacao boolean not null default false;


-- 2) CORREÇÃO DE SEGURANÇA — o trigger não pode mais confiar nos metadados
--
-- A versão anterior lia papel e clínica de `raw_user_meta_data`, que é
-- preenchido por quem chama a API de cadastro. Sem cadastro público isso
-- era inofensivo, porque só administradores criavam contas. Com a tela
-- aberta, qualquer visitante poderia enviar {"role":"super_admin"} e
-- receber acesso a todas as clínicas.
--
-- Agora o perfil nasce sempre no menor privilégio: sem clínica e como
-- 'medico'. Quem concede acesso de verdade são os caminhos do servidor
-- que rodam com a service role, depois de conferir quem está pedindo.
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


-- 3) Confira se alguém já se aproveitou da versão antiga do trigger.
--    O resultado esperado é uma linha só: a sua conta de administrador.
--    Qualquer super_admin que você não reconheça deve ser investigado.
select id, nome, role, created_at
  from public.profiles
 where role = 'super_admin'
 order by created_at;


-- ---------------------------------------------------------------------
-- 2026-08-11 — Confirmação de consulta pelo paciente
--
-- Rode este bloco para habilitar o link de confirmação e o disparo
-- automático 1 dia útil antes da consulta.
-- ---------------------------------------------------------------------

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
