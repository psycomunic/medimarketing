import Link from "next/link";
import { ArrowRight, CalendarPlus, Cake, Clock, MessageCircle, Megaphone, UserRoundX } from "lucide-react";
import type { Relacionamento } from "@/lib/inicio/dados";
import { MESES_SEM_RETORNO, mensagemAniversario, mensagemRetorno } from "@/lib/inicio/relacionamento";
import { linkWhatsApp } from "@/lib/lembretes";
import { SERIES, pct } from "@/components/graficos/formato";
import { Painel } from "@/components/app/financeiro/ui";
import { PainelNps } from "./nps";
import { cn } from "@/lib/utils";

const dataCurta = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { month: "short", year: "numeric", timeZone: "America/Sao_Paulo" }).replace(" de ", "/").replace(".", "");

const horas = (min: number) => {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
};

/**
 * O que dá para fazer hoje com quem já é paciente: trazer de volta quem
 * sumiu, parabenizar quem faz aniversário e encaixar gente nos horários
 * vagos de amanhã. E, para o marketing, de onde vêm os contatos.
 */
export function RelacionamentoPacientes({
  dados,
  clinica,
  nomes,
  mesRotulo,
}: {
  dados: Relacionamento;
  clinica: string;
  nomes: Record<string, string>;
  mesRotulo: string;
}) {
  const { vagas, semRetorno, origens } = dados;
  const totalContatos = origens.reduce((s, o) => s + o.contatos, 0);
  const maxContatos = Math.max(...origens.map((o) => o.contatos), 1);

  return (
    <section className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <h2 className="font-heading text-lg font-semibold text-azul-medico">Relacionamento com pacientes</h2>

      <PainelNps r={dados.nps} nomes={nomes} />

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Quem não voltou */}
        <Painel
          titulo="Pacientes que não voltaram"
          descricao={`Atendidos há mais de ${MESES_SEM_RETORNO} meses, sem nada marcado.`}
          acao={
            <Link href="/app/retencao" className="inline-flex items-center gap-1 text-sm font-medium text-teal hover:underline">
              Retenção <ArrowRight className="size-4" />
            </Link>
          }
        >
          {semRetorno.total ? (
            <div className="grid gap-3">
              <p className="flex items-center gap-2 text-sm text-cinza-texto">
                <UserRoundX className="size-4 shrink-0 text-coral" />
                <span>
                  <strong className="font-heading text-lg tabular-nums text-azul-medico">{semRetorno.total}</strong> paciente
                  {semRetorno.total === 1 ? "" : "s"} para chamar de volta.
                </span>
              </p>
              <ul className="divide-y divide-border rounded-lg border border-border">
                {semRetorno.lista.map((p) => (
                  <li key={p.nome + p.ultima} className="flex items-center justify-between gap-3 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-cinza-texto">{p.nome}</p>
                      <p className="text-xs text-cinza-suave">
                        Última consulta em {dataCurta(p.ultima)} · há {p.meses} meses
                      </p>
                    </div>
                    <BotaoWhats telefone={p.telefone} texto={mensagemRetorno(p.nome, clinica)} rotulo="Chamar" />
                  </li>
                ))}
              </ul>
              {semRetorno.total > semRetorno.lista.length && (
                <p className="text-xs text-cinza-suave">
                  Mostrando os {semRetorno.lista.length} mais recentes. A régua de reativação em Retenção cuida dos demais.
                </p>
              )}
            </div>
          ) : (
            <Vazio texto="Todos os pacientes atendidos voltaram ou têm consulta marcada." />
          )}
        </Painel>

        {/* Origem dos contatos */}
        <Painel
          titulo="De onde vêm os pacientes"
          descricao={`Contatos que chegaram em ${mesRotulo} e quantos agendaram.`}
          acao={
            <Link href="/app/crm" className="inline-flex items-center gap-1 text-sm font-medium text-teal hover:underline">
              CRM <ArrowRight className="size-4" />
            </Link>
          }
        >
          {origens.length ? (
            <div className="grid gap-3">
              <ul className="grid gap-3">
                {origens.slice(0, 6).map((o, i) => (
                  <li key={o.origem}>
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="flex min-w-0 items-center gap-2 text-cinza-texto">
                        <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: SERIES[i % SERIES.length] }} />
                        <span className="truncate">{o.origem}</span>
                      </span>
                      <span className="shrink-0 tabular-nums text-cinza-suave">
                        <strong className="text-cinza-texto">{o.contatos}</strong> contato{o.contatos === 1 ? "" : "s"} · {o.agendaram} agend.
                      </span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[var(--g-trilho)]">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${(o.contatos / maxContatos) * 100}%`, background: SERIES[i % SERIES.length] }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
              <p className="flex items-center gap-1.5 text-xs text-cinza-suave">
                <Megaphone className="size-3.5 shrink-0 text-teal" />
                {totalContatos} contato{totalContatos === 1 ? "" : "s"} no total
                {origens[0] && ` · ${origens[0].origem} traz ${pct((origens[0].contatos / totalContatos) * 100)}`}.
              </p>
            </div>
          ) : (
            <Vazio texto={`Nenhum contato registrado no CRM em ${mesRotulo}.`} />
          )}
        </Painel>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Horários vagos de amanhã */}
        <Painel
          titulo="Horários vagos amanhã"
          descricao={vagas ? `${capitalizar(vagas.rotulo)} · bom para encaixar quem está na lista de espera.` : "Para encaixar pacientes."}
          acao={
            <Link href="/app/agenda?novo=1" className="inline-flex items-center gap-1 text-sm font-medium text-teal hover:underline">
              <CalendarPlus className="size-4" /> Encaixar
            </Link>
          }
        >
          {!vagas ? (
            <p className="rounded-lg bg-branco-clinico px-3 py-2.5 text-sm text-cinza-suave">
              Cadastre os horários de atendimento em{" "}
              <Link href="/app/disponibilidade" className="font-medium text-teal hover:underline">
                Disponibilidade
              </Link>{" "}
              para ver os horários vagos.
            </p>
          ) : vagas.profissionais.length ? (
            <div className="grid gap-3">
              <p className="flex items-center gap-2 text-sm text-cinza-texto">
                <Clock className="size-4 shrink-0 text-teal" />
                <span>
                  <strong className="font-heading text-lg tabular-nums text-azul-medico">{horas(vagas.totalMinutos)}</strong> livres na agenda de amanhã.
                </span>
              </p>
              <ul className="grid gap-2.5">
                {vagas.profissionais.map((p) => (
                  <li key={p.medicoId} className="rounded-lg border border-border px-3 py-2.5">
                    <p className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="truncate font-medium text-cinza-texto">{nomes[p.medicoId] ?? "Profissional"}</span>
                      <span className="shrink-0 text-xs text-cinza-suave">{horas(p.minutos)} livres</span>
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {p.faixas.map((f) => (
                        <span key={f} className="rounded-md bg-verde-menta px-2 py-0.5 text-xs font-medium tabular-nums text-azul-medico">
                          {f}
                        </span>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <Vazio texto="Agenda de amanhã cheia ou sem atendimento nesse dia." />
          )}
        </Painel>

        {/* Aniversariantes */}
        <Painel titulo="Aniversariantes da semana" descricao="Uma mensagem no dia aproxima o paciente da clínica.">
          {dados.aniversariantes.length ? (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {dados.aniversariantes.slice(0, 6).map((a) => (
                <li key={a.nome + a.data} className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className={cn(
                        "grid size-9 shrink-0 place-items-center rounded-full",
                        a.hoje ? "bg-[#FDE7F0] text-[#C2185B]" : "bg-verde-menta text-teal"
                      )}
                    >
                      <Cake className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-cinza-texto">{a.nome}</p>
                      <p className="text-xs text-cinza-suave">
                        {capitalizar(a.quando)} · {a.idade} anos
                      </p>
                    </div>
                  </div>
                  <BotaoWhats telefone={a.telefone} texto={mensagemAniversario(a.nome, clinica)} rotulo="Parabenizar" />
                </li>
              ))}
            </ul>
          ) : (
            <Vazio texto="Nenhum paciente faz aniversário nos próximos 7 dias." />
          )}
        </Painel>
      </div>
    </section>
  );
}

const capitalizar = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

function BotaoWhats({ telefone, texto, rotulo }: { telefone: string | null; texto: string; rotulo: string }) {
  if (!telefone) return <span className="shrink-0 text-xs text-cinza-suave">Sem telefone</span>;
  return (
    <a
      href={linkWhatsApp(telefone, texto)}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-azul-medico hover:bg-branco-clinico"
    >
      <MessageCircle className="size-3.5 text-[#16A34A]" /> {rotulo}
    </a>
  );
}

function Vazio({ texto }: { texto: string }) {
  return <p className="grid min-h-28 place-items-center px-4 text-center text-sm text-cinza-suave">{texto}</p>;
}
