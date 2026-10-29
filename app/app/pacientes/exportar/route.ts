import { NextResponse } from "next/server";
import { getSessao } from "@/lib/supabase/queries";
import { getTodosPacientes } from "@/lib/supabase/pacientes";
import { nomeOrigem } from "@/lib/rotulos";

/**
 * Planilha com todos os pacientes ativos, que abre direto no Excel
 * (separador ";" e BOM para os acentos). Só o dono exporta: é a base
 * inteira de dados pessoais da clínica saindo do sistema.
 */
export async function GET() {
  const { profile } = await getSessao();
  if (!profile || (profile.role !== "gestor" && profile.role !== "super_admin")) {
    return NextResponse.json({ erro: "Só o dono da clínica pode exportar os pacientes." }, { status: 403 });
  }
  const lista = await getTodosPacientes();

  const cel = (v: unknown) => {
    const t = v == null ? "" : String(v);
    return /[";\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const data = (iso: string | null) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "");
  const num = (v: number) => v.toFixed(2).replace(".", ",");

  const linhas = [
    [
      "Nome",
      "Telefone",
      "E-mail",
      "Nascimento",
      "CPF",
      "Cidade",
      "Convênio",
      "Como conheceu",
      "Etiquetas",
      "Consultas realizadas",
      "Faltas",
      "Primeira consulta",
      "Última consulta",
      "Próxima consulta",
      "Total gasto",
      "Aceita campanhas",
    ].join(";"),
    ...lista.map((p) =>
      [
        p.nome,
        p.telefone,
        p.email,
        data(p.nascimento),
        p.cpf,
        p.cidade,
        p.convenio,
        p.origem ? nomeOrigem(p.origem) : "",
        p.tags.join(", "),
        p.consultas_realizadas,
        p.faltas,
        data(p.primeira_consulta),
        data(p.ultima_consulta),
        data(p.proxima_consulta),
        num(p.total_gasto),
        p.descadastrado_em ? "Não (descadastrado)" : p.consentimento_marketing ? "Sim" : "Não",
      ]
        .map(cel)
        .join(";")
    ),
  ];

  const hoje = new Date().toISOString().slice(0, 10);
  return new NextResponse("﻿" + linhas.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="pacientes-${hoje}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
