"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Atualiza o contador de notificações sem recarregar a página.
 *
 * Escuta as notificações novas pelo Realtime do Supabase. A RLS vale
 * aqui também: só chega o que esta pessoa pode ver. Ao chegar uma, o
 * servidor é consultado de novo (router.refresh) e o número da barra
 * lateral se acerta sozinho — sem contar nada no navegador.
 */
export function NotificacoesAoVivo() {
  const router = useRouter();
  const espera = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const canal = supabase
      .channel("notificacoes-novas")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notificacoes" },
        () => {
          // Várias de uma vez (ex.: resumo do dia) viram uma atualização só
          if (espera.current) clearTimeout(espera.current);
          espera.current = setTimeout(() => router.refresh(), 800);
        }
      )
      .subscribe();

    return () => {
      if (espera.current) clearTimeout(espera.current);
      supabase.removeChannel(canal);
    };
  }, [router]);

  return null;
}
