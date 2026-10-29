"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { importarPacientes, type LinhaImportacao } from "@/lib/actions/pacientes";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Campo = keyof LinhaImportacao;

/** Nomes de coluna que cada sistema costuma usar, já sem acento e em minúsculas. */
const SINONIMOS: Record<Campo, string[]> = {
  nome: ["nome", "paciente", "nome completo", "nome do paciente", "cliente"],
  telefone: ["telefone", "celular", "whatsapp", "fone", "tel", "telefone celular", "contato"],
  email: ["email", "e-mail", "e mail"],
  nascimento: ["nascimento", "data de nascimento", "data nascimento", "dt nascimento", "aniversario"],
  cpf: ["cpf", "documento"],
  cidade: ["cidade", "municipio"],
  convenio: ["convenio", "plano", "plano de saude", "operadora"],
  origem: ["origem", "como conheceu", "canal"],
  observacoes: ["observacoes", "observacao", "obs", "anotacoes", "notas"],
};
const ROTULOS: Record<Campo, string> = {
  nome: "Nome",
  telefone: "Telefone",
  email: "E-mail",
  nascimento: "Nascimento",
  cpf: "CPF",
  cidade: "Cidade",
  convenio: "Convênio",
  origem: "Origem",
  observacoes: "Observações",
};

const normal = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[_.]/g, " ")
    .trim();

/** CSV com vírgula ou ponto e vírgula (o Excel em português usa ;), com aspas. */
function lerCsv(texto: string): string[][] {
  const primeira = texto.split(/\r?\n/, 1)[0] ?? "";
  const sep = (primeira.match(/;/g)?.length ?? 0) > (primeira.match(/,/g)?.length ?? 0) ? ";" : ",";
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

export function ImportarDialog({ organizationId }: { organizationId?: string }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [arquivo, setArquivo] = useState<string | null>(null);
  const [cabecalho, setCabecalho] = useState<string[]>([]);
  const [dados, setDados] = useState<string[][]>([]);
  const [mapa, setMapa] = useState<Partial<Record<Campo, number>>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{ criados: number; repetidos: number; invalidos: number } | null>(null);
  const [pending, startTransition] = useTransition();

  function reiniciar() {
    setArquivo(null);
    setCabecalho([]);
    setDados([]);
    setMapa({});
    setErro(null);
    setResultado(null);
  }

  async function escolher(f: File | undefined) {
    reiniciar();
    if (!f) return;
    if (!/\.(csv|txt)$/i.test(f.name)) return setErro("Salve a planilha como CSV (no Excel: Arquivo › Salvar como › CSV) e envie de novo.");
    const bytes = await f.arrayBuffer();
    // O Excel em português costuma salvar em Windows-1252: se o UTF-8 quebrar, tenta ele
    let texto = new TextDecoder("utf-8").decode(bytes);
    if (texto.includes("�")) texto = new TextDecoder("windows-1252").decode(bytes);
    const linhas = lerCsv(texto.replace(/^﻿/, ""));
    if (linhas.length < 2) return setErro("A planilha precisa de uma linha de títulos e pelo menos um paciente.");
    const cab = linhas[0].map((c) => c.trim());
    const auto: Partial<Record<Campo, number>> = {};
    (Object.keys(SINONIMOS) as Campo[]).forEach((campo) => {
      const i = cab.findIndex((c) => SINONIMOS[campo].includes(normal(c)));
      if (i >= 0) auto[campo] = i;
    });
    setArquivo(f.name);
    setCabecalho(cab);
    setDados(linhas.slice(1));
    setMapa(auto);
  }

  const linhas: LinhaImportacao[] = dados.map((l) => {
    const o: Record<string, string> = {};
    (Object.keys(mapa) as Campo[]).forEach((campo) => {
      const i = mapa[campo];
      if (i !== undefined && l[i]?.trim()) o[campo] = l[i].trim();
    });
    return o as LinhaImportacao;
  });
  const validas = linhas.filter((l) => (l.nome ?? "").trim().length >= 2).length;

  function importar() {
    setErro(null);
    startTransition(async () => {
      const r = await importarPacientes(linhas, organizationId);
      if (!r.ok) return setErro(r.erro);
      setResultado(r);
      router.refresh();
    });
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setAberto(true)}>
        <Upload className="size-4" /> Importar planilha
      </Button>
      <Dialog
        open={aberto}
        onOpenChange={(o) => {
          setAberto(o);
          if (!o) reiniciar();
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Importar pacientes</DialogTitle>
            <DialogDescription>
              Envie um CSV com uma linha de títulos (Nome, Telefone, E-mail, Nascimento…). Quem já tem ficha com o mesmo
              telefone é ignorado, e os importados entram sem consentimento de marketing.
            </DialogDescription>
          </DialogHeader>

          {resultado ? (
            <div className="grid justify-items-center gap-3 py-6 text-center">
              <CheckCircle2 className="size-12 text-teal" />
              <p className="font-heading text-lg font-semibold text-azul-medico">
                {resultado.criados} paciente{resultado.criados === 1 ? "" : "s"} importado{resultado.criados === 1 ? "" : "s"}
              </p>
              <p className="text-sm text-cinza-suave">
                {resultado.repetidos} já tinha{resultado.repetidos === 1 ? "" : "m"} ficha · {resultado.invalidos} linha
                {resultado.invalidos === 1 ? "" : "s"} sem nome válido
              </p>
              <Button variant="marca" onClick={() => setAberto(false)}>
                Concluir
              </Button>
            </div>
          ) : (
            <div className="grid gap-4">
              <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-border bg-branco-clinico px-4 py-6 text-center hover:border-teal">
                <FileSpreadsheet className="size-8 text-teal" />
                <span className="text-sm font-medium text-azul-medico">{arquivo ?? "Escolher arquivo CSV"}</span>
                <span className="text-xs text-cinza-suave">{arquivo ? `${dados.length} linhas encontradas` : "Exporte do Excel, Google Planilhas ou do sistema antigo"}</span>
                <input type="file" accept=".csv,.txt,text/csv" className="sr-only" onChange={(e) => escolher(e.target.files?.[0])} />
              </label>

              {cabecalho.length > 0 && (
                <>
                  <div>
                    <p className="text-sm font-medium text-cinza-texto">Qual coluna é cada informação?</p>
                    <div className="mt-2 grid gap-2 sm:grid-cols-3">
                      {(Object.keys(ROTULOS) as Campo[]).map((campo) => (
                        <label key={campo} className="grid gap-1 text-xs text-cinza-suave">
                          {ROTULOS[campo]}
                          {campo === "nome" && <span className="sr-only">(obrigatório)</span>}
                          <select
                            value={mapa[campo] ?? ""}
                            onChange={(e) =>
                              setMapa((m) => {
                                const n = { ...m };
                                if (e.target.value === "") delete n[campo];
                                else n[campo] = Number(e.target.value);
                                return n;
                              })
                            }
                            className="h-9 rounded-md border border-input bg-white px-2 text-sm text-cinza-texto"
                          >
                            <option value="">— não importar —</option>
                            {cabecalho.map((c, i) => (
                              <option key={i} value={i}>
                                {c || `Coluna ${i + 1}`}
                              </option>
                            ))}
                          </select>
                        </label>
                      ))}
                    </div>
                  </div>

                  {mapa.nome !== undefined && (
                    <div className="overflow-x-auto rounded-lg border border-border">
                      <table className="w-full min-w-[520px] text-left text-xs">
                        <thead className="bg-branco-clinico text-cinza-suave">
                          <tr>
                            {(Object.keys(mapa) as Campo[]).map((c) => (
                              <th key={c} className="px-3 py-2 font-medium">
                                {ROTULOS[c]}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {linhas.slice(0, 5).map((l, i) => (
                            <tr key={i}>
                              {(Object.keys(mapa) as Campo[]).map((c) => (
                                <td key={c} className="max-w-[180px] truncate px-3 py-2 text-cinza-texto">
                                  {l[c] ?? "—"}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}

              {erro && <p className="rounded-md bg-coral/10 px-3 py-2 text-sm text-coral">{erro}</p>}

              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-cinza-suave">
                  {cabecalho.length ? (mapa.nome === undefined ? "Escolha qual coluna tem o nome." : `${validas} paciente${validas === 1 ? "" : "s"} prontos para importar.`) : ""}
                </p>
                <Button variant="marca" onClick={importar} disabled={pending || mapa.nome === undefined || !validas}>
                  {pending && <Loader2 className="size-4 animate-spin" />}
                  Importar {validas ? validas : ""}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
