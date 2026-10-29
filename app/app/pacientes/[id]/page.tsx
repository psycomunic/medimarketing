import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarCheck2,
  CalendarClock,
  CalendarPlus,
  Coins,
  Mail,
  MessageCircle,
  MessageSquareHeart,
  NotebookPen,
  Receipt,
  ListTodo,
  ShieldCheck,
  ShieldOff,
  Stethoscope,
  UserX,
  Wallet,
} from "lucide-react";
import { exigirModulo } from "@/lib/acesso";
import { getFichaPaciente } from "@/lib/supabase/pacientes";
import { getProfissionais } from "@/lib/supabase/financeiro-dados";
import { getFollowupDoPaciente } from "@/lib/supabase/followup";
import { getUsuarios } from "@/lib/supabase/usuarios";
import { Anotacoes, TarefasDoPaciente } from "@/components/app/pacientes/followup";
import { rotuloStatus, rotuloTipo } from "@/lib/agenda";
import { nomeOrigem } from "@/lib/rotulos";
import { rotuloEvento } from "@/lib/comunicacao/fila";
import { linkWhatsApp } from "@/lib/lembretes";
import { bruto } from "@/lib/financeiro/calculos";
import { Indicador, Painel } from "@/components/app/financeiro/ui";
import { Badge } from "@/components/ui/badge";
import { PacienteDialog } from "@/components/app/pacientes/paciente-dialog";
import { BotaoArquivar } from "@/components/app/pacientes/arquivar";
import { Avatar, dataCurta, dataHora, idade, relativo } from "@/components/app/pacientes/partes";
import { reais } from "@/components/graficos/formato";
import { cn } from "@/lib/utils";

export const metadata = { title: "Ficha do paciente" };

type Evento = {
  quando: string;
  tipo: "consulta" | "pagamento" | "avaliacao" | "mensagem" | "nota" | "tarefa";
  titulo: string;
  detalhe: string | null;
  extra?: React.ReactNode;
};

const ICONE = { consulta: Stethoscope, pagamento: Coins, avaliacao: MessageSquareHeart, mensagem: MessageCircle, nota: NotebookPen, tarefa: ListTodo };
const TOM = {
  consulta: "bg-[#E8F0FC] text-[#1D4ED8]",
  pagamento: "bg-[#E6F4F1] text-[#0F766E]",
  avaliacao: "bg-[#FDF2F8] text-[#BE185D]",
  mensagem: "bg-[#F1F5F9] text-[#475569]",
  nota: "bg-[#FEF6E0] text-[#A16207]",
  tarefa: "bg-[#EFEAFD] text-[#6D28D9]",
};
const SEXO: Record<string, string> = { feminino: "Feminino", masculino: "Masculino", outro: "Outro" };
const CANAL: Record<string, string> = { presencial: "na recepção", whatsapp: "pelo WhatsApp", formulario: "por formulário", email: "por e-mail" };

export default async function FichaPacientePage({ params }: { params: { id: string } }) {
  const { organizacao, profile, role } = await exigirModulo("pacientes");
  const [ficha, profissionais, followup, usuarios] = await Promise.all([
    getFichaPaciente(params.id),
    getProfissionais(organizacao?.id ?? null),
    getFollowupDoPaciente(params.id),
    getUsuarios({ organizationId: organizacao?.id ?? null, ehSuperAdmin: role === "super_admin" }),
  ]);
  if (!ficha) notFound();
  const equipe = usuarios
    .filter((u) => u.ativo && u.role !== "super_admin" && (!ficha.paciente.organization_id || u.organization_id === ficha.paciente.organization_id))
    .map((u) => ({ id: u.id, nome: u.nome ?? "Equipe" }));
  // Quem está usando sempre aparece, mesmo sendo da agência
  if (!equipe.some((u) => u.id === profile.id)) equipe.unshift({ id: profile.id, nome: profile.nome ?? "Eu" });
  const autores = Object.fromEntries(usuarios.map((u) => [u.id, u.nome ?? "Equipe"]));
  const { paciente: p, consultas, receitas, avaliacoes, mensagens } = ficha;
  const nomes = Object.fromEntries(profissionais.map((x) => [x.id, x.nome]));
  const anos = idade(p.nascimento);
  const ticket = p.consultas_realizadas ? p.total_gasto / p.consultas_realizadas : 0;
  const ultimaNota = [...avaliacoes].sort((a, b) => b.respondido_em.localeCompare(a.respondido_em))[0];

  const eventos: Evento[] = [
    ...consultas.map<Evento>((c) => ({
      quando: c.data_hora,
      tipo: "consulta",
      titulo: `${rotuloTipo[c.tipo]}${nomes[c.medico_id] ? ` com ${nomes[c.medico_id]}` : ""}`,
      detalhe: [c.motivo, c.convenio, c.valor ? reais(Number(c.valor)) : null].filter(Boolean).join(" · ") || null,
      extra: <Badge variant={c.status}>{rotuloStatus[c.status]}</Badge>,
    })),
    ...receitas
      .filter((l) => l.status === "recebido" && l.data_recebimento)
      .map<Evento>((l) => ({
        quando: `${l.data_recebimento}T12:00:00`,
        tipo: "pagamento",
        titulo: `Pagamento de ${reais(bruto(l))}`,
        detalhe: l.procedimento,
      })),
    ...avaliacoes.map<Evento>((a) => ({
      quando: a.respondido_em,
      tipo: "avaliacao",
      titulo: `Avaliou o atendimento com nota ${a.nota}`,
      detalhe: a.comentario ? `“${a.comentario}”` : null,
    })),
    ...followup.notas.map<Evento>((n) => ({
      quando: n.created_at,
      tipo: "nota",
      titulo: `Anotação de ${(n.autor_id && autores[n.autor_id]) || "Equipe"}`,
      detalhe: n.texto.length > 160 ? `${n.texto.slice(0, 160)}…` : n.texto,
    })),
    ...followup.tarefas
      .filter((t) => t.status === "feita" && t.concluida_em)
      .map<Evento>((t) => ({
        quando: t.concluida_em!,
        tipo: "tarefa",
        titulo: `Follow-up feito: ${t.titulo}`,
        detalhe: [t.resultado && `“${t.resultado}”`, t.concluida_por && autores[t.concluida_por]].filter(Boolean).join(" · ") || null,
      })),
    ...mensagens.map<Evento>((m) => ({
      quando: m.enviado_em ?? m.created_at,
      tipo: "mensagem",
      titulo: `Mensagem de ${rotuloEvento(m.evento)}`,
      detalhe: `${m.canal === "email" ? "E-mail" : "WhatsApp"} · ${m.status === "enviado" ? "enviada" : m.status}`,
    })),
  ].sort((a, b) => b.quando.localeCompare(a.quando));

  const dados: [string, React.ReactNode][] = [
    ["Telefone", p.telefone],
    ["E-mail", p.email],
    ["Nascimento", p.nascimento ? `${dataCurta(`${p.nascimento}T12:00:00`)}${anos !== null ? ` · ${anos} anos` : ""}` : null],
    ["Sexo", p.sexo ? SEXO[p.sexo] : null],
    ["CPF", p.cpf],
    ["Cidade", p.cidade],
    ["Convênio", [p.convenio, p.carteirinha && `carteirinha ${p.carteirinha}`].filter(Boolean).join(" · ") || null],
    ["Como conheceu", p.origem ? nomeOrigem(p.origem) : null],
    ["Profissional", p.profissional_principal ? nomes[p.profissional_principal] ?? null : null],
    ["Ficha criada em", dataCurta(p.created_at)],
  ];

  return (
    <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] gap-6 px-4 py-8 sm:px-5 md:px-8 md:py-10">
      <Link href="/app/pacientes" className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-cinza-suave hover:text-azul-medico">
        <ArrowLeft className="size-4" /> Pacientes
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <Avatar nome={p.nome} grande />
          <div className="min-w-0">
            <h1 className="text-2xl md:text-3xl">{p.nome}</h1>
            <p className="mt-1 text-sm text-cinza-suave">
              {[anos !== null ? `${anos} anos` : null, p.convenio, p.cidade].filter(Boolean).join(" · ") || "Sem dados complementares"}
              {!p.ativo && <span className="ml-2 rounded bg-[#F1F5F9] px-1.5 py-0.5 text-xs font-medium text-[#475569]">Arquivado</span>}
            </p>
            {p.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {p.tags.map((t) => (
                  <Link
                    key={t}
                    href={`/app/pacientes?tag=${encodeURIComponent(t)}`}
                    className="rounded-full bg-verde-menta px-2.5 py-0.5 text-xs font-medium text-azul-medico hover:bg-teal/15"
                  >
                    {t}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {p.telefone && (
            <a
              href={linkWhatsApp(p.telefone, `Olá, ${p.nome.split(" ")[0]}! Aqui é da ${organizacao?.nome ?? "clínica"}.`)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 items-center gap-1.5 rounded-full border-2 border-azul-medico/20 bg-white px-3.5 text-sm font-semibold text-azul-medico hover:border-teal hover:text-teal"
            >
              <MessageCircle className="size-4 text-[#16A34A]" /> WhatsApp
            </a>
          )}
          {p.email && (
            <a
              href={`mailto:${p.email}`}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border-2 border-azul-medico/20 bg-white px-3.5 text-sm font-semibold text-azul-medico hover:border-teal hover:text-teal"
            >
              <Mail className="size-4" /> E-mail
            </a>
          )}
          <Link
            href="/app/agenda?novo=1"
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-azul-medico px-3.5 text-sm font-semibold text-white hover:bg-azul-profundo"
          >
            <CalendarPlus className="size-4" /> Nova consulta
          </Link>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Indicador icone={CalendarCheck2} rotulo="Consultas" valor={String(p.consultas_realizadas)} nota={p.faltas ? `${p.faltas} falta${p.faltas === 1 ? "" : "s"}` : "Nenhuma falta"} />
        <Indicador icone={Wallet} rotulo="Total gasto" valor={reais(p.total_gasto)} nota="Desde a primeira consulta" destaque />
        <Indicador icone={Receipt} rotulo="Ticket médio" valor={reais(ticket)} nota="Por consulta realizada" />
        <Indicador
          icone={CalendarClock}
          rotulo="Última consulta"
          valor={p.ultima_consulta ? relativo(p.ultima_consulta) : "—"}
          nota={p.proxima_consulta ? `Próxima: ${dataHora(p.proxima_consulta)}` : "Nada marcado"}
        />
        <Indicador
          icone={MessageSquareHeart}
          rotulo="Satisfação"
          valor={ultimaNota ? `${ultimaNota.nota}/10` : "—"}
          nota={ultimaNota ? `Última avaliação, ${relativo(ultimaNota.respondido_em)}` : "Ainda não avaliou"}
        />
      </div>

      {followup.instalado ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <Painel titulo="Follow-up" descricao="O que a equipe combinou de fazer com este paciente.">
            <TarefasDoPaciente
              pacienteId={p.id}
              tarefas={followup.tarefas}
              equipe={equipe}
              usuarioId={profile.id}
              whatsapp={p.telefone ? linkWhatsApp(p.telefone, `Olá, ${p.nome.split(" ")[0]}! Aqui é da ${organizacao?.nome ?? "clínica"}.`) : null}
            />
          </Painel>
          <Painel titulo="Anotações" descricao="Só a equipe da clínica vê.">
            <Anotacoes pacienteId={p.id} notas={followup.notas} autores={autores} />
          </Painel>
        </div>
      ) : (
        <p className="rounded-xl border border-border bg-white px-5 py-4 text-sm text-cinza-suave shadow-soft">
          Follow-ups e anotações aparecem aqui depois que o SQL &quot;Pacientes: follow-up (Fase 2)&quot; for executado no Supabase.
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <Painel className="lg:col-span-2" titulo="Linha do tempo" descricao="Consultas, pagamentos, mensagens, avaliações, anotações e follow-ups.">
          {eventos.length ? (
            <ol className="relative grid gap-4 before:absolute before:bottom-2 before:left-[17px] before:top-2 before:w-px before:bg-border">
              {eventos.map((e, i) => {
                const Icone = e.tipo === "consulta" && consultas.find((c) => c.data_hora === e.quando)?.status === "faltou" ? UserX : ICONE[e.tipo];
                const futuro = new Date(e.quando).getTime() > Date.now();
                return (
                  <li key={i} className="relative flex gap-3">
                    <span className={cn("relative z-10 grid size-9 shrink-0 place-items-center rounded-full ring-4 ring-white", TOM[e.tipo])}>
                      <Icone className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1 pt-0.5">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <p className="text-sm font-medium text-cinza-texto">{e.titulo}</p>
                        {e.extra}
                      </div>
                      {e.detalhe && <p className="mt-0.5 break-words text-sm text-cinza-suave">{e.detalhe}</p>}
                      <p className="mt-0.5 text-xs text-cinza-suave/80">
                        {dataHora(e.quando)}
                        {futuro && " · agendada"}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="py-8 text-center text-sm text-cinza-suave">Nada registrado ainda.</p>
          )}
        </Painel>

        <div className="grid content-start gap-5">
          <Painel titulo="Dados do paciente">
            <dl className="grid gap-3 text-sm">
              {dados.map(([r, v]) => (
                <div key={r} className="flex items-start justify-between gap-3">
                  <dt className="shrink-0 text-cinza-suave">{r}</dt>
                  <dd className={cn("min-w-0 break-words text-right", v ? "text-cinza-texto" : "text-cinza-suave/60")}>{v || "—"}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4">
              <PacienteDialog paciente={p} />
              <BotaoArquivar id={p.id} ativo={p.ativo} />
            </div>
          </Painel>

          <Painel titulo="Campanhas e LGPD">
            {p.descadastrado_em ? (
              <p className="flex items-start gap-2 text-sm text-coral">
                <ShieldOff className="mt-0.5 size-4 shrink-0" /> Pediu para não receber campanhas em {dataCurta(p.descadastrado_em)}.
              </p>
            ) : p.consentimento_marketing ? (
              <p className="flex items-start gap-2 text-sm text-cinza-texto">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-teal" />
                <span>
                  Aceita receber campanhas
                  {p.consentimento_em && (
                    <span className="block text-xs text-cinza-suave">
                      Desde {dataCurta(p.consentimento_em)}
                      {p.consentimento_canal ? `, ${CANAL[p.consentimento_canal] ?? p.consentimento_canal}` : ""}.
                    </span>
                  )}
                </span>
              </p>
            ) : (
              <p className="flex items-start gap-2 text-sm text-cinza-suave">
                <ShieldOff className="mt-0.5 size-4 shrink-0" /> Sem consentimento para campanhas. Lembretes e retornos continuam normais.
              </p>
            )}
          </Painel>

          {p.observacoes && (
            <Painel titulo="Observações">
              <p className="whitespace-pre-line text-sm text-cinza-texto">{p.observacoes}</p>
            </Painel>
          )}
        </div>
      </div>
    </div>
  );
}
