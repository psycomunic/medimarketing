import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient, adminDisponivel } from "@/lib/supabase/admin";
import { estruturaPronta } from "@/lib/supabase/confirmacoes";
import { rodarRotina } from "@/lib/comunicacao/rotina";

/**
 * ROTINA DE COMUNICAÇÃO — chamada a cada 10 minutos pelo Supabase.
 *
 * O agendamento mora no próprio banco (pg_cron + pg_net, ver
 * supabase/atualizacoes.sql), porque o plano gratuito da Vercel só
 * aceita um cron por dia. O segredo da chamada fica em
 * `config_interna`, que só a service role lê: o banco manda, a rota
 * confere no mesmo lugar, e nenhuma variável de ambiente nova é preciso.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function autorizado(req: NextRequest): Promise<boolean> {
  const recebido = req.headers.get("authorization");
  if (!recebido) return !process.env.CRON_SECRET && !!req.headers.get("x-vercel-cron");
  if (process.env.CRON_SECRET && recebido === `Bearer ${process.env.CRON_SECRET}`) return true;

  const { data } = await createAdminClient()
    .from("config_interna")
    .select("valor")
    .eq("chave", "cron_segredo")
    .maybeSingle();
  return !!data?.valor && recebido === `Bearer ${data.valor}`;
}

export async function GET(req: NextRequest) {
  if (!adminDisponivel()) {
    return NextResponse.json({ erro: "SUPABASE_SERVICE_ROLE_KEY ausente" }, { status: 503 });
  }
  if (!(await autorizado(req))) {
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  }

  const estrutura = await estruturaPronta();
  if (!estrutura.pronta) {
    return NextResponse.json({ ok: false, erro: estrutura.motivo }, { status: 503 });
  }

  const relatorio = await rodarRotina();
  return NextResponse.json({ ok: true, em: new Date().toISOString(), ...relatorio });
}
