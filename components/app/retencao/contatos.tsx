"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Cake, Check, CheckCircle2, ClipboardCopy, HeartPulse, Loader2, MessageCircle, RotateCcw, SkipForward, Sparkles, UserRoundSearch, UserX } from "lucide-react";
import type { ConfigAutomacao, ContatoFeito, InfoAutomacao, ItemContato, TipoContato } from "@/lib/relacionamento/contatos";
import { desfazerContato, registrarContato, salvarAutomacao } from "@/lib/actions/relacionamento";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const TIPO: Record<TipoContato, { rotulo: string; icone: typeof Cake; cor: string }> = {
  aniversario: { rotulo: "Aniversário", icone: Cake, cor: "bg-[#FDF2F8] text-[#BE185D]" },
  faltou: { rotulo: "Faltou", icone: UserX, cor: "bg-[#F3F0FF] text-[#6D28D9]" },
  pos_consulta: { rotulo: "Pós-consulta", icone: HeartPulse, cor: "bg-verde-menta text-teal" },
  retorno: { rotulo: "Retorno", icone: CalendarClock, cor: "bg-[#EAF2FC] text-[#1D5FAE]" },
  primeira_sem_retorno: { rotulo: "1ª sem retorno", icone: UserRoundSearch, cor: "bg-[#FEF4E2] text-[#B45309]" },
  reativacao: { rotulo: "Reativação", icone: Sparkles, cor: "bg-[#FDECEC] text-[#B91C1C]" },
};

/** wa.me com o texto atual (a mensagem pode ter sido ajustada na tela). */
function linkWhats(telefone: string, texto: string) {
  const d = telefone.replace(/\D/g, "");
  const numero = d.startsWith("55") ? d : d.length === 10 || d.length === 11 ? `55${d}` : d;
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}

/* ------------------------------ Lista do dia ------------------------------ */

export function ListaContatos({ itens, demo, instalado }: { itens: ItemContato[]; demo: boolean; instalado: boolean }) {
  if (!itens.length)
    return (
      <div className="rounded-xl border border-border bg-white px-6 py-12 text-center shadow-soft">
        <CheckCircle2 className="mx-auto size-10 text-teal" />
        <p className="mt-3 font-heading text-base font-semibold text-azul-medico">Ninguém para contatar agora</p>
        <p className="mt-1 text-sm text-cinza-suave">Quando alguém fizer aniversário, faltar ou for atendido, aparece aqui com a mensagem pronta.</p>
      </div>
    );
  return (
    <ul className="grid gap-3">
      {itens.map((i) => (
        <CartaoContato key={i.chave} item={i} demo={demo} instalado={instalado} />
      ))}
    </ul>
  );
}

function CartaoContato({ item, demo, instalado }: { item: ItemContato; demo: boolean; instalado: boolean }) {
  const router = useRouter();
  const [texto, setTexto] = useState(item.mensagem);
  const [copiado, setCopiado] = useState(false);
  const [abriu, setAbriu] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const t = TIPO[item.tipo];
  const Icone = t.icone;

  function registrar(status: "enviado" | "pulado") {
    setErro(null);
    startTransition(async () => {
      const r = await registrarContato({
        chave: item.chave,
        tipo: item.tipo,
        pacienteId: item.pacienteId,
        consultaId: item.consultaId,
        nome: item.nome,
        status,
        mensagem: texto,
      });
      if (!r.ok) return setErro(r.erro);
      router.refresh();
    });
  }

  async function copiar() {
    await navigator.clipboard?.writeText(texto).catch(() => {});
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  return (
    <li className="rounded-xl border border-border bg-white p-4 shadow-soft sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold", t.cor)}>
              <Icone className="size-3.5" /> {t.rotulo}
            </span>
            {item.atrasoDias > 0 && (
              <span className="rounded-full bg-[#FEF4E2] px-2 py-0.5 text-[11px] font-semibold text-[#B45309]">
                esperando há {item.atrasoDias} dia{item.atrasoDias > 1 ? "s" : ""}
              </span>
            )}
          </div>
          <p className="mt-1.5 font-heading text-base font-semibold text-azul-medico">
            {item.pacienteId ? (
              <a href={`/app/pacientes/${item.pacienteId}`} className="hover:text-teal">
                {item.nome}
              </a>
            ) : (
              item.nome
            )}
          </p>
          <p className="text-xs text-cinza-suave">
            {item.detalhe}
            {item.telefone ? ` · ${item.telefone}` : " · sem telefone"}
          </p>
        </div>
      </div>

      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        rows={3}
        aria-label={`Mensagem para ${item.nome}`}
        className="mt-3 w-full resize-y rounded-lg border border-border bg-branco-clinico px-3 py-2.5 text-sm leading-relaxed text-cinza-texto focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20"
      />

      {erro && <p className="mt-2 rounded-md bg-coral/10 px-3 py-2 text-sm text-coral">{erro}</p>}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {item.telefone && item.telefone.replace(/\D/g, "").length >= 10 && (
          <a
            href={linkWhats(item.telefone, texto)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setAbriu(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[#25D366] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#1EBE5A]"
          >
            <MessageCircle className="size-4" /> Abrir no WhatsApp
          </a>
        )}
        <button
          type="button"
          onClick={copiar}
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-white px-4 text-sm font-medium text-azul-medico transition-colors hover:border-teal hover:text-teal"
        >
          {copiado ? <Check className="size-4 text-teal" /> : <ClipboardCopy className="size-4" />}
          {copiado ? "Copiada" : "Copiar mensagem"}
        </button>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button type="button" variant="ghost" size="sm" disabled={pending || demo || !instalado} onClick={() => registrar("pulado")} title="Tira da lista sem enviar">
            <SkipForward /> Pular
          </Button>
          <Button
            type="button"
            variant={abriu || copiado ? "marca" : "outline"}
            size="sm"
            disabled={pending || demo || !instalado}
            onClick={() => registrar("enviado")}
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 />} Marcar como enviada
          </Button>
        </div>
      </div>
    </li>
  );
}

/* ------------------------------ Automações ------------------------------ */

export function ConfigAutomacoes({
  config,
  info,
  podeEditar,
  demo,
}: {
  config: ConfigAutomacao[];
  info: Record<TipoContato, InfoAutomacao>;
  podeEditar: boolean;
  demo: boolean;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {config.map((c) => (
        <CartaoAutomacao key={c.tipo} c={c} info={info[c.tipo]} podeEditar={podeEditar} demo={demo} />
      ))}
    </div>
  );
}

function CartaoAutomacao({
  c,
  info,
  podeEditar,
  demo,
}: {
  c: ConfigAutomacao;
  info: InfoAutomacao;
  podeEditar: boolean;
  demo: boolean;
}) {
  const router = useRouter();
  const [ativa, setAtiva] = useState(c.ativa);
  const [mensagem, setMensagem] = useState(c.mensagem);
  const [dias, setDias] = useState(String(c.dias));
  const [salvo, setSalvo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const t = TIPO[c.tipo];
  const Icone = t.icone;
  const mudou = ativa !== c.ativa || mensagem !== c.mensagem || dias !== String(c.dias);

  function salvar() {
    setErro(null);
    setSalvo(false);
    startTransition(async () => {
      const r = await salvarAutomacao({ tipo: c.tipo, ativa, mensagem, dias: Number(dias) || 0 });
      if (!r.ok) return setErro(r.erro);
      setSalvo(true);
      router.refresh();
    });
  }

  return (
    <section className={cn("flex flex-col rounded-xl border bg-white p-5 shadow-soft", ativa ? "border-border" : "border-dashed border-border opacity-80")}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className={cn("grid size-9 place-items-center rounded-lg", t.cor)}>
            <Icone className="size-5" />
          </span>
          <h3 className="font-heading text-base font-semibold text-azul-medico">{info.nome}</h3>
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-cinza-suave">
          {ativa ? "Ligada" : "Desligada"}
          <input type="checkbox" checked={ativa} disabled={!podeEditar} onChange={(e) => setAtiva(e.target.checked)} className="size-4 accent-teal" />
        </label>
      </div>
      <p className="mt-2 text-sm text-cinza-suave">
        {info.descricao}
        {info.marketing && <span className="ml-1 rounded-full bg-branco-clinico px-1.5 py-0.5 text-[11px] font-semibold text-cinza-suave">marketing</span>}
      </p>
      {info.temDias && (
        <label className="mt-3 flex flex-wrap items-center gap-2 text-sm text-cinza-texto">
          Aparece
          <input
            inputMode="numeric"
            value={dias}
            disabled={!podeEditar}
            onChange={(e) => setDias(e.target.value.replace(/\D/g, "").slice(0, 2))}
            className="h-8 w-12 rounded-md border border-border bg-white text-center text-sm tabular-nums"
            aria-label="Dias depois"
          />
          {info.rotuloDias}
        </label>
      )}
      <textarea
        value={mensagem}
        onChange={(e) => setMensagem(e.target.value)}
        disabled={!podeEditar}
        rows={5}
        aria-label={`Mensagem de ${info.nome}`}
        className="mt-3 w-full flex-1 resize-y rounded-lg border border-border bg-branco-clinico px-3 py-2.5 text-sm leading-relaxed text-cinza-texto focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20"
      />
      <p className="mt-1.5 text-[11px] text-cinza-suave">
        Variáveis: {"{nome}"}, {"{clinica}"}, {"{profissional}"}, {"{servico}"}
        {c.tipo !== "aniversario" ? `, {data}` : ""}
      </p>
      {erro && <p className="mt-2 rounded-md bg-coral/10 px-3 py-2 text-sm text-coral">{erro}</p>}
      {podeEditar && (
        <div className="mt-3 flex items-center justify-end gap-2">
          {salvo && !mudou && <span className="text-xs text-[#15803D]">Salvo</span>}
          <Button type="button" variant="marca" size="sm" disabled={pending || demo || !mudou} onClick={salvar}>
            {pending && <Loader2 className="size-4 animate-spin" />} Salvar
          </Button>
        </div>
      )}
    </section>
  );
}

/* ------------------------------ Feitos ------------------------------ */

export function ContatosFeitos({ feitos, demo }: { feitos: ContatoFeito[]; demo: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  if (!feitos.length) return <p className="px-5 py-6 text-sm text-cinza-suave">Nenhum contato registrado nos últimos 7 dias.</p>;
  return (
    <ul className="divide-y divide-border">
      {feitos.map((f) => {
        const t = TIPO[f.tipo];
        return (
          <li key={f.id} className="flex flex-wrap items-center gap-3 px-5 py-2.5">
            <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", t.cor)}>{t.rotulo}</span>
            <span className="min-w-0 flex-1 truncate text-sm text-cinza-texto">{f.nome}</span>
            <span className={cn("text-xs font-semibold", f.status === "enviado" ? "text-[#15803D]" : "text-cinza-suave")}>
              {f.status === "enviado" ? "Enviada" : "Pulada"}
            </span>
            <span className="text-xs tabular-nums text-cinza-suave">
              {new Date(f.feito_em).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}
            </span>
            <button
              type="button"
              disabled={pending || demo}
              onClick={() =>
                startTransition(async () => {
                  const r = await desfazerContato(f.id);
                  if (r.ok) router.refresh();
                })
              }
              className="inline-flex items-center gap-1 text-xs font-medium text-teal hover:underline disabled:opacity-50"
            >
              <RotateCcw className="size-3" /> Desfazer
            </button>
          </li>
        );
      })}
    </ul>
  );
}
