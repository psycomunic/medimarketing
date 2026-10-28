import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Banner do topo da visão geral. A imagem entra na proporção em que foi
 * feita (sem corte), porque é comum o texto vir dentro da arte.
 */
export function BannerClinica({
  url,
  link,
  nome,
  className,
}: {
  url: string;
  link?: string | null;
  nome: string;
  className?: string;
}) {
  const imagem = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={`Banner de ${nome}`}
      className="block h-auto max-h-72 w-full object-cover"
    />
  );
  const classe = cn(
    "block overflow-hidden rounded-2xl border border-border bg-branco-clinico shadow-soft",
    link && "transition-all hover:-translate-y-0.5 hover:shadow-card",
    className
  );

  if (!link) return <div className={classe}>{imagem}</div>;
  if (link.startsWith("/")) {
    return (
      <Link href={link} className={classe}>
        {imagem}
      </Link>
    );
  }
  return (
    <a href={link} target="_blank" rel="noopener noreferrer" className={classe}>
      {imagem}
    </a>
  );
}
