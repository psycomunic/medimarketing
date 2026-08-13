import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Logotipo oficial da Medi Marketing.
 *
 * São dois arquivos, não um com filtro: no azul da marca a versão
 * original some, porque o círculo é exatamente o mesmo #0B4F6C do
 * fundo e o "Medi" é da mesma cor. A variante clara troca só esse azul
 * por branco e mantém o teal, que continua legível sobre o escuro.
 *
 * `priority` fica de fora de propósito: a logo aparece no topo de toda
 * página, e marcar tudo como prioritário é o mesmo que não priorizar
 * nada. Quem precisa dela cedo é o hero, que já carrega seu próprio
 * banner com prioridade.
 */
export function Logo({
  className,
  href = "/",
  light = false,
  altura = 36,
}: {
  className?: string;
  href?: string;
  /** Para fundos escuros. */
  light?: boolean;
  /** Altura em pixels. A largura acompanha a proporção. */
  altura?: number;
}) {
  return (
    <Link
      href={href}
      className={cn("inline-flex items-center", className)}
      aria-label="Medi Marketing, página inicial"
    >
      <Image
        src={light ? "/logo-medimarketing-branca.svg" : "/logo-medimarketing.svg"}
        alt="Medi Marketing"
        width={Math.round(altura * 5.76)}
        height={altura}
        style={{ height: altura, width: "auto" }}
        className="transition-opacity hover:opacity-90"
      />
    </Link>
  );
}

/**
 * Só o símbolo, sem o nome escrito.
 *
 * Serve onde o espaço é apertado e o nome já aparece ao lado, como na
 * barra lateral recolhida do painel.
 */
export function LogoSimbolo({
  className,
  tamanho = 36,
}: {
  className?: string;
  tamanho?: number;
}) {
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-full bg-azul-medico",
        className
      )}
      style={{ width: tamanho, height: tamanho }}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" style={{ width: tamanho * 0.6 }}>
        <path d="M10 4h4v6h6v4h-6v6h-4v-6H4v-4h6z" fill="#1A9E8F" />
      </svg>
    </span>
  );
}
