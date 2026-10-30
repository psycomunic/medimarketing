import "server-only";
import { adminDisponivel, createAdminClient } from "@/lib/supabase/admin";
import { rotuloTipo } from "@/lib/agenda";
import { TAXAS_PADRAO } from "@/lib/financeiro/calculos";
import type { FormaPagamento, TipoConsulta } from "@/lib/supabase/types";

/**
 * AGENDA → FINANCEIRO
 *
 * Toda consulta com valor vira uma receita prevista, sem ninguém
 * digitar nada: é o que faz o financeiro ter número de verdade. A
 * receita é sempre a mesma linha (uma por consulta), atualizada quando
 * a consulta muda.
 *
 * - Marcada ou remarcada: receita prevista na data da consulta.
 * - Cancelada: receita cancelada (sai de todas as contas).
 * - O pagamento é registrado à parte, na ficha da consulta.
 *
 * Roda com a service role porque a atendente marca consultas, mas não
 * escreve no financeiro diretamente. Falhar aqui nunca desfaz a
 * consulta: o pior caso é a receita ser lançada à mão.
 */
export async function sincronizarReceita(consultaId: string): Promise<void> {
  if (!adminDisponivel()) return;
  try {
    const admin = createAdminClient();
    const { data: c } = await admin
      .from("consultas")
      // "*": as colunas de serviço só existem depois do SQL
      .select("*")
      .eq("id", consultaId)
      .maybeSingle();
    if (!c?.organization_id) return;

    const { data: existente } = await admin
      .from("lancamentos")
      .select("id,status")
      .eq("consulta_id", consultaId)
      .maybeSingle();

    const valor = Number(c.valor ?? 0);
    const convenio = c.convenio && c.convenio.toLowerCase() !== "particular" ? c.convenio : null;
    const competencia = new Date(c.data_hora).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

    // Falta não é cobrada: sai das contas como o cancelamento
    if (c.status === "cancelada" || c.status === "faltou") {
      if (existente && existente.status !== "recebido") {
        await admin.from("lancamentos").update({ status: "cancelado" }).eq("id", existente.id);
      }
      return;
    }

    // Sem valor e sem convênio, não há o que cobrar (ex.: retorno)
    if (!existente && valor <= 0 && !convenio) return;

    // Com serviço, a receita leva o nome, a categoria e o custo direto da tabela
    const servico = c.servico_id
      ? (await admin.from("tabela_precos").select("procedimento,categoria,custo").eq("id", c.servico_id).maybeSingle()).data
      : null;
    const nomeServico: string | null = c.servico_nome?.trim() || servico?.procedimento || null;
    const procedimento = nomeServico
      ? c.motivo?.trim()
        ? `${nomeServico} · ${c.motivo.trim()}`
        : nomeServico
      : c.motivo?.trim()
        ? `${rotuloTipo[c.tipo as TipoConsulta]} · ${c.motivo.trim()}`
        : rotuloTipo[c.tipo as TipoConsulta];

    const forma: FormaPagamento = convenio ? "convenio" : "pix";
    const base = {
      organization_id: c.organization_id,
      consulta_id: c.id,
      medico_id: c.medico_id,
      paciente_nome: c.paciente_nome,
      procedimento: procedimento.slice(0, 120),
      categoria: servico?.categoria?.trim() || "Consultas",
      // Só quando a consulta já tem a coluna: banco sem o SQL segue como antes
      ...("servico_id" in c && { servico_id: c.servico_id ?? null }),
      ...(servico && { custo: Number(servico.custo) || 0 }),
      valor,
      convenio,
      data_competencia: competencia,
      origem: "agenda" as const,
      atualizado_em: new Date().toISOString(),
    };

    if (existente) {
      // Não mexe no que já foi recebido: o caixa daquele dia já fechou
      if (existente.status === "recebido") return;
      await admin
        .from("lancamentos")
        .update({ ...base, status: existente.status === "cancelado" ? "previsto" : existente.status })
        .eq("id", existente.id);
    } else {
      await admin.from("lancamentos").insert({
        custo: 0,
        ...base,
        forma_pagamento: forma,
        status: "previsto",
        data_recebimento: null,
        observacao: null,
        taxa: Math.round(valor * (TAXAS_PADRAO[forma] ?? 0)) / 100,
      });
    }
  } catch (e) {
    console.error("[financeiro] Falha ao sincronizar receita da consulta:", e);
  }
}
