import { Info, Repeat } from "lucide-react";
import { exigirModulo } from "@/lib/acesso";
import { emModoDemo } from "@/lib/supabase/queries";
import { AUTOMACOES, INTERVALO_DIAS, montarFilaContatos } from "@/lib/relacionamento/contatos";
import { ConfigAutomacoes, ContatosFeitos, ListaContatos } from "@/components/app/retencao/contatos";
import { Painel } from "@/components/app/financeiro/ui";

export const metadata = { title: "Retenção" };

/**
 * Retenção no modo manual: a lista de quem contatar hoje, com a mensagem
 * pronta para o WhatsApp da clínica, e o ajuste de cada automação.
 */
export default async function RetencaoPage() {
  const { organizacao, role } = await exigirModulo("retencao");
  const [fila, demo] = await Promise.all([montarFilaContatos(organizacao?.id ?? null, organizacao?.nome ?? "clínica"), emModoDemo()]);
  const podeEditar = role === "gestor" || role === "super_admin";
  const porTipo = (t: string) => fila.itens.filter((i) => i.tipo === t).length;

  return (
    <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] gap-6 px-4 py-8 sm:px-5 md:px-8 md:py-10">
      <header className="flex items-start gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-verde-menta text-teal">
          <Repeat className="size-6" />
        </span>
        <div>
          <h1 className="text-2xl md:text-3xl">Retenção</h1>
          <p className="mt-1 max-w-2xl text-cinza-suave">
            Quem contatar hoje, com a mensagem pronta. Abra no WhatsApp da clínica (ou copie), envie e marque como enviada.
          </p>
        </div>
      </header>

      {!fila.instalado && (
        <p className="flex items-start gap-2 rounded-lg border border-alerta/40 bg-alerta/8 px-4 py-3 text-sm text-cinza-texto">
          <Info className="mt-0.5 size-4 shrink-0 text-alerta" />
          Rode o SQL da Fase 4A no Supabase para registrar os contatos e salvar as mensagens. Até lá, a lista aparece com as mensagens padrão.
        </p>
      )}

      <section className="grid gap-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="font-heading text-lg font-semibold text-azul-medico">
              Para contatar hoje <span className="text-cinza-suave">({fila.itens.length})</span>
            </h2>
            <p className="text-sm text-cinza-suave">
              {[
                porTipo("aniversario") && `${porTipo("aniversario")} aniversário${porTipo("aniversario") > 1 ? "s" : ""}`,
                porTipo("faltou") && `${porTipo("faltou")} falta${porTipo("faltou") > 1 ? "s" : ""}`,
                porTipo("pos_consulta") && `${porTipo("pos_consulta")} pós-consulta`,
              ]
                .filter(Boolean)
                .join(" · ") || "Lista em dia"}
              {fila.emIntervalo > 0 &&
                ` · ${fila.emIntervalo} esperando: receberam mensagem há menos de ${INTERVALO_DIAS} dias`}
            </p>
          </div>
        </div>
        <ListaContatos itens={fila.itens} demo={demo} instalado={fila.instalado} />
      </section>

      <section className="grid gap-3">
        <div>
          <h2 className="font-heading text-lg font-semibold text-azul-medico">Automações</h2>
          <p className="text-sm text-cinza-suave">
            O que entra na lista e com qual mensagem. Uma mensagem por paciente por dia (a mais importante) e nenhuma para quem recebeu outra
            há menos de {INTERVALO_DIAS} dias. Quem pediu para não receber mensagens fica de fora.
          </p>
        </div>
        <ConfigAutomacoes
          config={fila.config}
          info={{
            aniversario: AUTOMACOES.aniversario,
            faltou: AUTOMACOES.faltou,
            pos_consulta: AUTOMACOES.pos_consulta,
          }}
          podeEditar={podeEditar}
          demo={demo}
        />
      </section>

      <Painel titulo="Feitos nos últimos 7 dias" descricao="Marcou por engano? Desfaça e o contato volta para a lista." corpo="p-0">
        <ContatosFeitos feitos={fila.feitos} demo={demo} />
      </Painel>
    </div>
  );
}
