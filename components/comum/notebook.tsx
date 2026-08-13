import { cn } from "@/lib/utils";

/**
 * Moldura de notebook em volta de um conteúdo qualquer.
 *
 * Nasceu para dar ao mockup do painel o mesmo peso da foto que está no
 * topo do site: lá o produto aparece numa tela de verdade, e um cartão
 * branco solto ao lado disso parecia rascunho.
 *
 * É CSS, não imagem, de propósito. A foto do site é um arquivo de 150
 * KB com a agenda de agosto de 2026 gravada nos pixels: envelhece,
 * não se adapta ao conteúdo e não dá para ler numa leitura de tela.
 * Aqui a tela é HTML de verdade, nítida em qualquer resolução, e o
 * conteúdo continua sendo texto.
 */
export function Notebook({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("w-full", className)}>
      {/* Tampa */}
      <div className="rounded-t-xl bg-gradient-to-b from-[#2B3A42] to-[#1B262C] p-2 pb-1.5 shadow-card sm:rounded-t-2xl sm:p-2.5">
        {/* Câmera */}
        <div className="mb-1.5 flex justify-center">
          <span className="size-1 rounded-full bg-white/25" />
        </div>
        <div className="overflow-hidden rounded-md bg-white sm:rounded-lg">
          {children}
        </div>
      </div>

      {/* Dobradiça e base, que dão o apoio visual da tampa */}
      <div className="h-1.5 rounded-b-sm bg-gradient-to-b from-[#1B262C] to-[#39474F]" />
      <div className="relative mx-auto h-2.5 w-[103%] rounded-b-xl bg-gradient-to-b from-[#C9D2D7] via-[#AEBAC1] to-[#8E9BA3] shadow-soft sm:h-3">
        {/* Recorte do polegar */}
        <span className="absolute left-1/2 top-0 h-1 w-16 -translate-x-1/2 rounded-b-full bg-[#7E8C94]/60" />
      </div>
    </div>
  );
}
