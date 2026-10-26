/** Formatação usada tanto em componentes de servidor quanto de cliente. */

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "2026-07" → "jul/2026". Vazio vira traço. */
export function rotuloMes(valor: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(valor);
  if (!m) return "—";
  return `${MESES[Number(m[2]) - 1] ?? m[2]}/${m[1]}`;
}

export function formatarData(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  return d.toLocaleDateString("pt-BR");
}

export function formatarDataHora(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function tamanhoArquivo(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}
