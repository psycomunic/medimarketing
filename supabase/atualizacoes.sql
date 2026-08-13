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


-- ---------------------------------------------------------------------
-- 2026-08-11 (2) — Notificações
--
-- Rode para habilitar a aba de notificações e os alertas de
-- reagendamento.
-- ---------------------------------------------------------------------

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


-- ---------------------------------------------------------------------
-- 2026-08-11 (3) — Logo da clínica
--
-- Rode para habilitar o upload da logo e a personalização do painel
-- e da página de confirmação do paciente.
-- ---------------------------------------------------------------------

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

-- ====================================================================
-- 2026-08-12 · WhatsApp pelo Merge
--
-- Cada clínica conecta o próprio número no Merge por QR code. A chave
-- da API é da conta da agência e vale para todas as conexões; o que
-- separa uma clínica da outra é o id da conexão, guardado aqui.
--
-- Fica nulo de propósito até alguém escolher: sem conexão definida o
-- envio automático não acontece, porque mandar mensagem de uma clínica
-- pelo número de outra é pior do que não mandar.
-- ====================================================================

alter table public.organizations
  add column if not exists merge_connection_id integer;

comment on column public.organizations.merge_connection_id is
  'Conexão do Merge (número de WhatsApp) que envia as mensagens desta clínica.';

-- O canal de disparo passa a distinguir de onde a mensagem saiu: pelo
-- número da própria clínica (merge) ou pelo número da plataforma
-- (whatsapp). Sem isso o histórico não conta a diferença que o
-- paciente enxerga.
alter table public.confirmacoes
  drop constraint if exists confirmacoes_canal_check;

alter table public.confirmacoes
  add constraint confirmacoes_canal_check
  check (canal in ('whatsapp','merge','manual','email'));

-- ====================================================================
-- 2026-08-12 (2) · Nome e logo da clínica pelo médico
--
-- Nome e logo não são administração: são a cara que o paciente vê em
-- toda mensagem — remetente do e-mail, assinatura do WhatsApp e
-- cabeçalho da página de confirmação. Em consultório de um médico só,
-- que é a maior parte da carteira, obrigá-lo a pedir para outra pessoa
-- trocar a própria marca é burocracia sem propósito.
--
-- A secretária continua de fora: ela opera a agenda, não decide a
-- marca. E o médico segue sem poder mexer em CNPJ, endereço, plano ou
-- horário de lembrete — para isso a política de gestor continua sendo
-- a única porta.
-- ====================================================================

create or replace function public.pode_editar_marca()
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.meu_papel() in ('gestor', 'medico', 'super_admin'), false);
$$;

comment on function public.pode_editar_marca() is
  'Quem pode trocar o nome e a logo da própria clínica.';

drop policy if exists "org_update" on public.organizations;
create policy "org_update" on public.organizations
  for update using (
    (id = public.minha_org() and public.pode_editar_marca())
    or public.is_super_admin()
  );

-- O storage guarda o arquivo da logo; sem liberar aqui também, o
-- médico salvaria o nome e apanharia no upload.
drop policy if exists "logos_envio" on storage.objects;
create policy "logos_envio" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'logos'
    and (
      public.is_super_admin()
      or (
        public.pode_editar_marca()
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
        public.pode_editar_marca()
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
        public.pode_editar_marca()
        and (storage.foldername(name))[1] = public.minha_org()::text
      )
    )
  );

-- ====================================================================
-- 2026-08-12 (3) · Colunas comerciais protegidas
--
-- A política de update libera a linha inteira, não coluna por coluna.
-- Como gestor e médico agora podem editar nome, logo e número de
-- WhatsApp, nada impediria um deles de chamar a API direto e mudar o
-- próprio plano ou reativar uma clínica que a agência desligou — a
-- interface não oferece, mas a interface não é a fronteira.
--
-- O gatilho fecha isso onde a fronteira de verdade está.
-- ====================================================================

create or replace function public.protege_campos_comerciais()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.is_super_admin() then
    return new;
  end if;

  if new.plano is distinct from old.plano then
    raise exception 'Somente a equipe Medi Marketing altera o plano da clínica';
  end if;

  if new.ativo is distinct from old.ativo then
    raise exception 'Somente a equipe Medi Marketing ativa ou desativa a clínica';
  end if;

  return new;
end;
$$;

drop trigger if exists organizations_protege_comercial on public.organizations;
create trigger organizations_protege_comercial
  before update on public.organizations
  for each row execute function public.protege_campos_comerciais();
