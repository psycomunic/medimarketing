import "server-only";
import { getConsultas } from "@/lib/supabase/queries";
import { getPrecos, getProfissionais, getReceitas } from "@/lib/supabase/financeiro-dados";
import { intervaloDoFiltro, type Filtro, type Intervalo } from "@/lib/inicio/painel";
import { analisarServicos, type AnaliseServicos } from "@/lib/financeiro/servicos-analise";

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Tudo o que a aba Serviços (e a planilha dela) precisa, já filtrado. */
export async function carregarServicos(
  orgId: string | null,
  filtro: Filtro
): Promise<{ analise: AnaliseServicos; intervalo: Intervalo; profissionais: { id: string; nome: string }[]; profissional: string | null }> {
  const agora = new Date();
  const intervalo = intervaloDoFiltro(filtro, agora);
  const { ini, fim, antIni } = intervalo;
  // Receitas: a comparação e 12 meses de série terminando no fim do período
  const ultimoMes = new Date(fim.getTime() - 864e5);
  const inicioSerie = new Date(ultimoMes.getFullYear(), ultimoMes.getMonth() - 11, 1);
  const deReceitas = antIni < inicioSerie ? antIni : inicioSerie;
  // Consultas: o período, mais 90 dias à frente para "voltaram" e agendados
  const deConsultas = ini < agora ? ini : agora;
  const noventa = new Date(agora.getTime() + 90 * 864e5);
  const ateConsultas = fim > noventa ? fim : noventa;

  const [precos, receitas, consultasTodas, profissionais] = await Promise.all([
    getPrecos(orgId),
    getReceitas(orgId, iso(deReceitas), iso(new Date(fim.getTime() - 864e5))),
    getConsultas(deConsultas.toISOString(), ateConsultas.toISOString()),
    getProfissionais(orgId),
  ]);
  const consultas = orgId ? consultasTodas.filter((c) => c.organization_id === orgId) : consultasTodas;
  const prof = filtro.profissional && profissionais.some((p) => p.id === filtro.profissional) ? filtro.profissional : null;
  const doProf = <T extends { medico_id?: string | null }>(lista: T[]) => (prof ? lista.filter((x) => x.medico_id === prof) : lista);

  const analise = analisarServicos({
    precos,
    consultas: doProf(consultas),
    receitas: doProf(receitas),
    ini,
    fim,
    antIni,
    agora,
    nomesProfissionais: Object.fromEntries(profissionais.map((p) => [p.id, p.nome])),
  });
  return { analise, intervalo, profissionais: profissionais.map(({ id, nome }) => ({ id, nome })), profissional: prof };
}
