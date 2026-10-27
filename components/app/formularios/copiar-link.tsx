"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * O link que a equipe manda para a clínica.
 *
 * Quem tem o link preenche sem conta — por isso ele aparece só aqui,
 * para a equipe, e o texto do WhatsApp já vem pronto para colar.
 */
export function CopiarLink({ url, clinica }: { url: string; clinica: string }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      window.prompt("Copie o link:", url);
    }
  }

  const mensagem = encodeURIComponent(
    `Olá! Segue o questionário de diagnóstico da ${clinica}. Dá para preencher pelo celular, aos poucos: as respostas ficam salvas automaticamente. ${url}`
  );

  return (
    <div className="grid gap-2">
      <p className="break-all rounded-md bg-branco-clinico px-3 py-2 font-mono text-xs text-cinza-texto">
        {url}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={copiar}>
          {copiado ? <Check /> : <Copy />}
          {copiado ? "Copiado" : "Copiar link"}
        </Button>
        <Button asChild variant="outline" size="sm">
          <a href={`https://wa.me/?text=${mensagem}`} target="_blank" rel="noopener noreferrer">
            <MessageCircle /> WhatsApp
          </a>
        </Button>
        <Button asChild variant="ghost" size="sm">
          <a href={url} target="_blank" rel="noopener noreferrer">
            <ExternalLink /> Abrir
          </a>
        </Button>
      </div>
      <p className="text-xs text-cinza-suave">
        Quem tiver o link preenche sem login. Envie só para a clínica.
      </p>
    </div>
  );
}
