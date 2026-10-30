import { NextResponse } from "next/server";
import { getSessao } from "@/lib/supabase/queries";
import { podeAcessar } from "@/lib/rbac";
import { lerFiltro } from "@/lib/inicio/painel";
import { carregarServicos } from "@/lib/financeiro/servicos-dados";

/** Planilha da aba Serviços, com o mesmo filtro da tela. */
export async function GET(req: Request) {
  const { profile, organizacao } = await getSessao();
  if (!profile || !podeAcessar(profile.role, "financeiro")) {
    return NextResponse.json({ erro: "Sem acesso." }, { status: 403 });
  }
  const url = new URL(req.url);
  const filtro = lerFiltro(Object.fromEntries(url.searchParams.entries()));
  const { analise, intervalo } = await carregarServicos(organizacao?.id ?? null, filtro);

  const cel = (v: unknown) => {
    const t = v == null ? "" : String(v);
    return /[";\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const num = (v: number | null, casas = 2) => (v == null ? "" : v.toFixed(casas).replace(".", ","));

  const linhas: string[] = [];
  linhas.push(
    [
      "Serviço",
      "Categoria",
      "Preço na tabela",
      "Consultas marcadas",
      "Realizadas",
      "Faltas",
      "Canceladas",
      "Taxa de faltas (%)",
      "Faturamento",
      "Do total (%)",
      "Variação (%)",
      "Atendimentos cobrados",
      "Ticket real",
      "Custo",
      "Margem (%)",
      "Pacientes novos",
      "Voltaram",
      "Agendado 30 dias",
      "Valor agendado",
    ].join(";")
  );
  for (const l of analise.linhas) {
    linhas.push(
      [
        l.nome,
        l.categoria ?? "",
        l.precoTabela ?? "",
        l.marcadas,
        l.realizadas,
        l.faltas,
        l.canceladas,
        num(l.taxaFaltas, 1),
        num(l.faturamento),
        num(l.participacao, 1),
        num(l.variacao, 1),
        l.atendimentos,
        num(l.ticket),
        num(l.custo),
        num(l.margem, 1),
        l.novos,
        l.voltaram,
        l.futuras,
        num(l.valorFuturo),
      ]
        .map(cel)
        .join(";")
    );
  }

  const nome = intervalo.titulo.replace(/^Faturamento d[eoa]s? /, "").replace(/[^\w-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return new NextResponse(`﻿${linhas.join("\r\n")}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="servicos-${nome || "periodo"}.csv"`,
    },
  });
}
