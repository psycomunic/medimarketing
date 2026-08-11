import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Marca da clínica.
 *
 * Mostra a logo quando ela existe e, sem logo, um monograma com a
 * inicial — nunca um espaço vazio, para o cabeçalho não "quebrar"
 * enquanto o cliente não subiu a imagem.
 *
 * `unoptimized` porque a URL vem do Storage do Supabase, um domínio
 * externo que teria de ser liberado em next.config para o otimizador.
 */
export function MarcaClinica({
  nome,
  logoUrl,
  href,
  tamanho = "md",
  className,
  /** Some com o nome escrito, deixando só a imagem. */
  soImagem = false,
}: {
  nome: string;
  logoUrl: string | null;
  href?: string;
  tamanho?: "sm" | "md" | "lg";
  className?: string;
  soImagem?: boolean;
}) {
  const px = tamanho === "lg" ? 72 : tamanho === "sm" ? 32 : 40;

  const caixa =
    tamanho === "lg" ? "size-18" : tamanho === "sm" ? "size-8" : "size-10";
  const texto =
    tamanho === "lg" ? "text-xl" : tamanho === "sm" ? "text-sm" : "text-base";

  const conteudo = (
    <>
      {logoUrl ? (
        <Image
          src={logoUrl}
          alt={nome}
          width={px}
          height={px}
          unoptimized
          className={cn(
            "shrink-0 rounded-lg object-contain",
            tamanho === "lg" ? "h-18 w-auto max-w-[200px]" : caixa
          )}
        />
      ) : (
        <span
          className={cn(
            "grid shrink-0 place-items-center rounded-lg bg-azul-medico font-heading font-bold text-white",
            caixa,
            texto
          )}
          aria-hidden
        >
          {nome.trim().charAt(0).toUpperCase()}
        </span>
      )}

      {!soImagem && (
        <span
          className={cn(
            "min-w-0 truncate font-heading font-bold leading-tight text-azul-medico",
            texto
          )}
        >
          {nome}
        </span>
      )}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className={cn("inline-flex items-center gap-2.5", className)}
        aria-label={nome}
      >
        {conteudo}
      </Link>
    );
  }

  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      {conteudo}
    </span>
  );
}
