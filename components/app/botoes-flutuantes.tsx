"use client";

import { CalendarPlus, FilePlus2, FileSignature, HandCoins, Receipt, Tag, Wallet } from "lucide-react";
import { BotaoFlutuante } from "./botao-flutuante";

/**
 * Botões flutuantes prontos de cada tela. Ficam aqui, do lado do
 * cliente, porque ícone é componente e não atravessa do servidor.
 */

const comMes = (href: string, mes?: string) => `${href}?novo=1${mes ? `&mes=${mes}` : ""}`;

export function FabNovaReceita() {
  return <BotaoFlutuante acoes={[{ rotulo: "Nova receita", icone: HandCoins, evento: "fab:nova-receita" }]} />;
}

export function FabNovaDespesa() {
  return <BotaoFlutuante acoes={[{ rotulo: "Nova despesa", icone: Receipt, evento: "fab:nova-despesa" }]} />;
}

export function FabNovoPreco() {
  return <BotaoFlutuante acoes={[{ rotulo: "Novo preço", icone: Tag, evento: "fab:novo-preco" }]} />;
}

/** Visão geral e fluxo de caixa: lançar sem trocar de aba primeiro. */
export function FabLancamentos({ mes }: { mes?: string }) {
  return (
    <BotaoFlutuante
      rotulo="Lançar"
      acoes={[
        { rotulo: "Nova receita", icone: HandCoins, href: comMes("/app/financeiro/receitas", mes) },
        { rotulo: "Nova despesa", icone: Receipt, href: comMes("/app/financeiro/despesas", mes) },
      ]}
    />
  );
}

export function FabNovaConsulta() {
  return <BotaoFlutuante acoes={[{ rotulo: "Nova consulta", icone: CalendarPlus, evento: "fab:nova-consulta" }]} />;
}

/* ------------------------------ Agência ------------------------------ */

export function FabNovoContrato() {
  return <BotaoFlutuante acoes={[{ rotulo: "Novo contrato", icone: FileSignature, evento: "fab:novo-contrato" }]} />;
}

export function FabCobranca() {
  return <BotaoFlutuante acoes={[{ rotulo: "Cobrança avulsa", icone: FilePlus2, evento: "fab:cobranca-avulsa" }]} />;
}

export function FabNovoCusto() {
  return <BotaoFlutuante acoes={[{ rotulo: "Novo custo", icone: Wallet, evento: "fab:novo-custo" }]} />;
}

export function FabAgencia({ mes }: { mes?: string }) {
  return (
    <BotaoFlutuante
      rotulo="Novo"
      acoes={[
        { rotulo: "Novo contrato", icone: FileSignature, href: comMes("/app/admin/financeiro/contratos", mes) },
        { rotulo: "Cobrança avulsa", icone: FilePlus2, href: comMes("/app/admin/financeiro/faturas", mes) },
        { rotulo: "Novo custo", icone: Wallet, href: comMes("/app/admin/financeiro/custos", mes) },
      ]}
    />
  );
}
