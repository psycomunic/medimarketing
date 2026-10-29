/**
 * Tipos do banco (espelham as tabelas do Supabase — ver supabase/schema.sql).
 * Para gerar automaticamente, use: `supabase gen types typescript`.
 */

export type StatusConsulta =
  | "pendente"
  | "confirmada"
  | "cancelada"
  | "realizada"
  | "faltou";

export type TipoConsulta = "primeira" | "retorno" | "teleconsulta";

/**
 * Papéis da plataforma (Parte B do briefing):
 * - super_admin: equipe Medi Marketing, enxerga todas as clínicas
 * - gestor:      dono/gestor da clínica, acesso total ao próprio tenant
 * - secretaria:  agenda, CRM, atendimento e retenção
 * - medico:      a própria agenda, os próprios indicadores e a Academy
 */
export type Role = "super_admin" | "gestor" | "secretaria" | "medico";

export type PlanoOrganizacao = "essencial" | "performance" | "full";

export type EtapaFunil =
  | "novo"
  | "em_contato"
  | "agendado"
  | "compareceu"
  | "em_tratamento"
  | "perdido";

export type StatusLead = "aberto" | "ganho" | "perdido";

// IMPORTANTE: usar `type` (não `interface`). Interfaces não são consideradas
// atribuíveis a `Record<string, unknown>` pelo TypeScript, o que faria o
// schema falhar na checagem GenericSchema do supabase-js e os tipos de
// insert/update colapsarem para `never`.

/** Clínica/consultório — o tenant da plataforma. */
export type Organization = {
  id: string;
  nome: string;
  slug: string | null;
  especialidade: string | null;
  plano: PlanoOrganizacao;
  cidade: string | null;
  telefone: string | null;
  email: string | null;
  ativo: boolean;
  /* Dados preenchidos em Configurações */
  cnpj: string | null;
  endereco: string | null;
  responsavel: string | null;
  /** Logo da clínica, no bucket público `logos`. */
  logo_url: string | null;
  /** Banner do topo da visão geral, no mesmo bucket da logo. */
  banner_url?: string | null;
  /** Para onde o banner leva ao ser clicado (rota do painel ou https). */
  banner_link?: string | null;
  site: string | null;
  instagram: string | null;
  /** Texto do lembrete de consulta enviado ao paciente. */
  mensagem_lembrete: string | null;
  /** @deprecated Substituído por `lembrete_dias_uteis`. */
  antecedencia_lembrete_h: number;
  /** Quantos dias úteis antes o lembrete sai. */
  lembrete_dias_uteis: number;
  /** Hora do dia (0–23) em que o disparo acontece. */
  lembrete_hora: number;
  lembrete_ativo: boolean;
  /** Pesquisa de satisfação automática após a consulta (opcional até o SQL rodar). */
  pesquisa_ativa?: boolean;
  /** Link para o paciente avaliar a clínica no Google. */
  link_avaliacao?: string | null;
  /**
   * Conexão do Merge que envia as mensagens desta clínica — o número
   * de WhatsApp que ela conectou por QR code. Nulo enquanto ninguém
   * escolheu: sem isso o envio automático não sai, de propósito.
   */
  merge_connection_id: number | null;
  created_at: string;
};

export type Profile = {
  id: string;
  organization_id: string | null;
  nome: string | null;
  especialidade: string | null;
  crm: string | null;
  telefone: string | null;
  foto_url: string | null;
  /** "Dr.", "Dra." ou vazio: vem antes do nome nas mensagens. */
  tratamento?: string | null;
  /** Registro de Qualificação de Especialista. */
  rqe?: string | null;
  /** Apresentação curta, mostrada no perfil. */
  bio?: string | null;
  instagram?: string | null;
  role: Role;
  ativo: boolean;
  /**
   * Cadastrou-se sozinho e ainda não foi liberado por um administrador.
   * Junto com `ativo = false`, distingue a fila de entrada de quem teve
   * o acesso cortado — os dois estão barrados, por motivos opostos.
   */
  aguardando_liberacao: boolean;
  created_at: string;
};

export type Consulta = {
  id: string;
  organization_id: string | null;
  medico_id: string;
  paciente_nome: string;
  paciente_telefone: string | null;
  paciente_email: string | null;
  paciente_nascimento: string | null; // "YYYY-MM-DD"
  convenio: string | null; // ex.: "Particular", "Unimed"
  data_hora: string; // ISO
  duracao_min: number | null; // duração estimada em minutos
  tipo: TipoConsulta;
  status: StatusConsulta;
  motivo: string | null; // queixa / motivo da consulta
  observacao: string | null;
  valor: number | null; // valor da consulta (R$)
  /** Ficha do paciente (nulo até o SQL do banco de pacientes rodar). */
  paciente_id?: string | null;
  criado_por: string | null;
  created_at: string;
};

/** Ficha do paciente: uma por pessoa, ligada a todas as consultas dela. */
export type Paciente = {
  id: string;
  organization_id: string;
  nome: string;
  telefone: string | null;
  telefone_chave: string | null;
  email: string | null;
  nascimento: string | null; // "YYYY-MM-DD"
  cpf: string | null;
  sexo: "feminino" | "masculino" | "outro" | null;
  cidade: string | null;
  convenio: string | null;
  carteirinha: string | null;
  origem: string | null;
  lead_id: string | null;
  tags: string[];
  observacoes: string | null;
  ativo: boolean;
  consentimento_marketing: boolean;
  consentimento_em: string | null;
  consentimento_canal: string | null;
  descadastrado_em: string | null;
  criado_por: string | null;
  created_at: string;
  updated_at: string;
};

export type NotaPaciente = {
  id: string;
  organization_id: string;
  paciente_id: string;
  autor_id: string | null;
  texto: string;
  fixada: boolean;
  created_at: string;
};

export type TipoTarefa = "ligar" | "whatsapp" | "orcamento" | "retorno" | "outro";
export type StatusTarefa = "aberta" | "feita" | "cancelada";

/** Follow-up com data e responsável, sempre ligado a um paciente. */
export type TarefaPaciente = {
  id: string;
  organization_id: string;
  paciente_id: string;
  titulo: string;
  tipo: TipoTarefa;
  vencimento: string; // "YYYY-MM-DD"
  responsavel_id: string | null;
  status: StatusTarefa;
  resultado: string | null;
  concluida_em: string | null;
  concluida_por: string | null;
  criado_por: string | null;
  created_at: string;
};

export type CanalDisparo = "whatsapp" | "email";
/** marketing: só quem aceitou; cuidado: retorno e aniversário, todos menos descadastrados. */
export type FinalidadeDisparo = "marketing" | "cuidado";
export type StatusDisparo = "agendado" | "enviando" | "concluido" | "cancelado";
export type StatusDestinatario = "pendente" | "programado" | "enviado" | "falhou" | "cancelado" | "ignorado";

/** Campanha de mensagem para um segmento de pacientes. */
export type Disparo = {
  id: string;
  organization_id: string;
  nome: string;
  canal: CanalDisparo;
  finalidade: FinalidadeDisparo;
  assunto: string | null;
  mensagem: string;
  filtros: Record<string, string>;
  segmento_nome: string | null;
  status: StatusDisparo;
  inicio: string;
  total: number;
  criado_por: string | null;
  cancelado_em: string | null;
  concluido_em: string | null;
  created_at: string;
};

export type DisparoDestinatario = {
  id: string;
  disparo_id: string;
  organization_id: string;
  paciente_id: string;
  nome: string;
  destino: string;
  token: string;
  previsto_para: string;
  status: StatusDestinatario;
  referencia: string | null;
  erro: string | null;
  processado_em: string | null;
  created_at: string;
};

/** Filtros da lista de pacientes guardados com um nome. */
export type SegmentoPacientes = {
  id: string;
  organization_id: string;
  nome: string;
  filtros: Record<string, string>;
  criado_por: string | null;
  created_at: string;
};

/** Ficha com o resumo calculado a partir das consultas e receitas. */
export type PacienteResumo = Paciente & {
  mes_nascimento: number | null;
  consultas_realizadas: number;
  faltas: number;
  primeira_consulta: string | null;
  ultima_consulta: string | null;
  proxima_consulta: string | null;
  total_gasto: number;
  profissional_principal: string | null;
};

/** Resposta da pesquisa de satisfação (NPS) de uma consulta. */
export type Avaliacao = {
  id: string;
  consulta_id: string;
  organization_id: string;
  medico_id: string | null;
  paciente_nome: string;
  token: string;
  enviado_em: string | null;
  nota: number | null;
  comentario: string | null;
  respondido_em: string | null;
  created_at: string;
};

/** Documento anexado a uma consulta (exame, encaminhamento, receita...). */
export type Anexo = {
  id: string;
  consulta_id: string;
  medico_id: string;
  nome: string;
  caminho: string; // path no Supabase Storage
  tipo: string | null; // mime type
  tamanho: number | null; // bytes
  created_at: string;
};

export type Disponibilidade = {
  id: string;
  medico_id: string;
  dia_semana: number; // 0 (domingo) a 6 (sábado)
  hora_inicio: string; // "HH:MM"
  hora_fim: string;
};

export type Bloqueio = {
  id: string;
  medico_id: string;
  data_inicio: string;
  data_fim: string;
  motivo: string | null;
};

/**
 * Lead. Com `organization_id` nulo é um lead comercial da própria
 * Medi Marketing (formulário do site). Preenchido, é lead de uma clínica
 * cliente e alimenta o CRM da Fase 2.
 */
export type Lead = {
  id: string;
  organization_id: string | null;
  nome: string;
  especialidade: string | null;
  whatsapp: string;
  email: string | null;
  cidade: string | null;
  faturamento_medio: string | null;
  tem_equipe_comercial: boolean | null;
  mensagem: string | null;
  origem: string | null;
  etapa_funil: EtapaFunil;
  status: StatusLead;
  consentimento_lgpd: boolean;
  /** Quem da equipe cuida deste lead. */
  responsavel_id: string | null;
  /** Quanto o tratamento pode valer, para priorizar o funil. */
  valor_estimado: number | null;
  tags: string[];
  /** Data combinada para o próximo toque (ISO). */
  proximo_contato: string | null;
  ultimo_contato: string | null;
  motivo_perda: string | null;
  created_at: string;
};

/* ------------------------------------------------------------------ */
/* CRM — histórico de relacionamento                                   */
/* ------------------------------------------------------------------ */

export type CanalContato =
  | "whatsapp"
  | "instagram"
  | "facebook"
  | "telefone"
  | "email"
  | "presencial";

export type TipoInteracao = "nota" | "mensagem" | "ligacao" | "tarefa";

/** Uma linha do histórico do lead: nota, contato feito ou tarefa agendada. */
export type LeadInteracao = {
  id: string;
  lead_id: string;
  organization_id: string;
  autor_id: string | null;
  tipo: TipoInteracao;
  canal: CanalContato | null;
  conteudo: string;
  /** Só faz sentido em `tipo = "tarefa"`. */
  concluida: boolean;
  vence_em: string | null;
  created_at: string;
};

/** Lead com o que a tela do funil precisa mostrar junto. */
export type LeadComContexto = Lead & {
  responsavel_nome: string | null;
  interacoes: number;
  ultima_interacao: string | null;
  tarefas_abertas: number;
};

/* ------------------------------------------------------------------ */
/* Atendimento — caixa de entrada dos canais                           */
/* ------------------------------------------------------------------ */

export type CanalConversa = "whatsapp" | "instagram" | "facebook";
export type StatusConversa = "aberta" | "pendente" | "resolvida";

export type Conversa = {
  id: string;
  organization_id: string;
  lead_id: string | null;
  canal: CanalConversa;
  contato_nome: string;
  /** Telefone no WhatsApp, @ nas redes. */
  contato_identificador: string;
  status: StatusConversa;
  atribuido_a: string | null;
  nao_lidas: number;
  ultima_mensagem: string | null;
  ultima_mensagem_em: string;
  created_at: string;
};

export type Mensagem = {
  id: string;
  conversa_id: string;
  /** "entrada" = paciente falou; "saida" = a clínica respondeu. */
  direcao: "entrada" | "saida";
  autor_id: string | null;
  autor_nome: string | null;
  conteudo: string;
  created_at: string;
};

export type ConversaComContexto = Conversa & {
  atribuido_nome: string | null;
  etapa_funil: EtapaFunil | null;
};

/* ------------------------------------------------------------------ */
/* Retenção — réguas de reabordagem                                    */
/* ------------------------------------------------------------------ */

export type TipoRegua =
  | "reabordagem"
  | "no_show"
  | "reativacao"
  | "recall"
  | "pos_consulta";

/** Cadência automática disparada por um evento do funil ou da agenda. */
export type Regua = {
  id: string;
  organization_id: string;
  tipo: TipoRegua;
  nome: string;
  descricao: string | null;
  ativa: boolean;
  created_at: string;
};

export type ReguaPasso = {
  id: string;
  regua_id: string;
  ordem: number;
  /** Espera desde o gatilho (ou desde o passo anterior, na leitura da tela). */
  atraso_horas: number;
  canal: CanalContato;
  mensagem: string;
};

export type StatusExecucao = "enviado" | "respondido" | "convertido" | "cancelado";

export type ReguaExecucao = {
  id: string;
  regua_id: string;
  organization_id: string;
  lead_id: string | null;
  passo: number;
  status: StatusExecucao;
  executado_em: string;
};

/** Régua com os passos e o desempenho dos últimos 90 dias. */
export type ReguaComDesempenho = Regua & {
  passos: ReguaPasso[];
  enviados: number;
  respondidos: number;
  convertidos: number;
};

/* ------------------------------------------------------------------ */
/* Marketing — campanhas de mídia paga                                 */
/* ------------------------------------------------------------------ */

export type PlataformaAds = "meta" | "google" | "organico" | "outro";
export type StatusCampanha = "ativa" | "pausada" | "encerrada";

export type Campanha = {
  id: string;
  organization_id: string;
  plataforma: PlataformaAds;
  nome: string;
  objetivo: string | null;
  status: StatusCampanha;
  inicio: string; // "YYYY-MM-DD"
  fim: string | null;
  investimento: number;
  impressoes: number;
  cliques: number;
  leads: number;
  agendamentos: number;
  created_at: string;
};

/* ------------------------------------------------------------------ */
/* Financeiro                                                          */
/* ------------------------------------------------------------------ */

export type FormaPagamento =
  | "pix"
  | "dinheiro"
  | "cartao_credito"
  | "cartao_debito"
  | "convenio"
  | "boleto";

export type StatusLancamento = "previsto" | "recebido" | "atrasado" | "cancelado";

/** Receita de um procedimento. O custo direto entra para calcular a margem. */
export type Lancamento = {
  id: string;
  organization_id: string;
  consulta_id: string | null;
  paciente_nome: string;
  procedimento: string;
  categoria: string | null;
  valor: number;
  /** Material, laboratório, repasse — o que sai do valor cheio. */
  custo: number;
  forma_pagamento: FormaPagamento;
  status: StatusLancamento;
  data_competencia: string; // "YYYY-MM-DD"
  data_recebimento: string | null;
  observacao: string | null;
  created_at: string;
  /* Campos do financeiro completo (opcionais até o SQL rodar) */
  medico_id?: string | null;
  convenio?: string | null;
  desconto?: number;
  /** Taxa da maquininha ou do boleto, já em reais. */
  taxa?: number;
  parcelas?: number;
  /** Quanto o convênio deixou de pagar. */
  glosa?: number;
  glosa_motivo?: string | null;
  /** Quando o convênio deve pagar. */
  previsao_recebimento?: string | null;
  origem?: "manual" | "agenda";
  atualizado_em?: string;
};

/* ------------------------------------------------------------------ */
/* Financeiro da clínica                                               */
/* ------------------------------------------------------------------ */

export type CategoriaDespesa =
  | "aluguel"
  | "equipe"
  | "pro_labore"
  | "insumos"
  | "laboratorio"
  | "marketing"
  | "sistemas"
  | "impostos"
  | "taxas"
  | "manutencao"
  | "outros";

export type StatusDespesa = "aberta" | "paga" | "cancelada";

export type Despesa = {
  id: string;
  organization_id: string;
  descricao: string;
  categoria: CategoriaDespesa;
  fornecedor: string | null;
  valor: number;
  vencimento: string;
  pago_em: string | null;
  status: StatusDespesa;
  /** Fixa: existe todo mês, com ou sem paciente (aluguel, equipe). */
  fixa: boolean;
  recorrente: boolean;
  grupo: string | null;
  parcela: number | null;
  parcelas: number | null;
  forma_pagamento: string | null;
  comprovante: string | null;
  observacao: string | null;
  created_at: string;
};

export type PrecoProcedimento = {
  id: string;
  organization_id: string;
  procedimento: string;
  categoria: string | null;
  /** Nulo = particular. */
  convenio: string | null;
  valor: number;
  custo: number;
  duracao_min: number | null;
  ativo: boolean;
  created_at: string;
};

export type RegraRepasse = {
  id: string;
  organization_id: string;
  medico_id: string;
  tipo: "percentual" | "fixo";
  /** Percentual (0–100) ou valor fixo por atendimento. */
  valor: number;
  base: "bruto" | "liquido";
  /** Repassa só o que já entrou no caixa. */
  so_recebido: boolean;
};

export type Repasse = {
  id: string;
  organization_id: string;
  medico_id: string;
  competencia: string;
  atendimentos: number;
  base: number;
  valor: number;
  status: "fechado" | "pago";
  pago_em: string | null;
  fechado_por: string | null;
  created_at: string;
};

export type ConfigFinanceira = {
  organization_id: string;
  /** Percentual de taxa por forma de pagamento. */
  taxas: Partial<Record<FormaPagamento, number>>;
  /** Imposto sobre a receita (%), para o resultado do mês. */
  imposto: number;
  /** Quanto separar da receita de convênio para glosas (%). */
  reserva_glosa: number;
  saldo_inicial: number;
  meta_lucro: number | null;
  atualizado_em: string;
};

/** Fechamento de caixa de um mês, importado de outro sistema ou planilha. */
export type FechamentoFinanceiro = {
  id: string;
  organization_id: string;
  mes: string;
  entradas: number | null;
  saidas: number | null;
  saldo_final: number | null;
  /** Receita dos atendimentos, sem entradas não operacionais. */
  receita_operacional: number | null;
  observacao: string | null;
  origem: string;
  created_at: string;
};

export type NaturezaComposicao =
  | "convenio"
  | "particular"
  | "outras"
  | "operacional"
  | "socios"
  | "financeiro"
  | "investimento";

/** Receitas por fonte ou saídas por categoria, somadas num período. */
export type ComposicaoFinanceira = {
  id: string;
  organization_id: string;
  inicio: string;
  fim: string;
  tipo: "receita" | "saida";
  item: string;
  valor: number;
  percentual: number | null;
  natureza: NaturezaComposicao;
  /** Valor calculado a partir do percentual informado. */
  estimado: boolean;
  observacao: string | null;
  ordem: number;
};

/* ------------------------------------------------------------------ */
/* Financeiro da agência                                               */
/* ------------------------------------------------------------------ */

export type StatusContrato = "ativo" | "pausado" | "cancelado";

export type Contrato = {
  id: string;
  organization_id: string;
  plano: PlanoOrganizacao;
  mensalidade: number;
  implantacao: number;
  inicio: string;
  fidelidade_meses: number;
  dia_vencimento: number;
  reajuste: string;
  status: StatusContrato;
  cancelado_em: string | null;
  motivo_saida: string | null;
  responsavel: string | null;
  observacao: string | null;
  created_at: string;
  atualizado_em: string;
};

export type TipoEventoContrato =
  | "novo"
  | "upgrade"
  | "downgrade"
  | "pausa"
  | "reativacao"
  | "cancelamento";

export type ContratoEvento = {
  id: string;
  contrato_id: string;
  tipo: TipoEventoContrato;
  data: string;
  mrr_antes: number;
  mrr_depois: number;
  observacao: string | null;
  created_at: string;
};

export type StatusFatura = "aberta" | "paga" | "cancelada";

export type Fatura = {
  id: string;
  organization_id: string;
  contrato_id: string | null;
  competencia: string;
  descricao: string;
  valor: number;
  vencimento: string;
  status: StatusFatura;
  pago_em: string | null;
  forma_pagamento: string | null;
  tipo: "mensalidade" | "implantacao" | "avulsa";
  created_at: string;
};

export type CustoAgencia = {
  id: string;
  descricao: string;
  categoria: "ferramentas" | "equipe" | "midia" | "impostos" | "estrutura" | "outros";
  valor: number;
  competencia: string;
  recorrente: boolean;
  organization_id: string | null;
  created_at: string;
};

/* ------------------------------------------------------------------ */
/* Confirmação de consulta                                             */
/* ------------------------------------------------------------------ */

export type StatusConfirmacao =
  /** Ainda não saiu: esperando a data de disparo. */
  | "pendente"
  /** Mensagem enviada, aguardando o paciente responder. */
  | "enviado"
  | "confirmado"
  /** Paciente pediu outro horário. */
  | "reagendar"
  /** Paciente avisou que não vem. */
  | "recusado"
  | "cancelado";

/**
 * Por onde a mensagem saiu. "merge" é o número da própria clínica;
 * "whatsapp", o número único da plataforma pela Cloud API.
 */
export type CanalEnvio = "whatsapp" | "merge" | "manual" | "email";

/**
 * Pedido de confirmação de uma consulta.
 *
 * O `token` é a credencial do paciente: com ele a página pública abre
 * sem login. Uma linha por consulta.
 */
export type Confirmacao = {
  id: string;
  consulta_id: string;
  organization_id: string;
  token: string;
  agendado_para: string;
  enviado_em: string | null;
  canal: CanalEnvio | null;
  status: StatusConfirmacao;
  respondido_em: string | null;
  observacao: string | null;
  tentativas: number;
  /** Quando o lembrete entrou na fila de envios. */
  enfileirado_em?: string | null;
  created_at: string;
};

/** Confirmação com os dados da consulta que a tela precisa mostrar. */
export type ConfirmacaoComConsulta = Confirmacao & {
  paciente_nome: string;
  paciente_telefone: string | null;
  data_hora: string;
  medico_nome: string | null;
  tipo: TipoConsulta;
  status_consulta: StatusConsulta;
};

/* ------------------------------------------------------------------ */
/* Notificações                                                        */
/* ------------------------------------------------------------------ */

export type TipoNotificacao =
  | "reagendamento"
  | "confirmacao"
  | "cancelamento"
  | "lembrete_atrasado"
  | "lead_novo"
  | "mensagem_nova"
  | "cadastro_pendente"
  | "sistema"
  | "consulta_nova"
  | "consulta_remarcada"
  | "agenda"
  | "envio_falhou";

/**
 * Aviso endereçado a papéis dentro de uma clínica.
 *
 * Não é endereçado a uma pessoa porque quem resolve é quem estiver de
 * plantão. `organization_id` nulo é aviso da plataforma, só para a
 * equipe Medi Marketing.
 */
export type Notificacao = {
  id: string;
  organization_id: string | null;
  papeis: Role[];
  tipo: TipoNotificacao;
  prioridade: "alta" | "normal";
  titulo: string;
  descricao: string | null;
  href: string | null;
  entidade_id: string | null;
  /** Preenchido, só esta pessoa vê; vazio, vale `papeis`. */
  usuario_id?: string | null;
  created_at: string;
};

/* ------------------------------------------------------------------ */
/* Comunicação                                                         */
/* ------------------------------------------------------------------ */

export type CanalAviso = "painel" | "whatsapp" | "email";

export type StatusEnvio = "pendente" | "enviando" | "enviado" | "falhou" | "ignorado" | "cancelado";

/** Uma mensagem da fila: o que sai, para quem, por onde e como foi. */
export type Envio = {
  id: string;
  organization_id: string | null;
  evento: string;
  canal: CanalAviso;
  publico: "paciente" | "equipe" | "clinica";
  usuario_id: string | null;
  destino: string | null;
  destino_nome: string | null;
  consulta_id: string | null;
  confirmacao_id: string | null;
  assunto: string | null;
  conteudo: string | null;
  payload: Record<string, unknown>;
  chave: string | null;
  status: StatusEnvio;
  agendado_para: string;
  tentativas: number;
  erro: string | null;
  referencia: string | null;
  enviado_em: string | null;
  created_at: string;
};

export type PreferenciaAviso = {
  usuario_id: string;
  organization_id: string | null;
  canais: Partial<Record<string, CanalAviso[]>>;
  resumo_hora: number;
  updated_at: string;
};

export type NotificacaoLeitura = {
  notificacao_id: string;
  user_id: string;
  lida_em: string;
};

/** Notificação já resolvida para o usuário que está olhando. */
export type NotificacaoComLeitura = Notificacao & { lida: boolean };

/* ------------------------------------------------------------------ */
/* Configurações — integrações da clínica                              */
/* ------------------------------------------------------------------ */

export type ProvedorIntegracao =
  | "meta_ads"
  | "google_ads"
  | "ga4"
  | "whatsapp"
  | "instagram";

export type Integracao = {
  id: string;
  organization_id: string;
  provedor: ProvedorIntegracao;
  conectado: boolean;
  /** ID da conta de anúncios, número do WhatsApp, @ do perfil... */
  identificador: string | null;
  atualizado_em: string;
};

/* ------------------------------------------------------------------ */
/* Academy                                                             */
/* ------------------------------------------------------------------ */

export type NivelTrilha = "essencial" | "intermediario" | "avancado";

/** Trilha de treinamento. Conteúdo global, produzido pela Medi Marketing. */
export type Course = {
  id: string;
  slug: string;
  titulo: string;
  resumo: string | null;
  descricao: string | null;
  nivel: NivelTrilha;
  /** Papéis que enxergam a trilha. */
  papeis: Role[];
  ordem: number;
  publicado: boolean;
  created_at: string;
};

export type Lesson = {
  id: string;
  course_id: string;
  slug: string;
  titulo: string;
  descricao: string | null;
  video_url: string | null;
  material_url: string | null;
  duracao_min: number | null;
  ordem: number;
  publicado: boolean;
  created_at: string;
};

export type LessonProgress = {
  id: string;
  lesson_id: string;
  user_id: string;
  concluida: boolean;
  concluida_em: string;
};

export type LessonComment = {
  id: string;
  lesson_id: string;
  user_id: string;
  organization_id: string | null;
  parent_id: string | null;
  conteudo: string;
  created_at: string;
};

/** Comentário já enriquecido com autor e respostas, para exibição. */
export type ComentarioComAutor = LessonComment & {
  autor_nome: string;
  autor_papel: Role;
  respostas?: ComentarioComAutor[];
};

/* ------------------------------------------------------------------ */
/* Indicadores                                                         */
/* ------------------------------------------------------------------ */

/** Números do mês de uma clínica. Lançados à mão até as APIs de Ads entrarem. */
export type IndicadorMensal = {
  id: string;
  organization_id: string;
  mes: string; // "YYYY-MM-01"
  investimento: number;
  leads: number;
  agendamentos: number;
  comparecimentos: number;
  faturamento: number;
  observacao: string | null;
  atualizado_em: string;
  /*
   * Detalhes que o diagnóstico e o check-in mensal trazem. Opcionais:
   * lançamentos antigos e manuais não têm, e nulo é "não informado".
   */
  pacientes_unicos?: number | null;
  novos_pacientes?: number | null;
  atendimentos?: number | null;
  ticket_medio?: number | null;
  gasto_medio_paciente?: number | null;
  /** Receita do mês por serviço: {"Quiropraxia": 31000}. */
  receitas_servico?: Record<string, number>;
  origem?: OrigemIndicador;
  /** Campos que a clínica informou como aproximados. */
  campos_estimados?: string[];
  /** Campos que a clínica não mede (gravados como zero). */
  campos_sem_dado?: string[];
};

export type OrigemIndicador = "manual" | "diagnostico" | "integracao" | "checkin";

/** Marco zero, metas e resumo do diagnóstico de uma clínica. */
export type PlanoCliente = {
  organization_id: string;
  resposta_id: string | null;
  /** Primeiro e último mês da base ("YYYY-MM-01"). */
  base_inicio: string | null;
  base_fim: string | null;
  meta_faturamento: number | null;
  meta_leads: number | null;
  meta_consultas: number | null;
  prazo: string | null;
  criterio_financeiro: string | null;
  prioridades: string | null;
  obstaculo: string | null;
  observacoes: string | null;
  importado_em: string | null;
  atualizado_em: string;
  atualizado_por: string | null;
};

// Cada tabela precisa expor Relationships para o supabase-js inferir os tipos.
type Tabela<Row, Insert, Update> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

/** Estrutura do Database para tipar o client do Supabase. */
export interface Database {
  public: {
    Tables: {
      organizations: Tabela<
        Organization,
        Omit<Organization, "id" | "created_at"> & { id?: string },
        Partial<Organization>
      >;
      profiles: Tabela<Profile, Partial<Profile> & { id: string }, Partial<Profile>>;
      propostas: Tabela<
        Proposta,
        Omit<Proposta, "id" | "created_at" | "visualizacoes" | "status"> & {
          id?: string;
          status?: StatusProposta;
          visualizacoes?: number;
        },
        Partial<Proposta>
      >;
      consultas: Tabela<
        Consulta,
        Omit<Consulta, "id" | "created_at"> & { id?: string },
        Partial<Consulta>
      >;
      paciente_notas: Tabela<
        NotaPaciente,
        Omit<NotaPaciente, "id" | "created_at" | "fixada"> & { id?: string; fixada?: boolean },
        Partial<NotaPaciente>
      >;
      paciente_tarefas: Tabela<
        TarefaPaciente,
        Omit<TarefaPaciente, "id" | "created_at" | "status" | "resultado" | "concluida_em" | "concluida_por"> & {
          id?: string;
          status?: StatusTarefa;
          resultado?: string | null;
          concluida_em?: string | null;
          concluida_por?: string | null;
        },
        Partial<TarefaPaciente>
      >;
      disparos: Tabela<
        Disparo,
        Omit<Disparo, "id" | "created_at" | "status" | "cancelado_em" | "concluido_em"> & {
          id?: string;
          status?: StatusDisparo;
          cancelado_em?: string | null;
          concluido_em?: string | null;
        },
        Partial<Disparo>
      >;
      disparo_destinatarios: Tabela<
        DisparoDestinatario,
        Omit<DisparoDestinatario, "id" | "created_at" | "status" | "referencia" | "erro" | "processado_em"> & {
          id?: string;
          status?: StatusDestinatario;
          referencia?: string | null;
          erro?: string | null;
          processado_em?: string | null;
        },
        Partial<DisparoDestinatario>
      >;
      segmentos_pacientes: Tabela<
        SegmentoPacientes,
        Omit<SegmentoPacientes, "id" | "created_at"> & { id?: string },
        Partial<SegmentoPacientes>
      >;
      pacientes: Tabela<
        Paciente,
        Partial<Omit<Paciente, "id" | "created_at" | "updated_at" | "telefone_chave">> & {
          organization_id: string;
          nome: string;
          id?: string;
        },
        Partial<Paciente>
      >;
      avaliacoes: Tabela<
        Avaliacao,
        Omit<Avaliacao, "id" | "created_at" | "enviado_em" | "nota" | "comentario" | "respondido_em"> & {
          id?: string;
          enviado_em?: string | null;
          nota?: number | null;
          comentario?: string | null;
          respondido_em?: string | null;
        },
        Partial<Avaliacao>
      >;
      disponibilidade: Tabela<
        Disponibilidade,
        Omit<Disponibilidade, "id"> & { id?: string },
        Partial<Disponibilidade>
      >;
      bloqueios: Tabela<
        Bloqueio,
        Omit<Bloqueio, "id"> & { id?: string },
        Partial<Bloqueio>
      >;
      leads: Tabela<
        Lead,
        // Os campos de trabalho do funil têm default no banco: quem insere
        // (formulário do site, importação) não precisa informá-los.
        Omit<
          Lead,
          | "id"
          | "created_at"
          | "etapa_funil"
          | "status"
          | "responsavel_id"
          | "valor_estimado"
          | "tags"
          | "proximo_contato"
          | "ultimo_contato"
          | "motivo_perda"
        > &
          Partial<
            Pick<
              Lead,
              | "id"
              | "etapa_funil"
              | "status"
              | "responsavel_id"
              | "valor_estimado"
              | "tags"
              | "proximo_contato"
              | "ultimo_contato"
              | "motivo_perda"
            >
          >,
        Partial<Lead>
      >;
      anexos: Tabela<
        Anexo,
        Omit<Anexo, "id" | "created_at"> & { id?: string },
        Partial<Anexo>
      >;
      courses: Tabela<
        Course,
        Omit<Course, "id" | "created_at"> & { id?: string },
        Partial<Course>
      >;
      lessons: Tabela<
        Lesson,
        Omit<Lesson, "id" | "created_at"> & { id?: string },
        Partial<Lesson>
      >;
      lesson_progress: Tabela<
        LessonProgress,
        Omit<LessonProgress, "id" | "concluida_em"> & {
          id?: string;
          concluida_em?: string;
        },
        Partial<LessonProgress>
      >;
      lesson_comments: Tabela<
        LessonComment,
        Omit<LessonComment, "id" | "created_at"> & { id?: string },
        Partial<LessonComment>
      >;
      indicadores_mensais: Tabela<
        IndicadorMensal,
        Omit<IndicadorMensal, "id" | "atualizado_em"> & {
          id?: string;
          atualizado_em?: string;
        },
        Partial<IndicadorMensal>
      >;
      lead_interacoes: Tabela<
        LeadInteracao,
        Omit<LeadInteracao, "id" | "created_at" | "concluida"> & {
          id?: string;
          concluida?: boolean;
        },
        Partial<LeadInteracao>
      >;
      conversas: Tabela<
        Conversa,
        Omit<Conversa, "id" | "created_at" | "nao_lidas"> & {
          id?: string;
          nao_lidas?: number;
        },
        Partial<Conversa>
      >;
      mensagens: Tabela<
        Mensagem,
        Omit<Mensagem, "id" | "created_at"> & { id?: string },
        Partial<Mensagem>
      >;
      reguas: Tabela<
        Regua,
        Omit<Regua, "id" | "created_at"> & { id?: string },
        Partial<Regua>
      >;
      regua_passos: Tabela<
        ReguaPasso,
        Omit<ReguaPasso, "id"> & { id?: string },
        Partial<ReguaPasso>
      >;
      regua_execucoes: Tabela<
        ReguaExecucao,
        Omit<ReguaExecucao, "id" | "executado_em"> & {
          id?: string;
          executado_em?: string;
        },
        Partial<ReguaExecucao>
      >;
      campanhas: Tabela<
        Campanha,
        Omit<Campanha, "id" | "created_at"> & { id?: string },
        Partial<Campanha>
      >;
      lancamentos: Tabela<
        Lancamento,
        Omit<Lancamento, "id" | "created_at"> & { id?: string },
        Partial<Lancamento>
      >;
      tabela_precos: Tabela<
        PrecoProcedimento,
        Pick<PrecoProcedimento, "organization_id" | "procedimento"> & Partial<PrecoProcedimento>,
        Partial<PrecoProcedimento>
      >;
      despesas: Tabela<
        Despesa,
        Pick<Despesa, "organization_id" | "descricao" | "valor" | "vencimento"> & Partial<Despesa>,
        Partial<Despesa>
      >;
      regras_repasse: Tabela<
        RegraRepasse,
        Pick<RegraRepasse, "organization_id" | "medico_id"> & Partial<RegraRepasse>,
        Partial<RegraRepasse>
      >;
      repasses: Tabela<
        Repasse,
        Pick<Repasse, "organization_id" | "medico_id" | "competencia"> & Partial<Repasse>,
        Partial<Repasse>
      >;
      config_financeira: Tabela<
        ConfigFinanceira,
        Pick<ConfigFinanceira, "organization_id"> & Partial<ConfigFinanceira>,
        Partial<ConfigFinanceira>
      >;
      contratos: Tabela<
        Contrato,
        Pick<Contrato, "organization_id"> & Partial<Contrato>,
        Partial<Contrato>
      >;
      contrato_eventos: Tabela<
        ContratoEvento,
        Pick<ContratoEvento, "contrato_id" | "tipo"> & Partial<ContratoEvento>,
        Partial<ContratoEvento>
      >;
      faturas: Tabela<
        Fatura,
        Pick<Fatura, "organization_id" | "competencia" | "valor" | "vencimento"> & Partial<Fatura>,
        Partial<Fatura>
      >;
      fechamentos_financeiros: Tabela<
        FechamentoFinanceiro,
        Pick<FechamentoFinanceiro, "organization_id" | "mes"> & Partial<FechamentoFinanceiro>,
        Partial<FechamentoFinanceiro>
      >;
      composicoes_financeiras: Tabela<
        ComposicaoFinanceira,
        Pick<ComposicaoFinanceira, "organization_id" | "inicio" | "fim" | "tipo" | "item" | "valor"> & Partial<ComposicaoFinanceira>,
        Partial<ComposicaoFinanceira>
      >;
      custos_agencia: Tabela<
        CustoAgencia,
        Pick<CustoAgencia, "descricao" | "valor" | "competencia"> & Partial<CustoAgencia>,
        Partial<CustoAgencia>
      >;
      integracoes: Tabela<
        Integracao,
        Omit<Integracao, "id" | "atualizado_em"> & {
          id?: string;
          atualizado_em?: string;
        },
        Partial<Integracao>
      >;
      confirmacoes: Tabela<
        Confirmacao,
        Omit<Confirmacao, "id" | "created_at" | "status" | "tentativas"> & {
          id?: string;
          status?: StatusConfirmacao;
          tentativas?: number;
        },
        Partial<Confirmacao>
      >;
      notificacoes: Tabela<
        Notificacao,
        Omit<Notificacao, "id" | "created_at" | "prioridade" | "papeis"> & {
          id?: string;
          prioridade?: "alta" | "normal";
          papeis?: Role[];
        },
        Partial<Notificacao>
      >;
      envios: Tabela<
        Envio,
        Pick<Envio, "evento" | "canal" | "publico"> & Partial<Envio>,
        Partial<Envio>
      >;
      preferencias_aviso: Tabela<
        PreferenciaAviso,
        Pick<PreferenciaAviso, "usuario_id"> & Partial<PreferenciaAviso>,
        Partial<PreferenciaAviso>
      >;
      config_interna: Tabela<
        { chave: string; valor: string },
        { chave: string; valor: string },
        Partial<{ chave: string; valor: string }>
      >;
      notificacao_leituras: Tabela<
        NotificacaoLeitura,
        Omit<NotificacaoLeitura, "lida_em"> & { lida_em?: string },
        Partial<NotificacaoLeitura>
      >;
      planos_cliente: Tabela<
        PlanoCliente,
        Pick<PlanoCliente, "organization_id"> & Partial<PlanoCliente>,
        Partial<PlanoCliente>
      >;
      formularios_modelos: Tabela<
        FormularioModelo,
        Omit<FormularioModelo, "id" | "created_at"> & { id?: string },
        Partial<FormularioModelo>
      >;
      formularios_respostas: Tabela<
        FormularioResposta,
        Pick<FormularioResposta, "modelo_id" | "organization_id"> &
          Partial<FormularioResposta>,
        Partial<FormularioResposta>
      >;
      formularios_notas: Tabela<
        FormularioNota,
        Pick<FormularioNota, "resposta_id" | "texto"> & Partial<FormularioNota>,
        Partial<FormularioNota>
      >;
      formularios_eventos: Tabela<
        FormularioEvento,
        Pick<FormularioEvento, "resposta_id" | "tipo"> & Partial<FormularioEvento>,
        Partial<FormularioEvento>
      >;
    };
    // Empty-key form (não use Record<string, never>: isso faria keyof = string
    // e todo nome de tabela casaria com a sobrecarga de "view", quebrando os tipos).
    Views: {
      pacientes_resumo: { Row: PacienteResumo; Relationships: [] };
    };
    Functions: {
      enviar_formulario: { Args: { p_id: string }; Returns: undefined };
      reabrir_formulario: { Args: { p_id: string }; Returns: undefined };
      marcar_formulario_revisado: { Args: { p_id: string }; Returns: undefined };
      liberar_formulario: { Args: { p_org: string; p_slug: string }; Returns: string };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
}

/* ------------------------------------------------------------------ */
/* Propostas comerciais                                                */
/* ------------------------------------------------------------------ */

export type StatusProposta = "enviada" | "vista" | "aceita" | "recusada";
export type PlanoProposta = "essencial" | "performance" | "full";

/**
 * Proposta com link público.
 *
 * Os preços são por proposta, não por plano: cada conversa fecha um
 * valor, e a tabela de preços do site é só o ponto de partida. Nulo
 * significa "sob consulta", que é como o Full costuma sair.
 */
export type Proposta = {
  id: string;
  token: string;
  cliente_nome: string;
  cliente_logo_url: string | null;
  especialidade: string | null;
  cidade: string | null;
  responsavel: string | null;
  preco_essencial: number | null;
  preco_performance: number | null;
  preco_full: number | null;
  plano_destaque: PlanoProposta;
  mensagem: string | null;
  valida_ate: string | null;
  status: StatusProposta;
  visualizacoes: number;
  vista_em: string | null;
  respondida_em: string | null;
  criado_por: string | null;
  created_at: string;
};

/* ------------------------------------------------------------------ */
/* Formulários (diagnóstico da clínica)                                */
/* ------------------------------------------------------------------ */

export type StatusFormulario = "rascunho" | "enviado" | "revisado";

/** O conteúdo do formulário, versionado. O schema é o de lib/formularios/tipos. */
export type FormularioModelo = {
  id: string;
  slug: string;
  versao: number;
  titulo: string;
  descricao: string | null;
  schema: import("@/lib/formularios/tipos").SchemaFormulario;
  ativo: boolean;
  created_at: string;
};

/** As respostas de uma clínica a uma versão do formulário. */
export type FormularioResposta = {
  id: string;
  modelo_id: string;
  organization_id: string;
  status: StatusFormulario;
  respondente_nome: string | null;
  respondente_cargo: string | null;
  data_referencia: string | null;
  respostas: import("@/lib/formularios/tipos").Respostas;
  progresso: number;
  /** Credencial do link público. Quem tem o link preenche sem conta. */
  token: string;
  /** Período de formulários mensais ("2026-10"). Nulo no diagnóstico. */
  referencia?: string | null;
  /** Quando a equipe levou as respostas para o painel. */
  importado_em?: string | null;
  enviado_em: string | null;
  revisado_em: string | null;
  revisado_por: string | null;
  atualizado_por: string | null;
  created_at: string;
  updated_at: string;
};

/** Anotação interna da equipe. Nunca chega à clínica. */
export type FormularioNota = {
  id: string;
  resposta_id: string;
  autor_id: string | null;
  texto: string;
  created_at: string;
};

export type TipoEventoFormulario = "liberado" | "enviado" | "reaberto" | "revisado";

export type FormularioEvento = {
  id: string;
  resposta_id: string;
  autor_id: string | null;
  tipo: TipoEventoFormulario;
  created_at: string;
};
