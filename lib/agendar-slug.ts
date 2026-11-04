/**
 * Pedaços legíveis dos endereços de agendamento:
 * /agendar/instituto-correr/dr-fulano/quiropraxia
 */
export function slugAgenda(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
