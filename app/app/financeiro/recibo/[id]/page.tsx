import { notFound } from "next/navigation";
import { exigirModulo } from "@/lib/acesso";
import { emModoDemo } from "@/lib/supabase/queries";
import { createClient } from "@/lib/supabase/server";
import { demoReceitas } from "@/lib/demo-financeiro";
import { bruto } from "@/lib/financeiro/calculos";
import { reaisPorExtenso } from "@/lib/financeiro/extenso";
import { rotuloFormaPagamento } from "@/lib/rotulos";
import { reais } from "@/components/graficos/formato";
import { Documento, SecaoDoc } from "@/components/relatorio/documento";
import type { Lancamento } from "@/lib/supabase/types";

export const metadata = { title: "Recibo" };

export default async function ReciboPage({ params }: { params: { id: string } }) {
  const { organizacao } = await exigirModulo("financeiro");
  let l: Lancamento | null = null;
  if (await emModoDemo()) {
    l = demoReceitas().find((x) => x.id === params.id) ?? null;
  } else {
    const supabase = await createClient();
    const { data } = await supabase.from("lancamentos").select("*").eq("id", params.id).maybeSingle();
    l = (data as Lancamento | null) ?? null;
  }
  if (!l || l.status === "cancelado") notFound();

  const valor = bruto(l);
  const data = new Date(`${l.data_recebimento ?? l.data_competencia}T12:00:00`);
  const numero = l.id.replace(/[^0-9a-f]/gi, "").slice(0, 8).toUpperCase();
  const cidade = organizacao?.cidade ?? "";
  const linhaClinica = [organizacao?.cnpj ? `CNPJ ${organizacao.cnpj}` : null, organizacao?.endereco, organizacao?.telefone].filter(Boolean).join(" · ");

  return (
    <Documento
      titulo="Recibo"
      subtitulo={`Nº ${numero}`}
      marca={{ nome: organizacao?.nome ?? "Clínica", logoUrl: organizacao?.logo_url ?? null }}
      emitidoPara={linhaClinica || undefined}
      voltar={{ href: `/app/financeiro/receitas?mes=${l.data_competencia.slice(0, 7)}`, rotulo: "Voltar às receitas" }}
      nomeArquivo={`Recibo ${l.paciente_nome} ${numero}`}
    >
      <div className="doc-bloco flex items-center justify-between gap-4 rounded-xl border-2 border-azul-medico/80 px-6 py-5">
        <p className="text-sm uppercase tracking-wide text-cinza-suave">Valor recebido</p>
        <p className="font-heading text-3xl font-bold tabular-nums text-azul-medico">{reais(valor, true)}</p>
      </div>

      <SecaoDoc titulo="Declaração">
        <p className="text-[15px] leading-8 text-cinza-texto">
          Recebemos de <strong>{l.paciente_nome}</strong> a importância de <strong>{reais(valor, true)}</strong> (
          {reaisPorExtenso(valor)}), referente a <strong>{l.procedimento}</strong>, realizado em{" "}
          {new Date(`${l.data_competencia}T12:00:00`).toLocaleDateString("pt-BR")}, pago via{" "}
          {l.forma_pagamento === "convenio" ? `convênio ${l.convenio ?? ""}`.trim() : l.forma_pagamento === "pix" ? "Pix" : rotuloFormaPagamento[l.forma_pagamento].toLowerCase()}
          {Number(l.parcelas ?? 1) > 1 ? ` em ${l.parcelas} parcelas` : ""}.
        </p>
        <p className="mt-2 text-[15px] leading-8 text-cinza-texto">Para clareza, firmamos o presente recibo.</p>
      </SecaoDoc>

      <div className="doc-bloco mt-6 grid gap-10 sm:grid-cols-2">
        <p className="text-sm text-cinza-texto">
          {cidade ? `${cidade}, ` : ""}
          {data.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" })}.
        </p>
        <div className="text-center">
          <div className="mx-auto mt-10 w-64 border-t border-cinza-texto/60" />
          <p className="mt-2 text-sm font-semibold text-cinza-texto">{organizacao?.nome ?? "Clínica"}</p>
          {organizacao?.responsavel && <p className="text-xs text-cinza-suave">{organizacao.responsavel}</p>}
        </div>
      </div>
    </Documento>
  );
}
