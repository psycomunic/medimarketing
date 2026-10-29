import { NextResponse } from "next/server";
import { getSessao } from "@/lib/supabase/queries";
import { podeAcessar } from "@/lib/rbac";
import { getDespesas, getProfissionais, getReceitas } from "@/lib/supabase/financeiro-dados";
import { bruto, liquido, rotuloCategoria } from "@/lib/financeiro/calculos";
import { rotuloFormaPagamento, rotuloStatusLancamento } from "@/lib/rotulos";

/**
 * Planilha do mês para o contador: receitas e despesas num CSV que abre
 * direto no Excel (separador ";" e BOM para os acentos).
 */
export async function GET(req: Request) {
  const { profile, organizacao } = await getSessao();
  if (!profile || !podeAcessar(profile.role, "financeiro")) {
    return NextResponse.json({ erro: "Sem acesso." }, { status: 403 });
  }
  const url = new URL(req.url);
  const mes = /^\d{4}-\d{2}$/.test(url.searchParams.get("mes") ?? "") ? url.searchParams.get("mes")! : new Date().toISOString().slice(0, 7);
  const [a, m] = mes.split("-").map(Number);
  const de = `${mes}-01`;
  const ate = `${mes}-${String(new Date(a, m, 0).getDate()).padStart(2, "0")}`;
  const orgId = organizacao?.id ?? null;
  const [receitas, despesas, profissionais] = await Promise.all([getReceitas(orgId, de, ate), getDespesas(orgId, de, ate), getProfissionais(orgId)]);
  const nomes = Object.fromEntries(profissionais.map((p) => [p.id, p.nome]));

  const cel = (v: unknown) => {
    const t = v == null ? "" : String(v);
    return /[";\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const num = (v: number) => v.toFixed(2).replace(".", ",");
  const dataBr = (iso: string | null | undefined) => (iso ? iso.split("-").reverse().join("/") : "");

  const linhas: string[] = [];
  linhas.push(["Tipo", "Data", "Descrição", "Paciente / fornecedor", "Categoria", "Forma de pagamento", "Convênio", "Profissional", "Situação", "Data do pagamento", "Valor bruto", "Desconto", "Taxa", "Glosa", "Valor líquido"].join(";"));
  for (const l of receitas.filter((x) => x.status !== "cancelado")) {
    linhas.push(
      [
        "Receita",
        dataBr(l.data_competencia),
        l.procedimento,
        l.paciente_nome,
        l.categoria ?? "",
        rotuloFormaPagamento[l.forma_pagamento],
        l.convenio ?? "",
        l.medico_id ? nomes[l.medico_id] ?? "" : "",
        rotuloStatusLancamento[l.status],
        dataBr(l.data_recebimento),
        num(Number(l.valor)),
        num(Number(l.desconto ?? 0)),
        num(Number(l.taxa ?? 0)),
        num(Number(l.glosa ?? 0)),
        num(liquido(l)),
      ]
        .map(cel)
        .join(";")
    );
  }
  for (const d of despesas.filter((x) => x.status !== "cancelada")) {
    linhas.push(
      [
        "Despesa",
        dataBr(d.vencimento),
        d.descricao,
        d.fornecedor ?? "",
        rotuloCategoria(d.categoria),
        d.forma_pagamento ?? "",
        "",
        "",
        d.status === "paga" ? "Paga" : "A pagar",
        dataBr(d.pago_em),
        num(-Number(d.valor)),
        "0,00",
        "0,00",
        "0,00",
        num(-Number(d.valor)),
      ]
        .map(cel)
        .join(";")
    );
  }
  const totalReceitas = receitas.filter((x) => x.status !== "cancelado").reduce((s, l) => s + bruto(l), 0);
  const totalDespesas = despesas.filter((x) => x.status !== "cancelada").reduce((s, d) => s + Number(d.valor), 0);
  linhas.push("");
  linhas.push(["Total de receitas", "", "", "", "", "", "", "", "", "", num(totalReceitas)].map(cel).join(";"));
  linhas.push(["Total de despesas", "", "", "", "", "", "", "", "", "", num(-totalDespesas)].map(cel).join(";"));

  const nome = `financeiro-${(organizacao?.nome ?? "clinica").normalize("NFD").replace(/[^\w]+/g, "-").toLowerCase()}-${mes}.csv`;
  return new NextResponse("﻿" + linhas.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nome}"`,
    },
  });
}
