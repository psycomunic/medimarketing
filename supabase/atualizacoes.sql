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
