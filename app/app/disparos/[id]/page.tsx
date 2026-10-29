import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarCheck2, Clock, Coins, Mail, MessageCircle, Send, UserMinus } from "lucide-react";
import { exigirModulo } from "@/lib/acesso";
import { DIAS_ATRIBUICAO, getDisparo } from "@/lib/disparos";
import { Indicador, Painel } from "@/components/app/financeiro/ui";
import { BotaoCancelarDisparo } from "@/components/app/disparos/partes";
import { STATUS_DISPARO } from "@/components/app/disparos/status";
import { reais } from "@/components/graficos/formato";
import { cn } from "@/lib/utils";

export const metadata = { title: "Disparo" };

const dataHora = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).replace(/\./g, "");

const SITUACAO: Record<string, { r: string; c: string }> = {
  pendente: { r: "Na fila", c: "text-cinza-suave" },
  programado: { r: "Programada", c: "text-[#B45309]" },
  enviado: { r: "Enviada", c: "text-[#15803D]" },
  falhou: { r: "Falhou", c: "text-coral" },
  cancelado: { r: "Cancelada", c: "text-cinza-suave" },
  ignorado: { r: "Não enviada", c: "text-cinza-suave" },
};

export default async function DisparoPage({ params }: { params: { id: string } }) {
  await exigirModulo("disparos");
  const r = await getDisparo(params.id);
  if (!r) notFound();
  const { disparo: d, destinatarios } = r;
  const res = d.resultado;
  const agora = Date.now();
  const taxa = res.enviados ? (res.consultas / res.enviados) * 100 : 0;
  const Icone = d.canal === "whatsapp" ? MessageCircle : Mail;

  return (
    <div className="mx-auto grid max-w-5xl grid-cols-[minmax(0,1fr)] gap-6 px-4 py-8 sm:px-5 md:px-8 md:py-10">
      <Link href="/app/disparos" className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-cinza-suave hover:text-azul-medico">
        <ArrowLeft className="size-4" /> Disparos
      </Link>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", STATUS_DISPARO[d.status].c)}>{STATUS_DISPARO[d.status].r}</span>
            <span className="inline-flex items-center gap-1 text-xs text-cinza-suave">
              <Icone className="size-3.5" /> {d.canal === "whatsapp" ? "WhatsApp" : "E-mail"} · {d.finalidade === "cuidado" ? "Cuidado e retorno" : "Novidades e promoções"}
            </span>
          </div>
          <h1 className="mt-2 text-2xl md:text-3xl">{d.nome}</h1>
          <p className="mt-1 text-sm text-cinza-suave">
            {d.segmento_nome ?? "Pacientes"} · começou {dataHora(d.inicio)}
            {res.terminaEm && d.status === "enviando" ? ` · termina por volta de ${dataHora(res.terminaEm)}` : ""}
          </p>
        </div>
        {(d.status === "agendado" || d.status === "enviando") && <BotaoCancelarDisparo id={d.id} />}
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicador icone={Send} rotulo="Enviadas" valor={`${res.enviados} de ${res.total}`} nota={res.pendentes ? `${res.pendentes} na fila` : res.falhas ? `${res.falhas} falharam` : "Todas saíram"} />
        <Indicador icone={CalendarCheck2} rotulo="Consultas marcadas" valor={String(res.consultas)} nota={`${taxa.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% de quem recebeu · até ${DIAS_ATRIBUICAO} dias`} />
        <Indicador icone={Coins} rotulo="Faturamento gerado" valor={reais(res.faturamento)} nota="Das consultas marcadas" destaque />
        <Indicador icone={UserMinus} rotulo="Pediram para sair" valor={String(res.descadastros)} nota={res.enviados ? `${((res.descadastros / res.enviados) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% de quem recebeu` : "—"} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Painel titulo="Mensagem">
          {d.assunto && <p className="mb-2 text-sm font-semibold text-cinza-texto">{d.assunto}</p>}
          <p className="whitespace-pre-line break-words rounded-lg bg-branco-clinico px-3 py-2.5 text-sm leading-relaxed text-cinza-texto">{d.mensagem}</p>
          <p className="mt-2 text-xs text-cinza-suave">Toda mensagem saiu com o link para o paciente deixar de receber.</p>
        </Painel>

        <Painel titulo="Destinatários" descricao={`${destinatarios.length} paciente${destinatarios.length === 1 ? "" : "s"}, na ordem de envio.`} corpo="p-0">
          <ul className="max-h-[480px] divide-y divide-border overflow-y-auto">
            {destinatarios.map((x) => {
              const efetivo = x.status === "programado" && Date.parse(x.previsto_para) <= agora ? "enviado" : x.status;
              const s = SITUACAO[efetivo] ?? SITUACAO.pendente;
              return (
                <li key={x.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                  <div className="min-w-0">
                    <Link href={`/app/pacientes/${x.paciente_id}`} className="block truncate text-sm font-medium text-cinza-texto hover:text-teal">
                      {x.nome}
                    </Link>
                    <p className="truncate text-xs text-cinza-suave">{x.erro ?? x.destino}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={cn("text-xs font-semibold", s.c)}>{s.r}</p>
                    <p className="inline-flex items-center gap-1 text-[11px] text-cinza-suave">
                      <Clock className="size-3" /> {dataHora(x.previsto_para)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </Painel>
      </div>
    </div>
  );
}
