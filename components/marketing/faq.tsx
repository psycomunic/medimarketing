import { Reveal } from "@/components/ui/reveal";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { faq } from "@/lib/conteudo";

export function Faq() {
  return (
    <section id="faq" className="section">
      <div className="container">
        <div className="mx-auto max-w-2xl text-center">
          <Reveal>
            <span className="eyebrow">Perguntas frequentes</span>
            <h2 className="mt-4 text-3xl md:text-4xl">Ainda com dúvidas?</h2>
            <p className="mt-4 text-lg text-cinza-suave">
              Reunimos as perguntas que mais recebemos. Se faltar alguma, é só
              chamar a gente.
            </p>
          </Reveal>
        </div>

        <div className="mx-auto mt-12 max-w-3xl">
          <Reveal>
            <Accordion type="single" collapsible className="space-y-3">
              {faq.map((item, i) => (
                <AccordionItem key={i} value={`item-${i}`}>
                  <AccordionTrigger>{item.pergunta}</AccordionTrigger>
                  <AccordionContent>{item.resposta}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
