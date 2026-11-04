import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Executa em todas as rotas, exceto:
     * arquivos estáticos, imagens e o favicon.
     */
    "/((?!_next/static|_next/image|favicon.svg|sw.js|manifest.webmanifest|offline.html|icones-app/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
