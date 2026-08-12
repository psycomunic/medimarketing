/**
 * Configuração central do site: dados de contato, navegação e metadados.
 * Ajuste aqui os valores marcados como TODO antes de ir para produção.
 */
export const site = {
  nome: "Medi Marketing",
  tagline: "A plataforma all-in-one para clínicas e profissionais de saúde",
  descricao:
    "Marketing, atendimento, agenda, CRM, retenção e resultados da sua clínica em um só lugar. Você cuida da medicina, a gente cuida do resto.",
  url: "https://medimarketing.com.br", // TODO: domínio final
  // Lidos de variáveis públicas; fallback para não quebrar em dev sem .env
  whatsapp: process.env.NEXT_PUBLIC_WHATSAPP ?? "5511999999999",
  email: process.env.NEXT_PUBLIC_EMAIL_CONTATO ?? "contato@medimarketing.com.br",
  // TODO: preencher com dados reais
  cnpj: "00.000.000/0001-00",
  endereco: "São Paulo, SP",
  instagram: "https://instagram.com/medimarketing",
} as const;

/** Itens do menu principal (âncoras da landing). */
export const navLinks = [
  { label: "Serviços", href: "#solucoes" },
  { label: "Método", href: "#metodo" },
  { label: "Plataforma", href: "#plataforma" },
  { label: "Automações", href: "#automacoes" },
  { label: "Planos", href: "#planos" },
  { label: "Resultados", href: "#resultados" },
  { label: "FAQ", href: "#faq" },
] as const;
