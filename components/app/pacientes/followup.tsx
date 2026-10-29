"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  CalendarClock,
  Check,
  FileText,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  Phone,
  Pin,
  PinOff,
  Plus,
  RotateCcw,
  Stethoscope,
  Trash2,
} from "lucide-react";
import {
  adiarTarefa,
  concluirTarefa,
  criarNota,
  criarTarefa,
  excluirNota,
  excluirTarefa,
  fixarNota,
  reabrirTarefa,
} from "@/lib/actions/followup";
import type { NotaPaciente, TarefaPaciente, TipoTarefa } from "@/lib/supabase/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const TIPOS: { v: TipoTarefa; r: string; icone: typeof Phone }[] = [
  { v: "whatsapp", r: "WhatsApp", icone: MessageCircle },
  { v: "ligar", r: "Ligar", icone: Phone },
  { v: "orcamento", r: "Orçamento", icone: FileText },
  { v: "retorno", r: "Retorno", icone: Stethoscope },
  { v: "outro", r: "Outro", icone: MoreHorizontal },
];
const TIPO = Object.fromEntries(TIPOS.map((t) => [t.v, t]));

const hojeSP = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
const somarDias = (data: string, dias: number) => {
  const d = new Date(`${data}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
};
const dataBr = (data: string) =>
  new Date(`${data}T12:00:00Z`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", timeZone: "UTC" }).replace(".", "");

/** "Atrasada há 3 dias", "Hoje", "Amanhã", "Em 5 dias". */
export function prazo(vencimento: string): { texto: string; tom: "atrasada" | "hoje" | "futura" } {
  const hoje = hojeSP();
  const dias = Math.round((new Date(`${vencimento}T12:00:00Z`).getTime() - new Date(`${hoje}T12:00:00Z`).getTime()) / 86400_000);
  if (dias < 0) return { texto: `Atrasada há ${-dias} dia${dias === -1 ? "" : "s"}`, tom: "atrasada" };
  if (dias === 0) return { texto: "Hoje", tom: "hoje" };
  if (dias === 1) return { texto: "Amanhã", tom: "futura" };
  return { texto: `${dataBr(vencimento)} · em ${dias} dias`, tom: "futura" };
}

/* ------------------------------------------------------------------ */

export function ItemTarefa({
  t,
  paciente,
  responsavel,
  whatsapp,
}: {
  t: TarefaPaciente;
  /** Na tela de follow-ups, o nome do paciente com link para a ficha. */
  paciente?: { id: string; nome: string } | null;
  responsavel?: string | null;
  /** Link do WhatsApp já com a mensagem, quando o paciente tem telefone. */
  whatsapp?: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [concluindo, setConcluindo] = useState(false);
  const [resultado, setResultado] = useState("");
  const Icone = TIPO[t.tipo]?.icone ?? MoreHorizontal;
  const p = prazo(t.vencimento);
  const feita = t.status === "feita";

  const rodar = (fn: () => Promise<{ ok: boolean; erro?: string }>) =>
    startTransition(async () => {
      setErro(null);
      const r = await fn();
      if (!r.ok) setErro(r.erro ?? "Não deu certo.");
      else {
        setConcluindo(false);
        router.refresh();
      }
    });

  return (
    <li className={cn("rounded-lg border px-3.5 py-3", feita ? "border-border bg-branco-clinico/60" : p.tom === "atrasada" ? "border-coral/40" : "border-border")}>
      <div className="flex items-start gap-3">
        <button
          type="button"
          aria-label={feita ? "Reabrir" : "Concluir"}
          disabled={pending}
          onClick={() => (feita ? rodar(() => reabrirTarefa(t.id)) : setConcluindo((c) => !c))}
          className={cn(
            "mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border-2 transition-colors",
            feita ? "border-teal bg-teal text-white" : "border-border hover:border-teal hover:text-teal"
          )}
        >
          {pending ? <Loader2 className="size-3.5 animate-spin" /> : feita ? <Check className="size-3.5" /> : null}
        </button>
        <div className="min-w-0 flex-1">
          {paciente && (
            <Link href={`/app/pacientes/${paciente.id}`} className="text-xs font-semibold text-teal hover:underline">
              {paciente.nome}
            </Link>
          )}
          <p className={cn("text-sm font-medium", feita ? "text-cinza-suave line-through" : "text-cinza-texto")}>{t.titulo}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-cinza-suave">
            <span className="inline-flex items-center gap-1">
              <Icone className="size-3.5" /> {TIPO[t.tipo]?.r}
            </span>
            {!feita && (
              <span className={cn("inline-flex items-center gap-1", p.tom === "atrasada" && "font-semibold text-coral", p.tom === "hoje" && "font-semibold text-[#B45309]")}>
                <CalendarClock className="size-3.5" /> {p.texto}
              </span>
            )}
            {responsavel && <span>· {responsavel}</span>}
          </p>
          {feita && t.resultado && <p className="mt-1 text-xs text-cinza-texto">“{t.resultado}”</p>}
        </div>
        {!feita && (
          <div className="flex shrink-0 items-center gap-1">
            {whatsapp && (t.tipo === "whatsapp" || t.tipo === "orcamento" || t.tipo === "retorno") && (
              <a
                href={whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Abrir conversa no WhatsApp"
                className="grid size-8 place-items-center rounded-md text-[#16A34A] hover:bg-verde-menta"
              >
                <MessageCircle className="size-4" />
              </a>
            )}
            <select
              aria-label="Adiar"
              value=""
              disabled={pending}
              onChange={(e) => e.target.value && rodar(() => adiarTarefa(t.id, e.target.value))}
              className="h-8 w-[74px] rounded-md border border-border bg-white px-1.5 text-xs text-cinza-suave"
            >
              <option value="">Adiar</option>
              <option value={somarDias(hojeSP(), 1)}>Amanhã</option>
              <option value={somarDias(hojeSP(), 3)}>3 dias</option>
              <option value={somarDias(hojeSP(), 7)}>1 semana</option>
              <option value={somarDias(hojeSP(), 30)}>1 mês</option>
            </select>
            <button
              type="button"
              aria-label="Excluir"
              disabled={pending}
              onClick={() => confirm("Excluir este follow-up?") && rodar(() => excluirTarefa(t.id))}
              className="grid size-8 place-items-center rounded-md text-cinza-suave hover:bg-coral/10 hover:text-coral"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        )}
      </div>

      {concluindo && (
        <div className="mt-3 flex flex-wrap items-center gap-2 pl-9">
          <input
            autoFocus
            value={resultado}
            onChange={(e) => setResultado(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && rodar(() => concluirTarefa(t.id, resultado))}
            placeholder="O que aconteceu? (opcional)"
            className="h-9 min-w-0 flex-1 rounded-md border border-border px-3 text-sm focus:border-teal focus:outline-none"
          />
          <Button variant="teal" size="sm" disabled={pending} onClick={() => rodar(() => concluirTarefa(t.id, resultado))}>
            <Check className="size-4" /> Concluir
          </Button>
        </div>
      )}
      {erro && <p className="mt-2 text-xs text-coral">{erro}</p>}
    </li>
  );
}

/* ------------------------------------------------------------------ */

export function NovaTarefa({
  pacienteId,
  equipe,
  usuarioId,
  onCriada,
}: {
  pacienteId: string;
  equipe: { id: string; nome: string }[];
  usuarioId: string;
  onCriada?: () => void;
}) {
  const router = useRouter();
  const [titulo, setTitulo] = useState("");
  const [tipo, setTipo] = useState<TipoTarefa>("whatsapp");
  const [vencimento, setVencimento] = useState(somarDias(hojeSP(), 1));
  const [responsavel, setResponsavel] = useState(usuarioId);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function criar() {
    setErro(null);
    startTransition(async () => {
      const r = await criarTarefa({ pacienteId, titulo, tipo, vencimento, responsavelId: responsavel });
      if (!r.ok) return setErro(r.erro);
      setTitulo("");
      onCriada?.();
      router.refresh();
    });
  }

  const campo = "h-9 min-w-0 rounded-md border border-border bg-white px-2.5 text-sm text-cinza-texto focus:border-teal focus:outline-none";
  return (
    <div className="grid gap-2 rounded-lg border border-dashed border-teal/50 bg-verde-menta/30 p-3">
      <input
        value={titulo}
        onChange={(e) => setTitulo(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && criar()}
        placeholder="Ex.: Ligar para saber se decidiu sobre o tratamento"
        className={cn(campo, "w-full")}
        aria-label="O que fazer"
      />
      <div className="grid grid-cols-2 gap-2">
        <select aria-label="Tipo" value={tipo} onChange={(e) => setTipo(e.target.value as TipoTarefa)} className={campo}>
          {TIPOS.map((t) => (
            <option key={t.v} value={t.v}>
              {t.r}
            </option>
          ))}
        </select>
        <input aria-label="Quando" type="date" value={vencimento} min={hojeSP()} onChange={(e) => setVencimento(e.target.value)} className={campo} />
        <select aria-label="Responsável" value={responsavel} onChange={(e) => setResponsavel(e.target.value)} className={campo}>
          {equipe.map((u) => (
            <option key={u.id} value={u.id}>
              {u.id === usuarioId ? `${u.nome} (eu)` : u.nome}
            </option>
          ))}
        </select>
        <Button variant="marca" size="sm" className="h-9" disabled={pending || titulo.trim().length < 3} onClick={criar}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Agendar
        </Button>
      </div>
      {erro && <p className="text-xs text-coral">{erro}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ */

const quando = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).replace(".", "");

export function Anotacoes({
  pacienteId,
  notas,
  autores,
}: {
  pacienteId: string;
  notas: NotaPaciente[];
  autores: Record<string, string>;
}) {
  const router = useRouter();
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const ordenadas = [...notas].sort((a, b) => Number(b.fixada) - Number(a.fixada) || b.created_at.localeCompare(a.created_at));

  const rodar = (fn: () => Promise<{ ok: boolean; erro?: string }>, limpar = false) =>
    startTransition(async () => {
      setErro(null);
      const r = await fn();
      if (!r.ok) return setErro(r.erro ?? "Não deu certo.");
      if (limpar) setTexto("");
      router.refresh();
    });

  return (
    <div className="grid gap-3">
      <div className="grid gap-2">
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={2}
          maxLength={4000}
          placeholder="Anote o que importa: preferências, o que conversaram, próximos passos…"
          className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-cinza-texto focus:border-teal focus:outline-none"
          aria-label="Nova anotação"
        />
        <div className="flex justify-end">
          <Button variant="outline" size="sm" disabled={pending || texto.trim().length < 2} onClick={() => rodar(() => criarNota(pacienteId, texto), true)}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Anotar
          </Button>
        </div>
      </div>
      {erro && <p className="text-xs text-coral">{erro}</p>}
      {ordenadas.length ? (
        <ul className="grid gap-2">
          {ordenadas.map((n) => (
            <li key={n.id} className={cn("group rounded-lg px-3 py-2.5", n.fixada ? "bg-[#FEF6E0]" : "bg-branco-clinico")}>
              <p className="whitespace-pre-line break-words text-sm text-cinza-texto">{n.texto}</p>
              <div className="mt-1.5 flex items-center justify-between gap-2">
                <p className="text-xs text-cinza-suave">
                  {n.fixada && <Pin className="mr-1 inline size-3 text-[#A16207]" />}
                  {(n.autor_id && autores[n.autor_id]) || "Equipe"} · {quando(n.created_at)}
                </p>
                <span className="flex gap-0.5">
                  <button
                    type="button"
                    aria-label={n.fixada ? "Desafixar" : "Fixar no topo"}
                    onClick={() => rodar(() => fixarNota(n.id, !n.fixada))}
                    className="grid size-7 place-items-center rounded text-cinza-suave hover:bg-white hover:text-azul-medico"
                  >
                    {n.fixada ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
                  </button>
                  <button
                    type="button"
                    aria-label="Excluir anotação"
                    onClick={() => confirm("Excluir esta anotação?") && rodar(() => excluirNota(n.id))}
                    className="grid size-7 place-items-center rounded text-cinza-suave hover:bg-white hover:text-coral"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </span>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-cinza-suave">Nenhuma anotação ainda.</p>
      )}
    </div>
  );
}

/** Lista de tarefas do paciente com o formulário de nova tarefa. */
export function TarefasDoPaciente({
  pacienteId,
  tarefas,
  equipe,
  usuarioId,
  whatsapp,
}: {
  pacienteId: string;
  tarefas: TarefaPaciente[];
  equipe: { id: string; nome: string }[];
  usuarioId: string;
  whatsapp: string | null;
}) {
  const [verFeitas, setVerFeitas] = useState(false);
  const nomes = Object.fromEntries(equipe.map((u) => [u.id, u.nome]));
  const abertas = tarefas.filter((t) => t.status === "aberta").sort((a, b) => a.vencimento.localeCompare(b.vencimento));
  const feitas = tarefas.filter((t) => t.status === "feita").sort((a, b) => (b.concluida_em ?? "").localeCompare(a.concluida_em ?? ""));
  return (
    <div className="grid gap-3">
      <NovaTarefa pacienteId={pacienteId} equipe={equipe} usuarioId={usuarioId} />
      {abertas.length ? (
        <ul className="grid gap-2">
          {abertas.map((t) => (
            <ItemTarefa key={t.id} t={t} responsavel={t.responsavel_id ? nomes[t.responsavel_id] : null} whatsapp={whatsapp} />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-cinza-suave">Nenhum follow-up em aberto.</p>
      )}
      {feitas.length > 0 && (
        <div>
          <button type="button" onClick={() => setVerFeitas((v) => !v)} className="inline-flex items-center gap-1 text-xs font-medium text-teal hover:underline">
            <RotateCcw className="size-3.5" /> {verFeitas ? "Esconder" : "Ver"} {feitas.length} concluído{feitas.length === 1 ? "" : "s"}
          </button>
          {verFeitas && (
            <ul className="mt-2 grid gap-2">
              {feitas.map((t) => (
                <ItemTarefa key={t.id} t={t} responsavel={t.concluida_por ? nomes[t.concluida_por] : null} />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
