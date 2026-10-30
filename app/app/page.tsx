import { exigirSessao } from "@/lib/acesso";
import { dadosAgencia, dadosClinica } from "@/lib/inicio/dados";
import { getProfissionais } from "@/lib/supabase/financeiro-dados";
import { lerFiltro } from "@/lib/inicio/painel";
import { InicioAgencia } from "@/components/app/inicio/inicio-agencia";
import { InicioAtendente, InicioGestor, InicioMedico } from "@/components/app/inicio/inicio-clinica";

/**
 * Início: cada papel abre o sistema com uma pergunta diferente.
 * - Agência: quais clientes pedem atenção e como vai a carteira.
 * - Dono da clínica: como vão o dia e o mês, e o que resolver.
 * - Atendente: a fila do dia e a lista do que fazer.
 * - Médico: quem vem a seguir.
 */
export default async function InicioPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const { profile, organizacao, role } = await exigirSessao();

  if (role === "super_admin") {
    const dados = await dadosAgencia();
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-5 md:px-8 md:py-10">
        <InicioAgencia profile={profile} dados={dados} />
      </div>
    );
  }

  const [dados, profissionais] = await Promise.all([
    dadosClinica(role, profile, organizacao, lerFiltro(searchParams)),
    getProfissionais(organizacao?.id ?? null),
  ]);
  const nomes = Object.fromEntries(profissionais.map((p) => [p.id, p.nome]));

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-5 md:px-8 md:py-10">
      {role === "gestor" ? (
        <InicioGestor profile={profile} org={organizacao} dados={dados} nomes={nomes} />
      ) : role === "medico" ? (
        <InicioMedico profile={profile} org={organizacao} dados={dados} />
      ) : (
        <InicioAtendente profile={profile} org={organizacao} dados={dados} nomes={nomes} />
      )}
    </div>
  );
}
