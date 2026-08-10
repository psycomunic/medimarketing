import { Hero } from "@/components/marketing/hero";
import { ProvaSocial } from "@/components/marketing/prova-social";
import { Dores } from "@/components/marketing/dores";
import { Metodo } from "@/components/marketing/metodo";
import { Solucoes } from "@/components/marketing/solucoes";
import { Plataforma } from "@/components/marketing/plataforma";
import { Academy } from "@/components/marketing/academy";
import { ComoFunciona } from "@/components/marketing/como-funciona";
import { Diferenciais } from "@/components/marketing/diferenciais";
import { Planos } from "@/components/marketing/planos";
import { Depoimentos } from "@/components/marketing/depoimentos";
import { Faq } from "@/components/marketing/faq";
import { CtaFinal } from "@/components/marketing/cta-final";

/**
 * Landing comercial. A ordem das seções segue a jornada do visitante:
 * promessa → prova → dor → método → solução → produto → oferta → contato.
 */
export default function HomePage() {
  return (
    <>
      <Hero />
      <ProvaSocial />
      <Dores />
      <Metodo />
      <Solucoes />
      <Plataforma />
      <Academy />
      <ComoFunciona />
      <Diferenciais />
      <Planos />
      <Depoimentos />
      <Faq />
      <CtaFinal />
    </>
  );
}
