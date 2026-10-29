"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Clock, Wallet } from "lucide-react";
import { lerPagamentoConsulta, type PagamentoDaConsulta } from "@/lib/actions/financeiro";
import { bruto } from "@/lib/financeiro/calculos";
import { rotuloFormaPagamento } from "@/lib/rotulos";
import { reais } from "@/components/graficos/formato";
import { Button } from "@/components/ui/button";
import { RecebimentoDialog } from "./receitas-ui";

/**
 * Pagamento dentro da ficha da consulta: é no balcão que o paciente
 * paga, e é a atendente quem está com a ficha aberta. Ela registra
 * aqui sem precisar entrar no financeiro (que não enxerga).
 */
export function PagamentoConsulta({
  consultaId,
  valor,
  convenio,
  demo,
}: {
  consultaId: string;
  valor: number | null;
  convenio: string | null;
  demo: boolean;
}) {
  const [dados, setDados] = useState<PagamentoDaConsulta | null>(null);
  const [aberto, setAberto] = useState(false);
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    let vivo = true;
    lerPagamentoConsulta(consultaId).then((d) => vivo && setDados(d));
    return () => {
      vivo = false;
    };
  }, [consultaId, versao]);

  if (!dados?.podeRegistrar) return null;
  const l = dados.lancamento;
  const recebido = l?.status === "recebido";
  const convenioReal = convenio && convenio.toLowerCase() !== "particular" ? convenio : null;

  return (
    <div className="border-t border-border pt-4">
      <h3 className="mb-2.5 flex items-center gap-2 text-sm font-semibold text-azul-medico">
        <Wallet className="size-4 text-teal" /> Pagamento
      </h3>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-branco-clinico px-4 py-3">
        {recebido && l ? (
          <p className="flex items-center gap-2 text-sm text-cinza-texto">
            <CheckCircle2 className="size-4 shrink-0 text-[#15803D]" />
            <span>
              <strong className="text-[#15803D]">Pago</strong> · {reais(bruto(l), true)} em {rotuloFormaPagamento[l.forma_pagamento]}
              {l.data_recebimento ? ` · ${new Date(`${l.data_recebimento}T12:00:00`).toLocaleDateString("pt-BR")}` : ""}
            </span>
          </p>
        ) : (
          <p className="flex items-center gap-2 text-sm text-cinza-texto">
            <Clock className="size-4 shrink-0 text-[#B45309]" />
            <span>
              {l ? (
                <>
                  <strong>A receber</strong> · {reais(bruto(l), true)}
                  {l.forma_pagamento === "convenio" ? ` · ${l.convenio ?? "convênio"}` : ""}
                </>
              ) : valor ? (
                <>
                  <strong>A receber</strong> · {reais(valor, true)}
                </>
              ) : (
                "Sem valor cadastrado nesta consulta"
              )}
            </span>
          </p>
        )}
        <Button type="button" variant={recebido ? "ghost" : "marca"} size="sm" onClick={() => setAberto(true)} disabled={demo}>
          {recebido ? "Corrigir" : "Registrar pagamento"}
        </Button>
      </div>
      {aberto && (
        <RecebimentoDialog
          aberto
          lancamento={l}
          consultaId={l ? undefined : consultaId}
          valorSugerido={valor}
          convenioSugerido={convenioReal}
          demo={demo}
          onFechar={() => {
            setAberto(false);
            setVersao((v) => v + 1);
          }}
        />
      )}
    </div>
  );
}
