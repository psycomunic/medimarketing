import { HandCoins, Receipt } from "lucide-react";
import type { Fatura, Repasse } from "@/lib/supabase/types";
import { mesLongo } from "@/lib/financeiro/calculos";
import { reais } from "@/components/graficos/formato";
import { Situacao } from "./ui";

const dataBr = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR");

/** Repasses do próprio profissional, em Meu perfil. */
export function MeusRepasses({ repasses }: { repasses: Repasse[] }) {
  return (
    <section className="mt-6 rounded-xl border border-border bg-white shadow-soft">
      <header className="flex items-start gap-3 border-b border-border px-6 py-4">
        <HandCoins className="mt-0.5 size-5 shrink-0 text-teal" />
        <div>
          <h2 className="text-lg font-semibold text-azul-medico">Meus repasses</h2>
          <p className="mt-0.5 text-sm text-cinza-suave">O que a clínica fechou de repasse para você a cada mês.</p>
        </div>
      </header>
      {repasses.length === 0 ? (
        <p className="px-6 py-8 text-center text-sm text-cinza-suave">Nenhum repasse fechado ainda.</p>
      ) : (
        <ul className="divide-y divide-border">
          {repasses.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-3 px-6 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium capitalize text-cinza-texto">{mesLongo(r.competencia.slice(0, 7))}</p>
                <p className="text-xs text-cinza-suave">
                  {r.atendimentos} atendimentos · base {reais(Number(r.base))}
                </p>
              </div>
              {r.status === "pago" ? (
                <Situacao tom="bom">Pago {r.pago_em ? dataBr(r.pago_em) : ""}</Situacao>
              ) : (
                <Situacao tom="atencao">A receber</Situacao>
              )}
              <p className="w-28 text-right font-heading text-base font-bold tabular-nums text-azul-medico">{reais(Number(r.valor), true)}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Faturas da clínica com a Medi Marketing, para o gestor. */
export function MinhasFaturas({ faturas }: { faturas: Fatura[] }) {
  const hoje = new Date().toISOString().slice(0, 10);
  const visiveis = faturas.filter((f) => f.status !== "cancelada").slice(0, 12);
  return (
    <section className="min-w-0 rounded-xl border border-border bg-white shadow-soft">
      <header className="flex items-start gap-3 border-b border-border px-5 py-4">
        <Receipt className="mt-0.5 size-5 shrink-0 text-teal" />
        <div>
          <h2 className="font-heading text-base font-semibold text-azul-medico">Sua assinatura Medi Marketing</h2>
          <p className="mt-0.5 text-sm text-cinza-suave">Mensalidades e cobranças da agência.</p>
        </div>
      </header>
      {visiveis.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-cinza-suave">Nenhuma fatura por aqui.</p>
      ) : (
        <ul className="divide-y divide-border">
          {visiveis.map((f) => (
            <li key={f.id} className="flex items-center gap-3 px-5 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-cinza-texto">
                  {f.descricao} · <span className="capitalize">{mesLongo(f.competencia.slice(0, 7))}</span>
                </p>
                <p className="text-xs text-cinza-suave">Vence {dataBr(f.vencimento)}</p>
              </div>
              {f.status === "paga" ? (
                <Situacao tom="bom">Paga</Situacao>
              ) : f.vencimento < hoje ? (
                <Situacao tom="critico">Vencida</Situacao>
              ) : (
                <Situacao tom="neutro">Em aberto</Situacao>
              )}
              <p className="w-24 text-right text-sm font-semibold tabular-nums text-azul-medico">{reais(Number(f.valor))}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
