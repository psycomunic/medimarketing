import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "./types";
import { DEMO_COOKIE, papelDemoValido } from "@/lib/demo";

type CookieItem = { name: string; value: string; options?: CookieOptions };

/**
 * Atualiza a sessão do Supabase em cada requisição e protege as rotas
 * da área do médico (`/app`). Chamado pelo middleware raiz.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  /**
   * MODO DEMONSTRAÇÃO — vale mesmo com o Supabase configurado.
   *
   * O cookie sozinho libera o painel, porque a demonstração comercial
   * roda em produção e a visita não tem conta. Não há risco de vazar
   * dado real: com o cookie, a sessão inteira vem do `lib/demo` e as
   * actions que escrevem param em `contexto()`.
   */
  const temDemo =
    papelDemoValido(request.cookies.get(DEMO_COOKIE)?.value) !== null;

  if (temDemo) {
    if (request.nextUrl.pathname === "/login") {
      const url = request.nextUrl.clone();
      url.pathname = "/app";
      return NextResponse.redirect(url);
    }
    return response;
  }

  // Sem Supabase configurado e sem demonstração: só resta barrar /app.
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    const { pathname: p } = request.nextUrl;
    if (p.startsWith("/app")) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("redirect", p);
      return NextResponse.redirect(url);
    }
    return response;
  }

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieItem[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Protege a área logada
  if (!user && pathname.startsWith("/app")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  // Usuário logado tentando acessar /login → manda para o painel
  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/app";
    return NextResponse.redirect(url);
  }

  return response;
}
