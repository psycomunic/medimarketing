import { NextResponse, type NextRequest } from "next/server";
import { getSessao } from "@/lib/supabase/queries";
import { getFormularioAdmin } from "@/lib/supabase/formularios";
import {
  linhasMensais,
  linhasTabela,
  numeracao,
  substituirClinica,
  valorMensal,
  valorTexto,
} from "@/lib/formularios/tipos";

/**
 * Exporta um diagnóstico em CSV (uma linha por resposta, tabelas
 * achatadas) ou no JSON bruto. Só para a equipe — a RLS barraria a
 * leitura de qualquer jeito, mas aqui a recusa vem antes de consultar.
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { profile } = await getSessao();
  if (!profile || profile.role !== "super_admin" || !profile.ativo) {
    return new NextResponse("Sem permissão", { status: 403 });
  }

  const d = await getFormularioAdmin(params.id);
  if (!d) return new NextResponse("Não encontrado", { status: 404 });

  const nomeArquivo = `diagnostico-${slugificar(d.clinica)}`;
  const { resposta, modelo } = d;

  if (req.nextUrl.searchParams.get("formato") === "json") {
    const corpo = JSON.stringify(
      {
        clinica: d.clinica,
        modelo: { slug: modelo.slug, versao: modelo.versao },
        status: resposta.status,
        respondente: {
          nome: resposta.respondente_nome,
          cargo: resposta.respondente_cargo,
          data: resposta.data_referencia,
        },
        enviado_em: resposta.enviado_em,
        revisado_em: resposta.revisado_em,
        respostas: resposta.respostas,
      },
      null,
      2
    );
    return new NextResponse(corpo, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${nomeArquivo}.json"`,
      },
    });
  }

  const schema = modelo.schema;
  const r = resposta.respostas;
  const nums = numeracao(schema);
  const linhas: string[][] = [["Etapa", "Nº", "Pergunta", "Resposta"]];

  linhas.push(["", "", "Responsável", resposta.respondente_nome ?? ""]);
  linhas.push(["", "", "Cargo", resposta.respondente_cargo ?? ""]);
  linhas.push(["", "", "Data", resposta.data_referencia ?? ""]);

  schema.etapas.forEach((etapa, i) => {
    const nomeEtapa = `${String(i + 1).padStart(2, "0")} ${etapa.titulo}`;
    for (const campo of etapa.campos) {
      if (campo.tipo === "texto") {
        const anexos = (r.anexos?.[campo.id] ?? []).map((a) => a.nome).join("; ");
        linhas.push([
          nomeEtapa,
          String(nums.get(campo.id) ?? ""),
          substituirClinica(campo.pergunta, d.clinica),
          valorTexto(r, campo.id) + (anexos ? `\n[Anexos: ${anexos}]` : ""),
        ]);
      } else if (campo.tipo === "tabela") {
        for (const l of linhasTabela(r, campo)) {
          for (const c of campo.colunas) {
            linhas.push([nomeEtapa, "", `${l.rotulo} · ${c.titulo}`, l[c.id] ?? ""]);
          }
        }
      } else {
        const v = valorMensal(r, campo);
        for (const l of linhasMensais(schema, r, campo)) {
          (v.linhas[l.chave] ?? []).forEach((valor, mi) => {
            linhas.push([nomeEtapa, "", `${l.rotulo} · ${v.meses[mi] ?? `Mês ${mi + 1}`}`, valor]);
          });
        }
      }
    }
  });

  // BOM: sem ele o Excel abre os acentos como lixo
  const csv = "﻿" + linhas.map((l) => l.map(celulaCsv).join(";")).join("\r\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nomeArquivo}.csv"`,
    },
  });
}

/** Ponto e vírgula: é o separador que o Excel em português espera. */
function celulaCsv(valor: string): string {
  // Fórmula no começo da célula vira comando no Excel; o apóstrofo neutraliza
  const seguro = /^[=+\-@]/.test(valor) ? `'${valor}` : valor;
  return /[;"\r\n]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
}

function slugificar(s: string): string {
  return (
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "clinica"
  );
}
