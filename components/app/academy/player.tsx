import { VideoOff } from "lucide-react";
import { urlDeEmbed } from "@/lib/video";

/**
 * Player da aula.
 *
 * Aceita três formatos de link, que é o que a equipe realmente usa:
 * YouTube e Vimeo entram por iframe; arquivo direto (mp4/webm) usa o
 * player nativo do navegador.
 */
export function Player({ url, titulo }: { url: string | null; titulo: string }) {
  if (!url) {
    return (
      <div className="grid aspect-video place-items-center rounded-xl border border-dashed border-border bg-white text-center">
        <div className="px-6">
          <VideoOff className="mx-auto size-10 text-cinza-suave/50" />
          <p className="mt-3 font-semibold text-azul-medico">
            Vídeo ainda não publicado
          </p>
          <p className="mt-1 text-sm text-cinza-suave">
            Esta aula já está na trilha, mas a gravação ainda vai ao ar.
          </p>
        </div>
      </div>
    );
  }

  const embed = urlDeEmbed(url);

  if (embed) {
    return (
      <div className="aspect-video overflow-hidden rounded-xl bg-azul-profundo shadow-card">
        <iframe
          src={embed}
          title={titulo}
          className="size-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
        />
      </div>
    );
  }

  return (
    <video
      controls
      preload="metadata"
      className="aspect-video w-full rounded-xl bg-azul-profundo shadow-card"
    >
      <source src={url} />
      Seu navegador não consegue exibir este vídeo.
    </video>
  );
}
