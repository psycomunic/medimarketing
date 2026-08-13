import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * A foto do painel rodando num notebook, a mesma do topo do site.
 *
 * O recorte é quadrado e ancorado à direita porque o arquivo original
 * é largo, com a marca-d'água ocupando a metade esquerda: num
 * enquadramento panorâmico o notebook fica pequeno e a água aparece.
 *
 * É um arquivo só, reaproveitado: refazer o notebook em CSS dava um
 * desenho parecido, nunca a mesma coisa — e duas versões da mesma
 * imagem envelhecem em ritmos diferentes.
 *
 * O fundo do arquivo é o branco-clínico do site, então sobre fundo
 * claro ele se funde sem emenda. Em fundo escuro precisa do cartão
 * branco em volta, senão aparece um retângulo pálido no meio do azul.
 */
export function FotoPainel({
  emFundoEscuro = false,
  className,
}: {
  emFundoEscuro?: boolean;
  className?: string;
}) {
  const foto = (
    <div className={cn("relative aspect-square w-full", className)}>
      <Image
        src="/BANNER-FUNDO-HEROok.jpg"
        alt="Notebook exibindo a agenda de consultas da plataforma Medi Marketing"
        fill
        sizes="(max-width: 1024px) 100vw, 50vw"
        className="object-cover object-right"
      />
    </div>
  );

  if (!emFundoEscuro) return foto;

  return (
    <div className="overflow-hidden rounded-2xl bg-branco-clinico p-2 shadow-card">
      <div className="overflow-hidden rounded-xl">{foto}</div>
    </div>
  );
}
