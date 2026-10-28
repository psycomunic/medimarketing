import { HandCoins, Percent, Users } from "lucide-react";
import { exigirModulo } from "@/lib/acesso";
import { emModoDemo } from "@/lib/supabase/queries";
import { getProfissionais, getReceitas, getRegrasRepasse, getRepasses } from "@/lib/supabase/financeiro-dados";
import { bruto, calcularRepasses, mesCurto, ultimosMeses, validos } from "@/lib/financeiro/calculos";
import { BarrasAgrupadas } from "@/components/graficos/graficos";
import { SERIES, pct, reais } from "@/components/graficos/formato";
import { Indicador, Painel, limites, mesDaUrl } from "@/components/app/financeiro/ui";
import { TabelaRepasses, type LinhaRepasseTela } from "@/components/app/financeiro/repasses-ui";

export const metadata = { title: "Repasses · Financeiro" };

export default async function RepassesPage({ searchParams }: { searchParams: { mes?: string } }) {
  const { organizacao } = await exigirModulo("financeiro");
  const orgId = organizacao?.id ?? null;
  const mes = mesDaUrl(searchParams.mes);
  const meses = ultimosMeses(mes, 6);
  const { ate } = limites(mes);
  const [receitas, regras, fechados, profissionais, demo] = await Promise.all([
    getReceitas(orgId, `${meses[0]}-01`, ate),
    getRegrasRepasse(orgId),
    getRepasses(orgId, `${mes}-01`),
    getProfissionais(orgId),
    emModoDemo(),
  ]);

  const nomes = Object.fromEntries(profissionais.map((p) => [p.id, p.nome]));
  const doMes = receitas.filter((l) => l.data_competencia.startsWith(mes));
  const calculados = calcularRepasses(doMes, regras);
  const ids = new Set([...profissionais.map((p) => p.id), ...calculados.map((c) => c.medicoId)]);
  const linhas: LinhaRepasseTela[] = [...ids]
    .map((id) => {
      const c = calculados.find((x) => x.medicoId === id);
      return {
        medicoId: id,
        nome: nomes[id] ?? "Profissional",
        atendimentos: c?.atendimentos ?? 0,
        base: c?.base ?? 0,
        valor: c?.valor ?? 0,
        regra: regras.find((r) => r.medico_id === id) ?? null,
        fechado: fechados.find((f) => f.medico_id === id) ?? null,
      };
    })
    .sort((a, b) => b.valor - a.valor);

  const total = linhas.reduce((s, l) => s + (l.fechado ? Number(l.fechado.valor) : l.valor), 0);
  const faturamento = validos(doMes).reduce((s, l) => s + bruto(l), 0);
  const pagos = linhas.filter((l) => l.fechado?.status === "pago").reduce((s, l) => s + Number(l.fechado!.valor), 0);

  return (
    <div className="grid gap-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Indicador icone={HandCoins} rotulo="Repasse do mês" valor={reais(total)} nota={`${reais(pagos)} já pago`} destaque />
        <Indicador icone={Percent} rotulo="Repasse sobre o faturamento" valor={pct(faturamento ? (total / faturamento) * 100 : 0, 1)} nota={`Faturamento de ${reais(faturamento)}`} />
        <Indicador icone={Users} rotulo="Profissionais com regra" valor={`${regras.length} de ${linhas.length}`} nota={regras.length < linhas.length ? "Defina a regra dos demais" : "Todos configurados"} />
      </div>

      <TabelaRepasses linhas={linhas} competencia={`${mes}-01`} demo={demo} />

      <Painel titulo="Repasse nos últimos 6 meses" descricao="Pela regra atual de cada profissional.">
        <BarrasAgrupadas
          categorias={meses.map(mesCurto)}
          barras={profissionais.slice(0, 5).map((p, i) => ({
            nome: p.nome,
            cor: SERIES[[1, 3, 0, 5, 4][i % 5]],
            valores: meses.map(
              (m) => calcularRepasses(receitas.filter((l) => l.data_competencia.startsWith(m)), regras).find((x) => x.medicoId === p.id)?.valor ?? 0
            ),
          }))}
          destaque={meses.length - 1}
          altura={240}
        />
      </Painel>
    </div>
  );
}
