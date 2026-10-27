/** Transforma "Clínica Vida Derma" em "clinica-vida-derma". */
export function gerarSlug(nome: string): string {
  const semAcento = [...nome.toLowerCase().normalize("NFD")]
    .filter((c) => {
      const cod = c.codePointAt(0) ?? 0;
      return cod < 0x0300 || cod > 0x036f;
    })
    .join("");

  return semAcento
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50) || "clinica";
}
