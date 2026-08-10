import { site } from "@/lib/site";

export const metadata = {
  title: "Política de Privacidade",
  description:
    "Como a Medi Marketing trata os dados de clínicas, profissionais de saúde e pacientes.",
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
            Do formulário de diagnóstico: nome, especialidade, WhatsApp, e-mail,
            cidade, faixa de faturamento declarada e se a clínica possui equipe
            comercial. Da operação da plataforma: dados de agenda, pacientes,
            atendimentos e indicadores das clínicas contratantes.
          </p>
        </section>
        <section>
          <h2 className="text-xl">2. Como usamos</h2>
          <p className="mt-2 text-cinza-suave">
            Utilizamos os dados exclusivamente para prestar os serviços
            contratados (marketing, atendimento, agenda, CRM, retenção e
            relatórios) e para o contato comercial autorizado no formulário.
            Não vendemos nem cedemos dados a terceiros para fins publicitários.
          </p>
        </section>
        <section>
          <h2 className="text-xl">3. Isolamento e acesso</h2>
          <p className="mt-2 text-cinza-suave">
            Cada clínica é um ambiente isolado no banco de dados, com regras de
            acesso aplicadas linha a linha: dados de uma clínica não são
            acessíveis a usuários de outra. Dentro da clínica, o acesso ainda é
            limitado por papel (gestor, atendimento e profissional de saúde).
          </p>
        </section>
        <section id="cookies">
          <h2 className="text-xl">4. Cookies</h2>
          <p className="mt-2 text-cinza-suave">
            Usamos cookies essenciais para manter a sessão de quem acessa a área
            do cliente e cookies de medição para entender o desempenho das
            campanhas e das páginas. Você pode bloqueá-los nas configurações do
            navegador; os essenciais são necessários para o login funcionar.
          </p>
        </section>
        <section>
          <h2 className="text-xl">5. Seus direitos</h2>
          <p className="mt-2 text-cinza-suave">
            Você pode solicitar acesso, correção, portabilidade ou exclusão dos
            seus dados a qualquer momento, além de revogar o consentimento de
            contato. Basta escrever para {site.email}.
          </p>
        </section>
        <section>
          <h2 className="text-xl">6. Contato</h2>
          <p className="mt-2 text-cinza-suave">
            Em caso de dúvidas sobre seus dados, entre em contato pelos canais
            informados no rodapé do site.
          </p>
        </section>
      </div>
    </div>
  );
}
