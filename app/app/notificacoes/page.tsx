import { Bell } from "lucide-react";
import { ListaNotificacoes } from "@/components/app/notificacoes/lista";
import { exigirSessao } from "@/lib/acesso";
import { emModoDemo } from "@/lib/supabase/queries";
import { getNotificacoes, resumirNotificacoes } from "@/lib/supabase/notificacoes";

export const metadata = { title: "Notificações" };

// O contador muda a cada visita: nada de cache
export const dynamic = "force-dynamic";

export default async function NotificacoesPage() {
  const { profile } = await exigirSessao();
  const [notificacoes, demo] = await Promise.all([
    getNotificacoes(profile),
    emModoDemo(),
  ]);

  const r = resumirNotificacoes(notificacoes);

  return (
    <div className="mx-auto max-w-3xl px-5 py-8 md:px-8 md:py-10">
      <header className="flex items-start gap-4">
        <span className="relative grid size-12 shrink-0 place-items-center rounded-xl bg-verde-menta text-teal">
          <Bell className="size-6" />
          {r.naoLidas > 0 && (
            <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-coral px-1.5 text-[10px] font-bold text-white">
              {r.naoLidas > 99 ? "99+" : r.naoLidas}
            </span>
          )}
        </span>
        <div>
          <h1 className="text-2xl md:text-3xl">Notificações</h1>
          <p className="mt-1 max-w-xl text-cinza-suave">
            {r.naoLidas === 0
              ? "Tudo visto. Os avisos aparecem aqui assim que algo acontece."
              : r.urgentes > 0
                ? `${r.urgentes} ${r.urgentes === 1 ? "aviso urgente" : "avisos urgentes"} de ${r.naoLidas} não ${r.naoLidas === 1 ? "lido" : "lidos"}.`
                : `${r.naoLidas} ${r.naoLidas === 1 ? "aviso não lido" : "avisos não lidos"}.`}
          </p>
        </div>
      </header>

      <div className="mt-8">
        <ListaNotificacoes notificacoes={notificacoes} demo={demo} />
      </div>
    </div>
  );
}
