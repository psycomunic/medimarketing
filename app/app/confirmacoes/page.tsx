import {
  CalendarCheck,
  Clock,
  Send,
  CheckCircle2,
  CalendarClock,
  AlertTriangle,
} from "lucide-react";
import { FilaConfirmacoes } from "@/components/app/confirmacoes/fila";
import { exigirModulo } from "@/lib/acesso";
import { emModoDemo } from "@/lib/supabase/queries";
import { whatsappConfigurado } from "@/lib/envio";
import {
  estruturaPronta,
  gerarPendentes,
  getConfirmacoes,
  resumirConfirmacoes,
} from "@/lib/supabase/confirmacoes";
import { montarMensagem, urlConfirmacao } from "@/lib/lembretes";
import { formatarNumero, formatarPercentual } from "@/lib/indicadores";

export const metadata = { title: "Confirmações" };

/** Janela padrão: da véspera até 14 dias à frente. */
const DIAS_A_FRENTE = 14;

export default async function ConfirmacoesPage() {
  const { organizacao } = await exigirModulo("confirmacoes");
  const orgId = organizacao?.id ?? null;
  const demo = await emModoDemo();

  const de = new Date();
  de.setDate(de.getDate() - 1);
  const ate = new Date();
  ate.setDate(ate.getDate() + DIAS_A_FRENTE);

  // Consulta marcada agora já aparece na fila, sem esperar o próximo cron
  const estrutura = demo ? { pronta: true as const } : await estruturaPronta();
  if (!demo && organizacao && estrutura.pronta) {
    await gerarPendentes(organizacao, ate);
  }

  const confirmacoes = await getConfirmacoes(
    orgId,
    de.toISOString(),
    ate.toISOString()
  );
  const r = resumirConfirmacoes(confirmacoes);

  // O texto de cada mensagem sai do servidor: assim o botão de WhatsApp e
  // o de copiar usam exatamente o que a rotina automática enviaria.
  const mensagens: Record<string, string> = {};
  for (const c of confirmacoes) {
    mensagens[c.id] = montarMensagem({
      paciente: c.paciente_nome,
      dataHora: c.data_hora,
      medico: c.medico_nome,
      clinica: organizacao?.nome ?? "a clínica",
      endereco:
        [organizacao?.endereco, organizacao?.cidade].filter(Boolean).join(" — ") ||
        null,
      link: urlConfirmacao(c.token),
      modelo: organizacao?.mensagem_lembrete,
    });
  }

  const cards = [
    {
      icone: AlertTriangle,
      label: "aguardando envio",
      valor: formatarNumero(r.aguardandoEnvio),
      destaque: r.atrasados > 0,
      nota: r.atrasados > 0 ? `${r.atrasados} já passaram do horário` : undefined,
    },
    { icone: Send, label: "enviados", valor: formatarNumero(r.enviados) },
    {
      icone: CheckCircle2,
      label: "presença confirmada",
      valor: formatarNumero(r.confirmados),
    },
    {
      icone: CalendarClock,
      label: "pediram para reagendar",
      valor: formatarNumero(r.reagendar),
    },
    {
      icone: Clock,
      label: "taxa de resposta",
      valor: formatarPercentual(r.taxaConfirmacao),
    },
  ];

  return (
    <div className="mx-auto max-w-5xl px-5 py-8 md:px-8 md:py-10">
      <header className="flex items-start gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-verde-menta text-teal">
          <CalendarCheck className="size-6" />
        </span>
        <div>
          <h1 className="text-2xl md:text-3xl">Confirmações</h1>
          <p className="mt-1 max-w-2xl text-cinza-suave">
            Um dia útil antes da consulta, o paciente recebe um link e
            confirma a presença sozinho. Aqui você acompanha quem respondeu
            e resolve o que ficou parado.
          </p>
        </div>
      </header>

      {!estrutura.pronta && (
        <div className="mt-6 rounded-lg border border-alerta/40 bg-alerta/5 px-4 py-3.5 text-sm">
          <p className="flex items-center gap-2 font-semibold text-alerta">
            <AlertTriangle className="size-4" />
            Falta preparar o banco
          </p>
          <p className="mt-1.5 text-cinza-suave">{estrutura.motivo}</p>
          <p className="mt-1.5 text-cinza-suave">
            Enquanto isso a fila fica vazia e o disparo automático não roda.
          </p>
        </div>
      )}

      {confirmacoes.length > 0 && (
        <dl className="mt-8 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-5">
          {cards.map((c) => (
            <div key={c.label} className="bg-white px-5 py-5">
              <span
                className={`grid size-9 place-items-center rounded-lg ${
                  c.destaque ? "bg-alerta/15 text-alerta" : "bg-verde-menta text-teal"
                }`}
              >
                <c.icone className="size-5" />
              </span>
              <dd
                className={`mt-3 font-heading text-2xl font-bold ${
                  c.destaque ? "text-alerta" : "text-azul-medico"
                }`}
              >
                {c.valor}
              </dd>
              <dt className="text-sm text-cinza-suave">{c.label}</dt>
              {c.nota && (
                <p className="mt-1 text-xs font-medium text-alerta">{c.nota}</p>
              )}
            </div>
          ))}
        </dl>
      )}

      <div className="mt-8">
        {confirmacoes.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-white p-10 text-center shadow-soft">
            <CalendarCheck className="mx-auto size-10 text-teal-claro" />
            <h2 className="mt-3 text-lg font-semibold text-azul-medico">
              Nenhuma consulta nos próximos {DIAS_A_FRENTE} dias
            </h2>
            <p className="mx-auto mt-2 max-w-md text-cinza-suave">
              Assim que houver consultas marcadas, os pedidos de confirmação
              aparecem aqui automaticamente, já com a data de disparo
              calculada.
            </p>
          </div>
        ) : (
          <FilaConfirmacoes
            confirmacoes={confirmacoes}
            mensagens={mensagens}
            envioAutomatico={whatsappConfigurado()}
            demo={demo}
          />
        )}
      </div>
    </div>
  );
}
