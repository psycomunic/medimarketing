import "server-only";

import { createAdminClient, adminDisponivel } from "@/lib/supabase/admin";
import type {
  Bloqueio,
  Disponibilidade,
  Fechamento,
  Organization,
  PrecoProcedimento,
  Profile,
} from "@/lib/supabase/types";
import { catalogoServicos, precoDoServico, type Servico } from "@/lib/servicos";
import { temFaixa, textoValor } from "@/lib/financeiro/precos";
import { limiteValido, type ConsultaOcupando } from "@/lib/agenda-capacidade";
import { horariosDoDia, minutosDe, periodoDe, type RegraFechamento } from "@/lib/agenda-horarios";
import { diaEmBrasilia, instanteEmBrasilia, somarDias } from "@/lib/lembretes";
import { slugAgenda } from "@/lib/agendar-slug";
import {
  DEMO_SLUGS_AGENDA,
  demoBloqueios,
  demoConsultas,
  demoDisponibilidade,
  demoEquipe,
  demoFechamentos,
  demoOrganization,
  demoServicosDosProfissionais,
} from "@/lib/demo";
import { demoPrecos } from "@/lib/demo-financeiro";

/**
 * AGENDA PÚBLICA DE UM PROFISSIONAL
 *
 * O que o link /agendar/<clinica>/<profissional> mostra: só horários
 * livres, calculados aqui no servidor com a mesma regra da agenda interna
 * (lib/agenda-horarios.ts), em hora de Brasília. Nada de outros pacientes
 * sai daqui — nem nome, nem quantas consultas há em cada horário.
 *
 * É também o que o agendamento confere antes de gravar: o horário pedido
 * precisa estar nesta lista, calculada de novo no momento do clique.
 */

export type HorarioPublico = { hora: string; iso: string; periodo: "manha" | "tarde" | "noite" };
export type DiaPublico = { dia: string; semana: number; horarios: HorarioPublico[] };
export type ServicoPublico = {
  /** Nulo: profissional sem serviços na tabela ("Consulta"). */
  id: string | null;
  slug: string;
  nome: string;
  duracao: number;
  /** Texto do preço, só quando a clínica escolheu mostrar. */
  preco: string | null;
  valor: number | null;
  dias: DiaPublico[];
};
export type AgendaPublica = {
  clinica: {
    id: string;
    nome: string;
    slug: string;
    logoUrl: string | null;
    endereco: string | null;
    telefone: string | null;
  };
  profissional: { id: string; nome: string; especialidade: string | null; fotoUrl: string | null; slug: string };
  servicos: ServicoPublico[];
  prazoDias: number;
  demo: boolean;
};

export type ResultadoAgenda =
  | { ok: true; agenda: AgendaPublica }
  | { ok: false; motivo: "nao_encontrado" }
  | { ok: false; motivo: "desligado"; clinica: AgendaPublica["clinica"]; profissional: string };

type Fontes = {
  org: Organization;
  prof: Profile;
  precos: PrecoProcedimento[];
  vinculados: string[];
  disponibilidade: Disponibilidade[];
  bloqueios: Bloqueio[];
  fechamentos: Fechamento[];
  consultas: ConsultaOcupando[];
  demo: boolean;
};

export async function carregarAgendaPublica(slugClinica: string, slugProfissional: string): Promise<ResultadoAgenda> {
  const fontes = slugClinica === demoOrganization.slug ? fontesDemo(slugProfissional) : await fontesReais(slugClinica, slugProfissional);
  if (!fontes) return { ok: false, motivo: "nao_encontrado" };
  if ("desligado" in fontes) return fontes.desligado;
  return { ok: true, agenda: montar(fontes) };
}

function dadosClinica(org: Organization): AgendaPublica["clinica"] {
  return {
    id: org.id,
    nome: org.nome,
    slug: org.slug ?? "",
    logoUrl: org.logo_url,
    endereco: [org.endereco, org.cidade].filter(Boolean).join(" · ") || null,
    telefone: org.telefone,
  };
}

async function fontesReais(
  slugClinica: string,
  slugProfissional: string
): Promise<Fontes | { desligado: ResultadoAgenda } | null> {
  if (!adminDisponivel()) return null;
  const admin = createAdminClient();

  const { data: org } = await admin.from("organizations").select("*").eq("slug", slugClinica).eq("ativo", true).maybeSingle();
  if (!org) return null;
  const { data: perfil } = await admin
    .from("profiles")
    .select("*")
    .eq("organization_id", org.id)
    .eq("slug_agenda", slugProfissional)
    .eq("ativo", true)
    .maybeSingle();
  const prof = perfil as (Profile & { agenda_publica?: boolean }) | null;
  if (!prof) return null;
  if (!prof.agenda_publica) {
    return {
      desligado: { ok: false, motivo: "desligado", clinica: dadosClinica(org as Organization), profissional: prof.nome ?? "" },
    };
  }

  const prazo = (org as Organization).agendamento_prazo_dias ?? 30;
  const agora = new Date();
  const ate = new Date(agora.getTime() + (prazo + 2) * 86_400_000);

  const [{ data: precos }, { data: vinculos }, { data: disponibilidade }, { data: bloqueios }, { data: fechamentos }, { data: consultas }] =
    await Promise.all([
      admin.from("tabela_precos").select("*").eq("organization_id", org.id),
      admin.from("profissional_servicos").select("servico_id").eq("medico_id", prof.id),
      admin.from("disponibilidade").select("*").eq("medico_id", prof.id),
      admin.from("bloqueios").select("*").eq("medico_id", prof.id).gte("data_fim", agora.toISOString()),
      admin.from("fechamentos").select("*").eq("medico_id", prof.id),
      admin
        .from("consultas")
        .select("id,medico_id,data_hora,duracao_min,status")
        .eq("organization_id", org.id)
        .neq("status", "cancelada")
        .gte("data_hora", new Date(agora.getTime() - 8 * 3600000).toISOString())
        .lte("data_hora", ate.toISOString()),
    ]);

  return {
    org: org as Organization,
    prof,
    precos: (precos ?? []) as PrecoProcedimento[],
    vinculados: (vinculos ?? []).map((v) => v.servico_id),
    disponibilidade: (disponibilidade ?? []) as Disponibilidade[],
    bloqueios: (bloqueios ?? []) as Bloqueio[],
    fechamentos: (fechamentos ?? []) as Fechamento[],
    consultas: (consultas ?? []) as ConsultaOcupando[],
    demo: false,
  };
}

/** A demonstração também tem link: /agendar/vida-derma/dra-marina-alves */
function fontesDemo(slugProfissional: string): Fontes | null {
  const id = Object.entries(DEMO_SLUGS_AGENDA).find(([, s]) => s === slugProfissional)?.[0];
  if (!id) return null;
  const prof = demoEquipe(demoOrganization.id).find((p) => p.id === id);
  if (!prof) return null;
  return {
    org: demoOrganization,
    prof,
    precos: demoPrecos(),
    vinculados: demoServicosDosProfissionais()
      .filter((v) => v.medico_id === id)
      .map((v) => v.servico_id),
    disponibilidade: demoDisponibilidade().filter((d) => d.medico_id === id),
    bloqueios: demoBloqueios().filter((b) => b.medico_id === id),
    fechamentos: demoFechamentos().filter((f) => f.medico_id === id),
    consultas: demoConsultas() as ConsultaOcupando[],
    demo: true,
  };
}

function montar(f: Fontes): AgendaPublica {
  const org = f.org;
  const prazo = org.agendamento_prazo_dias ?? 30;
  const antecedenciaMin = (org.agendamento_antecedencia_h ?? 2) * 60;
  const mostrarPreco = !!org.agendamento_mostrar_preco;
  const limite = limiteValido(org.max_consultas_horario);
  const agora = new Date();
  const hoje = diaEmBrasilia(agora);

  // Os serviços dele; sem nenhum marcado, os da clínica; sem tabela, "Consulta"
  const catalogo = catalogoServicos(f.precos);
  const seus: (Servico | null)[] = f.vinculados.length
    ? catalogo.filter((s) => f.vinculados.includes(s.id) || s.linhas.some((l) => f.vinculados.includes(l.id)))
    : catalogo;
  const lista = seus.length ? seus : [null];

  const servicos: ServicoPublico[] = lista.map((s) => {
    const particular = s ? precoDoServico(s, null) : null;
    const duracao = particular?.duracao_min || 30;
    const valor = particular && !temFaixa(particular) && Number(particular.valor) ? Number(particular.valor) : null;
    const dias: DiaPublico[] = [];

    for (let i = 0; i <= prazo; i++) {
      const dia = somarDias(hoje, i);
      const semana = new Date(`${dia}T12:00:00Z`).getUTCDay();
      const janelas = f.disponibilidade
        .filter((d) => d.dia_semana === semana)
        .map((d) => ({ ini: minutosDe(d.hora_inicio), fim: minutosDe(d.hora_fim) }));
      if (!janelas.length) continue;

      const livres = horariosDoDia({
        dia,
        semana,
        medicoId: f.prof.id,
        servicoId: s?.id ?? null,
        duracao,
        janelas,
        fechamentos: f.fechamentos as RegraFechamento[],
        bloqueios: f.bloqueios,
        consultas: f.consultas,
        limite,
        agora,
        antecedenciaMin,
        instante: instanteEmBrasilia,
      }).filter((h) => h.livre);

      if (livres.length) {
        dias.push({
          dia,
          semana,
          horarios: livres.map((h) => ({ hora: h.hora, iso: h.iso, periodo: periodoDe(h.minutos) })),
        });
      }
    }

    return {
      id: s?.id ?? null,
      slug: slugAgenda(s?.nome ?? "consulta"),
      nome: s?.nome ?? "Consulta",
      duracao,
      preco: mostrarPreco && particular && Number(particular.valor) ? textoValor(particular) : null,
      valor,
      dias,
    };
  });

  return {
    clinica: dadosClinica(org),
    profissional: {
      id: f.prof.id,
      nome: nomeComTratamento(f.prof),
      especialidade: f.prof.especialidade,
      fotoUrl: f.prof.foto_url,
      slug: f.prof.slug_agenda ?? DEMO_SLUGS_AGENDA[f.prof.id] ?? "",
    },
    servicos,
    prazoDias: prazo,
    demo: f.demo,
  };
}

/** "Dra. Marina Alves" — sem repetir o "Dra." quando já vem no nome. */
function nomeComTratamento(p: Pick<Profile, "nome" | "tratamento">): string {
  const nome = (p.nome ?? "").trim();
  const t = p.tratamento?.trim();
  if (!nome) return "Profissional";
  return t && !nome.toLowerCase().startsWith(t.toLowerCase()) ? `${t} ${nome}` : nome;
}
