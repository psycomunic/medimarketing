"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import {
  CalendarX2,
  Check,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  Link2,
  Loader2,
  MessageCircle,
  Plus,
  Save,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import type { Fechamento } from "@/lib/supabase/types";
import type { Servico } from "@/lib/servicos";
import { porCategoria } from "@/lib/servicos";
import { DIAS_SEMANA } from "@/lib/agenda";
import { descreverFechamento } from "@/lib/agenda-horarios";
import { slugAgenda } from "@/lib/agendar-slug";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  criarFechamento,
  removerFechamento,
  salvarLinkAgenda,
  salvarServicosDoProfissional,
} from "@/lib/actions/agenda-profissional";

const selectClass =
  "h-10 w-full rounded-md border border-input bg-white px-3 text-sm text-cinza-texto shadow-sm focus-visible:border-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40";

/* ------------------------------------------------------------------ */
/* Serviços que o profissional atende                                  */
/* ------------------------------------------------------------------ */

export function ServicosDoProfissional({
  medicoId,
  nome,
  catalogo,
  marcados,
  podeEditar,
  demo,
}: {
  medicoId: string;
  nome: string;
  catalogo: Servico[];
  marcados: string[];
  podeEditar: boolean;
  demo: boolean;
}) {
  const router = useRouter();
  const [sel, setSel] = useState<Set<string>>(new Set(marcados));
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);
  const [pending, startTransition] = useTransition();
  const mudou = sel.size !== marcados.length || marcados.some((m) => !sel.has(m));

  function alternar(id: string) {
    setSalvo(false);
    setSel((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function salvar() {
    setErro(null);
    startTransition(async () => {
      const r = await salvarServicosDoProfissional(medicoId, [...sel]);
      if (!r.ok) return setErro(r.erro);
      setSalvo(true);
      router.refresh();
    });
  }

  return (
    <section className="rounded-lg border border-border bg-white shadow-soft">
      <div className="border-b border-border px-6 py-4">
        <h2 className="text-lg font-semibold text-azul-medico">Serviços que atende</h2>
        <p className="text-sm text-cinza-suave">
          Ao marcar um desses serviços, {nome} aparece como opção; no link de agendamento, o paciente só vê estes.
          Sem nenhum marcado, vale qualquer serviço.
        </p>
      </div>

      {catalogo.length === 0 ? (
        <p className="px-6 py-6 text-sm text-cinza-suave">
          A clínica ainda não tem serviços na Tabela de preços (Financeiro → Serviços).
        </p>
      ) : (
        <div className="space-y-4 px-6 py-4">
          {porCategoria(catalogo).map(([categoria, lista]) => (
            <div key={categoria}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-cinza-suave">{categoria}</p>
              <div className="flex flex-wrap gap-2">
                {lista.map((s) => {
                  const ativo = sel.has(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      disabled={!podeEditar || demo}
                      onClick={() => alternar(s.id)}
                      aria-pressed={ativo}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                        ativo
                          ? "border-teal bg-teal text-white"
                          : "border-border bg-white text-cinza-texto hover:border-teal hover:text-teal",
                        (!podeEditar || demo) && "cursor-default hover:border-border hover:text-cinza-texto"
                      )}
                    >
                      {ativo && <Check className="size-3.5" />}
                      {s.nome}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {podeEditar && catalogo.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-6 py-4">
          <div className="text-sm">
            {salvo && !mudou && (
              <span className="flex items-center gap-1.5 text-sucesso">
                <CheckCircle2 className="size-4" /> Serviços salvos
              </span>
            )}
            {erro && <span className="text-coral">{erro}</span>}
            {!podeEditar && <span className="text-cinza-suave">Só o gestor muda os serviços.</span>}
          </div>
          <Button variant="marca" onClick={salvar} disabled={pending || !mudou || demo}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Salvar serviços
          </Button>
        </div>
      )}
      {!podeEditar && (
        <p className="border-t border-border px-6 py-3 text-xs text-cinza-suave">Só o gestor da clínica muda os serviços.</p>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Fechamentos                                                         */
/* ------------------------------------------------------------------ */

export function Fechamentos({
  medicoId,
  servicos,
  fechamentos,
  demo,
}: {
  medicoId: string;
  /** Os serviços que ele atende (ou todos os da clínica). */
  servicos: Servico[];
  fechamentos: Fechamento[];
  demo: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [servicoId, setServicoId] = useState("");
  const [modo, setModo] = useState<"semana" | "data">("semana");
  const [diaSemana, setDiaSemana] = useState(5);
  const [data, setData] = useState("");
  const [inicio, setInicio] = useState("13:00");
  const [fim, setFim] = useState("18:00");
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [conflito, setConflito] = useState<{ texto: string; consultas: string[] } | null>(null);
  const nomeServico = (id: string | null) =>
    id ? servicos.find((s) => s.id === id || s.linhas.some((l) => l.id === id))?.nome ?? "Serviço removido" : "Todos os serviços";

  function salvar(confirmar = false) {
    setErro(null);
    if (modo === "data" && !data) return setErro("Escolha a data.");
    startTransition(async () => {
      const r = await criarFechamento({
        medicoId,
        servicoId: servicoId || null,
        diaSemana: modo === "semana" ? diaSemana : null,
        data: modo === "data" ? data : null,
        inicio,
        fim,
        motivo,
        confirmar,
      });
      if (!r.ok) {
        if ("codigo" in r && r.codigo === "conflito") return setConflito({ texto: r.erro, consultas: r.consultas });
        return setErro(r.erro);
      }
      setConflito(null);
      setMotivo("");
      setData("");
      router.refresh();
    });
  }

  function remover(id: string) {
    startTransition(async () => {
      const r = await removerFechamento(id);
      if (!r.ok) setErro(r.erro);
      router.refresh();
    });
  }

  const hoje = new Date().toISOString().slice(0, 10);
  const ativos = fechamentos.filter((f) => !f.data || f.data >= hoje);

  return (
    <section className="rounded-lg border border-border bg-white shadow-soft">
      <div className="border-b border-border px-6 py-4">
        <h2 className="text-lg font-semibold text-azul-medico">Fechar a agenda</h2>
        <p className="text-sm text-cinza-suave">
          Fecha só este profissional, num serviço ou em todos. Os colegas e a clínica seguem atendendo normalmente.
        </p>
      </div>

      <div className="grid gap-4 border-b border-border px-6 py-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="fech-servico">Serviço</Label>
            <select id="fech-servico" className={selectClass} value={servicoId} onChange={(e) => setServicoId(e.target.value)}>
              <option value="">Todos os serviços</option>
              {servicos.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1.5">
            <span className="text-sm font-medium text-cinza-texto">Quando</span>
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-branco-clinico p-1" role="radiogroup">
              {(
                [
                  ["semana", "Toda semana"],
                  ["data", "Uma data"],
                ] as const
              ).map(([m, rotulo]) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={modo === m}
                  onClick={() => setModo(m)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    modo === m ? "bg-white text-azul-medico shadow-sm" : "text-cinza-suave hover:text-azul-medico"
                  )}
                >
                  {rotulo}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-[1.3fr_1fr_1fr]">
          {modo === "semana" ? (
            <div className="grid gap-1.5">
              <Label htmlFor="fech-dia">Dia da semana</Label>
              <select
                id="fech-dia"
                className={selectClass}
                value={diaSemana}
                onChange={(e) => setDiaSemana(Number(e.target.value))}
              >
                {DIAS_SEMANA.map((d, i) => (
                  <option key={d} value={i}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="grid gap-1.5">
              <Label htmlFor="fech-data">Data</Label>
              <Input id="fech-data" type="date" min={hoje} value={data} onChange={(e) => setData(e.target.value)} />
            </div>
          )}
          <div className="grid gap-1.5">
            <Label htmlFor="fech-ini">Das</Label>
            <Input id="fech-ini" type="time" value={inicio} onChange={(e) => setInicio(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="fech-fim">Até</Label>
            <Input id="fech-fim" type="time" value={fim} onChange={(e) => setFim(e.target.value)} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="grid gap-1.5">
            <Label htmlFor="fech-motivo">Motivo (só a equipe vê)</Label>
            <Input
              id="fech-motivo"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex.: cirurgias, curso, reunião"
            />
          </div>
          <Button variant="teal" onClick={() => salvar(false)} disabled={pending || demo}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Fechar horário
          </Button>
        </div>

        {conflito && (
          <div className="rounded-md border border-alerta/40 bg-alerta/8 px-4 py-3 text-sm text-cinza-texto">
            <p className="flex items-start gap-2">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-alerta" />
              {conflito.texto}
            </p>
            <ul className="mt-2 space-y-0.5 pl-6 text-xs text-cinza-suave">
              {conflito.consultas.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap gap-2 pl-6">
              <Button size="sm" variant="teal" onClick={() => salvar(true)} disabled={pending}>
                Fechar mesmo assim
              </Button>
              <Button size="sm" variant="outline" onClick={() => setConflito(null)} disabled={pending}>
                Voltar
              </Button>
            </div>
          </div>
        )}
        {erro && <p className="text-sm text-coral">{erro}</p>}
      </div>

      {ativos.length === 0 ? (
        <div className="px-6 py-10 text-center text-cinza-suave">
          <CalendarX2 className="mx-auto mb-2 size-8 text-teal-claro" />
          <p className="text-sm">Nenhum horário fechado.</p>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {ativos.map((f) => (
            <li key={f.id} className="flex items-center gap-3 px-6 py-3.5">
              <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-cinza-suave/10 text-cinza-suave">
                <CalendarX2 className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-cinza-texto">{descreverFechamento(f, DIAS_SEMANA)}</p>
                <p className="text-sm text-cinza-suave">
                  {nomeServico(f.servico_id)}
                  {f.motivo ? ` · ${f.motivo}` : ""}
                </p>
              </div>
              <button
                onClick={() => remover(f.id)}
                disabled={pending || demo}
                className="inline-flex h-9 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium text-cinza-suave transition-colors hover:bg-coral/10 hover:text-coral"
                aria-label={`Reabrir ${descreverFechamento(f, DIAS_SEMANA)}`}
              >
                <Trash2 className="size-4" /> Reabrir
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Link público de agendamento                                         */
/* ------------------------------------------------------------------ */

export function LinkAgenda({
  medicoId,
  nome,
  base,
  slugClinica,
  slug,
  ativo,
  servicos,
  semExpediente,
  demo,
}: {
  medicoId: string;
  nome: string;
  /** https://www.medimarketing.com.br */
  base: string;
  slugClinica: string | null;
  slug: string | null;
  ativo: boolean;
  servicos: Servico[];
  semExpediente: boolean;
  demo: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editando, setEditando] = useState(!slug);
  const [texto, setTexto] = useState(slug ?? slugAgenda(nome));
  const [erro, setErro] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);

  const link = slugClinica && slug ? `${base}/agendar/${slugClinica}/${slug}` : null;

  useEffect(() => {
    if (!link) return setQr(null);
    QRCode.toDataURL(link, { margin: 1, width: 360, color: { dark: "#0B4F6C", light: "#FFFFFF" } })
      .then(setQr)
      .catch(() => setQr(null));
  }, [link]);

  function salvar(novoAtivo: boolean) {
    setErro(null);
    startTransition(async () => {
      const r = await salvarLinkAgenda({ medicoId, ativo: novoAtivo, slug: texto });
      if (!r.ok) return setErro(r.erro);
      setTexto(r.slug);
      setEditando(false);
      router.refresh();
    });
  }

  async function copiar(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(url);
      setTimeout(() => setCopiado(null), 2000);
    } catch {
      setErro("Não foi possível copiar.");
    }
  }

  const mensagem = (url: string) =>
    `Olá! Para agendar sua consulta com ${nome}, escolha o melhor horário por aqui: ${url}`;

  return (
    <section className="rounded-lg border border-border bg-white shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-6 py-4">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-azul-medico">
            <Link2 className="size-5 text-teal" /> Link de agendamento
          </h2>
          <p className="text-sm text-cinza-suave">
            Mande para o paciente: ele vê os horários livres e marca sozinho. Entra na agenda como pendente, com o
            aviso de sempre.
          </p>
        </div>
        {slug && (
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-cinza-texto">
            <input
              type="checkbox"
              className="size-4 accent-teal"
              checked={ativo}
              disabled={pending || demo}
              onChange={(e) => salvar(e.target.checked)}
            />
            Link no ar
          </label>
        )}
      </div>

      <div className="space-y-4 px-6 py-4">
        {!slugClinica && (
          <p className="rounded-md border border-alerta/40 bg-alerta/8 px-3 py-2 text-sm text-cinza-texto">
            A clínica ainda não tem endereço próprio. Fale com a equipe Medi para liberar o link.
          </p>
        )}
        {semExpediente && (
          <p className="flex items-start gap-2 rounded-md border border-alerta/40 bg-alerta/8 px-3 py-2 text-sm text-cinza-texto">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-alerta" />
            Cadastre os horários de atendimento acima: sem eles, o link não mostra nenhum horário.
          </p>
        )}

        {editando || !slug ? (
          <div className="grid gap-1.5">
            <Label htmlFor="slug-agenda">Endereço do link</Label>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-cinza-suave [overflow-wrap:anywhere]">
                {base.replace(/^https?:\/\//, "")}/agendar/{slugClinica ?? "clinica"}/
              </span>
              <Input
                id="slug-agenda"
                className="h-9 w-56"
                value={texto}
                onChange={(e) => setTexto(slugAgenda(e.target.value) || e.target.value.toLowerCase())}
              />
              <Button variant="marca" size="sm" onClick={() => salvar(slug ? ativo : true)} disabled={pending || demo || !slugClinica}>
                {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                {slug ? "Salvar endereço" : "Criar link"}
              </Button>
            </div>
          </div>
        ) : (
          link && (
            <div className="grid gap-4 md:grid-cols-[1fr_auto]">
              <div className="min-w-0 space-y-2">
                {!ativo && (
                  <p className="rounded-md bg-cinza-suave/10 px-3 py-2 text-sm text-cinza-suave">
                    Link desligado: quem abrir vê que a agenda online está fechada.
                  </p>
                )}
                {[{ rotulo: "Todos os serviços", url: link }, ...servicos.map((s) => ({ rotulo: s.nome, url: `${link}/${slugAgenda(s.nome)}` }))].map(
                  (l) => (
                    <div key={l.url} className="rounded-md border border-border bg-branco-clinico px-3 py-2.5">
                      <p className="text-xs font-semibold text-azul-medico">{l.rotulo}</p>
                      <p className="mt-0.5 text-xs text-cinza-suave [overflow-wrap:anywhere]">{l.url}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <Button size="sm" variant="outline" onClick={() => copiar(l.url)}>
                          {copiado === l.url ? <Check className="size-4 text-sucesso" /> : <Copy className="size-4" />}
                          {copiado === l.url ? "Copiado" : "Copiar"}
                        </Button>
                        <a
                          href={`https://wa.me/?text=${encodeURIComponent(mensagem(l.url))}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex h-8 items-center gap-1.5 rounded-md bg-sucesso/12 px-3 text-sm font-medium text-sucesso transition-colors hover:bg-sucesso/20"
                        >
                          <MessageCircle className="size-4" /> WhatsApp
                        </a>
                        <a
                          href={l.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-medium text-teal transition-colors hover:bg-verde-menta"
                        >
                          <ExternalLink className="size-4" /> Abrir
                        </a>
                      </div>
                    </div>
                  )
                )}
                <button
                  type="button"
                  onClick={() => setEditando(true)}
                  className="text-xs font-semibold text-teal hover:underline"
                >
                  Mudar o endereço
                </button>
              </div>

              {qr && (
                <div className="flex flex-col items-center gap-2 rounded-md border border-border p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qr} alt={`QR Code do link de agendamento de ${nome}`} className="size-40" />
                  <a
                    href={qr}
                    download={`agendar-${slug}.png`}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal hover:underline"
                  >
                    <Download className="size-3.5" /> Baixar QR Code
                  </a>
                  <p className="max-w-[10rem] text-center text-[11px] text-cinza-suave">Para imprimir na recepção</p>
                </div>
              )}
            </div>
          )
        )}
        {erro && <p className="text-sm text-coral">{erro}</p>}
      </div>
    </section>
  );
}
