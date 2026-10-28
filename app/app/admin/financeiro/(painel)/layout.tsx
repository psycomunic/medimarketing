import { Suspense } from "react";
import { Landmark } from "lucide-react";
import { exigirModulo } from "@/lib/acesso";
import { NavFinanceiro } from "@/components/app/financeiro/nav";
import { AvisoInstalacao } from "@/components/app/financeiro/ui";
import { financeiroInstalado } from "@/lib/supabase/financeiro-dados";

const ABAS = [
  { href: "/app/admin/financeiro", rotulo: "Visão geral" },
  { href: "/app/admin/financeiro/contratos", rotulo: "Contratos" },
  { href: "/app/admin/financeiro/faturas", rotulo: "Faturas e cobrança" },
  { href: "/app/admin/financeiro/custos", rotulo: "Custos e margem" },
  { href: "/app/admin/financeiro/clientes", rotulo: "Saúde dos clientes" },
];

export default async function FinanceiroAgenciaLayout({ children }: { children: React.ReactNode }) {
  await exigirModulo("admin-financeiro");
  const instalado = await financeiroInstalado();
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-5 md:px-8 md:py-10">
      <header className="flex items-start gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-azul-medico text-white">
          <Landmark className="size-6" />
        </span>
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl">Financeiro da agência</h1>
          <p className="mt-1 text-cinza-suave">Receita recorrente, contratos, cobrança e quanto cada cliente deixa de margem.</p>
        </div>
      </header>
      <Suspense fallback={<div className="mt-6 h-[104px] rounded-xl border border-border bg-white" />}>
        <NavFinanceiro abas={ABAS} base="/app/admin/financeiro" relatorioHref="/app/admin/financeiro/relatorio" />
      </Suspense>
      <div className="mt-6">
        {!instalado && <AvisoInstalacao />}
        {children}
      </div>
    </div>
  );
}
