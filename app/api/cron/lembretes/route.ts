import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient, adminDisponivel } from "@/lib/supabase/admin";
import { estruturaPronta } from "@/lib/supabase/confirmacoes";
import { whatsappConfigurado } from "@/lib/envio";
import { mergeConfigurado } from "@/lib/merge";
import { rodarRotina } from "@/lib/comunicacao/rotina";
import { gerarCheckinsDoMes } from "@/lib/formularios/periodico";

/**
 * ROTINA DIÁRIA — chamada pelo Vercel Cron (ver vercel.json).
 *
 * Os lembretes e avisos agora rodam a cada 10 minutos pela rotina de
 * comunicação (/api/cron/comunicacao, agendada no Supabase). Esta
 * passada diária roda o mesmo motor de reserva — se o agendamento do
 * banco parar, os lembretes ainda saem uma vez por dia — e cuida do
 * que é mensal: o check-in das clínicas.
 *
 * Rodar as duas no mesmo minuto não duplica nada: cada mensagem tem uma
 * chave única na fila de envios.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function autorizado(req: NextRequest): boolean {
  const segredo = process.env.CRON_SECRET;

  // Sem segredo configurado, só aceitamos a chamada do próprio Vercel Cron
  if (!segredo) return !!req.headers.get("x-vercel-cron");

  return req.headers.get("authorization") === `Bearer ${segredo}`;
}

export async function GET(req: NextRequest) {
  if (!autorizado(req)) {
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  }
  if (!adminDisponivel()) {
    return NextResponse.json(
      { erro: "SUPABASE_SERVICE_ROLE_KEY ausente" },
      { status: 503 }
    );
  }

  // Falha ruidosa: sem a estrutura no banco, a rotina não pode responder
  // "0 enviados" como se estivesse tudo bem.
  const estrutura = await estruturaPronta();
  if (!estrutura.pronta) {
    console.error("[cron/lembretes] Estrutura ausente:", estrutura.motivo);
    return NextResponse.json({ ok: false, erro: estrutura.motivo }, { status: 503 });
  }

  let comunicacao: Awaited<ReturnType<typeof rodarRotina>> | { erro: string };
  try {
    comunicacao = await rodarRotina();
  } catch (e) {
    console.error("[cron/comunicacao]", e instanceof Error ? e.message : e);
    comunicacao = { erro: "falhou" };
  }

  // Check-in mensal: isolado — uma falha aqui não pode impedir o
  // paciente de receber a confirmação
  let checkins: { criados: number; falhas: number } | { erro: string };
  try {
    checkins = await gerarCheckinsDoMes(createAdminClient());
  } catch (e) {
    console.error("[cron/checkin]", e instanceof Error ? e.message : e);
    checkins = { erro: "falhou" };
  }

  return NextResponse.json({
    ok: true,
    em: new Date().toISOString(),
    canalAutomatico: mergeConfigurado()
      ? "merge (número da própria clínica)"
      : whatsappConfigurado()
        ? "whatsapp (número da plataforma)"
        : "nenhum (envio manual pelo painel)",
    comunicacao,
    checkins,
  });
}
