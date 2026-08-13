import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * O painel aberto no celular, em foto com fundo transparente.
 *
 * A transparência é o que a torna melhor que a do notebook para fundo
 * escuro: dispensa a faixa clara atrás e o aparelho flutua direto
 * sobre o azul, sem retângulo pálido nem moldura.
 *
 * Vale também pelo argumento: o médico não fica na frente do
 * computador o dia inteiro. Mostrar a agenda no celular é dizer que
 * ele acompanha a clínica entre uma consulta e outra.
 */
export function FotoCelular({ className }: { className?: string }) {
  return (
    <div className={cn("relative", className)}>
      <Image
        src="/mockup-celular.png"
        alt="Agenda da plataforma Medi Marketing aberta no celular"
        width={588}
        height={768}
        priority
        className="mx-auto max-h-[68vh] w-auto object-contain drop-shadow-2xl"
      />
    </div>
  );
}
