/**
 * CSV com vírgula, ponto e vírgula (o Excel em português usa ;) ou
 * tabulação (o "CSV para Excel" do Google Ads), com aspas. O separador é o
 * mais frequente nas primeiras linhas: relatórios de anúncios começam com
 * uma linha de título sem separador nenhum.
 */
export function lerCsv(bruto: string): string[][] {
  const texto = bruto.replace(/^﻿/, "");
  const amostra = texto.split(/\r?\n/, 10).join("\n");
  const conta = (c: string) => amostra.split(c).length - 1;
  const sep = [";", ",", "\t"].sort((a, b) => conta(b) - conta(a))[0];
  const linhas: string[][] = [];
  let linha: string[] = [];
  let campo = "";
  let aspas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (aspas) {
      if (c === '"' && texto[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (c === '"') aspas = false;
      else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === sep) {
      linha.push(campo);
      campo = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && texto[i + 1] === "\n") i++;
      linha.push(campo);
      if (linha.some((x) => x.trim())) linhas.push(linha);
      linha = [];
      campo = "";
    } else campo += c;
  }
  linha.push(campo);
  if (linha.some((x) => x.trim())) linhas.push(linha);
  return linhas;
}

/** Lê o arquivo respeitando UTF-16 (exportação "Excel" do Google Ads), UTF-8 e Latin-1. */
export async function textoDoArquivo(arquivo: File): Promise<string> {
  const bytes = new Uint8Array(await arquivo.arrayBuffer());
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder("utf-16le").decode(bytes);
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder("utf-16be").decode(bytes);
  const utf8 = new TextDecoder("utf-8").decode(bytes);
  // Arquivo em Latin-1 (Excel antigo): os acentos viram "�"
  return utf8.includes("�") ? new TextDecoder("windows-1252").decode(bytes) : utf8;
}
