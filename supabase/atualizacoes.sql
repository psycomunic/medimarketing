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

-- ====================================================================
-- 2026-08-12 (4) · Propostas comerciais
--
-- Cada proposta é uma página pública, aberta por token, com a marca do
-- cliente e os preços combinados naquela conversa. O token é a única
-- credencial: quem tem o link vê, e é assim que precisa ser — o médico
-- vai abrir no celular, encaminhar para o sócio, e ninguém vai criar
-- conta para ler uma proposta.
--
-- Por isso a leitura pública é por `token`, nunca por id, e a tabela
-- não guarda nada sensível além do que já estaria no PDF que hoje se
-- manda por WhatsApp.
-- ====================================================================

create table if not exists public.propostas (
  id              uuid primary key default gen_random_uuid(),
  token           text not null unique,

  -- A marca do cliente, que a apresentação veste
  cliente_nome    text not null,
  cliente_logo_url text,
  especialidade   text,
  cidade          text,
  responsavel     text,

  -- Preços daquela conversa. Nulo = "sob consulta".
  preco_essencial   numeric(10,2),
  preco_performance numeric(10,2),
  preco_full        numeric(10,2),
  plano_destaque    text not null default 'performance'
                      check (plano_destaque in ('essencial','performance','full')),

  -- Parágrafo escrito à mão para aquele cliente, se houver
  mensagem        text,
  valida_ate      date,

  status          text not null default 'enviada'
                    check (status in ('enviada','vista','aceita','recusada')),
  visualizacoes   integer not null default 0,
  vista_em        timestamptz,
  respondida_em   timestamptz,

  criado_por      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now()
);

create index if not exists propostas_token_idx on public.propostas (token);
create index if not exists propostas_criada_idx on public.propostas (created_at desc);

alter table public.propostas enable row level security;

-- Só a equipe Medi Marketing cria, lê e edita pelo painel. A página
-- pública não passa por aqui: ela lê com a service role, filtrando
-- pelo token, porque quem abre a proposta não tem sessão.
drop policy if exists "propostas_admin" on public.propostas;
create policy "propostas_admin" on public.propostas
  for all using (public.is_super_admin()) with check (public.is_super_admin());

comment on table public.propostas is
  'Propostas comerciais com link público por token.';

-- ====================================================================
-- 2026-10-26 · Diagnóstico da clínica (formulários por schema)
--
-- O diagnóstico inicial deixa de ser um HTML que o cliente preenche e
-- baixa: passa a viver no painel, salvo no banco, com a equipe lendo,
-- anotando e marcando como revisado.
--
-- O formulário é um JSON em `formularios_modelos`. Formulário novo é
-- linha nova aqui, não código novo. Cada resposta aponta para a versão
-- exata do modelo, então publicar a versão 2 não muda a leitura do que
-- já foi respondido na 1.
--
-- Quem responde pela clínica: gestor e médico (o médico é o dono na
-- maior parte da carteira, os consultórios de um profissional só). A
-- secretária não vê: são números de faturamento e margem.
-- ====================================================================

create or replace function public.responde_formularios()
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.meu_papel() in ('gestor', 'medico'), false);
$$;

create table if not exists public.formularios_modelos (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null,
  versao      integer not null default 1,
  titulo      text not null,
  descricao   text,
  schema      jsonb not null,
  ativo       boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (slug, versao)
);

create table if not exists public.formularios_respostas (
  id                uuid primary key default gen_random_uuid(),
  modelo_id         uuid not null references public.formularios_modelos(id) on delete restrict,
  organization_id   uuid not null references public.organizations(id) on delete cascade,
  status            text not null default 'rascunho'
                      check (status in ('rascunho', 'enviado', 'revisado')),
  respondente_nome  text,
  respondente_cargo text,
  data_referencia   date,
  respostas         jsonb not null default '{}'::jsonb,
  progresso         smallint not null default 0 check (progresso between 0 and 100),
  enviado_em        timestamptz,
  revisado_em       timestamptz,
  revisado_por      uuid references public.profiles(id) on delete set null,
  atualizado_por    uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (organization_id, modelo_id)
);

create index if not exists formularios_respostas_status_idx
  on public.formularios_respostas (status, updated_at desc);

create table if not exists public.formularios_notas (
  id           uuid primary key default gen_random_uuid(),
  resposta_id  uuid not null references public.formularios_respostas(id) on delete cascade,
  autor_id     uuid references public.profiles(id) on delete set null,
  texto        text not null check (length(trim(texto)) > 0),
  created_at   timestamptz not null default now()
);

create table if not exists public.formularios_eventos (
  id           uuid primary key default gen_random_uuid(),
  resposta_id  uuid not null references public.formularios_respostas(id) on delete cascade,
  autor_id     uuid references public.profiles(id) on delete set null,
  tipo         text not null check (tipo in ('liberado', 'enviado', 'reaberto', 'revisado')),
  created_at   timestamptz not null default now()
);

create index if not exists formularios_notas_resposta_idx on public.formularios_notas (resposta_id);
create index if not exists formularios_eventos_resposta_idx on public.formularios_eventos (resposta_id);

-- --------------------------------------------------------------------
-- Guarda das colunas de controle
--
-- A política de update libera a linha do rascunho inteira. Sem este
-- gatilho, a clínica poderia chamar a API direto e se dar "revisado",
-- trocar de modelo ou mudar a data de envio. A interface não oferece;
-- a interface não é a fronteira.
--
-- As transições legítimas passam pelas funções abaixo, que ligam a
-- chave `app.formulario_transicao` só dentro da própria transação.
-- --------------------------------------------------------------------
create or replace function public.formularios_respostas_guarda()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();

  if public.is_super_admin()
     or coalesce(current_setting('app.formulario_transicao', true), '') = 'on' then
    return new;
  end if;

  if new.status          is distinct from old.status
  or new.enviado_em      is distinct from old.enviado_em
  or new.revisado_em     is distinct from old.revisado_em
  or new.revisado_por    is distinct from old.revisado_por
  or new.organization_id is distinct from old.organization_id
  or new.modelo_id       is distinct from old.modelo_id
  or new.created_at      is distinct from old.created_at then
    raise exception 'Somente a equipe Medi Marketing altera o status do diagnóstico';
  end if;

  return new;
end;
$$;

drop trigger if exists formularios_respostas_guarda on public.formularios_respostas;
create trigger formularios_respostas_guarda
  before update on public.formularios_respostas
  for each row execute function public.formularios_respostas_guarda();

-- --------------------------------------------------------------------
-- RLS
-- --------------------------------------------------------------------
alter table public.formularios_modelos   enable row level security;
alter table public.formularios_respostas enable row level security;
alter table public.formularios_notas     enable row level security;
alter table public.formularios_eventos   enable row level security;

-- Modelos: lê o ativo, ou a versão antiga em que a própria clínica respondeu
drop policy if exists "formularios_modelos_select" on public.formularios_modelos;
create policy "formularios_modelos_select" on public.formularios_modelos
  for select to authenticated
  using (
    ativo
    or public.is_super_admin()
    or exists (
      select 1 from public.formularios_respostas r
      where r.modelo_id = formularios_modelos.id
        and r.organization_id = public.minha_org()
    )
  );

drop policy if exists "formularios_modelos_admin" on public.formularios_modelos;
create policy "formularios_modelos_admin" on public.formularios_modelos
  for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

-- Respostas: a clínica lê as suas; só edita enquanto é rascunho
drop policy if exists "formularios_respostas_select" on public.formularios_respostas;
create policy "formularios_respostas_select" on public.formularios_respostas
  for select to authenticated
  using (
    public.is_super_admin()
    or (organization_id = public.minha_org() and public.responde_formularios())
  );

drop policy if exists "formularios_respostas_update" on public.formularios_respostas;
create policy "formularios_respostas_update" on public.formularios_respostas
  for update to authenticated
  using (
    organization_id = public.minha_org()
    and public.responde_formularios()
    and status = 'rascunho'
  )
  with check (
    organization_id = public.minha_org()
    and public.responde_formularios()
    and status = 'rascunho'
  );

-- Criar, apagar e mudar status: só a equipe (direto ou pelas funções)
drop policy if exists "formularios_respostas_admin" on public.formularios_respostas;
create policy "formularios_respostas_admin" on public.formularios_respostas
  for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

-- Notas internas e histórico: só a equipe. A clínica não lê nenhum dos dois.
drop policy if exists "formularios_notas_admin" on public.formularios_notas;
create policy "formularios_notas_admin" on public.formularios_notas
  for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

drop policy if exists "formularios_eventos_admin" on public.formularios_eventos;
create policy "formularios_eventos_admin" on public.formularios_eventos
  for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

-- --------------------------------------------------------------------
-- Transições de status
-- --------------------------------------------------------------------
create or replace function public.enviar_formulario(p_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  r public.formularios_respostas;
begin
  select * into r from public.formularios_respostas where id = p_id for update;
  if not found then
    raise exception 'Diagnóstico não encontrado';
  end if;
  if not (
    public.is_super_admin()
    or (r.organization_id = public.minha_org() and public.responde_formularios())
  ) then
    raise exception 'Sem permissão para enviar este diagnóstico';
  end if;
  if r.status <> 'rascunho' then
    raise exception 'Este diagnóstico já foi enviado';
  end if;

  perform set_config('app.formulario_transicao', 'on', true);
  update public.formularios_respostas
     set status = 'enviado', enviado_em = now(), atualizado_por = auth.uid()
   where id = p_id;
  perform set_config('app.formulario_transicao', 'off', true);

  insert into public.formularios_eventos (resposta_id, autor_id, tipo)
  values (p_id, auth.uid(), 'enviado');
end;
$$;

create or replace function public.reabrir_formulario(p_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_super_admin() then
    raise exception 'Somente a equipe Medi Marketing reabre um diagnóstico';
  end if;

  update public.formularios_respostas
     set status = 'rascunho', enviado_em = null, revisado_em = null, revisado_por = null
   where id = p_id and status in ('enviado', 'revisado');
  if not found then
    raise exception 'Só um diagnóstico enviado pode ser reaberto';
  end if;

  insert into public.formularios_eventos (resposta_id, autor_id, tipo)
  values (p_id, auth.uid(), 'reaberto');
end;
$$;

create or replace function public.marcar_formulario_revisado(p_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_super_admin() then
    raise exception 'Somente a equipe Medi Marketing revisa um diagnóstico';
  end if;

  update public.formularios_respostas
     set status = 'revisado', revisado_em = now(), revisado_por = auth.uid()
   where id = p_id and status = 'enviado';
  if not found then
    raise exception 'Só um diagnóstico enviado pode ser marcado como revisado';
  end if;

  insert into public.formularios_eventos (resposta_id, autor_id, tipo)
  values (p_id, auth.uid(), 'revisado');
end;
$$;

-- Libera o formulário para uma clínica. Se ela já tem um (de qualquer
-- versão daquele slug), devolve o existente em vez de duplicar.
create or replace function public.liberar_formulario(p_org uuid, p_slug text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_modelo uuid;
  v_id     uuid;
begin
  if not public.is_super_admin() then
    raise exception 'Somente a equipe Medi Marketing libera formulários';
  end if;

  select r.id into v_id
    from public.formularios_respostas r
    join public.formularios_modelos m on m.id = r.modelo_id
   where r.organization_id = p_org and m.slug = p_slug
   limit 1;
  if v_id is not null then
    return v_id;
  end if;

  select id into v_modelo
    from public.formularios_modelos
   where slug = p_slug and ativo
   order by versao desc
   limit 1;
  if v_modelo is null then
    raise exception 'Modelo de formulário não encontrado';
  end if;

  insert into public.formularios_respostas (modelo_id, organization_id)
  values (v_modelo, p_org)
  returning id into v_id;

  insert into public.formularios_eventos (resposta_id, autor_id, tipo)
  values (v_id, auth.uid(), 'liberado');

  return v_id;
end;
$$;

revoke all on function public.enviar_formulario(uuid)             from public, anon;
revoke all on function public.reabrir_formulario(uuid)            from public, anon;
revoke all on function public.marcar_formulario_revisado(uuid)    from public, anon;
revoke all on function public.liberar_formulario(uuid, text)      from public, anon;
grant execute on function public.enviar_formulario(uuid)          to authenticated;
grant execute on function public.reabrir_formulario(uuid)         to authenticated;
grant execute on function public.marcar_formulario_revisado(uuid) to authenticated;
grant execute on function public.liberar_formulario(uuid, text)   to authenticated;

-- --------------------------------------------------------------------
-- Storage: anexos do diagnóstico
--
-- Pasta por clínica e por resposta: {organization_id}/{resposta_id}/...
-- Diferente do bucket "anexos" (pasta por usuário), aqui a equipe
-- precisa ler o que a clínica mandou. A clínica só sobe e apaga
-- enquanto o diagnóstico é rascunho.
-- --------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'diagnosticos', 'diagnosticos', false, 10485760,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv',
    'image/png',
    'image/jpeg'
  ]
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "diagnosticos_leitura" on storage.objects;
create policy "diagnosticos_leitura" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'diagnosticos'
    and (
      public.is_super_admin()
      or (
        public.responde_formularios()
        and (storage.foldername(name))[1] = public.minha_org()::text
      )
    )
  );

drop policy if exists "diagnosticos_envio" on storage.objects;
create policy "diagnosticos_envio" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'diagnosticos'
    and (
      public.is_super_admin()
      or (
        public.responde_formularios()
        and (storage.foldername(name))[1] = public.minha_org()::text
        and exists (
          select 1 from public.formularios_respostas r
          where r.id::text = (storage.foldername(name))[2]
            and r.organization_id = public.minha_org()
            and r.status = 'rascunho'
        )
      )
    )
  );

drop policy if exists "diagnosticos_remocao" on storage.objects;
create policy "diagnosticos_remocao" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'diagnosticos'
    and (
      public.is_super_admin()
      or (
        public.responde_formularios()
        and (storage.foldername(name))[1] = public.minha_org()::text
        and exists (
          select 1 from public.formularios_respostas r
          where r.id::text = (storage.foldername(name))[2]
            and r.organization_id = public.minha_org()
            and r.status = 'rascunho'
        )
      )
    )
  );

comment on table public.formularios_modelos is
  'Formulários gerados por schema JSON (lib/formularios/tipos.ts), versionados.';
comment on table public.formularios_respostas is
  'Respostas de uma clínica a uma versão de formulário. Rascunho editável pela clínica.';

-- --------------------------------------------------------------------
-- Seed: diagnóstico da clínica, versão 1
-- Gerado por `npx tsx scripts/seed-formularios.mts` a partir de
-- lib/formularios/diagnostico-clinica.ts. Não edite à mão.
-- --------------------------------------------------------------------
insert into public.formularios_modelos (slug, versao, titulo, descricao, schema, ativo)
values (
  'diagnostico-clinica', 1, 'Diagnóstico inicial',
  'Estratégia para o crescimento da clínica',
  $schema${
  "intro": {
    "eyebrow": "Estratégia para o crescimento da clínica",
    "titulo": "Vamos entender o seu negócio.",
    "destaque": "E planejar o próximo passo.",
    "texto": "Este questionário nos ajuda a conhecer a operação da {clinica} e definir prioridades para aumentar o faturamento, considerando margem, capacidade de atendimento e experiência dos pacientes."
  },
  "aviso": "Use os três últimos meses completos. Indique “não medimos” quando não houver dados e “estimativa” para valores aproximados. Não inclua nomes ou dados pessoais de pacientes.",
  "agradecimento": "Obrigado pelo preenchimento. As respostas vão orientar a definição de prioridades, metas e indicadores de acompanhamento junto à MediMarketing.",
  "etapas": [
    {
      "id": "objetivos",
      "rotulo": "Objetivos",
      "titulo": "Objetivos e prioridades",
      "campos": [
        {
          "tipo": "texto",
          "id": "meta_faturamento",
          "pergunta": "Qual é a meta de faturamento mensal e em quanto tempo desejam alcançá-la?",
          "ajuda": "Informe também se a prioridade é aumentar faturamento, lucro, ocupação da agenda ou uma combinação desses objetivos."
        },
        {
          "tipo": "texto",
          "id": "principal_obstaculo",
          "pergunta": "O que vocês consideram o principal obstáculo ao crescimento hoje?",
          "ajuda": "Exemplos: poucos contatos, dificuldade para agendar, faltas, baixa adesão ao tratamento ou agenda cheia."
        },
        {
          "tipo": "texto",
          "id": "servicos_prioritarios",
          "pergunta": "Quais serviços querem priorizar e por quê?",
          "ajuda": "Considerem todos os serviços que estejam ativos."
        },
        {
          "tipo": "texto",
          "id": "aumento_procura",
          "pergunta": "Se a procura aumentasse no próximo mês, o que precisaria mudar para atender bem?"
        }
      ]
    },
    {
      "id": "servicos",
      "rotulo": "Serviços",
      "titulo": "Serviços e capacidade de atendimento",
      "instrucao": "Preencha uma linha por serviço ativo. Se as técnicas fizerem parte de uma mesma sessão, registre o serviço cobrado, sem duplicar a receita. Adicione linhas se necessário.",
      "campos": [
        {
          "tipo": "tabela",
          "id": "servicos",
          "rotulo": "Serviço",
          "colunas": [
            {
              "id": "preco",
              "titulo": "Preço praticado (R$)"
            },
            {
              "id": "duracao",
              "titulo": "Duração (minutos)"
            },
            {
              "id": "vagas",
              "titulo": "Vagas por semana (total / ocupadas)"
            }
          ],
          "linhas": [
            "Avaliação inicial",
            "Quiropraxia",
            "Fisioterapia",
            "Pilates",
            "Outros"
          ],
          "permite_linhas": true,
          "rotulo_editavel": true,
          "nota": "Em serviços recorrentes, como Pilates, informe se o valor corresponde à aula ou à mensalidade e se as vagas representam pessoas ou turmas."
        },
        {
          "tipo": "texto",
          "id": "primeira_consulta",
          "pergunta": "Como funciona a primeira consulta de quem procura o serviço principal?",
          "ajuda": "O que está incluído, quem atende e como a proposta é explicada antes do agendamento?"
        },
        {
          "tipo": "texto",
          "id": "margem_servicos",
          "pergunta": "Quais serviços deixam maior margem para a clínica?",
          "ajuda": "Se possível, informe os custos diretos ou repasses por serviço. Não é necessário calcular caso esse controle ainda não exista."
        },
        {
          "tipo": "texto",
          "id": "planos_pagamento",
          "pergunta": "Há planos, pacotes, convênios ou parcelamento? Como funcionam?",
          "ajuda": "Informe valores, descontos e formas de pagamento mais utilizadas."
        },
        {
          "tipo": "texto",
          "id": "vagas_espera",
          "pergunta": "Quais horários e profissionais têm vagas? Qual é a espera para uma primeira consulta?"
        },
        {
          "tipo": "texto",
          "id": "clinica_ou_profissional",
          "pergunta": "Os pacientes procuram a clínica ou um profissional específico?",
          "ajuda": "Quando a agenda desse profissional está cheia, aceitam atendimento com outro membro da equipe?"
        }
      ]
    },
    {
      "id": "captacao",
      "rotulo": "Captação",
      "titulo": "Do primeiro contato ao atendimento",
      "campos": [
        {
          "tipo": "texto",
          "id": "perfil_publico",
          "pergunta": "Quem costuma procurar a clínica e de onde essas pessoas vêm?",
          "ajuda": "Principais necessidades, faixa etária, bairros e cidades. Quais perfis a equipe está mais preparada para atender?"
        },
        {
          "tipo": "texto",
          "id": "canais_origem",
          "pergunta": "De quais canais vêm os novos pacientes e como vocês registram essa origem?",
          "ajuda": "Exemplos: indicação, Google, Instagram, anúncios, parceiros e outros."
        },
        {
          "tipo": "texto",
          "id": "tempo_resposta",
          "pergunta": "Quem responde aos contatos e qual é o tempo médio de primeira resposta?",
          "ajuda": "Informe como funciona durante o expediente, à noite e nos fins de semana."
        },
        {
          "tipo": "texto",
          "id": "motivos_nao_agendar",
          "pergunta": "Quais são os motivos mais frequentes para um interessado não agendar?",
          "ajuda": "Exemplos: preço, localização, falta de horário, dúvidas sobre o atendimento ou ausência de resposta."
        },
        {
          "tipo": "texto",
          "id": "acompanhamento_interessados",
          "pergunta": "Como acompanham quem pediu informações e não agendou?",
          "ajuda": "Existe responsável, prazo para novo contato e registro do resultado?"
        },
        {
          "tipo": "texto",
          "id": "confirmacao_cancelamento",
          "pergunta": "Como funcionam a confirmação, os cancelamentos e os reagendamentos?",
          "ajuda": "Há lista de espera ou outra forma de preencher horários liberados?"
        },
        {
          "tipo": "texto",
          "id": "foco_anuncios",
          "pergunta": "Qual serviço é o foco dos anúncios atuais? Por quê?",
          "ajuda": "O que já funcionou ou não funcionou? Os contatos procuram uma sessão pontual ou entendem a proposta de avaliação e tratamento?"
        }
      ]
    },
    {
      "id": "continuidade",
      "rotulo": "Continuidade",
      "titulo": "Continuidade e experiência do paciente",
      "nota_final": "A continuidade deve acompanhar a necessidade clínica e a orientação da equipe. Para este diagnóstico, alta adequada e abandono são situações diferentes.",
      "campos": [
        {
          "tipo": "texto",
          "id": "apresentacao_proposta",
          "pergunta": "Quando há indicação de tratamento após a avaliação, como a proposta é apresentada?",
          "ajuda": "Quem explica objetivos, frequência, valores e próximos passos? Quais são as dúvidas ou objeções mais comuns?"
        },
        {
          "tipo": "texto",
          "id": "adesao_tratamento",
          "pergunta": "Quantos pacientes iniciam o tratamento indicado e quantos deixam de iniciar?",
          "ajuda": "Use o mesmo período de referência. Se não houver números, descreva sua percepção e identifique como estimativa."
        },
        {
          "tipo": "texto",
          "id": "duracao_gasto_tratamento",
          "pergunta": "Qual é a duração habitual e o gasto médio por tratamento em cada serviço?",
          "ajuda": "Diferencie duração de cada atendimento, número de sessões realizadas e tempo total em semanas ou meses."
        },
        {
          "tipo": "texto",
          "id": "alta_interrupcao",
          "pergunta": "Como diferenciam pacientes que receberam alta daqueles que interromperam o tratamento?",
          "ajuda": "Quais motivos de interrupção são conhecidos? Como acompanham faltas e continuidade quando indicada pela equipe?"
        },
        {
          "tipo": "texto",
          "id": "servicos_recorrentes",
          "pergunta": "Como funcionam os serviços recorrentes (ex.: Pilates, planos mensais) atualmente?",
          "ajuda": "Informe alunos ou pacientes ativos, frequência semanal, mensalidade média, permanência média e motivos de saída. Se não houver, indique isso."
        },
        {
          "tipo": "texto",
          "id": "percepcao_pacientes",
          "pergunta": "O que os pacientes mais valorizam e quais reclamações aparecem com frequência?",
          "ajuda": "Como essas opiniões são coletadas? O que diferencia a {clinica} na percepção dos pacientes?"
        }
      ]
    },
    {
      "id": "indicadores",
      "rotulo": "Indicadores",
      "titulo": "Números para orientar o planejamento",
      "instrucao": "Preencha os três últimos meses completos. Considere pacientes únicos separadamente do número de sessões: uma pessoa atendida quatro vezes representa um paciente e quatro atendimentos.",
      "campos": [
        {
          "tipo": "tabela_mensal",
          "id": "indicadores",
          "rotulo": "Indicador",
          "meses": 3,
          "linhas": [
            {
              "id": "faturamento_total",
              "rotulo": "Faturamento total (R$)"
            },
            {
              "por_tabela": "servicos",
              "modelo": "Receita de {item} (R$)",
              "ignorar": [
                "Avaliação inicial"
              ]
            },
            {
              "id": "pacientes_unicos",
              "rotulo": "Pacientes únicos atendidos"
            },
            {
              "id": "novos_pacientes",
              "rotulo": "Novos pacientes atendidos"
            },
            {
              "id": "total_atendimentos",
              "rotulo": "Total de atendimentos realizados"
            },
            {
              "id": "ticket_medio",
              "rotulo": "Ticket médio por atendimento (R$)"
            },
            {
              "id": "gasto_medio_paciente",
              "rotulo": "Gasto médio por paciente no mês (R$)"
            },
            {
              "id": "novos_interessados",
              "rotulo": "Novos interessados que entraram em contato"
            },
            {
              "id": "consultas_agendadas",
              "rotulo": "Primeiras consultas agendadas"
            },
            {
              "id": "consultas_realizadas",
              "rotulo": "Primeiras consultas realizadas"
            },
            {
              "id": "investimento_anuncios",
              "rotulo": "Investimento em anúncios (R$)"
            }
          ],
          "nota": "Use o mesmo critério financeiro nos três meses e evite somar a mesma receita em mais de um serviço. Os contatos e agendamentos do mês podem se referir a pessoas de períodos diferentes."
        },
        {
          "tipo": "texto",
          "id": "fonte_dados",
          "pergunta": "Os valores acima representam serviços vendidos, realizados ou dinheiro recebido?",
          "ajuda": "Informe a fonte dos dados e sinalize estimativas. Se houver relatórios dos últimos seis meses, anexe aqui.",
          "anexos": true
        },
        {
          "tipo": "texto",
          "id": "sistemas_planilhas",
          "pergunta": "Quais sistemas ou planilhas usam para agenda, atendimento e financeiro?",
          "ajuda": "Conseguem relacionar a origem do contato ao atendimento e à receita? Informe também quem pode esclarecer os dados e qualquer informação importante que tenha faltado."
        }
      ]
    }
  ]
}$schema$::jsonb,
  true
)
on conflict (slug, versao) do update
  set titulo = excluded.titulo,
      descricao = excluded.descricao,
      schema = excluded.schema,
      ativo = excluded.ativo;

-- ====================================================================
-- 2026-10-27 · Diagnóstico por link
--
-- O diagnóstico ganha um link próprio, como a proposta: a clínica
-- preenche pelo celular sem criar conta. O token é a credencial — quem
-- tem o link lê e edita aquele diagnóstico, e só aquele. Por isso ele é
-- longo (duas UUIDs, 244 bits aleatórios) e a página pública busca
-- sempre pelo token exato, nunca pelo id.
--
-- A página roda no servidor com a service role. O gatilho de guarda
-- passa a confiar nela também: é o caminho que muda o status quando a
-- clínica envia pelo link, depois de conferir o token.
-- ====================================================================

alter table public.formularios_respostas
  add column if not exists token text
  default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');

update public.formularios_respostas
   set token = replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
 where token is null;

alter table public.formularios_respostas alter column token set not null;

create unique index if not exists formularios_respostas_token_idx
  on public.formularios_respostas (token);

create or replace function public.formularios_respostas_guarda()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();

  if public.is_super_admin()
     or coalesce(auth.role(), '') = 'service_role'
     or coalesce(current_setting('app.formulario_transicao', true), '') = 'on' then
    return new;
  end if;

  if new.status          is distinct from old.status
  or new.enviado_em      is distinct from old.enviado_em
  or new.revisado_em     is distinct from old.revisado_em
  or new.revisado_por    is distinct from old.revisado_por
  or new.organization_id is distinct from old.organization_id
  or new.modelo_id       is distinct from old.modelo_id
  or new.token           is distinct from old.token
  or new.created_at      is distinct from old.created_at then
    raise exception 'Somente a equipe Medi Marketing altera o status do diagnóstico';
  end if;

  return new;
end;
$$;

-- ====================================================================
-- 2026-10-27 (2) · Evolução do cliente a partir do diagnóstico
--
-- Os números da Etapa 05 do diagnóstico viram os primeiros meses de
-- `indicadores_mensais` (depois de a equipe revisar) e o marco zero do
-- acompanhamento. Daqui em diante, cada mês lançado é comparado com
-- esse ponto de partida e com a meta combinada.
-- ====================================================================

-- Indicadores que o diagnóstico traz e a tabela ainda não tinha.
-- Nulo = não informado (diferente de zero).
alter table public.indicadores_mensais
  add column if not exists pacientes_unicos      integer,
  add column if not exists novos_pacientes       integer,
  add column if not exists atendimentos          integer,
  add column if not exists ticket_medio          numeric(12,2),
  add column if not exists gasto_medio_paciente  numeric(12,2),
  -- {"Quiropraxia": 31000, "Pilates": 8000}
  add column if not exists receitas_servico      jsonb not null default '{}'::jsonb,
  -- De onde o número veio: lançado à mão, importado do diagnóstico,
  -- trazido por integração ou pelo check-in mensal
  add column if not exists origem                text not null default 'manual',
  -- Campos que a clínica informou como aproximados, e os que ela não mede
  add column if not exists campos_estimados      text[] not null default '{}',
  add column if not exists campos_sem_dado       text[] not null default '{}';

alter table public.indicadores_mensais drop constraint if exists indicadores_mensais_origem_check;
alter table public.indicadores_mensais add constraint indicadores_mensais_origem_check
  check (origem in ('manual', 'diagnostico', 'integracao', 'checkin'));

-- --------------------------------------------------------------------
-- Plano do cliente: marco zero, metas e o resumo do diagnóstico
--
-- Um por clínica. O marco zero não é uma cópia dos números: é o
-- intervalo de meses que serve de base, para que uma correção feita
-- depois em `indicadores_mensais` apareça também na comparação.
-- --------------------------------------------------------------------
create table if not exists public.planos_cliente (
  organization_id    uuid primary key references public.organizations(id) on delete cascade,
  resposta_id        uuid references public.formularios_respostas(id) on delete set null,
  base_inicio        date,
  base_fim           date,
  meta_faturamento   numeric(12,2),
  meta_leads         integer,
  meta_consultas     integer,
  prazo              date,
  criterio_financeiro text,
  prioridades        text,
  obstaculo          text,
  observacoes        text,
  importado_em       timestamptz,
  atualizado_em      timestamptz not null default now(),
  atualizado_por     uuid references public.profiles(id) on delete set null
);

alter table public.planos_cliente enable row level security;

-- Metas e faturamento: quem responde pela clínica e a equipe.
drop policy if exists "planos_cliente_select" on public.planos_cliente;
create policy "planos_cliente_select" on public.planos_cliente
  for select to authenticated
  using (
    public.is_super_admin()
    or (organization_id = public.minha_org() and public.responde_formularios())
  );

drop policy if exists "planos_cliente_admin" on public.planos_cliente;
create policy "planos_cliente_admin" on public.planos_cliente
  for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

comment on table public.planos_cliente is
  'Marco zero (meses de base), metas e resumo do diagnóstico de cada clínica.';

-- ====================================================================
-- 2026-10-27 (3) · Check-in mensal
--
-- Formulários periódicos: a mesma clínica responde o check-in todo mês,
-- então a resposta passa a ter um período de referência ("2026-10") e a
-- unicidade vira (clínica, modelo, período). O diagnóstico continua com
-- referência nula — uma resposta só por clínica, como antes.
--
-- `importado_em` registra quando a equipe levou as respostas ao painel.
-- ====================================================================

alter table public.formularios_respostas
  add column if not exists referencia   text check (referencia ~ '^\d{4}-\d{2}$'),
  add column if not exists importado_em timestamptz;

alter table public.formularios_respostas
  drop constraint if exists formularios_respostas_organization_id_modelo_id_key;

create unique index if not exists formularios_respostas_periodo_idx
  on public.formularios_respostas (organization_id, modelo_id, coalesce(referencia, ''));

-- A referência também é coluna de controle: a clínica não troca o mês
-- de um check-in pela API.
create or replace function public.formularios_respostas_guarda()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();

  if public.is_super_admin()
     or coalesce(auth.role(), '') = 'service_role'
     or coalesce(current_setting('app.formulario_transicao', true), '') = 'on' then
    return new;
  end if;

  if new.status          is distinct from old.status
  or new.enviado_em      is distinct from old.enviado_em
  or new.revisado_em     is distinct from old.revisado_em
  or new.revisado_por    is distinct from old.revisado_por
  or new.organization_id is distinct from old.organization_id
  or new.modelo_id       is distinct from old.modelo_id
  or new.token           is distinct from old.token
  or new.referencia      is distinct from old.referencia
  or new.importado_em    is distinct from old.importado_em
  or new.created_at      is distinct from old.created_at then
    raise exception 'Somente a equipe Medi Marketing altera o status do diagnóstico';
  end if;

  return new;
end;
$$;

-- Seed: check-in mensal, versão 1
-- Gerado por `npx tsx scripts/seed-formularios.mts checkin-mensal`.
insert into public.formularios_modelos (slug, versao, titulo, descricao, schema, ativo)
values (
  'checkin-mensal', 1, 'Check-in mensal',
  'Os números do mês para acompanhar a evolução',
  $schema${
  "intro": {
    "eyebrow": "Acompanhamento mensal",
    "titulo": "Como foi o último mês?",
    "destaque": "Leva poucos minutos.",
    "texto": "Os números do mês alimentam o painel da {clinica} e mostram a evolução desde o diagnóstico. Use o mesmo critério dos meses anteriores e marque o que for estimativa."
  },
  "aviso": "Indique “não medimos” quando não houver dados e “estimativa” para valores aproximados. Não inclua nomes ou dados pessoais de pacientes.",
  "agradecimento": "Obrigado! Os números vão para o painel depois da revisão da MediMarketing, e a evolução do mês aparece nos seus Indicadores.",
  "etapas": [
    {
      "id": "numeros",
      "rotulo": "Números",
      "titulo": "Números do mês",
      "instrucao": "Confira o mês no cabeçalho da tabela. Considere pacientes únicos separadamente do número de sessões.",
      "campos": [
        {
          "tipo": "tabela_mensal",
          "id": "indicadores",
          "rotulo": "Indicador",
          "meses": 1,
          "linhas": [
            {
              "id": "faturamento_total",
              "rotulo": "Faturamento total (R$)"
            },
            {
              "id": "investimento_anuncios",
              "rotulo": "Investimento em anúncios (R$)"
            },
            {
              "id": "novos_interessados",
              "rotulo": "Novos interessados que entraram em contato"
            },
            {
              "id": "consultas_agendadas",
              "rotulo": "Primeiras consultas agendadas"
            },
            {
              "id": "consultas_realizadas",
              "rotulo": "Primeiras consultas realizadas"
            },
            {
              "id": "pacientes_unicos",
              "rotulo": "Pacientes únicos atendidos"
            },
            {
              "id": "novos_pacientes",
              "rotulo": "Novos pacientes atendidos"
            },
            {
              "id": "total_atendimentos",
              "rotulo": "Total de atendimentos realizados"
            },
            {
              "id": "ticket_medio",
              "rotulo": "Ticket médio por atendimento (R$)"
            },
            {
              "id": "gasto_medio_paciente",
              "rotulo": "Gasto médio por paciente no mês (R$)"
            }
          ]
        },
        {
          "tipo": "tabela",
          "id": "receitas",
          "rotulo": "Serviço",
          "colunas": [
            {
              "id": "valor",
              "titulo": "Receita no mês (R$)"
            }
          ],
          "linhas": [],
          "permite_linhas": true,
          "rotulo_editavel": true,
          "nota": "Evite somar a mesma receita em mais de um serviço."
        },
        {
          "tipo": "texto",
          "id": "destaques",
          "pergunta": "O que mudou no mês?",
          "ajuda": "Algo fora do comum: equipe, agenda, preço, uma campanha, feriados. Ajuda a ler os números."
        }
      ]
    }
  ]
}$schema$::jsonb,
  true
)
on conflict (slug, versao) do update
  set titulo = excluded.titulo,
      descricao = excluded.descricao,
      schema = excluded.schema,
      ativo = excluded.ativo;


-- ====================================================================
-- 2026-10-27 (4) · Diagnóstico sem a pergunta de vagas e espera
--
-- Sai "Quais horários e profissionais têm vagas? Qual é a espera para
-- uma primeira consulta?" (id vagas_espera). Alterado na própria versão
-- 1 porque ninguém tinha respondido; com respostas, o certo seria
-- publicar a versão 2. A numeração das seguintes se ajusta sozinha.
-- ====================================================================

update public.formularios_modelos
   set schema = jsonb_set(
         schema,
         '{etapas,1,campos}',
         (select jsonb_agg(c order by i)
            from jsonb_array_elements(schema->'etapas'->1->'campos') with ordinality as t(c, i)
           where c->>'id' <> 'vagas_espera')
       )
 where slug = 'diagnostico-clinica' and versao = 1;

-- ====================================================================
-- 2026-10-28 · Comunicação: fila de envios, avisos por pessoa,
-- preferências de aviso e rotina a cada 10 minutos
--
-- Toda mensagem (WhatsApp, e-mail ou aviso no painel) passa a entrar
-- numa fila, `envios`, antes de sair. A fila registra o que saiu, para
-- quem, por onde e se deu certo; impede o mesmo aviso de sair duas
-- vezes (`chave`); e permite tentar de novo quando falha.
--
-- O Supabase chama a rotina a cada 10 minutos (pg_cron + pg_net), sem
-- depender do cron diário do plano gratuito da Vercel. O segredo da
-- chamada fica em `config_interna`, que só a service role lê.
-- ====================================================================

create table if not exists public.envios (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  -- consulta_nova, consulta_cancelada, lembrete_paciente, agenda_do_dia...
  evento          text not null,
  canal           text not null check (canal in ('email','whatsapp','painel')),
  -- paciente, alguém da equipe ou a caixa de e-mail da clínica
  publico         text not null check (publico in ('paciente','equipe','clinica')),
  usuario_id      uuid references public.profiles(id) on delete set null,
  destino         text,
  destino_nome    text,
  consulta_id     uuid references public.consultas(id) on delete set null,
  confirmacao_id  uuid references public.confirmacoes(id) on delete set null,
  assunto         text,
  conteudo        text,
  payload         jsonb not null default '{}'::jsonb,
  -- Impede o mesmo aviso duas vezes (ex.: agenda:<pessoa>:<dia>:whatsapp)
  chave           text unique,
  status          text not null default 'pendente'
                    check (status in ('pendente','enviando','enviado','falhou','ignorado','cancelado')),
  agendado_para   timestamptz not null default now(),
  tentativas      integer not null default 0,
  erro            text,
  referencia      text,
  enviado_em      timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists envios_fila_idx
  on public.envios (agendado_para) where status in ('pendente','enviando');
create index if not exists envios_org_idx
  on public.envios (organization_id, created_at desc);
create index if not exists envios_consulta_idx
  on public.envios (consulta_id) where consulta_id is not null;

alter table public.envios enable row level security;

-- Leitura para quem opera a clínica; escrita só pelo servidor
drop policy if exists "envios_select" on public.envios;
create policy "envios_select" on public.envios
  for select to authenticated
  using (
    public.is_super_admin()
    or (organization_id = public.minha_org() and public.is_operacional())
  );

-- Lembrete já colocado na fila: a rotina não enfileira de novo
alter table public.confirmacoes
  add column if not exists enfileirado_em timestamptz;

-- --------------------------------------------------------------------
-- Avisos no painel endereçados a uma pessoa
-- --------------------------------------------------------------------
alter table public.notificacoes
  add column if not exists usuario_id uuid references public.profiles(id) on delete cascade;

create index if not exists idx_notificacoes_usuario
  on public.notificacoes (usuario_id, created_at desc) where usuario_id is not null;

alter table public.notificacoes drop constraint if exists notificacoes_tipo_check;
alter table public.notificacoes add constraint notificacoes_tipo_check
  check (tipo in (
    'reagendamento','confirmacao','cancelamento','lembrete_atrasado',
    'lead_novo','mensagem_nova','cadastro_pendente','sistema',
    'consulta_nova','consulta_remarcada','agenda','envio_falhou'
  ));

-- Com usuario_id, só aquela pessoa vê. Sem, vale o papel (como antes).
drop policy if exists "notificacoes_select" on public.notificacoes;
create policy "notificacoes_select" on public.notificacoes
  for select to authenticated
  using (
    usuario_id = auth.uid()
    or (
      usuario_id is null
      and (
        public.is_super_admin()
        or (organization_id = public.minha_org() and public.meu_papel() = any(papeis))
      )
    )
  );

-- Contador atualiza sozinho: o painel escuta as notificações novas
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notificacoes'
     ) then
    alter publication supabase_realtime add table public.notificacoes;
  end if;
end $$;

-- --------------------------------------------------------------------
-- Preferências de aviso de cada pessoa da equipe
-- --------------------------------------------------------------------
create table if not exists public.preferencias_aviso (
  usuario_id      uuid primary key references public.profiles(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  -- { "consulta_nova": ["painel","whatsapp"], ... } — evento ausente = padrão
  canais          jsonb not null default '{}'::jsonb,
  -- Hora (Brasília) do resumo da agenda do dia
  resumo_hora     smallint not null default 7 check (resumo_hora between 0 and 23),
  updated_at      timestamptz not null default now()
);

alter table public.preferencias_aviso enable row level security;

-- A própria pessoa, o gestor da clínica dela ou a equipe Medi Marketing
drop policy if exists "preferencias_aviso_select" on public.preferencias_aviso;
create policy "preferencias_aviso_select" on public.preferencias_aviso
  for select to authenticated
  using (
    usuario_id = auth.uid()
    or public.is_super_admin()
    or (organization_id = public.minha_org() and public.is_gestor())
  );

drop policy if exists "preferencias_aviso_insert" on public.preferencias_aviso;
create policy "preferencias_aviso_insert" on public.preferencias_aviso
  for insert to authenticated
  with check (
    public.is_super_admin()
    or (organization_id = public.minha_org()
        and (usuario_id = auth.uid() or public.is_gestor()))
  );

drop policy if exists "preferencias_aviso_update" on public.preferencias_aviso;
create policy "preferencias_aviso_update" on public.preferencias_aviso
  for update to authenticated
  using (
    public.is_super_admin()
    or (organization_id = public.minha_org()
        and (usuario_id = auth.uid() or public.is_gestor()))
  )
  with check (
    public.is_super_admin()
    or (organization_id = public.minha_org()
        and (usuario_id = auth.uid() or public.is_gestor()))
  );

-- --------------------------------------------------------------------
-- Rotina a cada 10 minutos
-- --------------------------------------------------------------------
create table if not exists public.config_interna (
  chave text primary key,
  valor text not null
);
-- RLS ligada e nenhuma política: só a service role enxerga
alter table public.config_interna enable row level security;

insert into public.config_interna (chave, valor)
values ('cron_segredo', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))
on conflict (chave) do nothing;

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule(jobid) from cron.job where jobname = 'medi-comunicacao';

select cron.schedule(
  'medi-comunicacao',
  '*/10 * * * *',
  $job$
    select net.http_get(
      url := 'https://medimarketing.com.br/api/cron/comunicacao',
      headers := jsonb_build_object(
        'Authorization',
        'Bearer ' || (select valor from public.config_interna where chave = 'cron_segredo')
      ),
      timeout_milliseconds := 55000
    );
  $job$
);


-- ---------------------------------------------------------------------
-- 2026-10-28 (2) — Banner do painel da clínica
--
-- Imagem que aparece no topo da visão geral da clínica, com link
-- opcional. Fica no bucket `logos` (já público, pasta da clínica), então
-- as políticas de storage do bloco da logo já cobrem o upload.
-- ---------------------------------------------------------------------
alter table public.organizations add column if not exists banner_url text;
alter table public.organizations add column if not exists banner_link text;


-- ---------------------------------------------------------------------
-- 2026-10-28 (3) — Perfil completo e foto
--
-- Campos novos do Meu perfil. A foto vai para o bucket público
-- `avatares`, numa pasta com o id da pessoa; o upload passa pelo
-- servidor, então não precisa de política de escrita.
-- ---------------------------------------------------------------------
alter table public.profiles add column if not exists tratamento text;
alter table public.profiles add column if not exists rqe text;
alter table public.profiles add column if not exists bio text;
alter table public.profiles add column if not exists instagram text;

insert into storage.buckets (id, name, public)
values ('avatares', 'avatares', true)
on conflict (id) do update set public = true;


-- ---------------------------------------------------------------------
-- 2026-10-28 (4) — Financeiro completo: clínica e agência
--
-- Clínica: receita ligada à agenda, pagamentos com taxa, despesas e
-- contas a pagar, tabela de preços, convênios e glosas, repasse aos
-- médicos e configuração financeira.
-- Agência: contratos, histórico de mudanças (base do MRR), faturas e
-- custos da operação.
-- ---------------------------------------------------------------------

-- ============================ CLÍNICA ================================

-- Receita: o que faltava para convênio, taxa, repasse e origem
alter table public.lancamentos add column if not exists medico_id uuid references public.profiles(id) on delete set null;
alter table public.lancamentos add column if not exists convenio text;
alter table public.lancamentos add column if not exists desconto numeric(12,2) not null default 0;
alter table public.lancamentos add column if not exists taxa numeric(12,2) not null default 0;
alter table public.lancamentos add column if not exists parcelas smallint not null default 1;
alter table public.lancamentos add column if not exists glosa numeric(12,2) not null default 0;
alter table public.lancamentos add column if not exists glosa_motivo text;
alter table public.lancamentos add column if not exists previsao_recebimento date;
alter table public.lancamentos add column if not exists origem text not null default 'manual';
alter table public.lancamentos add column if not exists atualizado_em timestamptz not null default now();
alter table public.lancamentos drop constraint if exists lancamentos_origem_check;
alter table public.lancamentos add constraint lancamentos_origem_check check (origem in ('manual', 'agenda'));

-- Uma receita por consulta: a agenda atualiza sempre a mesma linha
create unique index if not exists lancamentos_consulta_unica
  on public.lancamentos (consulta_id) where consulta_id is not null;
create index if not exists idx_lancamentos_medico on public.lancamentos (medico_id, data_competencia);

-- Tabela de preços: particular (convenio nulo) ou por convênio
create table if not exists public.tabela_precos (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  procedimento    text not null,
  categoria       text,
  convenio        text,
  valor           numeric(12,2) not null default 0,
  custo           numeric(12,2) not null default 0,
  duracao_min     smallint,
  ativo           boolean not null default true,
  created_at      timestamptz not null default now()
);
create index if not exists idx_precos_org on public.tabela_precos (organization_id, procedimento);

-- Despesas e contas a pagar
create table if not exists public.despesas (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  descricao       text not null,
  categoria       text not null default 'outros',
  fornecedor      text,
  valor           numeric(12,2) not null,
  vencimento      date not null,
  pago_em         date,
  status          text not null default 'aberta' check (status in ('aberta', 'paga', 'cancelada')),
  fixa            boolean not null default false,
  recorrente      boolean not null default false,
  grupo           uuid,
  parcela         smallint,
  parcelas        smallint,
  forma_pagamento text,
  comprovante     text,
  observacao      text,
  created_at      timestamptz not null default now()
);
create index if not exists idx_despesas_org_venc on public.despesas (organization_id, vencimento);

-- Regra de repasse por profissional
create table if not exists public.regras_repasse (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  medico_id       uuid not null references public.profiles(id) on delete cascade,
  tipo            text not null default 'percentual' check (tipo in ('percentual', 'fixo')),
  valor           numeric(12,2) not null default 0,
  base            text not null default 'liquido' check (base in ('bruto', 'liquido')),
  so_recebido     boolean not null default true,
  unique (organization_id, medico_id)
);

-- Fechamento do repasse de um mês
create table if not exists public.repasses (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  medico_id       uuid not null references public.profiles(id) on delete cascade,
  competencia     date not null,
  atendimentos    integer not null default 0,
  base            numeric(12,2) not null default 0,
  valor           numeric(12,2) not null default 0,
  status          text not null default 'fechado' check (status in ('fechado', 'pago')),
  pago_em         date,
  fechado_por     uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  unique (organization_id, medico_id, competencia)
);

-- Configuração financeira da clínica
create table if not exists public.config_financeira (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  taxas           jsonb not null default '{"pix":0,"dinheiro":0,"cartao_debito":1.6,"cartao_credito":3.5,"boleto":2,"convenio":0}',
  imposto         numeric(5,2) not null default 6,
  reserva_glosa   numeric(5,2) not null default 7,
  saldo_inicial   numeric(12,2) not null default 0,
  meta_lucro      numeric(12,2),
  atualizado_em   timestamptz not null default now()
);

alter table public.tabela_precos     enable row level security;
alter table public.despesas          enable row level security;
alter table public.regras_repasse    enable row level security;
alter table public.repasses          enable row level security;
alter table public.config_financeira enable row level security;

-- Preços: a clínica toda lê (a agenda usa); gestor escreve
drop policy if exists "precos_select" on public.tabela_precos;
create policy "precos_select" on public.tabela_precos for select to authenticated
  using (organization_id = public.minha_org() or public.is_super_admin());
drop policy if exists "precos_write" on public.tabela_precos;
create policy "precos_write" on public.tabela_precos for all to authenticated
  using ((organization_id = public.minha_org() and public.is_gestor()) or public.is_super_admin())
  with check ((organization_id = public.minha_org() and public.is_gestor()) or public.is_super_admin());

-- Despesas, regras e configuração: só gestor (a atendente não vê o custo da clínica)
drop policy if exists "despesas_all" on public.despesas;
create policy "despesas_all" on public.despesas for all to authenticated
  using ((organization_id = public.minha_org() and public.is_gestor()) or public.is_super_admin())
  with check ((organization_id = public.minha_org() and public.is_gestor()) or public.is_super_admin());

drop policy if exists "regras_repasse_all" on public.regras_repasse;
create policy "regras_repasse_all" on public.regras_repasse for all to authenticated
  using ((organization_id = public.minha_org() and public.is_gestor()) or public.is_super_admin())
  with check ((organization_id = public.minha_org() and public.is_gestor()) or public.is_super_admin());

drop policy if exists "config_financeira_all" on public.config_financeira;
create policy "config_financeira_all" on public.config_financeira for all to authenticated
  using ((organization_id = public.minha_org() and public.is_gestor()) or public.is_super_admin())
  with check ((organization_id = public.minha_org() and public.is_gestor()) or public.is_super_admin());

-- Repasses: o médico lê só o dele; gestor lê e escreve os da clínica
drop policy if exists "repasses_select" on public.repasses;
create policy "repasses_select" on public.repasses for select to authenticated
  using (
    medico_id = auth.uid()
    or (organization_id = public.minha_org() and public.is_gestor())
    or public.is_super_admin()
  );
drop policy if exists "repasses_write" on public.repasses;
create policy "repasses_write" on public.repasses for all to authenticated
  using ((organization_id = public.minha_org() and public.is_gestor()) or public.is_super_admin())
  with check ((organization_id = public.minha_org() and public.is_gestor()) or public.is_super_admin());

-- ============================ AGÊNCIA ================================

create table if not exists public.contratos (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  plano            text not null default 'essencial',
  mensalidade      numeric(12,2) not null default 0,
  implantacao      numeric(12,2) not null default 0,
  inicio           date not null default current_date,
  fidelidade_meses smallint not null default 12,
  dia_vencimento   smallint not null default 10 check (dia_vencimento between 1 and 28),
  reajuste         text not null default 'IPCA',
  status           text not null default 'ativo' check (status in ('ativo', 'pausado', 'cancelado')),
  cancelado_em     date,
  motivo_saida     text,
  responsavel      text,
  observacao       text,
  created_at       timestamptz not null default now(),
  atualizado_em    timestamptz not null default now()
);
create unique index if not exists contratos_um_ativo
  on public.contratos (organization_id) where status <> 'cancelado';

-- Cada mudança de valor fica registrada: é daqui que sai a ponte do MRR
create table if not exists public.contrato_eventos (
  id           uuid primary key default gen_random_uuid(),
  contrato_id  uuid not null references public.contratos(id) on delete cascade,
  tipo         text not null check (tipo in ('novo', 'upgrade', 'downgrade', 'pausa', 'reativacao', 'cancelamento')),
  data         date not null default current_date,
  mrr_antes    numeric(12,2) not null default 0,
  mrr_depois   numeric(12,2) not null default 0,
  observacao   text,
  created_at   timestamptz not null default now()
);
create index if not exists idx_contrato_eventos on public.contrato_eventos (contrato_id, data);

create table if not exists public.faturas (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contrato_id     uuid references public.contratos(id) on delete set null,
  competencia     date not null,
  descricao       text not null default 'Mensalidade',
  valor           numeric(12,2) not null,
  vencimento      date not null,
  status          text not null default 'aberta' check (status in ('aberta', 'paga', 'cancelada')),
  pago_em         date,
  forma_pagamento text,
  tipo            text not null default 'mensalidade' check (tipo in ('mensalidade', 'implantacao', 'avulsa')),
  created_at      timestamptz not null default now()
);
create unique index if not exists faturas_mensalidade_unica
  on public.faturas (contrato_id, competencia) where tipo = 'mensalidade';
create index if not exists idx_faturas_venc on public.faturas (vencimento);

create table if not exists public.custos_agencia (
  id              uuid primary key default gen_random_uuid(),
  descricao       text not null,
  categoria       text not null default 'ferramentas',
  valor           numeric(12,2) not null,
  competencia     date not null,
  recorrente      boolean not null default true,
  organization_id uuid references public.organizations(id) on delete set null,
  created_at      timestamptz not null default now()
);
create index if not exists idx_custos_agencia on public.custos_agencia (competencia);

alter table public.contratos        enable row level security;
alter table public.contrato_eventos enable row level security;
alter table public.faturas          enable row level security;
alter table public.custos_agencia   enable row level security;

drop policy if exists "contratos_admin" on public.contratos;
create policy "contratos_admin" on public.contratos for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());
drop policy if exists "contrato_eventos_admin" on public.contrato_eventos;
create policy "contrato_eventos_admin" on public.contrato_eventos for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());
drop policy if exists "custos_agencia_admin" on public.custos_agencia;
create policy "custos_agencia_admin" on public.custos_agencia for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

-- A clínica vê as próprias faturas (gestor); só a agência escreve
drop policy if exists "faturas_select" on public.faturas;
create policy "faturas_select" on public.faturas for select to authenticated
  using (public.is_super_admin() or (organization_id = public.minha_org() and public.is_gestor()));
drop policy if exists "faturas_admin" on public.faturas;
create policy "faturas_admin" on public.faturas for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());


-- ---------------------------------------------------------------------
-- 2026-10-29 — Histórico de caixa (fechamentos importados)
--
-- Para clínicas que chegam com o financeiro de outro sistema ou
-- planilha: o fechamento de cada mês (entradas, saídas e saldo) e a
-- composição do período (receitas por fonte, saídas por categoria).
-- Fica separado dos lançamentos do dia a dia de propósito: regime de
-- caixa inclui distribuição de lucros, empréstimos e investimentos,
-- que não são despesa da clínica e distorceriam o resultado (DRE).
-- Os dados de cada clínica entram por fora deste arquivo.
-- ---------------------------------------------------------------------
create table if not exists public.fechamentos_financeiros (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references public.organizations(id) on delete cascade,
  mes                 date not null,
  entradas            numeric(14,2),
  saidas              numeric(14,2),
  saldo_final         numeric(14,2),
  receita_operacional numeric(14,2),
  observacao          text,
  origem              text not null default 'importado',
  created_at          timestamptz not null default now(),
  unique (organization_id, mes)
);

create table if not exists public.composicoes_financeiras (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  inicio          date not null,
  fim             date not null,
  tipo            text not null check (tipo in ('receita', 'saida')),
  item            text not null,
  valor           numeric(14,2) not null,
  percentual      numeric(6,2),
  natureza        text not null default 'operacional'
                    check (natureza in ('convenio', 'particular', 'outras', 'operacional', 'socios', 'financeiro', 'investimento')),
  estimado        boolean not null default false,
  observacao      text,
  ordem           smallint not null default 0,
  unique (organization_id, inicio, fim, tipo, item)
);

alter table public.fechamentos_financeiros enable row level security;
alter table public.composicoes_financeiras enable row level security;

drop policy if exists "fechamentos_all" on public.fechamentos_financeiros;
create policy "fechamentos_all" on public.fechamentos_financeiros for all to authenticated
  using ((organization_id = public.minha_org() and public.is_gestor()) or public.is_super_admin())
  with check ((organization_id = public.minha_org() and public.is_gestor()) or public.is_super_admin());

drop policy if exists "composicoes_all" on public.composicoes_financeiras;
create policy "composicoes_all" on public.composicoes_financeiras for all to authenticated
  using ((organization_id = public.minha_org() and public.is_gestor()) or public.is_super_admin())
  with check ((organization_id = public.minha_org() and public.is_gestor()) or public.is_super_admin());

-- ============================================================
-- 2026-10-29 — Painel do dono: status "faltou"
-- A consulta em que o paciente não apareceu deixa de contar como
-- pendente/confirmada e sai do faturamento (como o cancelamento).
-- ============================================================
alter type public.status_consulta add value if not exists 'faltou';
