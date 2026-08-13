"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { salvarNomeClinica } from "@/lib/actions/identidade";
import { FormLogo } from "@/components/app/configuracoes/form-logo";
import { ConexaoWhatsApp } from "@/components/app/configuracoes/conexao-whatsapp";
import type { ConexaoDisponivel } from "@/lib/actions/configuracoes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Nome e logo da clínica, dentro do perfil.
 *
 * Estão aqui, e não só em Configurações, porque é a identidade que sai
 * em toda comunicação — e quem responde por ela é o profissional. Numa
 * clínica de um médico só, ele é o dono; pedir para outra pessoa
 * trocar a própria logo não faria sentido.
 *
 * A prévia mostra a mesma marca que o paciente vê na mensagem, para a
 * escolha não ser às cegas.
 */
export function MarcaClinica({
  organizationId,
  nome,
  logoUrl,
  conexaoEscolhida,
  conexoes,
  mergeDisponivel,
  demo,
}: {
  organizationId: string;
  nome: string;
  logoUrl: string | null;
  conexaoEscolhida: number | null;
  conexoes: ConexaoDisponivel[];
  mergeDisponivel: boolean;
  demo: boolean;
}) {
  const router = useRouter();
  const [valor, setValor] = useState(nome);
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);
  const [pending, startTransition] = useTransition();

  const mudou = valor.trim() !== nome.trim();

  function salvar() {
    setErro(null);
    setSalvo(false);
    startTransition(async () => {
      const res = await salvarNomeClinica({ organizationId, nome: valor });
      if (!res.ok) {
        setErro(res.erro);
        return;
      }
      setSalvo(true);
      router.refresh();
    });
  }

  return (
    <section className="mt-6 rounded-lg border border-border bg-white p-6 shadow-soft">
      <h2 className="text-lg font-semibold text-azul-medico">
        Sua clínica nas comunicações
      </h2>
      <p className="mt-1 text-sm text-cinza-suave">
        É este nome e esta logo que o paciente vê: no remetente do e-mail, na
        assinatura do WhatsApp e na página que ele abre para confirmar a
        consulta.
      </p>

      <div className="mt-5 grid gap-2 sm:max-w-md">
        <Label htmlFor="nome-clinica">Nome da clínica</Label>
        <Input
          id="nome-clinica"
          value={valor}
          onChange={(e) => {
            setValor(e.target.value);
            setSalvo(false);
          }}
          placeholder="Clínica Vida Derma"
          disabled={demo}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button onClick={salvar} disabled={demo || pending || !mudou}>
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Salvando…
            </>
          ) : (
            "Salvar nome"
          )}
        </Button>

        {salvo && !mudou && (
          <span className="inline-flex items-center gap-1.5 text-sm text-teal">
            <CheckCircle2 className="size-4" /> Nome atualizado
          </span>
        )}
        {erro && <span className="text-sm text-vermelho-alerta">{erro}</span>}
      </div>

      <div className="mt-6 border-t border-border pt-6">
        <FormLogo
          organizationId={organizationId}
          nome={valor || nome}
          logoUrl={logoUrl}
          demo={demo}
        />
      </div>

      {/* O número fica aqui, e não só em Configurações, porque o médico
          dono não enxerga aquela tela — e sem escolher o número o
          WhatsApp simplesmente não sai. */}
      <div className="mt-6 border-t border-border pt-6">
        <ConexaoWhatsApp
          organizationId={organizationId}
          conexoes={conexoes}
          disponivel={mergeDisponivel}
          escolhida={conexaoEscolhida}
          demo={demo}
        />
      </div>
    </section>
  );
}
