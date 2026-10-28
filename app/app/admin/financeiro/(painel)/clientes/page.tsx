import Link from "next/link";
import { HeartPulse, ShieldAlert, ShieldCheck } from "lucide-react";
import { getAgencia } from "@/lib/supabase/financeiro-dados";
import { getUsuarios } from "@/lib/supabase/usuarios";
import { ROTULO_PLANO, fimFidelidade, riscoDoCliente, vencida } from "@/lib/financeiro/agencia";
import { diasEntre, hojeIso } from "@/lib/financeiro/calculos";
import { Indicador, Painel, Situacao } from "@/components/app/financeiro/ui";
import { reais } from "@/components/graficos/formato";

export const metadata = { title: "Saúde dos clientes · Financeiro da agência" };

export default async function SaudeClientesPage() {
  const [{ contratos, faturas, clientes }, usuarios] = await Promise.all([
    getAgencia(),
    getUsuarios({ organizationId: null, ehSuperAdmin: true }),
  ]);
  const hoje = hojeIso();
  const nome = (id: string) => clientes.find((c) => c.id === id)?.nome ?? "Clínica";

  // Último acesso de qualquer pessoa da clínica
  const ultimoAcesso = new Map<string, string>();
  for (const u of usuarios) {
    if (!u.organization_id || !u.ultimo_acesso) continue;
    const atual = ultimoAcesso.get(u.organization_id);
    if (!atual || u.ultimo_acesso > atual) ultimoAcesso.set(u.organization_id, u.ultimo_acesso);
  }

  const linhas = contratos
    .filter((c) => c.status !== "cancelado")
    .map((c) => {
      const acesso = ultimoAcesso.get(c.organization_id) ?? null;
      const dias = acesso ? diasEntre(acesso.slice(0, 10), hoje) : null;
      return {
        c,
        acesso,
        risco: riscoDoCliente(c, faturas, { diasSemAcesso: dias, retornoCaindo: false }),
        vencido: faturas.filter((f) => f.organization_id === c.organization_id && vencida(f, hoje)).reduce((s, f) => s + Number(f.valor), 0),
      };
    })
    .sort((a, b) => b.risco.pontos - a.risco.pontos);

  const alto = linhas.filter((l) => l.risco.nivel === "alto");
  const medio = linhas.filter((l) => l.risco.nivel === "medio");

  return (
    <div className="grid gap-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Indicador
          icone={ShieldAlert}
          rotulo="Risco alto de saída"
          valor={String(alto.length)}
          nota={alto.length ? `${reais(alto.reduce((s, l) => s + Number(l.c.mensalidade), 0))}/mês em risco` : "Nenhum cliente em risco alto"}
          destaque={alto.length > 0}
        />
        <Indicador icone={HeartPulse} rotulo="Pedem atenção" valor={String(medio.length)} nota="Risco médio" />
        <Indicador icone={ShieldCheck} rotulo="Saudáveis" valor={String(linhas.length - alto.length - medio.length)} nota="Sem sinal de alerta" />
      </div>

      <Painel
        titulo="Saúde de cada cliente"
        descricao="Sinais combinados: fatura vencida, fidelidade acabando, contrato pausado e dias sem entrar no painel."
        corpo="p-0"
      >
        {linhas.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-cinza-suave">Nenhum contrato em vigor.</p>
        ) : (
          <ul className="divide-y divide-border">
            {linhas.map(({ c, acesso, risco, vencido }) => (
              <li key={c.id} className="grid gap-3 px-5 py-4 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto] md:items-center">
                <div className="min-w-0">
                  <Link href={`/app/clinicas/${c.organization_id}`} className="font-medium text-cinza-texto hover:text-teal">
                    {nome(c.organization_id)}
                  </Link>
                  <p className="text-xs text-cinza-suave">
                    {ROTULO_PLANO[c.plano] ?? c.plano} · {reais(Number(c.mensalidade))}/mês · fidelidade até{" "}
                    {c.fidelidade_meses ? new Date(`${fimFidelidade(c)}T12:00:00`).toLocaleDateString("pt-BR") : "—"}
                  </p>
                </div>
                <div className="min-w-0 text-xs text-cinza-suave">
                  {risco.motivos.length ? (
                    <ul className="grid gap-0.5">
                      {risco.motivos.map((m) => (
                        <li key={m} className="flex items-center gap-1.5">
                          <span className="size-1.5 shrink-0 rounded-full bg-[#D97706]" />
                          <span className="truncate">{m}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span>Tudo em dia{acesso ? ` · último acesso ${new Date(acesso).toLocaleDateString("pt-BR")}` : ""}</span>
                  )}
                  {vencido > 0 && <p className="mt-1 font-semibold text-[#B91C1C]">{reais(vencido)} vencido</p>}
                </div>
                <div className="flex items-center gap-3 md:justify-end">
                  <div className="h-2 w-24 overflow-hidden rounded-full bg-[#EEF3F5]" aria-hidden>
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(Math.max(risco.pontos, 4), 100)}%`,
                        background: risco.nivel === "alto" ? "#DC2626" : risco.nivel === "medio" ? "#D97706" : "#16A34A",
                      }}
                    />
                  </div>
                  <Situacao tom={risco.nivel === "alto" ? "critico" : risco.nivel === "medio" ? "atencao" : "bom"}>
                    {risco.nivel === "alto" ? "Risco alto" : risco.nivel === "medio" ? "Atenção" : "Saudável"}
                  </Situacao>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Painel>
    </div>
  );
}
