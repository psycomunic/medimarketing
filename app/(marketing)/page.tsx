import { Hero } from "@/components/marketing/hero";
import { Dores } from "@/components/marketing/dores";
import { Servicos } from "@/components/marketing/servicos";
import { ComoFunciona } from "@/components/marketing/como-funciona";
import { Diferenciais } from "@/components/marketing/diferenciais";
import { Depoimentos } from "@/components/marketing/depoimentos";
import { Faq } from "@/components/marketing/faq";
import { CtaFinal } from "@/components/marketing/cta-final";

export default function HomePage() {
  return (
    <>
      <Hero />
      <Dores />
      <Servicos />
      <ComoFunciona />
      <Diferenciais />
      <Depoimentos />
      <Faq />
      <CtaFinal />
    </>
  );
}
