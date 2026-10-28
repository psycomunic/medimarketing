import { ArrowDownRight, ArrowUpRight, Database, Minus } from "lucide-react";
import { Minigrafico } from "@/components/graficos/graficos";
import { cn } from "@/lib/utils";

/** Cartão de seção com título, descrição e ação à direita. */
export function Painel({
  titulo,
  descricao,
  acao,
  children,
  className,
  corpo = "p-5",
}: {
  titulo?: string;
  descricao?: React.ReactNode;
  acao?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  corpo?: string;
}) {
  return (
    <section className={cn("min-w-0 rounded-xl border border-border bg-white shadow-soft", className)}>
      {titulo && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2 className="font-heading text-base font-semibold text-azul-medico">{titulo}</h2>
            {descricao && <p className="mt-0.5 text-sm text-cinza-suave">{descricao}</p>}
          </div>
          {acao && <div className="flex shrink-0 flex-wrap items-center gap-2">{acao}</div>}
        </header>
      )}
      <div className={corpo}>{children}</div>
    </section>
  );
}

/**
 * Indicador principal: valor grande, comparação com o mês anterior e a
 * tendência dos últimos meses. `inverter` para custos (subir é ruim).
 */
export function Indicador({
  rotulo,
  valor,
  variacao,
  inverter = false,
  nota,
  serie,
  cor,
  destaque = false,
  icone: Icone,
}: {
  rotulo: string;
  valor: string;
  variacao?: number | null;
  inverter?: boolean;
  nota?: React.ReactNode;
  serie?: number[];
  cor?: string;
  destaque?: boolean;
  icone?: React.ComponentType<{ className?: string }>;
}) {
  const bom = variacao == null ? null : inverter ? variacao <= 0 : variacao >= 0;
  const Seta = variacao == null || Math.abs(variacao) < 0.5 ? Minus : variacao > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col justify-between rounded-xl border p-4 shadow-soft",
        destaque ? "border-azul-medico bg-azul-medico text-white" : "border-border bg-white"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className={cn("flex min-w-0 items-center gap-1.5 text-xs font-medium", destaque ? "text-white/75" : "text-cinza-suave")}>
          {Icone && <Icone className={cn("size-3.5 shrink-0", destaque ? "text-white/75" : "text-teal")} />}
          <span className="truncate">{rotulo}</span>
        </p>
        {variacao != null && (
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
              destaque
                ? "bg-white/15 text-white"
                : bom
                  ? "bg-[#E9F8EF] text-[#15803D]"
                  : "bg-[#FDECEC] text-[#B91C1C]"
            )}
            title="Comparado ao mês anterior"
          >
            <Seta className="size-3" />
            {Math.abs(variacao).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
          </span>
        )}
      </div>
      <p
        className={cn(
          "mt-3 font-heading text-[22px] font-bold leading-none tabular-nums tracking-tight",
          destaque ? "text-white" : "text-azul-medico"
        )}
      >
        {valor}
      </p>
      <div className="mt-2 flex min-h-7 items-end justify-between gap-3">
        {nota ? (
          <p className={cn("min-w-0 text-xs leading-snug", destaque ? "text-white/75" : "text-cinza-suave")}>{nota}</p>
        ) : (
          <span />
        )}
        {serie && serie.length > 1 && (
          <div className="shrink-0 opacity-90">
            <Minigrafico valores={serie} cor={destaque ? "#9ED9D0" : cor} largura={64} altura={26} />
          </div>
        )}
      </div>
    </div>
  );
}

/** Pílula de situação com cor e texto (nunca só cor). */
export function Situacao({ tom, children }: { tom: "bom" | "atencao" | "critico" | "neutro" | "info"; children: React.ReactNode }) {
  const cores = {
    bom: "bg-[#E9F8EF] text-[#15803D]",
    atencao: "bg-[#FEF4E2] text-[#B45309]",
    critico: "bg-[#FDECEC] text-[#B91C1C]",
    neutro: "bg-[#EEF2F4] text-cinza-suave",
    info: "bg-verde-menta text-teal",
  };
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold", cores[tom])}>
      <span className="size-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}

export function Vazio({ titulo, children, acao }: { titulo: string; children?: React.ReactNode; acao?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-branco-clinico px-6 py-10 text-center">
      <p className="font-medium text-azul-medico">{titulo}</p>
      {children && <p className="mt-1 max-w-md text-sm text-cinza-suave">{children}</p>}
      {acao && <div className="mt-4">{acao}</div>}
    </div>
  );
}

export function AvisoInstalacao() {
  return (
    <div className="mb-6 flex items-start gap-3 rounded-xl border border-alerta/40 bg-[#FFF8EB] px-4 py-3 text-sm text-cinza-texto">
      <Database className="mt-0.5 size-4 shrink-0 text-alerta" />
      <p>
        <strong>Falta instalar o financeiro completo.</strong> Rode o bloco “Financeiro completo” do arquivo
        supabase/atualizacoes.sql no Supabase. Até lá, só as receitas aparecem.
      </p>
    </div>
  );
}

/** Mês da URL (YYYY-MM) ou o atual. */
export function mesDaUrl(bruto?: string): string {
  if (bruto && /^\d{4}-(0[1-9]|1[0-2])$/.test(bruto)) return bruto;
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function limites(mes: string) {
  const [a, m] = mes.split("-").map(Number);
  return { de: `${mes}-01`, ate: `${mes}-${String(new Date(a, m, 0).getDate()).padStart(2, "0")}` };
}
