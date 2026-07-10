import Link from "next/link";
import { cn } from "@/lib/utils";

/** Logotipo textual da Medi Marketing (TODO: substituir por SVG oficial quando houver). */
export function Logo({
  className,
  href = "/",
  light = false,
}: {
  className?: string;
  href?: string;
  light?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn("group inline-flex items-center gap-2.5", className)}
      aria-label="Medi Marketing — página inicial"
    >
      {/* Símbolo: cruz médica em quadrado arredondado */}
      <span className="grid size-9 place-items-center rounded-lg bg-azul-medico shadow-soft transition-transform group-hover:scale-105">
        <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
          <path
            d="M10 3h4v5h5v4h-5v5h-4v-5H5V8h5z"
            fill="#1A9E8F"
          />
        </svg>
      </span>
      <span
        className={cn(
          "font-heading text-lg font-bold leading-none",
          light ? "text-white" : "text-azul-medico"
        )}
      >
        Medi<span className="text-teal">Marketing</span>
      </span>
    </Link>
  );
}
