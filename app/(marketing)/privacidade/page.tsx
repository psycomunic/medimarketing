export const metadata = {
  title: "Política de Privacidade",
  description: "Como a Medi Marketing trata os dados dos médicos e pacientes.",
};

// TODO: substituir por política de privacidade real revisada juridicamente (LGPD).
export default function PrivacidadePage() {
  return (
    <div className="container max-w-3xl py-32">
      <h1 className="text-3xl md:text-4xl">Política de Privacidade</h1>
      <p className="mt-4 text-cinza-suave">
        Esta é uma versão preliminar. O conteúdo definitivo, em conformidade com
        a LGPD, será publicado em breve.
      </p>

      <div className="mt-8 space-y-6 leading-relaxed text-cinza-texto">
        <section>
          <h2 className="text-xl">1. Dados que coletamos</h2>
          <p className="mt-2 text-cinza-suave">
            Coletamos dados fornecidos nos formulários de contato (nome,
            especialidade, WhatsApp e cidade) e dados necessários à operação da
            agenda dos médicos cadastrados.
          </p>
        </section>
        <section>
          <h2 className="text-xl">2. Como usamos</h2>
          <p className="mt-2 text-cinza-suave">
            Utilizamos os dados exclusivamente para prestar os serviços de
            atendimento, agenda e marketing contratados.
          </p>
        </section>
        <section>
          <h2 className="text-xl">3. Contato</h2>
          <p className="mt-2 text-cinza-suave">
            Em caso de dúvidas sobre seus dados, entre em contato pelos canais
            informados no rodapé do site.
          </p>
        </section>
      </div>
    </div>
  );
}
