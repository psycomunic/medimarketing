"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { bloqueio, contexto } from "@/lib/actions/contexto";
import { CAMPOS_IMPORTACAO } from "@/lib/evolucao";

/**
 * Leva os números do diagnóstico para o painel da clínica.
 *
 * Só depois da revisão da equipe: o que chega aqui já foi conferido na
 * tela de importação. Grava os meses em `indicadores_mensais` (o mesmo
 * mês, se já existir, é substituído — reimportar não duplica) e o
 * marco zero com as metas em `planos_cliente`.
 */
const numero = z.number().finite().nonnegative().nullable();
const CAMPOS = CAMPOS_IMPORTACAO.map((c) => c.campo);

const schema = z.object({
  respostaId: z.string().uuid(),
  meses: z
    .array(
      z.object({
        mes: z.string().regex(/^\d{4}-\d{2}-01$/),
        valores: z.record(numero),
        estimados: z.array(z.string()),
        semDado: z.array(z.string()),
        receitas: z.record(z.number().finite().nonnegative()),
      })
    )
    .min(1, "Nenhum mês com data para importar.")
    .max(12),
  /** Comentário da equipe sobre o mês (check-in). Vai para `observacao`. */
  comentario: z.string().max(2000).optional(),
  plano: z.object({
    metaFaturamento: numero,
    metaLeads: numero,
    metaConsultas: numero,
    prazo: z.string().regex(/^\d{4}-\d{2}$/).or(z.literal("")),
    criterio: z.string().max(2000),
    prioridades: z.string().max(2000),
    obstaculo: z.string().max(2000),
    observacoes: z.string().max(4000),
  }).nullable(),
});

export type ImportacaoInput = z.input<typeof schema>;

export type ResultadoImportacao =
  | { ok: true; organizationId: string }
  | { ok: false; erro: string };

export async function importarDiagnostico(input: ImportacaoInput): Promise<ResultadoImportacao> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.errors[0]?.message ?? "Dados inválidos." };
  }

  const ctx = await contexto(["super_admin"]);
  if (ctx.estado !== "ok") {
    const b = bloqueio(ctx);
    return { ok: false, erro: b.ok ? "Sem permissão." : b.erro };
  }

  const d = parsed.data;
  const { data: resposta } = await ctx.supabase
    .from("formularios_respostas")
    .select("id,organization_id,status,referencia")
    .eq("id", d.respostaId)
    .maybeSingle();
  if (!resposta) return { ok: false, erro: "Formulário não encontrado." };
  const org = resposta.organization_id;
  // Check-in (tem mês de referência) só acrescenta o mês; o diagnóstico
  // também define o marco zero e as metas
  const checkin = !!resposta.referencia;

  const inteiro = (v: number | null | undefined) => (v == null ? null : Math.round(v));
  const so = (lista: string[]) => lista.filter((c) => (CAMPOS as string[]).includes(c));

  const linhas = d.meses.map((m) => {
    const v = m.valores;
    return {
      organization_id: org,
      mes: m.mes,
      // Colunas obrigatórias: sem dado grava zero, e `campos_sem_dado` registra
      faturamento: v.faturamento ?? 0,
      investimento: v.investimento ?? 0,
      leads: inteiro(v.leads) ?? 0,
      agendamentos: inteiro(v.agendamentos) ?? 0,
      comparecimentos: inteiro(v.comparecimentos) ?? 0,
      pacientes_unicos: inteiro(v.pacientes_unicos),
      novos_pacientes: inteiro(v.novos_pacientes),
      atendimentos: inteiro(v.atendimentos),
      ticket_medio: v.ticket_medio ?? null,
      gasto_medio_paciente: v.gasto_medio_paciente ?? null,
      receitas_servico: m.receitas,
      origem: checkin ? ("checkin" as const) : ("diagnostico" as const),
      campos_estimados: so(m.estimados),
      campos_sem_dado: so(m.semDado),
      observacao:
        d.comentario?.trim() ||
        (checkin ? "Informado pela clínica no check-in mensal." : "Informado pela clínica no diagnóstico inicial."),
      atualizado_em: new Date().toISOString(),
    };
  });

  const { error: erroMeses } = await ctx.supabase
    .from("indicadores_mensais")
    .upsert(linhas, { onConflict: "organization_id,mes" });
  if (erroMeses) {
    console.error("[evolucao] Erro nos meses:", erroMeses.message);
    return {
      ok: false,
      erro: /column|schema cache/i.test(erroMeses.message)
        ? "O banco ainda não tem as colunas novas. Rode o bloco 2026-10-27 (2) de supabase/atualizacoes.sql."
        : "Não foi possível gravar os meses.",
    };
  }

  const agora = new Date().toISOString();
  await ctx.supabase
    .from("formularios_respostas")
    .update({
      importado_em: agora,
      ...(resposta.status === "enviado"
        ? { status: "revisado" as const, revisado_em: agora, revisado_por: ctx.profile.id }
        : {}),
    })
    .eq("id", resposta.id);

  if (checkin || !d.plano) {
    revalidatePath("/app/indicadores");
    revalidatePath(`/app/clinicas/${org}`);
    return { ok: true, organizationId: org };
  }

  const meses = d.meses.map((m) => m.mes).sort();
  const p = d.plano;
  const { error: erroPlano } = await ctx.supabase.from("planos_cliente").upsert(
    {
      organization_id: org,
      resposta_id: resposta.id,
      base_inicio: meses[0],
      base_fim: meses[meses.length - 1],
      meta_faturamento: p.metaFaturamento,
      meta_leads: inteiro(p.metaLeads),
      meta_consultas: inteiro(p.metaConsultas),
      prazo: p.prazo ? `${p.prazo}-01` : null,
      criterio_financeiro: p.criterio.trim() || null,
      prioridades: p.prioridades.trim() || null,
      obstaculo: p.obstaculo.trim() || null,
      observacoes: p.observacoes.trim() || null,
      importado_em: new Date().toISOString(),
      atualizado_em: new Date().toISOString(),
      atualizado_por: ctx.profile.id,
    },
    { onConflict: "organization_id" }
  );
  if (erroPlano) {
    console.error("[evolucao] Erro no plano:", erroPlano.message);
    return { ok: false, erro: "Os meses foram gravados, mas o plano não. Tente de novo." };
  }

  revalidatePath("/app/indicadores");
  revalidatePath(`/app/clinicas/${org}`);
  revalidatePath("/app/clinicas");
  return { ok: true, organizationId: org };
}
