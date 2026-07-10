/**
 * Configuração central do site: dados de contato, navegação e metadados.
 * Ajuste aqui os valores marcados como TODO no briefing (seção 9).
 */
export const site = {
  nome: "Medi Marketing",
  descricao:
    "Atendimento para marcar suas consultas e marketing médico que atrai pacientes. Você cuida da medicina, a gente cuida do resto.",
  url: "https://medimarketing.com.br", // TODO: domínio final
  // Lidos de variáveis públicas; fallback para não quebrar em dev sem .env
  whatsapp: process.env.NEXT_PUBLIC_WHATSAPP ?? "5511999999999",
  email: process.env.NEXT_PUBLIC_EMAIL_CONTATO ?? "contato@medimarketing.com.br",
  // TODO: preencher com dados reais
  cnpj: "00.000.000/0001-00",
  instagram: "https://instagram.com/medimarketing",
} as const;

/** Itens do menu principal (âncoras da landing). */
export const navLinks = [
  { label: "Serviços", href: "#servicos" },
  { label: "Como funciona", href: "#como-funciona" },
  { label: "Diferenciais", href: "#diferenciais" },
  { label: "Depoimentos", href: "#depoimentos" },
  { label: "FAQ", href: "#faq" },
] as const;
