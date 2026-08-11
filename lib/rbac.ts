/**
 * RBAC — controle de acesso por papel.
 *
 * Fonte única de verdade dos módulos do painel: a sidebar, o guard das
 * rotas e as páginas de placeholder leem tudo daqui. Ao criar um módulo
 * novo, basta registrá-lo nesta lista.
 */
import {
  LayoutDashboard,
  CalendarDays,
  CalendarCheck,
  Clock,
  Users,
  MessagesSquare,
  Megaphone,
  Repeat,
  GraduationCap,
  BarChart3,
  Wallet,
  Building2,
  Settings,
  User,
  LibraryBig,
  MessageSquareReply,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/lib/supabase/types";

export type ModuloId =
  | "dashboard"
  | "agenda"
  | "confirmacoes"
  | "disponibilidade"
  | "crm"
  | "atendimento"
  | "marketing"
  | "retencao"
  | "academy"
  | "indicadores"
  | "financeiro"
  | "clinicas"
  | "admin-usuarios"
  | "admin-academy"
  | "admin-comentarios"
  | "configuracoes"
  | "perfil";

/** Fase do roadmap em que o módulo passa a ter dados reais. */
export type Fase = 1 | 2 | 3 | 4 | 5;

export type Modulo = {
  id: ModuloId;
  label: string;
  href: string;
  icone: LucideIcon;
  /** Papéis com permissão de entrar no módulo. */
  papeis: readonly Role[];
  fase: Fase;
  /** Agrupamento visual na sidebar. */
  grupo: "operacao" | "crescimento" | "admin" | "conta";
  /** Descrição curta usada na tela de "em construção". */
  resumo: string;
};

const TODOS: readonly Role[] = ["super_admin", "gestor", "secretaria", "medico"];
const OPERACAO: readonly Role[] = ["super_admin", "gestor", "secretaria"];
const GESTAO: readonly Role[] = ["super_admin", "gestor"];

export const MODULOS: readonly Modulo[] = [
  {
    id: "dashboard",
    label: "Início",
    href: "/app",
    icone: LayoutDashboard,
    papeis: TODOS,
    fase: 1,
    grupo: "operacao",
    resumo: "Visão geral do dia, da agenda e dos números da clínica.",
  },
  {
    id: "agenda",
    label: "Agenda",
    href: "/app/agenda",
    icone: CalendarDays,
    papeis: TODOS,
    fase: 1,
    grupo: "operacao",
    resumo: "Consultas por mês, semana e dia, com status e confirmação.",
  },
  {
    id: "confirmacoes",
    label: "Confirmações",
    href: "/app/confirmacoes",
    icone: CalendarCheck,
    papeis: OPERACAO,
    fase: 1,
    grupo: "operacao",
    resumo:
      "Lembrete um dia útil antes e o paciente confirmando a presença pelo link.",
  },
  {
    id: "disponibilidade",
    label: "Disponibilidade",
    href: "/app/disponibilidade",
    icone: Clock,
    papeis: TODOS,
    fase: 1,
    grupo: "operacao",
    resumo: "Horários de atendimento e bloqueios de agenda.",
  },
  {
    id: "crm",
    label: "CRM e Funil",
    href: "/app/crm",
    icone: Users,
    papeis: OPERACAO,
    fase: 1,
    grupo: "operacao",
    resumo:
      "Leads e pacientes num funil visual: do primeiro contato ao tratamento.",
  },
  {
    id: "atendimento",
    label: "Atendimento",
    href: "/app/atendimento",
    icone: MessagesSquare,
    papeis: OPERACAO,
    fase: 1,
    grupo: "operacao",
    resumo:
      "Caixa de entrada única de WhatsApp, Instagram e Facebook, ligada ao CRM.",
  },
  {
    id: "retencao",
    label: "Retenção",
    href: "/app/retencao",
    icone: Repeat,
    papeis: OPERACAO,
    fase: 1,
    grupo: "crescimento",
    resumo:
      "Réguas de reabordagem, no-show, reativação de base e recall de retorno.",
  },
  {
    id: "marketing",
    label: "Marketing",
    href: "/app/marketing",
    icone: Megaphone,
    papeis: GESTAO,
    fase: 1,
    grupo: "crescimento",
    resumo:
      "Campanhas de Google e Meta Ads: investimento, leads, custo por lead e ROI.",
  },
  {
    id: "indicadores",
    label: "Indicadores",
    href: "/app/indicadores",
    icone: BarChart3,
    papeis: TODOS,
    fase: 1,
    grupo: "crescimento",
    resumo:
      "Do investimento ao faturamento: leads, agendamentos, comparecimento e ROI.",
  },
  {
    id: "academy",
    label: "Academy",
    href: "/app/academy",
    icone: GraduationCap,
    papeis: TODOS,
    fase: 1,
    grupo: "crescimento",
    resumo:
      "Trilhas de treinamento em vídeo para a secretária, o comercial e a gestão.",
  },
  {
    id: "financeiro",
    label: "Financeiro",
    href: "/app/financeiro",
    icone: Wallet,
    papeis: GESTAO,
    fase: 1,
    grupo: "crescimento",
    resumo:
      "Faturamento por procedimento, ticket médio e valor do paciente ao longo do tempo.",
  },
  {
    id: "clinicas",
    label: "Clientes",
    href: "/app/clinicas",
    icone: Building2,
    papeis: ["super_admin"],
    fase: 1,
    grupo: "admin",
    resumo: "Todas as clínicas atendidas pela Medi Marketing.",
  },
  {
    id: "admin-usuarios",
    label: "Usuários",
    href: "/app/admin/usuarios",
    icone: UsersRound,
    papeis: ["super_admin"],
    fase: 1,
    grupo: "admin",
    resumo: "Criar acessos, definir papéis e cortar entrada, em todas as clínicas.",
  },
  {
    id: "admin-academy",
    label: "Conteúdo Academy",
    href: "/app/admin/academy",
    icone: LibraryBig,
    papeis: ["super_admin"],
    fase: 1,
    grupo: "admin",
    resumo: "Criar trilhas, cadastrar aulas e publicar os vídeos.",
  },
  {
    id: "admin-comentarios",
    label: "Dúvidas dos alunos",
    href: "/app/admin/comentarios",
    icone: MessageSquareReply,
    papeis: ["super_admin"],
    fase: 1,
    grupo: "admin",
    resumo: "Responder às perguntas feitas nas aulas da Academy.",
  },
  {
    id: "configuracoes",
    label: "Configurações",
    href: "/app/configuracoes",
    icone: Settings,
    papeis: GESTAO,
    fase: 1,
    grupo: "conta",
    resumo: "Dados da clínica, usuários, papéis e integrações.",
  },
  {
    id: "perfil",
    label: "Meu perfil",
    href: "/app/perfil",
    icone: User,
    papeis: TODOS,
    fase: 1,
    grupo: "conta",
    resumo: "Seus dados de cadastro e preferências.",
  },
] as const;

/** Módulos visíveis para um papel, na ordem de exibição. */
export function modulosDoPapel(role: Role): Modulo[] {
  return MODULOS.filter((m) => m.papeis.includes(role));
}

export function moduloPorId(id: ModuloId): Modulo | undefined {
  return MODULOS.find((m) => m.id === id);
}

/** Verdadeiro se o papel pode entrar no módulo. */
export function podeAcessar(role: Role, id: ModuloId): boolean {
  return moduloPorId(id)?.papeis.includes(role) ?? false;
}

/** Rótulo em português para exibir na interface. */
export function rotuloPapel(role: Role): string {
  const mapa: Record<Role, string> = {
    super_admin: "Equipe Medi Marketing",
    gestor: "Gestor(a) da clínica",
    secretaria: "Atendimento",
    medico: "Médico(a)",
  };
  return mapa[role] ?? "Usuário";
}

export const GRUPOS: { id: Modulo["grupo"]; label: string }[] = [
  { id: "operacao", label: "Operação" },
  { id: "crescimento", label: "Crescimento" },
  { id: "admin", label: "Administração" },
  { id: "conta", label: "Conta" },
];
