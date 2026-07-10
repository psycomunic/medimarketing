import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types";

/**
 * Client do Supabase para uso em Client Components (browser).
 * Usa a chave anônima pública — a segurança vem do RLS no banco.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
