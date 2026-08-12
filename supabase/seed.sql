-- =====================================================================
-- Medi Marketing — CARGA INICIAL
--
-- Rode DEPOIS de supabase/schema.sql, no SQL Editor do Supabase.
-- É IDEMPOTENTE: rodar de novo não duplica nada.
--
-- O que este arquivo faz:
--   1. cria a clínica (organization)
--   2. publica as 6 trilhas da Academy com as 33 aulas
--   3. cria as 5 réguas de retenção padrão
--   4. registra as integrações como "não conectadas"
--   5. instala a função vincular_a_clinica() para ligar seu usuário
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1) A CLÍNICA — ajuste os valores desta seção antes de rodar
-- ---------------------------------------------------------------------
insert into public.organizations
  (nome, slug, especialidade, plano, cidade, telefone, email, responsavel)
values (
  'Minha Clínica',              -- nome que aparece no painel
  'minha-clinica',              -- slug: só minúsculas, números e hífen
  'Dermatologia',               -- especialidade principal
  'performance',                -- essencial | performance | full
  'São Paulo, SP',
  '(11) 0000-0000',
  'contato@minhaclinica.com.br',
  'Dr(a). Responsável'
)
on conflict (slug) do nothing;


-- ---------------------------------------------------------------------
-- 2) ACADEMY — conteúdo global, visível para todas as clínicas
-- ---------------------------------------------------------------------
insert into public.courses (slug, titulo, resumo, descricao, nivel, papeis, ordem, publicado)
values
  ('secretaria-vendedora',
   'Secretária Vendedora',
   'Atendimento que acolhe e conduz o paciente até o agendamento.',
   'A trilha mais importante da operação. Sua secretária sai daqui sabendo conduzir a conversa do primeiro oi até o horário marcado, sem soar comercial demais nem entregar preço e sumir.',
   'essencial', '{gestor,secretaria}', 1, true),

  ('contratacao-e-gestao-da-secretaria',
   'Contratação e Gestão da Secretária',
   'Como escolher, treinar e acompanhar quem atende sua clínica.',
   'Para o gestor que cansou de trocar de secretária a cada seis meses. Processo de seleção, onboarding, metas e rotina de acompanhamento.',
   'intermediario', '{gestor}', 2, true),

  ('reabordagem-e-reativacao',
   'Reabordagem e Reativação',
   'O que dizer para quem não fechou, faltou ou sumiu.',
   'Dinheiro que já está na sua base. Scripts e cadências para recuperar orçamento parado, no-show e paciente antigo.',
   'essencial', '{gestor,secretaria}', 3, true),

  ('processo-comercial-da-clinica',
   'Processo Comercial da Clínica',
   'Funil, metas e rotina de acompanhamento do time.',
   'Como estruturar o comercial da clínica com etapas claras, responsáveis definidos e números acompanhados toda semana.',
   'intermediario', '{gestor,secretaria}', 4, true),

  ('marketing-para-a-clinica',
   'Marketing para a Clínica',
   'Como ler os números das campanhas e cobrar resultado.',
   'Você não precisa saber configurar anúncio, precisa saber ler o resultado. Esta trilha traduz as métricas que importam.',
   'essencial', '{gestor,medico}', 5, true),

  ('onboarding-da-plataforma',
   'Onboarding da Plataforma',
   'Primeiros passos no painel, para cada papel da equipe.',
   'Comece por aqui. Em menos de uma hora sua equipe sabe operar agenda, CRM e atendimento dentro da plataforma.',
   'essencial', '{gestor,secretaria,medico}', 6, true)
on conflict (slug) do nothing;


-- As aulas entram sem vídeo: suba os links depois em Conteúdo Academy.
insert into public.lessons (course_id, slug, titulo, descricao, duracao_min, ordem, publicado)
select c.id, v.slug, v.titulo, v.descricao, v.duracao, v.ordem, true
from (values
  -- Secretária Vendedora
  ('secretaria-vendedora','aula-1','Por que informar preço não é atender','A diferença entre tirar pedido e conduzir uma decisão de saúde.',9,1),
  ('secretaria-vendedora','aula-2','Os 4 momentos de uma conversa que converte','Acolher, entender, apresentar e combinar o próximo passo.',14,2),
  ('secretaria-vendedora','aula-3','Como perguntar sem parecer interrogatório','Perguntas que revelam a real necessidade do paciente.',11,3),
  ('secretaria-vendedora','aula-4','Apresentando valor antes do preço','O que dizer para o preço fazer sentido quando ele chegar.',13,4),
  ('secretaria-vendedora','aula-5','Contornando o "vou pensar"','O que está por trás da objeção e como seguir sem pressionar.',16,5),
  ('secretaria-vendedora','aula-6','Fechando o agendamento na conversa','Técnicas de fechamento que respeitam o tempo do paciente.',12,6),
  ('secretaria-vendedora','aula-7','O follow-up que não incomoda','Cadência, tom e limite para retomar quem não respondeu.',10,7),
  ('secretaria-vendedora','aula-8','Erros que fazem o paciente sumir','Os oito deslizes mais comuns no WhatsApp da clínica.',15,8),

  -- Contratação e Gestão da Secretária
  ('contratacao-e-gestao-da-secretaria','aula-1','O perfil certo para a sua clínica','Competências que importam e as que não fazem diferença.',12,1),
  ('contratacao-e-gestao-da-secretaria','aula-2','Anúncio de vaga e triagem','Como escrever a vaga e filtrar currículos sem perder tempo.',10,2),
  ('contratacao-e-gestao-da-secretaria','aula-3','Entrevista com teste prático','O roteiro de entrevista e o teste de atendimento simulado.',18,3),
  ('contratacao-e-gestao-da-secretaria','aula-4','Primeiros 30 dias de onboarding','O que treinar em cada semana para reduzir o tempo de rampa.',14,4),
  ('contratacao-e-gestao-da-secretaria','aula-5','Metas e comissão sem virar bagunça','Como remunerar por resultado numa clínica de saúde.',16,5),
  ('contratacao-e-gestao-da-secretaria','aula-6','Reunião semanal de acompanhamento','A pauta de 20 minutos que mantém o time no ritmo.',11,6),

  -- Reabordagem e Reativação
  ('reabordagem-e-reativacao','aula-1','Por que a base parada vale mais que lead novo','A conta que mostra o custo de ignorar quem já te conhece.',8,1),
  ('reabordagem-e-reativacao','aula-2','Régua de reabordagem em 3 toques','Quando falar, o que falar e quando parar.',13,2),
  ('reabordagem-e-reativacao','aula-3','Resgatando o no-show no mesmo dia','A janela de ouro das primeiras duas horas.',9,3),
  ('reabordagem-e-reativacao','aula-4','Campanha de reativação de base','Como segmentar e abordar quem não volta há meses.',17,4),
  ('reabordagem-e-reativacao','aula-5','Recall de retorno e revisão','Transformando protocolo clínico em agenda cheia.',12,5),

  -- Processo Comercial da Clínica
  ('processo-comercial-da-clinica','aula-1','Desenhando o funil da sua clínica','Da origem do lead ao paciente em tratamento.',15,1),
  ('processo-comercial-da-clinica','aula-2','Quem faz o quê em cada etapa','Divisão de responsabilidades sem sobreposição.',11,2),
  ('processo-comercial-da-clinica','aula-3','Definindo metas que fazem sentido','Meta de agenda, de conversão e de faturamento.',14,3),
  ('processo-comercial-da-clinica','aula-4','A rotina semanal do comercial','O que revisar toda segunda para não perder o mês.',10,4),
  ('processo-comercial-da-clinica','aula-5','Usando o CRM no dia a dia','Higiene de funil: o que atualizar e quando.',13,5),

  -- Marketing para a Clínica
  ('marketing-para-a-clinica','aula-1','As 6 métricas que você precisa entender','Investimento, lead, CPL, agendamento, comparecimento e ROI.',16,1),
  ('marketing-para-a-clinica','aula-2','Quanto deve custar um paciente novo','Como chegar no seu número, por especialidade.',12,2),
  ('marketing-para-a-clinica','aula-3','Lendo o relatório sem se enganar','As armadilhas de métrica de vaidade.',14,3),
  ('marketing-para-a-clinica','aula-4','Publicidade médica dentro do CFM','O que pode, o que não pode e onde a maioria erra.',18,4),

  -- Onboarding da Plataforma
  ('onboarding-da-plataforma','aula-1','Conhecendo o painel','O que cada módulo faz e quem acessa o quê.',7,1),
  ('onboarding-da-plataforma','aula-2','Operando a agenda','Criar consulta, confirmar, remarcar e bloquear horário.',12,2),
  ('onboarding-da-plataforma','aula-3','Configurando sua disponibilidade','Horários semanais, bloqueios e férias.',8,3),
  ('onboarding-da-plataforma','aula-4','Acompanhando seus indicadores','Onde ver os números e como interpretá-los.',9,4),
  ('onboarding-da-plataforma','aula-5','Usando a Academy','Progresso, certificado e como tirar dúvidas nas aulas.',6,5)
) as v(curso, slug, titulo, descricao, duracao, ordem)
join public.courses c on c.slug = v.curso
on conflict (course_id, slug) do nothing;


-- ---------------------------------------------------------------------
-- 3) RETENÇÃO — réguas padrão, criadas DESLIGADAS
--    Revise os textos e ligue cada uma pela tela de Retenção.
-- ---------------------------------------------------------------------
insert into public.reguas (organization_id, tipo, nome, descricao, ativa)
select o.id, v.tipo, v.nome, v.descricao, false
from public.organizations o
cross join (values
  ('reabordagem', 'Reabordagem de orçamento parado',
   'Para quem recebeu o valor e não respondeu. Três toques em uma semana, cada um trazendo informação nova.'),
  ('no_show', 'Resgate de falta no mesmo dia',
   'A janela de ouro são as duas primeiras horas depois do horário perdido.'),
  ('reativacao', 'Reativação da base parada',
   'Pacientes sem retorno há mais de 8 meses. Roda uma vez por trimestre.'),
  ('recall', 'Recall de retorno e revisão',
   'Dispara conforme o protocolo clínico de cada tratamento.'),
  ('pos_consulta', 'Pós-consulta e pedido de avaliação',
   'Cuidado no dia seguinte e convite para avaliar a clínica no Google.')
) as v(tipo, nome, descricao)
where o.slug = 'minha-clinica'
  and not exists (
    select 1 from public.reguas r
    where r.organization_id = o.id and r.nome = v.nome
  );


insert into public.regua_passos (regua_id, ordem, atraso_horas, canal, mensagem)
select r.id, v.ordem, v.atraso, v.canal, v.mensagem
from public.reguas r
join public.organizations o on o.id = r.organization_id
join (values
  ('Reabordagem de orçamento parado', 1, 48,  'whatsapp', 'Oi, {paciente}! Passando para saber se ficou alguma dúvida sobre o que conversamos. Se quiser, posso explicar melhor qualquer parte do tratamento, sem compromisso.'),
  ('Reabordagem de orçamento parado', 2, 96,  'whatsapp', '{paciente}, lembrei de você hoje. Separei um caso bem parecido com o seu, com antes e depois. Quer que eu mande para você ver o resultado?'),
  ('Reabordagem de orçamento parado', 3, 168, 'whatsapp', 'Oi, {paciente}! Vou parar por aqui para não incomodar. Deixo a porta aberta: quando fizer sentido para você, me chama que retomo de onde paramos. Um abraço da equipe {clinica}.'),

  ('Resgate de falta no mesmo dia', 1, 2,  'whatsapp', 'Oi, {paciente}! Você tinha horário com a gente hoje e acabou não conseguindo vir. Está tudo bem? Se quiser, consigo te encaixar ainda esta semana.'),
  ('Resgate de falta no mesmo dia', 2, 24, 'telefone', 'Ligação de recuperação: entender o que aconteceu e já oferecer dois horários concretos, em vez de perguntar quando ele pode.'),
  ('Resgate de falta no mesmo dia', 3, 72, 'whatsapp', '{paciente}, abriram dois horários novos na agenda. Quer que eu reserve um para você? Só me dizer qual período prefere.'),

  ('Reativação da base parada', 1, 0,   'whatsapp', 'Oi, {paciente}! Faz um tempo que você não aparece por aqui e lembrei de você. Como está indo o seu tratamento?'),
  ('Reativação da base parada', 2, 120, 'whatsapp', '{paciente}, este mês a avaliação de retorno é por nossa conta para quem já é paciente da casa. Se quiser aproveitar, me diga qual semana fica melhor.'),

  ('Recall de retorno e revisão', 1, 168, 'whatsapp', 'Oi, {paciente}! Já faz uma semana do seu procedimento. Como você está se sentindo? Qualquer coisa fora do esperado, me avise.'),
  ('Recall de retorno e revisão', 2, 720, 'whatsapp', '{paciente}, chegou o momento da sua revisão. É rapidinha e serve para conferir se está tudo evoluindo bem. Qual dia da semana costuma ser melhor para você?'),

  ('Pós-consulta e pedido de avaliação', 1, 24,  'whatsapp', 'Oi, {paciente}! Tudo certo depois da consulta de ontem? Se surgir qualquer dúvida sobre os cuidados, é só me chamar.'),
  ('Pós-consulta e pedido de avaliação', 2, 120, 'whatsapp', '{paciente}, se o atendimento foi bom para você, uma avaliação no Google ajuda muito outras pessoas a encontrarem a gente. Se preferir, também adoramos ouvir sua opinião por aqui mesmo.')
) as v(regua, ordem, atraso, canal, mensagem) on v.regua = r.nome
where o.slug = 'minha-clinica'
  and not exists (
    select 1 from public.regua_passos p
    where p.regua_id = r.id and p.ordem = v.ordem
  );


-- ---------------------------------------------------------------------
-- 4) INTEGRAÇÕES — aparecem como "não conectadas" em Configurações
-- ---------------------------------------------------------------------
insert into public.integracoes (organization_id, provedor, conectado)
select o.id, v.provedor, false
from public.organizations o
cross join (values ('meta_ads'), ('google_ads'), ('ga4'), ('whatsapp'), ('instagram'))
  as v(provedor)
where o.slug = 'minha-clinica'
on conflict (organization_id, provedor) do nothing;


-- ---------------------------------------------------------------------
-- 5) VINCULAR SEU USUÁRIO
--
-- O cadastro no Supabase cria o profile automaticamente, mas sem clínica
-- e com papel 'medico'. Esta função corrige isso.
--
-- Depois de criar seu usuário (Authentication > Users > Add user, ou pela
-- tela de login do app), rode:
--
--     select public.vincular_a_clinica('voce@email.com', 'gestor');
--
-- Papéis: 'gestor' | 'secretaria' | 'medico' | 'super_admin'
-- Use 'super_admin' na conta da equipe Medi Marketing: ela enxerga todas
-- as clínicas e administra o conteúdo da Academy.
-- ---------------------------------------------------------------------
create or replace function public.vincular_a_clinica(
  p_email text,
  p_papel text default 'gestor',
  p_slug  text default 'minha-clinica'
)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid;
  v_org_id  uuid;
begin
  if p_papel not in ('super_admin', 'gestor', 'secretaria', 'medico') then
    return 'Papel inválido: ' || p_papel;
  end if;

  select id into v_user_id from auth.users where lower(email) = lower(p_email);
  if v_user_id is null then
    return 'Usuário não encontrado: ' || p_email || '. Crie-o em Authentication > Users primeiro.';
  end if;

  -- Super admin é da equipe Medi Marketing: não pertence a clínica nenhuma
  if p_papel <> 'super_admin' then
    select id into v_org_id from public.organizations where slug = p_slug;
    if v_org_id is null then
      return 'Clínica não encontrada: ' || p_slug;
    end if;
  end if;

  -- O trigger de cadastro já deve ter criado o profile; garantimos aqui
  insert into public.profiles (id, nome, role, organization_id)
  values (v_user_id, split_part(p_email, '@', 1), p_papel, v_org_id)
  on conflict (id) do update
    set role = excluded.role,
        organization_id = excluded.organization_id,
        ativo = true;

  return 'OK: ' || p_email || ' agora é ' || p_papel ||
         case when v_org_id is null then ' (equipe Medi Marketing)'
              else ' em ' || p_slug end;
end;
$$;

-- IMPORTANTE: a função é security definer e concede papéis, inclusive
-- super_admin. Sem este revoke, qualquer usuário logado poderia chamá-la
-- via RPC e se promover. Só o SQL Editor (postgres) deve executá-la.
revoke all on function public.vincular_a_clinica(text, text, text) from public;
revoke all on function public.vincular_a_clinica(text, text, text) from anon;
revoke all on function public.vincular_a_clinica(text, text, text) from authenticated;
