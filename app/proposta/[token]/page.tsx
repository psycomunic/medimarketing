import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Apresentacao } from "@/components/proposta/apresentacao";
import { getPropostaPorToken } from "@/lib/supabase/propostas";
import { registrarVisualizacao } from "@/lib/actions/propostas";
import { site } from "@/lib/site";

// A contagem de visualizações precisa do pedido real, não de um cache
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { token: string };
}): Promise<Metadata> {
  const p = await getPropostaPorToken(params.token);
  if (!p) return { title: "Proposta" };

  return {
    title: `Proposta para ${p.cliente_nome}`,
    description: `Plano de marketing, atendimento e plataforma preparado para ${p.cliente_nome}.`,
    // Proposta é documento privado: não deve aparecer em busca
    robots: { index: false, follow: false },
  };
}

/**
 * A proposta que o cliente abre.
 *
 * Sem sessão: a autorização é o token do link. Fora da moldura do app
 * de propósito — nada de barra lateral, nada de "entrar". Quem recebe
 * isto está avaliando uma compra, não usando um sistema.
 */
export default async function PropostaPage({
  params,
}: {
  params: { token: string };
}) {
  const proposta = await getPropostaPorToken(params.token);
  if (!proposta) notFound();

  // Falhar aqui não pode impedir a leitura da proposta
  await registrarVisualizacao(params.token).catch(() => {});

  return <Apresentacao proposta={proposta} whatsapp={site.whatsapp} />;
}
