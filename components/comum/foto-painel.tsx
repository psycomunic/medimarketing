import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * O painel rodando num notebook, em foto com fundo transparente.
 *
 * A transparência é o que dispensa a faixa clara que existia aqui
 * antes: o aparelho flutua direto sobre o azul, inteiro, sem corte.
 *
 * A máscara em degradê na borda esquerda existe por causa da
 * marca-d'água que vem no arquivo. As letras dela avançam para o lado
 * do texto e disputam a leitura; dissolvendo essa borda, o notebook
 * continua nítido e a água some justamente onde atrapalharia. É melhor
 * que tentar recortá-la: ela encosta no aparelho e não sai sem levar
 * pedaço da silhueta junto.
 *
 * Some abaixo de `lg` porque em tela estreita não sobra largura para
 * dividir com o texto, e um notebook espremido não prova nada.
 */
export function FotoPainel({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative [-webkit-mask-image:linear-gradient(to_right,transparent_0%,transparent_18%,black_55%)] [mask-image:linear-gradient(to_right,transparent_0%,transparent_18%,black_55%)]",
        className
      )}
    >
      <Image
        src="/mockup-laptopsemfundo.png"
        alt="Notebook exibindo a agenda de consultas da plataforma Medi Marketing"
        width={1400}
        height={941}
        priority
        className="max-h-[86vh] w-full object-contain drop-shadow-2xl"
      />
    </div>
  );
}
