/**
 * Conversão do link de vídeo colado pelo admin em URL de embed.
 *
 * Vive em lib/ (e não junto do player) para poder ser usado tanto pelo
 * componente de servidor que exibe a aula quanto pelo formulário de
 * cadastro, que é client, sem arrastar JSX para o bundle do navegador.
 *
 * Devolve null quando o link não é de um serviço conhecido — nesse caso
 * o player tenta tocar como arquivo direto (mp4/webm).
 */
export function urlDeEmbed(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");

    if (host === "youtube.com" || host === "m.youtube.com") {
      const id = u.searchParams.get("v");
      if (id) return `https://www.youtube.com/embed/${id}`;
      // Formatos /embed/ID e /shorts/ID
      const m = u.pathname.match(/\/(embed|shorts)\/([\w-]+)/);
      if (m) return `https://www.youtube.com/embed/${m[2]}`;
    }

    if (host === "youtu.be") {
      const id = u.pathname.slice(1);
      if (id) return `https://www.youtube.com/embed/${id}`;
    }

    if (host === "vimeo.com") {
      const id = u.pathname.split("/").filter(Boolean)[0];
      if (id && /^\d+$/.test(id)) return `https://player.vimeo.com/video/${id}`;
    }

    if (host === "player.vimeo.com" || host === "youtube-nocookie.com") {
      return url;
    }
  } catch {
    return null;
  }

  return null;
}

/** O link aponta para um arquivo de vídeo que o navegador toca direto? */
export function ehArquivoDeVideo(url: string): boolean {
  return /\.(mp4|webm|ogg|mov)(\?|$)/i.test(url);
}
