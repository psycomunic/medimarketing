import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * O painel rodando num notebook, em foto com fundo transparente.
 *
 * A transparência é o que dispensa a faixa clara que existia aqui
 * antes: o aparelho flutua direto sobre o azul, sem retângulo pálido
 * nem moldura. E o ajuste é `contain`, então ele aparece inteiro —
 * cortar o notebook para caber era o defeito da versão anterior.
 *
 * Some abaixo de `lg` porque em tela estreita não sobra largura para
 * dividir com o texto, e um notebook espremido não prova nada.
 */
export function FotoPainel({ className }: { className?: string }) {
  return (
    <div className={cn("relative", className)}>
      <Image
        src="/mockup-laptopsemfundo.png"
        alt="Notebook exibindo a agenda de consultas da plataforma Medi Marketing"
        width={1000}
        height={667}
        priority
        className="max-h-[68vh] w-full object-contain drop-shadow-2xl"
      />
    </div>
  );
}
