import Image from "next/image";

/**
 * A foto do painel rodando num notebook, a mesma do topo do site.
 *
 * Ocupa a metade direita do slide inteira, de borda a borda, sobre uma
 * faixa clara. O recorte deixa o notebook sangrar pela direita e por
 * baixo de propósito: enquadrá-lo inteiro numa faixa vertical o
 * obrigaria a encolher, e o pedido era o contrário. A faixa não é enfeite: o fundo do arquivo é o
 * branco-clínico do site, e sem ela a foto vira um retângulo pálido
 * boiando no azul. Com ela, a imagem se funde e o notebook fica tão
 * grande quanto a tela permite.
 *
 * Some abaixo de `lg` porque em tela estreita não sobra largura para
 * dividir com o texto, e um notebook espremido não prova nada.
 */
export function FotoPainel() {
  return (
    <div
      aria-hidden
      className="absolute inset-y-0 right-0 hidden w-1/2 overflow-hidden bg-branco-clinico lg:block"
    >
      <Image
        src="/BANNER-FUNDO-HEROok.jpg"
        alt="Notebook exibindo a agenda de consultas da plataforma Medi Marketing"
        fill
        sizes="50vw"
        priority
        className="object-cover object-[68%_50%]"
      />
    </div>
  );
}
