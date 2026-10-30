import { Suspense } from "react";
import { Wallet } from "lucide-react";
import { exigirModulo } from "@/lib/acesso";
import { NavFinanceiro } from "@/components/app/financeiro/nav";
import { AvisoInstalacao } from "@/components/app/financeiro/ui";
import { financeiroInstalado } from "@/lib/supabase/financeiro-dados";

const ABAS = [
  { href: "/app/financeiro", rotulo: "Visão geral" },
  { href: "/app/financeiro/receitas", rotulo: "Receitas" },
  // Tem filtro próprio de período (atalhos, datas e profissional)
  { href: "/app/financeiro/servicos", rotulo: "Serviços", semMes: true },
  { href: "/app/financeiro/despesas", rotulo: "Despesas" },
  // Projeção para a frente, com horizonte próprio (30 a 180 dias)
  { href: "/app/financeiro/caixa", rotulo: "Fluxo de caixa", semMes: true },
  { href: "/app/financeiro/historico", rotulo: "Histórico de caixa", semMes: true },
  { href: "/app/financeiro/convenios", rotulo: "Convênios" },
  // Repasse fecha mês a mês
  { href: "/app/financeiro/repasses", rotulo: "Repasses", soMes: true },
  { href: "/app/financeiro/resultado", rotulo: "Resultado (DRE)" },
  { href: "/app/financeiro/configuracoes", rotulo: "Preços e taxas" },
];

export default async function FinanceiroLayout({ children }: { children: React.ReactNode }) {
  const { organizacao } = await exigirModulo("financeiro");
  const instalado = await financeiroInstalado();

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-5 md:px-8 md:py-10 print:p-0">
      <header className="flex items-start gap-4 print:hidden">
        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-verde-menta text-teal">
          <Wallet className="size-6" />
        </span>
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl">Financeiro</h1>
          <p className="mt-1 text-cinza-suave">
            {organizacao?.nome ? `${organizacao.nome} · ` : ""}quanto entra, quanto sai e quanto sobra.
          </p>
        </div>
      </header>
      <Suspense fallback={<div className="mt-6 h-[104px] rounded-xl border border-border bg-white" />}>
        <NavFinanceiro abas={ABAS} base="/app/financeiro" relatorioHref="/app/financeiro/relatorio" exportarHref="/app/financeiro/exportar" intervalos />
      </Suspense>
      <div className="mt-6">
        {!instalado && <AvisoInstalacao />}
        {children}
      </div>
    </div>
  );
}
