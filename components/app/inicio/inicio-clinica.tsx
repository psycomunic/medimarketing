import {
  Banknote,
  CalendarCheck2,
  CalendarClock,
  CalendarPlus,
  Clock,
  FileText,
  HandCoins,
  Landmark,
  MessageCircle,
  Send,
  Stethoscope,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import type { Organization, Profile, Role } from "@/lib/supabase/types";
import type { DadosClinica } from "@/lib/inicio/dados";
import { calcularEvolucao } from "@/lib/evolucao";
import { mesLongo } from "@/lib/financeiro/calculos";
import { rotuloPapel } from "@/lib/rbac";
import { Medidor } from "@/components/graficos/graficos";
import { pct, reais } from "@/components/graficos/formato";
import { Indicador, Painel } from "@/components/app/financeiro/ui";
import { PainelDeNumeros } from "./painel-numeros";
import { RelacionamentoPacientes } from "./relacionamento";
import { AgendaHoje, Cabecalho, FunilComercial, PedeAtencao, PrimeirosPassos, ProximosPacientes, RecadoMedi } from "./blocos";

const banner = (org: Organization | null) =>
  org?.banner_url ? { url: org.banner_url, link: org.banner_link ?? null, nome: org.nome } : null;

function contexto(role: Role, org: Organization | null) {
  return `${rotuloPapel(role)} · ${org?.nome ?? "sua clínica"}`;
}

/* ============================== GESTOR ============================== */

export function InicioGestor({ profile, org, dados, nomes }: { profile: Profile; org: Organization | null; dados: DadosClinica; nomes: Record<string, string> }) {
  const f = dados.financeiro;
  const ativasHoje = dados.hoje.filter((c) => c.status !== "cancelada");
  const confirmadasHoje = ativasHoje.filter((c) => c.status === "confirmada" || c.status === "realizada").length;
  const ind = dados.indicadores;
  const ultimo = ind[ind.length - 1] ?? null;
  const ev = calcularEvolucao(ind, dados.plano);
  const metaFat = dados.plano?.meta_faturamento ? Number(dados.plano.meta_faturamento) : null;
  const metaConsultas = dados.plano?.meta_consultas ? Number(dados.plano.meta_consultas) : null;
  const metaLeads = dados.plano?.meta_leads ? Number(dados.plano.meta_leads) : null;
  const leadsMes = ultimo && ultimo.mes.startsWith(new Date().toISOString().slice(0, 7)) ? Number(ultimo.leads) : null;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <Cabecalho
        nome={profile.nome}
        contexto={contexto("gestor", org)}
        banner={banner(org)}
        atalhos={[
          { href: "/app/agenda?novo=1", rotulo: "Nova consulta", icone: CalendarPlus, principal: true },
          { href: "/app/financeiro/receitas", rotulo: "Receber pagamento", icone: Wallet },
          { href: "/app/crm?novo=1", rotulo: "Novo lead", icone: UserPlus },
        ]}
      />

      <PrimeirosPassos passos={dados.checklist} />

      {dados.painel ? (
        <PainelDeNumeros
          p={dados.painel}
          hoje={dados.hoje}
          meta={metaFat}
          nomes={nomes}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Indicador icone={CalendarCheck2} rotulo="Consultas hoje" valor={String(ativasHoje.length)} nota={`${confirmadasHoje} confirmada${confirmadasHoje === 1 ? "" : "s"}`} />
          <Indicador icone={Banknote} rotulo="Previsto para hoje" valor={reais(f?.previstoHoje ?? 0)} nota="Valor das consultas do dia" />
          <Indicador icone={HandCoins} rotulo="Recebido hoje" valor={reais(f?.recebidoHoje ?? 0)} nota="Pagamentos registrados" />
          <Indicador icone={Landmark} rotulo="Saldo em caixa" valor={reais(f?.saldoCaixa ?? 0)} nota="Informado no financeiro" destaque />
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-5">
        <div className="min-w-0 lg:col-span-3">
          <AgendaHoje consultas={dados.hoje} mostrarProfissional nomes={nomes} />
        </div>
        <div className="min-w-0 lg:col-span-2">
          <PedeAtencao itens={dados.pendencias} vazio="Lembretes em dia, ninguém esperando resposta e nenhuma conta atrasada." />
        </div>
      </div>

      {dados.relacionamento && (
        <RelacionamentoPacientes
          dados={dados.relacionamento}
          clinica={org?.nome ?? "clínica"}
          nomes={nomes}
          quando={dados.painel?.recorte.quando ?? "neste mês"}
        />
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <Painel titulo="Metas do mês">
          <div className="grid gap-5">
            {metaFat ? <Medidor rotulo="Faturamento" valor={f?.atual.receitaBruta ?? 0} meta={metaFat} /> : null}
            {metaConsultas ? <Medidor rotulo="Consultas" valor={dados.consultasMes.realizadas} meta={metaConsultas} formato="numero" /> : null}
            {metaLeads && leadsMes !== null ? <Medidor rotulo="Leads" valor={leadsMes} meta={metaLeads} formato="numero" /> : null}
            {f?.metaLucro ? <Medidor rotulo="Lucro" valor={Math.max(f.atual.lucro, 0)} meta={f.metaLucro} /> : null}
            {!metaFat && !metaConsultas && !f?.metaLucro && (
              <p className="text-sm text-cinza-suave">As metas aparecem aqui quando forem definidas no plano com a Medi Marketing.</p>
            )}
          </div>
        </Painel>
        <FunilComercial indicador={ultimo} />
        <Painel titulo="Evolução desde o início" descricao={ev ? "Faturamento médio do marco zero contra o último mês lançado." : undefined}>
          {ev && ultimo ? (
            <div className="grid gap-4">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-xs text-cinza-suave">Antes</p>
                  <p className="font-heading text-lg font-bold tabular-nums text-cinza-suave">{reais(ev.mediaBase.faturamento)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-cinza-suave">Último mês</p>
                  <p className="font-heading text-2xl font-bold tabular-nums text-azul-medico">{reais(Number(ultimo.faturamento))}</p>
                </div>
              </div>
              {ev.mediaBase.faturamento > 0 && (
                <p className="rounded-lg bg-[#E9F8EF] px-3 py-2 text-sm font-semibold text-[#15803D]">
                  {Number(ultimo.faturamento) >= ev.mediaBase.faturamento ? "+" : ""}
                  {pct(((Number(ultimo.faturamento) - ev.mediaBase.faturamento) / ev.mediaBase.faturamento) * 100)} desde o diagnóstico
                </p>
              )}
              {metaFat && (
                <Medidor rotulo="Rumo à meta" valor={Number(ultimo.faturamento)} meta={metaFat} />
              )}
            </div>
          ) : (
            <p className="text-sm text-cinza-suave">A evolução aparece depois do diagnóstico e do primeiro mês acompanhado.</p>
          )}
        </Painel>
        <RecadoMedi indicadores={ind} />
      </div>
    </div>
  );
}

/* ============================= ATENDENTE ============================= */

export function InicioAtendente({ profile, org, dados, nomes }: { profile: Profile; org: Organization | null; dados: DadosClinica; nomes: Record<string, string> }) {
  const ativasHoje = dados.hoje.filter((c) => c.status !== "cancelada");
  const confirmadas = ativasHoje.filter((c) => c.status === "confirmada" || c.status === "realizada").length;
  const amanha = dados.proximos.filter((c) => new Date(c.data_hora).toDateString() === new Date(Date.now() + 86400000).toDateString());
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <Cabecalho
        nome={profile.nome}
        contexto={contexto("secretaria", org)}
        banner={banner(org)}
        atalhos={[
          { href: "/app/agenda?novo=1", rotulo: "Nova consulta", icone: CalendarPlus, principal: true },
          { href: "/app/confirmacoes", rotulo: "Confirmações", icone: Send },
          { href: "/app/crm?novo=1", rotulo: "Novo lead", icone: UserPlus },
        ]}
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Indicador icone={CalendarCheck2} rotulo="Consultas hoje" valor={String(ativasHoje.length)} nota={`${dados.hoje.length - ativasHoje.length} cancelada(s)`} />
        <Indicador icone={Stethoscope} rotulo="Confirmadas hoje" valor={`${confirmadas} de ${ativasHoje.length}`} nota={ativasHoje.length - confirmadas ? `${ativasHoje.length - confirmadas} sem confirmação` : "Todas confirmadas"} />
        <Indicador icone={CalendarClock} rotulo="Amanhã" valor={String(amanha.length)} nota="Confirmar ainda hoje" />
        <Indicador icone={MessageCircle} rotulo="A fazer" valor={String(dados.pendencias.length)} nota="Itens na sua lista" destaque={dados.pendencias.some((p) => p.urgente)} />
      </div>
      <div className="grid gap-5 lg:grid-cols-5">
        <div className="min-w-0 lg:col-span-3">
          <AgendaHoje consultas={dados.hoje} mostrarProfissional nomes={nomes} titulo="Fila do dia" />
        </div>
        <div className="grid min-w-0 content-start gap-5 lg:col-span-2">
          <PedeAtencao itens={dados.pendencias} titulo="Sua lista" vazio="Nada esperando por você: confirmações, conversas e leads em dia." />
          <ProximosPacientes consultas={dados.proximos} />
        </div>
      </div>
    </div>
  );
}

/* =============================== MÉDICO =============================== */

export function InicioMedico({ profile, org, dados }: { profile: Profile; org: Organization | null; dados: DadosClinica }) {
  const ativasHoje = dados.hoje.filter((c) => c.status !== "cancelada");
  const proxima = ativasHoje.find((c) => new Date(c.data_hora).getTime() > Date.now()) ?? dados.proximos[0] ?? null;
  const repasse = dados.repasses[0] ?? null;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <Cabecalho
        nome={profile.nome}
        contexto={contexto("medico", org)}
        banner={banner(org)}
        atalhos={[
          { href: "/app/agenda", rotulo: "Minha agenda", icone: CalendarCheck2, principal: true },
          { href: "/app/disponibilidade", rotulo: "Meus horários", icone: Clock },
        ]}
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Indicador icone={CalendarCheck2} rotulo="Pacientes hoje" valor={String(ativasHoje.length)} nota={`${ativasHoje.filter((c) => c.tipo === "primeira").length} primeira(s) consulta(s)`} />
        <Indicador
          icone={Clock}
          rotulo="Próximo paciente"
          valor={proxima ? new Date(proxima.data_hora).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—"}
          nota={proxima ? proxima.paciente_nome : "Nada marcado"}
          destaque={!!proxima}
        />
        <Indicador icone={Users} rotulo="Atendidos no mês" valor={String(dados.consultasMes.realizadas)} nota={`${dados.consultasMes.agendadas} marcadas no mês`} />
        <Indicador
          icone={FileText}
          rotulo="Último repasse"
          valor={repasse ? reais(Number(repasse.valor)) : "—"}
          nota={repasse ? `${mesLongo(repasse.competencia.slice(0, 7))} · ${repasse.status === "pago" ? "pago" : "a receber"}` : "Nenhum fechado ainda"}
        />
      </div>
      <div className="grid gap-5 lg:grid-cols-5">
        <div className="min-w-0 lg:col-span-3">
          <AgendaHoje consultas={dados.hoje} titulo="Meus pacientes de hoje" />
        </div>
        <div className="grid min-w-0 content-start gap-5 lg:col-span-2">
          {/* Para o médico, só o que muda a agenda dele */}
          {dados.pendencias.some((p) => p.chave === "reagendar") && (
            <PedeAtencao itens={dados.pendencias.filter((p) => p.chave === "reagendar")} titulo="Avisos" vazio="" />
          )}
          <ProximosPacientes consultas={dados.proximos} />
        </div>
      </div>
    </div>
  );
}
