// O check-in mensal usa a mesma página do diagnóstico: o que muda é o
// modelo, que vem do banco pelo token. O caminho próprio só deixa o
// link que a clínica recebe todo mês com o nome certo.
export { default, generateMetadata } from "@/app/diagnostico/[token]/page";

export const dynamic = "force-dynamic";
