"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Abre o "Salvar como PDF" do navegador com o nome do arquivo já
 * sugerido: o título da aba vira o nome do PDF.
 */
export function BotaoPdf({ nomeArquivo, rotulo = "Baixar PDF" }: { nomeArquivo: string; rotulo?: string }) {
  return (
    <Button
      type="button"
      variant="marca"
      size="sm"
      onClick={() => {
        const antes = document.title;
        document.title = nomeArquivo;
        const voltar = () => {
          document.title = antes;
          window.removeEventListener("afterprint", voltar);
        };
        window.addEventListener("afterprint", voltar);
        window.print();
      }}
    >
      <Download className="size-4" /> {rotulo}
    </Button>
  );
}
