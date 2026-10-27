import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { notificar } from "@/lib/supabase/notificacoes";
import { SLUG_CHECKIN } from "@/lib/formularios/checkin-mensal";
import type { Database } from "@/lib/supabase/types";

/**
 * CHECK-IN MENSAL
 *
 * Um por clínica por mês, para quem já tem marco zero no painel. A
 * rotina diária cria o do mês que acabou de fechar; a equipe também pode
 * gerar na hora pelo detalhe do cliente. Criar de novo o mesmo mês não
 * duplica: devolve o que já existe.
 *
 * Roda com a service role (a rotina não tem sessão). Quem chama confere
 * a permissão antes.
 */

type Admin = SupabaseClient<Database>;

/** O mês que acabou de fechar: "2026-10" no meio de novembro. */
export function mesAnterior(hoje = new Date()): string {
  const d = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Caminho público de um formulário: check-in e diagnóstico têm o seu. */
export function caminhoPublico(r: { token: string; referencia?: string | null }): string {
  return `${r.referencia ? "/checkin" : "/diagnostico"}/${r.token}`;
}

export type ResultadoCheckin =
  | { ok: true; id: string; token: string; criado: boolean }
  | { ok: false; erro: string };

export async function criarCheckin(
  admin: Admin,
  organizationId: string,
  referencia: string,
  autorId: string | null
): Promise<ResultadoCheckin> {
  const { data: modelo } = await admin
    .from("formularios_modelos")
    .select("id")
    .eq("slug", SLUG_CHECKIN)
    .eq("ativo", true)
    .order("versao", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!modelo) return { ok: false, erro: "O modelo do check-in mensal não está no banco." };

  const { data: existente } = await admin
    .from("formularios_respostas")
    .select("id,token")
    .eq("organization_id", organizationId)
    .eq("modelo_id", modelo.id)
    .eq("referencia", referencia)
    .maybeSingle();
  if (existente) return { ok: true, id: existente.id, token: existente.token, criado: false };

  // Os serviços do último mês lançado já vêm na tabela de receitas:
  // a clínica só preenche os valores
  const { data: ultimo } = await admin
    .from("indicadores_mensais")
    .select("receitas_servico")
    .eq("organization_id", organizationId)
    .order("mes", { ascending: false })
    .limit(1)
    .maybeSingle();
  const servicos = Object.keys(ultimo?.receitas_servico ?? {});

  const { data: criado, error } = await admin
    .from("formularios_respostas")
    .insert({
      modelo_id: modelo.id,
      organization_id: organizationId,
      referencia,
      respostas: {
        indicadores: { meses: [referencia], linhas: {} },
        receitas: servicos.map((rotulo) => ({ rotulo, valor: "" })),
      },
    })
    .select("id,token")
    .single();
  if (error || !criado) {
    console.error("[checkin] Não criou:", error?.message);
    return { ok: false, erro: "Não foi possível criar o check-in." };
  }

  await admin
    .from("formularios_eventos")
    .insert({ resposta_id: criado.id, autor_id: autorId, tipo: "liberado" });

  await notificar({
    organizationId,
    tipo: "sistema",
    titulo: "Check-in do mês disponível",
    descricao: "Informe os números do mês para acompanhar a evolução desde o diagnóstico.",
    href: caminhoPublico({ token: criado.token, referencia }),
    entidadeId: criado.id,
    papeis: ["gestor", "medico"],
  });

  return { ok: true, id: criado.id, token: criado.token, criado: true };
}

/**
 * Passada da rotina diária: cria o check-in do mês que fechou para cada
 * clínica ativa com marco zero. Idempotente — no dia seguinte, quem já
 * tem não ganha outro.
 */
export async function gerarCheckinsDoMes(admin: Admin): Promise<{ criados: number; falhas: number }> {
  const referencia = mesAnterior();
  const { data: planos } = await admin
    .from("planos_cliente")
    .select("organization_id,base_fim,importado_em")
    .not("importado_em", "is", null);

  const { data: orgs } = await admin.from("organizations").select("id").eq("ativo", true);
  const ativas = new Set((orgs ?? []).map((o) => o.id));

  let criados = 0;
  let falhas = 0;
  for (const p of planos ?? []) {
    if (!ativas.has(p.organization_id)) continue;
    // O mês ainda faz parte do marco zero: não há o que perguntar
    if (p.base_fim && p.base_fim.slice(0, 7) >= referencia) continue;
    const res = await criarCheckin(admin, p.organization_id, referencia, null);
    if (!res.ok) falhas++;
    else if (res.criado) criados++;
  }
  return { criados, falhas };
}
