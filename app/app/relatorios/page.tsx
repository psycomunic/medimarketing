import { redirect } from "next/navigation";

// A antiga tela de "Relatórios" virou o módulo Indicadores.
// Mantido como redirecionamento para não quebrar links salvos.
export default function RelatoriosPage() {
  redirect("/app/indicadores");
}
