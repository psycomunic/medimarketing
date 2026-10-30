"use client";

import type { PacienteBasico } from "@/lib/supabase/pacientes";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addDays, addMinutes, differenceInCalendarDays, differenceInYears, format, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Bell,
  BellRing,
  CalendarCheck,
  FileText,
  Paperclip,
  X,
  Clock,
  History,
  Loader2,
  Mail,
  MessageCircle,
  Plus,
  RotateCcw,
  Search,
  Stethoscope,
  TriangleAlert,
  UserPlus,
  Video,
} from "lucide-react";
import type { Bloqueio, Disponibilidade, PrecoProcedimento, TipoConsulta } from "@/lib/supabase/types";
import type { ConsultaComContexto } from "@/lib/supabase/queries";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { rotuloTipo } from "@/lib/agenda";
import { criarConsulta } from "@/lib/actions/consultas";
import { salvarAnexo } from "@/lib/actions/anexos";
import { calcularDisparo } from "@/lib/lembretes";
import { cn } from "@/lib/utils";
import { catalogoServicos, porCategoria, precoDoServico, resumoPreco } from "@/lib/servicos";
import { temFaixa, textoDuracao, textoValor } from "@/lib/financeiro/precos";

// Convênios mais comuns no Brasil. O que não estiver aqui entra por
// "Outro convênio", e passa a aparecer na lista da clínica depois.
const CONVENIOS = [
  "Unimed",
  "Bradesco Saúde",
  "SulAmérica",
  "Amil",
  "NotreDame Intermédica",
  "Hapvida",
  "Porto Seguro Saúde",
  "Prevent Senior",
  "Golden Cross",
  "Care Plus",
  "Omint",
  "Allianz Saúde",
  "Mediservice",
  "MedSênior",
  "Seguros Unimed",
  "Alice",
  "Sami",
  "QSaúde",
  "Leve Saúde",
  "Assim Saúde",
  "São Francisco Saúde",
  "Plena Saúde",
  "Ameplan",
  "Trasmontano",
  "Biovida",
  "Clinipam",
  "Cassi",
  "Geap",
  "Saúde Caixa",
  "Postal Saúde",
  "Saúde Petrobras",
  "Cabesp",
  "Economus",
  "IAMSPE",
  "IPSEMG",
  "Fusex",
];
const OUTRO = "__outro";
/** Atendimento fora da Tabela de preços. */
const OUTRO_SERVICO = "__outro_servico";

const DURACOES = [15, 20, 30, 40, 45, 60, 90];

const MAX_ANEXO = 10 * 1024 * 1024;
const TIPOS_ANEXO = ".pdf,.jpg,.jpeg,.png,.webp,.heic,.doc,.docx,image/*,application/pdf";

function tamanhoLegivel(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}

const ICONE_TIPO: Record<TipoConsulta, typeof UserPlus> = {
  primeira: UserPlus,
  retorno: RotateCcw,
  teleconsulta: Video,
};

const selectClass =
  "flex h-11 w-full rounded-md border border-input bg-white px-4 text-sm text-cinza-texto shadow-sm focus-visible:border-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40";

export type OpcaoProfissional = {
  id: string;
  nome: string;
  organization_id: string | null;
};

type PacienteConhecido = {
  nome: string;
  telefone: string | null;
  email: string | null;
  nascimento: string | null;
  convenio: string | null;
  consultas: number;
  ultima: string;
  /** Valor da última consulta, para sugerir. */
  valor: number | null;
};

const soDigitos = (s: string) => s.replace(/\D/g, "");

/** (11) 99999-9999 enquanto digita. */
function mascaraTelefone(bruto: string): string {
  const d = soDigitos(bruto).slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

const minutos = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
};
const hhmm = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return "?";
  return ((partes[0][0] ?? "") + (partes.length > 1 ? partes[partes.length - 1][0] : "")).toUpperCase();
}

function Secao({
  n,
  titulo,
  children,
  className,
}: {
  n: number;
  titulo: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-xl border border-border bg-white p-4 sm:p-5", className)}>
      <h3 className="mb-4 flex items-center gap-2.5 text-sm font-semibold text-azul-medico">
        <span className="grid size-6 place-items-center rounded-full bg-verde-menta text-xs font-bold text-teal">
          {n}
        </span>
        {titulo}
      </h3>
      {children}
    </section>
  );
}

export function NovaConsultaDialog({
  onCriada,
  aberto,
  data,
  onOpenChange,
  profissionais = [],
  clinicas = [],
  usuarioId,
  organizationId,
  conveniosUsados = [],
  consultas = [],
  pacientesBanco = [],
  disponibilidade = [],
  bloqueios = [],
  envioAutomatico = false,
  lembrete = null,
  servicos = [],
}: {
  aberto: boolean;
  data: Date | null;
  onOpenChange: (aberto: boolean) => void;
  /** Equipe que pode atender. Vazio = só quem está criando. */
  profissionais?: OpcaoProfissional[];
  /** Só tem mais de uma para o super admin. */
  clinicas?: { id: string; nome: string }[];
  usuarioId?: string;
  /** Clínica de quem está criando; nula para o super admin. */
  organizationId?: string | null;
  /** Convênios que a clínica já usou: entram no topo da lista. */
  conveniosUsados?: string[];
  /** Consultas já carregadas: dão os horários ocupados e os pacientes conhecidos. */
  consultas?: ConsultaComContexto[];
  /** Fichas do banco de pacientes, inclusive quem ainda não tem consulta. */
  pacientesBanco?: PacienteBasico[];
  /** Horário de atendimento semanal de cada profissional. */
  disponibilidade?: Disponibilidade[];
  /** Folgas e férias. */
  bloqueios?: Bloqueio[];
  /** A clínica tem WhatsApp conectado para o aviso ao paciente. */
  envioAutomatico?: boolean;
  /** Régua do lembrete da clínica, para dizer quando ele sai. */
  lembrete?: { ativo: boolean; diasUteis: number; hora: number } | null;
  /** Avisa a data criada, para a agenda ir até ela. */
  onCriada?: (quando: Date) => void;
  /** Tabela de preços: os serviços que a clínica oferece. */
  servicos?: PrecoProcedimento[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  // --- Campos do formulário ---
  const [nome, setNome] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [conhecido, setConhecido] = useState<PacienteConhecido | null>(null);
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [nascimento, setNascimento] = useState("");
  const [convenio, setConvenio] = useState("Particular");
  const [convenioOutro, setConvenioOutro] = useState(false);
  const [dia, setDia] = useState("");
  const [hora, setHora] = useState("09:00");
  const [duracao, setDuracao] = useState(30);
  const [tipo, setTipo] = useState<TipoConsulta>("primeira");
  const [motivo, setMotivo] = useState("");
  const [valor, setValor] = useState("");
  const [servicoId, setServicoId] = useState("");
  // Valor digitado à mão não é sobrescrito pela tabela
  const [valorManual, setValorManual] = useState(false);
  const [observacao, setObservacao] = useState("");
  const [avisarPaciente, setAvisarPaciente] = useState(true);
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [arrastando, setArrastando] = useState(false);
  const [etapa, setEtapa] = useState<string | null>(null);
  const [clinicaId, setClinicaId] = useState(organizationId ?? clinicas[0]?.id ?? "");
  // Só pré-seleciona a si mesmo quem de fato atende na clínica
  const [medicoId, setMedicoId] = useState(
    profissionais.some((p) => p.id === usuarioId) ? usuarioId ?? "" : ""
  );

  const usados = [...new Set(conveniosUsados.map((c) => c.trim()).filter(Boolean))]
    .filter((c) => c.toLowerCase() !== "particular")
    .sort((a, b) => a.localeCompare(b, "pt-BR"));

  // Trocar de clínica invalida um profissional de outra
  const daClinica = profissionais.filter(
    (p) => !clinicaId || p.organization_id === clinicaId
  );
  const precisaEscolherClinica = clinicas.length > 1;
  const medico = profissionais.find((p) => p.id === medicoId) ?? null;

  // Serviços da tabela de preços da clínica escolhida
  const catalogo = useMemo(
    () => catalogoServicos(servicos.filter((p) => !clinicaId || p.organization_id === clinicaId)),
    [servicos, clinicaId]
  );
  const servico = catalogo.find((x) => x.id === servicoId) ?? null;
  const precoServico = servico ? precoDoServico(servico, convenio) : null;

  /** Preenche duração e valor pela tabela (o valor só se ninguém digitou). */
  function aplicarPreco(p: PrecoProcedimento | null, manual = valorManual) {
    if (!p) return;
    if (p.duracao_min) setDuracao(p.duracao_min);
    if (!manual) setValor(temFaixa(p) || !Number(p.valor) ? "" : Number(p.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 }));
  }

  function escolherServico(id: string) {
    setServicoId(id);
    setValorManual(false);
    const s = catalogo.find((x) => x.id === id);
    if (s) aplicarPreco(precoDoServico(s, convenio), false);
  }

  // Trocou o convênio: o preço do serviço pode ser outro
  useEffect(() => {
    if (precoServico) aplicarPreco(precoServico);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convenio]);

  // Com um profissional só, ele já vem escolhido
  useEffect(() => {
    if (!medicoId && daClinica.length === 1) setMedicoId(daClinica[0].id);
  }, [medicoId, daClinica]);

  // Reinicia o formulário ao abrir, preenchendo a data escolhida
  useEffect(() => {
    if (aberto) {
      const base = data ?? new Date();
      setDia(format(base, "yyyy-MM-dd"));
      setErro(null);
    }
  }, [aberto, data]);

  function limpar() {
    setNome("");
    setConhecido(null);
    setTelefone("");
    setEmail("");
    setNascimento("");
    setConvenio("Particular");
    setConvenioOutro(false);
    setDuracao(30);
    setTipo("primeira");
    setMotivo("");
    setValor("");
    setServicoId("");
    setValorManual(false);
    setObservacao("");
    setAvisarPaciente(true);
    setArquivos([]);
    setEtapa(null);
  }

  function adicionarArquivos(lista: FileList | File[] | null) {
    if (!lista) return;
    const novos: File[] = [];
    const grandes: string[] = [];
    for (const f of Array.from(lista)) {
      if (f.size > MAX_ANEXO) grandes.push(f.name);
      else if (!arquivos.some((a) => a.name === f.name && a.size === f.size)) novos.push(f);
    }
    setArquivos((atual) => [...atual, ...novos].slice(0, 10));
    setErro(grandes.length ? `Acima de 10 MB, não entra: ${grandes.join(", ")}.` : null);
  }

  /* ------------------------ Pacientes já atendidos ------------------------ */

  // Uma ficha por pessoa (telefone, ou nome quando não há telefone),
  // com os dados da consulta mais recente.
  const pacientes = useMemo(() => {
    const mapa = new Map<string, PacienteConhecido>();
    const ordenadas = [...consultas]
      .filter((c) => !clinicaId || c.organization_id === clinicaId)
      .sort((a, b) => b.data_hora.localeCompare(a.data_hora));
    for (const c of ordenadas) {
      const chave = soDigitos(c.paciente_telefone ?? "") || c.paciente_nome.trim().toLowerCase();
      const ja = mapa.get(chave);
      if (ja) {
        ja.consultas += 1;
        continue;
      }
      mapa.set(chave, {
        nome: c.paciente_nome,
        telefone: c.paciente_telefone,
        email: c.paciente_email,
        nascimento: c.paciente_nascimento,
        convenio: c.convenio,
        consultas: 1,
        ultima: c.data_hora,
        valor: c.valor != null ? Number(c.valor) : null,
      });
    }
    // Quem está no banco mas nunca veio (cadastro manual ou importação)
    for (const b of pacientesBanco) {
      if (clinicaId && b.organization_id !== clinicaId) continue;
      const chave = soDigitos(b.telefone ?? "") || b.nome.trim().toLowerCase();
      if (mapa.has(chave)) continue;
      mapa.set(chave, {
        nome: b.nome,
        telefone: b.telefone,
        email: b.email,
        nascimento: b.nascimento,
        convenio: b.convenio,
        consultas: 0,
        ultima: "",
        valor: null,
      });
    }
    return [...mapa.values()];
  }, [consultas, pacientesBanco, clinicaId]);

  const sugestoes = useMemo(() => {
    const termo = nome.trim().toLowerCase();
    if (termo.length < 2 || conhecido) return [];
    const digitos = soDigitos(termo);
    return pacientes
      .filter(
        (p) =>
          p.nome.toLowerCase().includes(termo) ||
          (digitos.length >= 4 && soDigitos(p.telefone ?? "").includes(digitos))
      )
      .slice(0, 5);
  }, [nome, pacientes, conhecido]);

  function escolherPaciente(p: PacienteConhecido) {
    setConhecido(p);
    setNome(p.nome);
    setTelefone(p.telefone ? mascaraTelefone(p.telefone) : "");
    setEmail(p.email ?? "");
    setNascimento(p.nascimento ?? "");
    const conv = p.convenio?.trim() || "Particular";
    setConvenio(conv);
    setConvenioOutro(false);
    // Ficha sem consulta (cadastrada ou importada): é a primeira vez
    setTipo(p.consultas > 0 ? "retorno" : "primeira");
    if (!valor && p.valor && !servicoId) setValor(String(p.valor).replace(".", ","));
    setBuscando(false);
  }

  const idade =
    nascimento && isValid(new Date(nascimento))
      ? differenceInYears(new Date(), new Date(`${nascimento}T12:00:00`))
      : null;

  /* ------------------------------ Horários ------------------------------ */

  const escolhida = new Date(`${dia}T${hora || "00:00"}:00`);
  const dataValida = isValid(escolhida);

  // Consultas do profissional nesse dia, para marcar o que está ocupado
  const ocupadas = useMemo(() => {
    if (!dia || !medicoId) return [];
    return consultas
      .filter(
        (c) =>
          c.medico_id === medicoId &&
          c.status !== "cancelada" &&
          format(new Date(c.data_hora), "yyyy-MM-dd") === dia
      )
      .map((c) => {
        const ini = new Date(c.data_hora);
        const m = ini.getHours() * 60 + ini.getMinutes();
        return { ini: m, fim: m + (c.duracao_min ?? 30), paciente: c.paciente_nome };
      });
  }, [consultas, medicoId, dia]);

  const janelas = useMemo(() => {
    if (!dia || !medicoId) return [];
    const semana = new Date(`${dia}T12:00:00`).getDay();
    return disponibilidade
      .filter((d) => d.medico_id === medicoId && d.dia_semana === semana)
      .map((d) => ({ ini: minutos(d.hora_inicio), fim: minutos(d.hora_fim) }))
      .sort((a, b) => a.ini - b.ini);
  }, [disponibilidade, medicoId, dia]);

  const semExpediente = janelas.length === 0;

  const bloqueado = useMemo(() => {
    if (!dia || !medicoId) return [] as { ini: number; fim: number }[];
    const inicioDia = new Date(`${dia}T00:00:00`).getTime();
    const fimDia = inicioDia + 24 * 60 * 60 * 1000;
    return bloqueios
      .filter((b) => b.medico_id === medicoId)
      .map((b) => ({ a: new Date(b.data_inicio).getTime(), b: new Date(b.data_fim).getTime() }))
      .filter((b) => b.a < fimDia && b.b > inicioDia)
      .map((b) => ({
        ini: Math.max(0, Math.round((b.a - inicioDia) / 60000)),
        fim: Math.min(24 * 60, Math.round((b.b - inicioDia) / 60000)),
      }));
  }, [bloqueios, medicoId, dia]);

  const horarios = useMemo(() => {
    if (!dia) return [];
    const passo = duracao <= 20 ? duracao : 30;
    const base = semExpediente ? [{ ini: 8 * 60, fim: 18 * 60 }] : janelas;
    const agora = new Date();
    const ehHoje = dia === format(agora, "yyyy-MM-dd");
    const agoraMin = agora.getHours() * 60 + agora.getMinutes();
    const lista: { hora: string; livre: boolean; motivo?: string }[] = [];
    for (const j of base) {
      for (let m = j.ini; m + duracao <= j.fim; m += passo) {
        const conflito = ocupadas.find((o) => m < o.fim && m + duracao > o.ini);
        const folga = bloqueado.some((b) => m < b.fim && m + duracao > b.ini);
        const passou = ehHoje && m < agoraMin;
        lista.push({
          hora: hhmm(m),
          livre: !conflito && !folga && !passou,
          motivo: conflito ? conflito.paciente : folga ? "Bloqueado" : passou ? "Já passou" : undefined,
        });
      }
    }
    return lista;
  }, [dia, duracao, janelas, semExpediente, ocupadas, bloqueado]);

  const livres = horarios.filter((h) => h.livre).length;
  const inicioEscolhido = minutos(hora || "00:00");
  const conflitoEscolhido = ocupadas.find(
    (o) => inicioEscolhido < o.fim && inicioEscolhido + duracao > o.ini
  );
  const emFolga = bloqueado.some((b) => inicioEscolhido < b.fim && inicioEscolhido + duracao > b.ini);

  /*
   * Conferência do que foi escolhido, escrita por extenso.
   *
   * O <input type="date"> desenha o formato conforme o idioma do
   * navegador, não o da página: num Chrome em inglês ele mostra
   * mm/dd/yyyy, e quem digita "12/08" pensando em 12 de agosto marca
   * 8 de dezembro. Escrever a data por extenso, em português, torna o
   * engano impossível de não ver.
   */
  const diasAdiante = dataValida ? differenceInCalendarDays(escolhida, new Date()) : 0;
  const porExtenso = dataValida
    ? format(escolhida, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })
    : null;
  const distancia = !dataValida
    ? null
    : diasAdiante === 0
      ? "hoje"
      : diasAdiante === 1
        ? "amanhã"
        : diasAdiante === -1
          ? "ontem"
          : diasAdiante < 0
            ? `${Math.abs(diasAdiante)} dias atrás`
            : `daqui a ${diasAdiante} dias`;
  // Passado é quase sempre engano; muito longe costuma ser dia/mês trocados
  const suspeita = dataValida && (diasAdiante < 0 || diasAdiante > 120);
  const fimConsulta = dataValida ? format(addMinutes(escolhida, duracao), "HH:mm") : null;

  const atalhosDia = [
    { rotulo: "Hoje", d: new Date() },
    { rotulo: "Amanhã", d: addDays(new Date(), 1) },
    { rotulo: "Em 7 dias", d: addDays(new Date(), 7) },
    { rotulo: "Em 30 dias", d: addDays(new Date(), 30) },
  ];

  /* ------------------------------- Envio ------------------------------- */

  const valorNum = valor.trim() ? Number(valor.replace(/\./g, "").replace(",", ".")) : undefined;
  const avisoWhats = envioAutomatico && soDigitos(telefone).length >= 10;
  const avisoEmail = /\S+@\S+\.\S+/.test(email);

  // Quando o lembrete com o link de confirmação sai, pela régua da clínica
  const disparoLembrete =
    lembrete?.ativo && dataValida ? calcularDisparo(escolhida, lembrete.diasUteis, lembrete.hora) : null;
  const lembreteJaPassou = disparoLembrete ? disparoLembrete.getTime() <= Date.now() : false;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!nome.trim()) {
      setErro("Informe o nome do paciente.");
      return;
    }
    if (!medicoId && daClinica.length > 0) {
      setErro("Escolha o médico responsável.");
      return;
    }
    if (!dataValida) {
      setErro("Escolha a data e o horário.");
      return;
    }
    if (catalogo.length > 0 && !servicoId) {
      setErro("Escolha o serviço da consulta (ou \"Outro serviço\").");
      return;
    }
    if (valorNum !== undefined && !Number.isFinite(valorNum)) {
      setErro("O valor precisa ser um número, como 350,00.");
      return;
    }
    const dataHora = new Date(`${dia}T${hora}:00`);

    startTransition(async () => {
      setEtapa("Criando a consulta…");
      const res = await criarConsulta({
        paciente_nome: nome,
        paciente_telefone: telefone,
        paciente_email: email,
        paciente_nascimento: nascimento || undefined,
        convenio,
        data_hora: dataHora.toISOString(),
        duracao_min: duracao,
        tipo,
        motivo,
        observacao,
        valor: valorNum,
        servico_id: servico?.id,
        medico_id: medicoId || undefined,
        organization_id: clinicaId || undefined,
        avisar_paciente: avisarPaciente,
      });
      if (!res.ok) {
        setEtapa(null);
        setErro(res.erro);
        return;
      }

      // Os documentos sobem depois, já ligados à consulta criada
      const falharam: string[] = [];
      for (const [i, f] of arquivos.entries()) {
        setEtapa(`Enviando documento ${i + 1} de ${arquivos.length}…`);
        const fd = new FormData();
        fd.append("file", f);
        const up = await salvarAnexo(res.id, fd).catch(() => ({ ok: false as const, erro: "" }));
        if (!up.ok) falharam.push(f.name);
      }

      // Leva a agenda até a consulta criada. Sem isso, marcar num mês
      // que não é o que está na tela parece que a consulta sumiu.
      onCriada?.(dataHora);
      router.refresh();

      if (falharam.length) {
        // A consulta existe: o que faltou dá para anexar na ficha dela
        setEtapa(null);
        setArquivos(arquivos.filter((f) => falharam.includes(f.name)));
        setErro(
          `Consulta criada, mas ${falharam.length === 1 ? "um documento não subiu" : `${falharam.length} documentos não subiram`}: ${falharam.join(", ")}. Abra a consulta na agenda e anexe de novo.`
        );
        return;
      }
      limpar();
      onOpenChange(false);
    });
  }

  const TipoIcone = ICONE_TIPO[tipo];

  return (
    <Dialog open={aberto} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl gap-0 bg-branco-clinico p-0">
        <DialogHeader className="border-b border-border bg-white px-5 py-4 sm:px-6">
          <DialogTitle>Nova consulta</DialogTitle>
          <DialogDescription>
            Marque o paciente, o médico e o horário. O médico é avisado na hora, e o
            paciente recebe a confirmação.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="grid min-w-0">
          <div className="grid min-w-0 gap-4 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <div className="grid min-w-0 gap-4">
              {/* ---------- 1. Atendimento ----------
                  Vem primeiro porque define o resto: a clínica determina
                  quais profissionais aparecem, e o médico, os horários
                  livres. */}
              <Secao n={1} titulo="Atendimento">
                <div className="grid gap-4 sm:grid-cols-2">
                  {precisaEscolherClinica && (
                    <div className="grid gap-1.5">
                      <Label htmlFor="clinica">
                        Clínica <span className="text-coral">*</span>
                      </Label>
                      <select
                        id="clinica"
                        className={selectClass}
                        value={clinicaId}
                        onChange={(e) => {
                          setClinicaId(e.target.value);
                          setConhecido(null);
                          // O profissional escolhido pode não ser desta clínica
                          const aindaVale = profissionais.some(
                            (p) => p.id === medicoId && p.organization_id === e.target.value
                          );
                          if (!aindaVale) setMedicoId("");
                        }}
                      >
                        <option value="">Selecione…</option>
                        {clinicas.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.nome}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {clinicaId && daClinica.length === 0 ? (
                    <p className="rounded-md border border-dashed border-alerta/40 bg-alerta/5 px-3 py-2.5 text-xs text-cinza-suave sm:col-span-2">
                      Esta clínica ainda não tem nenhum profissional cadastrado. Crie o
                      acesso do médico em{" "}
                      <a href="/app/admin/usuarios" className="font-semibold text-teal hover:underline">
                        Usuários
                      </a>{" "}
                      antes de marcar a consulta: é ele que aparece na agenda e na
                      mensagem enviada ao paciente.
                    </p>
                  ) : (
                    <div className={cn("grid gap-1.5", !precisaEscolherClinica && "sm:col-span-2")}>
                      <Label htmlFor="profissional">
                        Médico responsável <span className="text-coral">*</span>
                      </Label>
                      <select
                        id="profissional"
                        className={selectClass}
                        value={medicoId}
                        onChange={(e) => setMedicoId(e.target.value)}
                      >
                        <option value="">Selecione…</option>
                        {daClinica.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.nome}
                            {p.id === usuarioId ? " (você)" : ""}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-cinza-suave">
                        Recebe o aviso desta consulta no painel, no WhatsApp e no e-mail.
                        Não está na lista? O acesso dele precisa ser de Médico(a).
                      </p>
                    </div>
                  )}
                </div>

                <div className="mt-4 grid gap-1.5">
                  <span className="text-sm font-medium text-cinza-texto">Tipo de consulta</span>
                  <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Tipo de consulta">
                    {(Object.keys(rotuloTipo) as TipoConsulta[]).map((t) => {
                      const Icone = ICONE_TIPO[t];
                      const ativo = tipo === t;
                      return (
                        <button
                          key={t}
                          type="button"
                          role="radio"
                          aria-checked={ativo}
                          onClick={() => setTipo(t)}
                          className={cn(
                            "flex flex-col items-center gap-1.5 rounded-lg border px-2 py-3 text-center text-xs font-medium transition-colors sm:flex-row sm:justify-center sm:text-sm",
                            ativo
                              ? "border-teal bg-verde-menta text-azul-medico ring-1 ring-teal"
                              : "border-border bg-white text-cinza-suave hover:border-teal/50 hover:text-azul-medico"
                          )}
                        >
                          <Icone className={cn("size-4 shrink-0", ativo && "text-teal")} />
                          {rotuloTipo[t]}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-4 grid gap-1.5">
                  <Label htmlFor="servico">
                    Serviço {catalogo.length > 0 && <span className="text-coral">*</span>}
                  </Label>
                  {catalogo.length > 0 ? (
                    <>
                      <select id="servico" className={selectClass} value={servicoId} onChange={(e) => escolherServico(e.target.value)}>
                        <option value="">Selecione o serviço…</option>
                        {porCategoria(catalogo).map(([categoria, lista]) => (
                          <optgroup key={categoria} label={categoria}>
                            {lista.map((x) => {
                              const r = resumoPreco(precoDoServico(x, convenio));
                              return (
                                <option key={x.id} value={x.id}>
                                  {x.nome}
                                  {r ? ` — ${r}` : ""}
                                </option>
                              );
                            })}
                          </optgroup>
                        ))}
                        <option value={OUTRO_SERVICO}>Outro serviço (fora da tabela)</option>
                      </select>
                      {precoServico && (
                        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-cinza-suave">
                          <span className="rounded-full bg-verde-menta px-2 py-0.5 font-semibold text-azul-medico">
                            {Number(precoServico.valor) || temFaixa(precoServico) ? textoValor(precoServico) : "Sem cobrança"}
                          </span>
                          {textoDuracao(precoServico) && <span>{textoDuracao(precoServico)}</span>}
                          {precoServico.convenio && <span>Preço do {precoServico.convenio}.</span>}
                          {temFaixa(precoServico) && <span>Informe o valor cobrado em Detalhes.</span>}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="rounded-md border border-dashed border-border px-3 py-2.5 text-xs text-cinza-suave">
                      Nenhum serviço cadastrado ainda.{" "}
                      <a href="/app/financeiro/configuracoes" className="font-medium text-teal hover:underline">
                        Cadastre os serviços na Tabela de preços
                      </a>{" "}
                      para escolher aqui e ver quanto cada um rende.
                    </p>
                  )}
                </div>
              </Secao>

              {/* ---------- 2. Paciente ---------- */}
              <Secao n={2} titulo="Paciente">
                <div className="relative grid gap-1.5">
                  <Label htmlFor="paciente">
                    Nome do paciente <span className="text-coral">*</span>
                  </Label>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-cinza-suave" />
                    <Input
                      id="paciente"
                      value={nome}
                      onChange={(e) => {
                        setNome(e.target.value);
                        setConhecido(null);
                        setBuscando(true);
                      }}
                      onFocus={() => setBuscando(true)}
                      onBlur={() => setTimeout(() => setBuscando(false), 150)}
                      placeholder="Digite o nome ou o telefone para buscar"
                      autoComplete="off"
                      className="pl-10"
                      autoFocus
                    />
                  </div>

                  {buscando && sugestoes.length > 0 && (
                    <ul className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-lg border border-border bg-white shadow-card">
                      <li className="border-b border-border bg-branco-clinico px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-cinza-suave">
                        Pacientes cadastrados
                      </li>
                      {sugestoes.map((p) => (
                        <li key={`${p.nome}-${p.telefone}`}>
                          <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => escolherPaciente(p)}
                            className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-verde-menta/60"
                          >
                            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-azul-medico text-xs font-bold text-white">
                              {iniciais(p.nome)}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium text-cinza-texto">{p.nome}</span>
                              <span className="block truncate text-xs text-cinza-suave">
                                {p.telefone ? mascaraTelefone(p.telefone) : "Sem telefone"} ·{" "}
                                {p.ultima
                                  ? `${p.consultas} consulta${p.consultas === 1 ? "" : "s"} · última em ${format(new Date(p.ultima), "dd/MM/yyyy")}`
                                  : "ainda sem consulta"}
                              </span>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {conhecido && (
                  <p className="mt-3 flex flex-wrap items-center gap-2 rounded-md bg-verde-menta/60 px-3 py-2 text-xs text-azul-medico">
                    <History className="size-4 shrink-0 text-teal" />
                    <span>
                      {conhecido.ultima ? (
                        <>
                          <strong>Paciente já atendido</strong> · {conhecido.consultas} consulta
                          {conhecido.consultas === 1 ? "" : "s"}, a última em {format(new Date(conhecido.ultima), "dd/MM/yyyy")}.
                          Dados preenchidos com o cadastro.
                        </>
                      ) : (
                        <>
                          <strong>Paciente cadastrado</strong> · primeira consulta. Dados preenchidos com a ficha.
                        </>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setConhecido(null);
                        setTipo("primeira");
                      }}
                      className="ml-auto font-semibold text-teal hover:underline"
                    >
                      Não é esse
                    </button>
                  </p>
                )}

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-1.5">
                    <Label htmlFor="telefone">WhatsApp / telefone</Label>
                    <Input
                      id="telefone"
                      value={telefone}
                      onChange={(e) => setTelefone(mascaraTelefone(e.target.value))}
                      placeholder="(11) 99999-9999"
                      inputMode="tel"
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="email">E-mail</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="paciente@email.com"
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="nascimento">
                      Data de nascimento
                      {idade !== null && idade >= 0 && idade < 130 && (
                        <span className="ml-1.5 font-normal text-cinza-suave">· {idade} anos</span>
                      )}
                    </Label>
                    <Input
                      id="nascimento"
                      type="date"
                      value={nascimento}
                      onChange={(e) => setNascimento(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="convenio">Convênio</Label>
                    <select
                      id="convenio"
                      value={convenioOutro ? OUTRO : convenio}
                      onChange={(e) => {
                        if (e.target.value === OUTRO) {
                          setConvenioOutro(true);
                          setConvenio("");
                        } else {
                          setConvenioOutro(false);
                          setConvenio(e.target.value);
                        }
                      }}
                      className={selectClass}
                    >
                      <option value="Particular">Particular</option>
                      {usados.length > 0 && (
                        <optgroup label="Já usados na clínica">
                          {usados.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      <optgroup label="Convênios">
                        {CONVENIOS.filter((c) => !usados.includes(c)).map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </optgroup>
                      <option value={OUTRO}>Outro convênio…</option>
                    </select>
                    {convenioOutro && (
                      <Input
                        aria-label="Nome do convênio"
                        value={convenio}
                        onChange={(e) => setConvenio(e.target.value)}
                        placeholder="Digite o nome do convênio"
                        autoFocus
                      />
                    )}
                  </div>
                </div>
              </Secao>

              {/* ---------- 3. Data e horário ---------- */}
              <Secao n={3} titulo="Data e horário">
                <div className="flex flex-wrap gap-2">
                  {atalhosDia.map((a) => {
                    const v = format(a.d, "yyyy-MM-dd");
                    return (
                      <button
                        key={a.rotulo}
                        type="button"
                        onClick={() => setDia(v)}
                        className={cn(
                          "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                          dia === v
                            ? "border-teal bg-verde-menta text-azul-medico"
                            : "border-border bg-white text-cinza-suave hover:text-azul-medico"
                        )}
                      >
                        {a.rotulo}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3">
                  <div className="grid gap-1.5">
                    <Label htmlFor="dia">Data</Label>
                    <Input id="dia" type="date" value={dia} onChange={(e) => setDia(e.target.value)} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="hora">Horário</Label>
                    <Input id="hora" type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
                  </div>
                  <div className="col-span-2 grid gap-1.5 sm:col-span-1">
                    <Label htmlFor="duracao">Duração</Label>
                    <select
                      id="duracao"
                      value={duracao}
                      onChange={(e) => setDuracao(Number(e.target.value))}
                      className={selectClass}
                    >
                      {[...new Set([...DURACOES, duracao])].sort((x, y) => x - y).map((d) => (
                        <option key={d} value={d}>
                          {d} min
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Horários do dia: livre, ocupado ou bloqueado */}
                {medicoId && horarios.length > 0 && (
                  <div className="mt-4">
                    <p className="mb-2 flex flex-wrap items-center gap-x-2 text-xs text-cinza-suave">
                      <Clock className="size-3.5 text-teal" />
                      <span>
                        <strong className="text-azul-medico">{livres}</strong> horário
                        {livres === 1 ? " livre" : "s livres"} para {medico?.nome ?? "o médico"}
                      </span>
                      {semExpediente && <span>· sem expediente cadastrado, mostrando das 8h às 18h</span>}
                    </p>
                    <div className="grid max-h-40 grid-cols-4 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-6">
                      {horarios.map((h) => (
                        <button
                          key={h.hora}
                          type="button"
                          disabled={!h.livre}
                          title={h.motivo}
                          onClick={() => setHora(h.hora)}
                          className={cn(
                            "rounded-md border px-2 py-1.5 text-xs font-medium tabular-nums transition-colors",
                            hora === h.hora
                              ? "border-teal bg-teal text-white"
                              : h.livre
                                ? "border-border bg-white text-cinza-texto hover:border-teal hover:text-teal"
                                : "cursor-not-allowed border-transparent bg-cinza-suave/10 text-cinza-suave/60 line-through"
                          )}
                        >
                          {h.hora}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {(conflitoEscolhido || emFolga) && (
                  <p className="mt-3 flex items-start gap-2 rounded-md border border-alerta/40 bg-alerta/8 px-3 py-2 text-xs text-cinza-texto">
                    <TriangleAlert className="mt-0.5 size-4 shrink-0 text-alerta" />
                    {conflitoEscolhido
                      ? `Esse horário encosta na consulta de ${conflitoEscolhido.paciente} (${hhmm(conflitoEscolhido.ini)}). Dá para salvar como encaixe.`
                      : "O médico tem um bloqueio (folga ou férias) nesse horário."}
                  </p>
                )}

                {/* A data por extenso: é aqui que um dia/mês trocado aparece */}
                {porExtenso && suspeita && (
                  <p className="mt-3 flex items-start gap-2 rounded-md border border-alerta/40 bg-alerta/8 px-3 py-2 text-xs text-cinza-texto">
                    <TriangleAlert className="mt-0.5 size-4 shrink-0 text-alerta" />
                    <span>
                      <strong className="capitalize">{porExtenso}</strong>, {distancia}. Confira: o campo de
                      data segue o idioma do seu navegador, e nele o dia pode estar no lugar do mês.
                    </span>
                  </p>
                )}
              </Secao>

              {/* ---------- 4. Detalhes ---------- */}
              <Secao n={4} titulo="Detalhes">
                <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_12rem]">
                  <div className="grid gap-1.5">
                    <Label htmlFor="motivo">Motivo / queixa</Label>
                    <Input
                      id="motivo"
                      value={motivo}
                      onChange={(e) => setMotivo(e.target.value)}
                      placeholder="Ex.: Avaliação de manchas na pele"
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="valor">Valor</Label>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-cinza-suave">
                        R$
                      </span>
                      <Input
                        id="valor"
                        inputMode="decimal"
                        value={valor}
                        onChange={(e) => {
                          setValor(e.target.value.replace(/[^\d.,]/g, ""));
                          setValorManual(true);
                        }}
                        placeholder={precoServico && temFaixa(precoServico) ? textoValor(precoServico).replace(/R\$\s?/g, "") : convenio === "Particular" ? "0,00" : "Pelo convênio"}
                        className="pl-10"
                      />
                    </div>
                  </div>
                </div>
                <div className="mt-4 grid gap-1.5">
                  <Label htmlFor="obs">Observação para a equipe (opcional)</Label>
                  <Textarea
                    id="obs"
                    value={observacao}
                    onChange={(e) => setObservacao(e.target.value)}
                    placeholder="Ex.: trazer exames anteriores, prefere ser chamado pelo sobrenome…"
                    className="min-h-[64px]"
                  />
                </div>
              </Secao>

              {/* ---------- 5. Documentos ---------- */}
              <Secao n={5} titulo="Documentos e exames">
                <label
                  onDragOver={(e) => {
                    e.preventDefault();
                    setArrastando(true);
                  }}
                  onDragLeave={() => setArrastando(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setArrastando(false);
                    adicionarArquivos(e.dataTransfer.files);
                  }}
                  className={cn(
                    "flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors",
                    arrastando
                      ? "border-teal bg-verde-menta/60"
                      : "border-border bg-branco-clinico hover:border-teal/60 hover:bg-verde-menta/30"
                  )}
                >
                  <Paperclip className="size-5 text-teal" />
                  <span className="text-sm font-medium text-azul-medico">
                    Arraste aqui ou clique para anexar
                  </span>
                  <span className="text-xs text-cinza-suave">
                    Exames, pedidos, encaminhamentos, receitas · PDF, imagem ou Word · até 10 MB cada
                  </span>
                  <input
                    type="file"
                    multiple
                    accept={TIPOS_ANEXO}
                    className="sr-only"
                    onChange={(e) => {
                      adicionarArquivos(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </label>

                {arquivos.length > 0 && (
                  <ul className="mt-3 grid gap-2">
                    {arquivos.map((f) => (
                      <li
                        key={`${f.name}-${f.size}`}
                        className="flex items-center gap-3 rounded-lg border border-border bg-white px-3 py-2"
                      >
                        <span className="grid size-8 shrink-0 place-items-center rounded-md bg-verde-menta text-teal">
                          <FileText className="size-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm text-cinza-texto">{f.name}</span>
                          <span className="block text-xs text-cinza-suave">{tamanhoLegivel(f.size)}</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setArquivos(arquivos.filter((a) => a !== f))}
                          disabled={pending}
                          className="grid size-8 place-items-center rounded-md text-cinza-suave hover:bg-coral/10 hover:text-coral"
                          aria-label={`Tirar ${f.name}`}
                        >
                          <X className="size-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-2 text-xs text-cinza-suave">
                  Ficam guardados na ficha da consulta, visíveis só para a equipe da clínica.
                </p>
              </Secao>
            </div>

            {/* ---------- Resumo ---------- */}
            <aside className="min-w-0 lg:sticky lg:top-0 lg:self-start">
              <div className="overflow-hidden rounded-xl border border-border bg-white">
                <div className="bg-azul-medico px-4 py-4 text-white">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-white/70">Resumo</p>
                  <div className="mt-2 flex items-center gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white/15 font-heading text-sm font-bold">
                      {iniciais(nome)}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{nome.trim() || "Paciente"}</span>
                      <span className="block truncate text-xs text-white/70">
                        {convenioOutro ? convenio || "Outro convênio" : convenio}
                        {idade !== null && idade >= 0 && idade < 130 ? ` · ${idade} anos` : ""}
                      </span>
                    </span>
                  </div>
                </div>

                <dl className="divide-y divide-border text-sm">
                  <div className="flex items-start gap-3 px-4 py-3">
                    <CalendarCheck className="mt-0.5 size-4 shrink-0 text-teal" />
                    <div className="min-w-0">
                      <dt className="sr-only">Quando</dt>
                      <dd className="font-medium capitalize text-azul-medico">{porExtenso ?? "Escolha a data"}</dd>
                      {dataValida && (
                        <dd className="text-xs text-cinza-suave">
                          {hora} às {fimConsulta} · {distancia}
                        </dd>
                      )}
                    </div>
                  </div>
                  <div className="flex items-start gap-3 px-4 py-3">
                    <Stethoscope className="mt-0.5 size-4 shrink-0 text-teal" />
                    <div className="min-w-0">
                      <dt className="sr-only">Médico</dt>
                      <dd className="truncate font-medium text-azul-medico">{medico?.nome ?? "Escolha o médico"}</dd>
                      {servico && <dd className="truncate text-xs font-medium text-cinza-texto">{servico.nome}</dd>}
                      <dd className="flex items-center gap-1 text-xs text-cinza-suave">
                        <TipoIcone className="size-3" /> {rotuloTipo[tipo]} · {duracao} min
                      </dd>
                    </div>
                  </div>
                  {arquivos.length > 0 && (
                    <div className="flex items-center gap-3 px-4 py-3">
                      <Paperclip className="size-4 shrink-0 text-teal" />
                      <dd className="text-cinza-texto">
                        {arquivos.length} documento{arquivos.length === 1 ? "" : "s"} anexado{arquivos.length === 1 ? "" : "s"}
                      </dd>
                    </div>
                  )}
                  {valorNum !== undefined && Number.isFinite(valorNum) && (
                    <div className="flex items-center justify-between px-4 py-3">
                      <dt className="text-cinza-suave">Valor</dt>
                      <dd className="font-semibold text-teal">
                        {valorNum.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </dd>
                    </div>
                  )}
                </dl>

                <div className="border-t border-border bg-branco-clinico px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-cinza-suave">Ao criar</p>
                  <ul className="mt-2 grid gap-1.5 text-xs text-cinza-texto">
                    <li className="flex items-center gap-2">
                      <Bell className="size-3.5 shrink-0 text-teal" />
                      {medico ? `${medico.nome.split(" ")[0]} é avisado` : "O médico é avisado"} no painel
                    </li>
                    <li className={cn("flex items-center gap-2", !(avisarPaciente && avisoWhats) && "text-cinza-suave line-through")}>
                      <MessageCircle className="size-3.5 shrink-0 text-teal" />
                      Paciente recebe no WhatsApp
                    </li>
                    <li className={cn("flex items-center gap-2", !(avisarPaciente && avisoEmail) && "text-cinza-suave line-through")}>
                      <Mail className="size-3.5 shrink-0 text-teal" />
                      Paciente recebe por e-mail
                    </li>
                    {disparoLembrete && (
                      <li className="flex items-start gap-2">
                        <BellRing className="mt-0.5 size-3.5 shrink-0 text-teal" />
                        <span>
                          {lembreteJaPassou
                            ? "Pedido de confirmação vai junto, já que a consulta está perto"
                            : `Lembrete para confirmar: ${format(disparoLembrete, "EEE, dd/MM 'às' HH'h'", { locale: ptBR })}`}
                        </span>
                      </li>
                    )}
                  </ul>
                  <label className="mt-3 flex cursor-pointer items-start gap-2 text-xs text-cinza-texto">
                    <input
                      type="checkbox"
                      className="mt-0.5 size-4 accent-teal"
                      checked={avisarPaciente}
                      onChange={(e) => setAvisarPaciente(e.target.checked)}
                    />
                    <span>
                      Avisar o paciente agora
                      {!envioAutomatico && (
                        <span className="block text-cinza-suave">WhatsApp da clínica ainda não conectado.</span>
                      )}
                    </span>
                  </label>
                </div>
              </div>
            </aside>
          </div>

          <div className="sticky bottom-0 z-10 flex flex-col-reverse gap-3 border-t border-border bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            {erro ? (
              <p className="rounded-md bg-coral/10 px-3 py-2 text-sm text-coral">{erro}</p>
            ) : etapa ? (
              <p className="flex items-center gap-2 text-sm text-cinza-suave">
                <Loader2 className="size-4 animate-spin text-teal" /> {etapa}
              </p>
            ) : (
              <span className="hidden text-xs text-cinza-suave sm:block">
                Campos com <span className="text-coral">*</span> são obrigatórios.
              </span>
            )}
            <div className="flex gap-2 sm:justify-end">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1 sm:flex-none">
                Cancelar
              </Button>
              <Button type="submit" variant="primary" disabled={pending} className="flex-1 sm:flex-none">
                {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                {pending ? "Criando…" : "Criar consulta"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
