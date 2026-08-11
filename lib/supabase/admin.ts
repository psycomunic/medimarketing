import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

/**
 * Client de SERVICE ROLE — ignora RLS por completo.
 *
 * É o único caminho para criar usuário, trocar senha de outra pessoa ou
 * ler o e-mail de alguém (que vive em `auth.users`, fora do alcance da
 * chave publicável).
 *
 * Três regras que não podem ser quebradas:
 *
 * 1. `import "server-only"` no topo: se algum componente de cliente tentar
 *    importar este arquivo, o build quebra em vez de vazar a chave.
 * 2. A variável é `SUPABASE_SERVICE_ROLE_KEY`, sem `NEXT_PUBLIC_`. Prefixo
 *    público embutiria o segredo no bundle do navegador.
 * 3. Como a RLS não vale aqui, TODA action que usa este client precisa
 *    conferir papel e clínica do solicitante na mão. Não existe rede de
 *    proteção do banco neste caminho.
 */
export function adminDisponivel(): boolean {
  return (
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export function createAdminClient() {
  if (!adminDisponivel()) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY ausente: a gestão de usuários precisa dela."
    );
  }

  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        // Client de serviço não tem sessão para guardar nem renovar
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
