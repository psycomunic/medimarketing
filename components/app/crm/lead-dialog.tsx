"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  Check,
  CircleUser,
  Loader2,
  Mail,
  MapPin,
  MessageSquare,
  PencilLine,
  Phone,
  StickyNote,
  Tag,
  Trash2,
} from "lucide-react";
import type {
  CanalContato,
  EtapaFunil,
  LeadComContexto,
  LeadInteracao,
  Profile,
  TipoInteracao,
} from "@/lib/supabase/types";
import { concluirTarefa, excluirLead, moverEtapa, registrarInteracao } from "@/lib/actions/crm";
import {
  ETAPAS_FUNIL,
  dataHoraCurta,
  nomeOrigem,
  prazoRelativo,
  rotuloCanal,
  rotuloEtapa,
  rotuloStatusLead,
  rotuloTipoInteracao,
  tempoRelativo,
} from "@/lib/rotulos";
import { formatarReais } from "@/lib/indicadores";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { LeadForm } from "@/components/app/crm/lead-form";

const iconeTipo: Record<TipoInteracao, typeof StickyNote> = {
  nota: StickyNote,
  mensagem: MessageSquare,
  ligacao: Phone,
  tarefa: CalendarClock,
};

/** Ficha do lead: dados, histórico e registro de novas interações. */
export function LeadDialog({
  lead,
  historico,
  equipe,
  demo,
  onOpenChange,
}: {
  lead: LeadComContexto | null;
  historico: LeadInteracao[];
  equipe: Profile[];
  demo: boolean;
  onOpenChange: (aberto: boolean) => void;
}) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [editando, setEditando] = useState(false);
  const [pending, startTransition] = useTransition();

  // Formulário de nova interação
  const [tipo, setTipo] = useState<TipoInteracao>("nota");
  const [canal, setCanal] = useState<CanalContato | "">("whatsapp");
  const [conteudo, setConteudo] = useState("");
  const [venceEm, setVenceEm] = useState("");

  if (!lead) return null;

  const nomeAutor = (id: string | null) =>
    equipe.find((p) => p.id === id)?.nome ?? "Equipe";

  function agir(fn: () => Promise<{ ok: boolean; erro?: string }>) {
    setErro(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        setErro(res.erro ?? "Não foi possível concluir.");
        return;
      }
      router.refresh();
    });
  }

  function registrar() {
    if (!lead) return;
    agir(async () => {
      const res = await registrarInteracao({
        leadId: lead.id,
        tipo,
        canal: tipo === "nota" ? "" : canal,
        conteudo,
        venceEm: tipo === "tarefa" ? venceEm : "",
      });
      if (res.ok) {
        setConteudo("");
        setVenceEm("");
      }
      return res;
    });
  }

  const tarefas = historico.filter((i) => i.tipo === "tarefa" && !i.concluida);

  return (
    <>
      <Dialog open={!!lead} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{lead.nome}</DialogTitle>
            <DialogDescription>
              {nomeOrigem(lead.origem)} · entrou {tempoRelativo(lead.created_at)} ·{" "}
              {rotuloStatusLead[lead.status]}
            </DialogDescription>
          </DialogHeader>

          {/* Etapa atual */}
          <div className="rounded-lg border border-border bg-branco-clinico p-3">
            <p className="mb-2 text-xs font-medium text-cinza-suave">Etapa no funil</p>
            <div className="flex flex-wrap gap-1.5">
              {[...ETAPAS_FUNIL, "perdido" as const].map((e) => (
                <button
                  key={e}
                  disabled={pending}
                  onClick={() => agir(() => moverEtapa(lead.id, e as EtapaFunil))}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50",
                    lead.etapa_funil === e
                      ? "bg-azul-medico text-white"
                      : "bg-white text-cinza-suave hover:bg-verde-menta hover:text-azul-medico"
                  )}
                >
                  {rotuloEtapa[e]}
                </button>
              ))}
            </div>
          </div>

          {/* Dados */}
          <dl className="grid gap-3 sm:grid-cols-2">
            <Dado icone={Phone} rotulo="WhatsApp" valor={lead.whatsapp} />
            <Dado icone={Mail} rotulo="E-mail" valor={lead.email} />
            <Dado icone={MapPin} rotulo="Cidade" valor={lead.cidade} />
            <Dado
              icone={CircleUser}
              rotulo="Responsável"
              valor={lead.responsavel_nome ?? "Sem responsável"}
            />
            <Dado
              icone={Tag}
              rotulo="Valor estimado"
              valor={lead.valor_estimado ? formatarReais(Number(lead.valor_estimado)) : null}
            />
            <Dado
              icone={CalendarClock}
              rotulo="Próximo contato"
              valor={lead.proximo_contato ? dataHoraCurta(lead.proximo_contato) : null}
              alerta={
                !!lead.proximo_contato &&
                new Date(lead.proximo_contato).getTime() < Date.now()
              }
            />
          </dl>

          {lead.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {lead.tags.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 rounded-full bg-verde-menta px-2.5 py-1 text-xs text-azul-medico"
                >
                  <Tag className="size-3" />
                  {t}
                </span>
              ))}
            </div>
          )}

          {lead.mensagem && (
            <p className="rounded-md border border-dashed border-border bg-white px-4 py-3 text-sm text-cinza-suave">
              {lead.mensagem}
            </p>
          )}

          {lead.motivo_perda && (
            <p className="rounded-md bg-coral/8 px-4 py-3 text-sm text-coral">
              <strong>Motivo da perda:</strong> {lead.motivo_perda}
            </p>
          )}

          {/* Tarefas abertas */}
          {tarefas.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-azul-medico">
                Tarefas abertas ({tarefas.length})
              </h3>
              <ul className="mt-2 space-y-2">
                {tarefas.map((t) => {
                  const prazo = t.vence_em ? prazoRelativo(t.vence_em) : null;
                  return (
                    <li
                      key={t.id}
                      className={cn(
                        "flex items-start gap-3 rounded-md border px-3 py-2.5",
                        prazo?.atrasado ? "border-coral/40 bg-coral/5" : "border-border bg-white"
                      )}
                    >
                      <button
                        disabled={pending}
                        onClick={() => agir(() => concluirTarefa(t.id, true))}
                        className="mt-0.5 grid size-5 shrink-0 place-items-center rounded border border-border text-transparent transition-colors hover:border-sucesso hover:text-sucesso disabled:opacity-50"
                        aria-label="Concluir tarefa"
                      >
                        <Check className="size-3.5" />
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-cinza-texto">{t.conteudo}</p>
                        {prazo && (
                          <p
                            className={cn(
                              "mt-0.5 text-xs",
                              prazo.atrasado ? "font-semibold text-coral" : "text-cinza-suave"
                            )}
                          >
                            {prazo.texto}
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {/* Registrar interação */}
          <section className="rounded-lg border border-border bg-branco-clinico p-4">
            <h3 className="text-sm font-semibold text-azul-medico">
              Registrar no histórico
            </h3>

            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <div className="grid gap-1.5">
                <Label htmlFor="tipo-int">Tipo</Label>
                <Select
                  id="tipo-int"
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value as TipoInteracao)}
                  className="h-10"
                >
                  {(["nota", "mensagem", "ligacao", "tarefa"] as TipoInteracao[]).map((t) => (
                    <option key={t} value={t}>
                      {rotuloTipoInteracao[t]}
                    </option>
                  ))}
                </Select>
              </div>

              {tipo !== "nota" && (
                <div className="grid gap-1.5">
                  <Label htmlFor="canal-int">Canal</Label>
                  <Select
                    id="canal-int"
                    value={canal}
                    onChange={(e) => setCanal(e.target.value as CanalContato)}
                    className="h-10"
                  >
                    {(
                      ["whatsapp", "telefone", "instagram", "email", "presencial"] as CanalContato[]
                    ).map((c) => (
                      <option key={c} value={c}>
                        {rotuloCanal[c]}
                      </option>
                    ))}
                  </Select>
                </div>
              )}

              {tipo === "tarefa" && (
                <div className="grid gap-1.5">
                  <Label htmlFor="vence">Prazo</Label>
                  <Input
                    id="vence"
                    type="datetime-local"
                    value={venceEm}
                    onChange={(e) => setVenceEm(e.target.value)}
                    className="h-10"
                  />
                </div>
              )}
            </div>

            <Textarea
              rows={2}
              className="mt-3"
              value={conteudo}
              onChange={(e) => setConteudo(e.target.value)}
              placeholder={
                tipo === "tarefa"
                  ? "O que precisa ser feito?"
                  : "O que aconteceu nesse contato?"
              }
            />

            <div className="mt-3 flex justify-end">
              <Button
                variant="teal"
                size="sm"
                onClick={registrar}
                disabled={pending || conteudo.trim().length < 2}
              >
                {pending && <Loader2 className="size-4 animate-spin" />}
                Registrar
              </Button>
            </div>
          </section>

          {/* Histórico */}
          <section>
            <h3 className="text-sm font-semibold text-azul-medico">
              Histórico ({historico.length})
            </h3>
            {historico.length === 0 ? (
              <p className="mt-2 rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-cinza-suave">
                Nada registrado ainda.
              </p>
            ) : (
              <ol className="mt-3 space-y-3">
                {historico.map((i) => {
                  const Icone = iconeTipo[i.tipo];
                  return (
                    <li key={i.id} className="flex gap-3">
                      <span
                        className={cn(
                          "mt-0.5 grid size-8 shrink-0 place-items-center rounded-full",
                          i.tipo === "tarefa" && !i.concluida
                            ? "bg-alerta/12 text-alerta"
                            : "bg-verde-menta text-teal"
                        )}
                      >
                        <Icone className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1 border-b border-border pb-3">
                        <p className="text-sm text-cinza-texto">{i.conteudo}</p>
                        <p className="mt-1 text-xs text-cinza-suave">
                          {rotuloTipoInteracao[i.tipo]}
                          {i.canal && ` · ${rotuloCanal[i.canal]}`} ·{" "}
                          {nomeAutor(i.autor_id)} · {tempoRelativo(i.created_at)}
                          {i.tipo === "tarefa" && i.concluida && " · concluída"}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>

          {erro && (
            <p className="rounded-md bg-coral/10 px-3 py-2 text-sm text-coral">{erro}</p>
          )}
          {demo && (
            <p className="rounded-md border border-dashed border-border bg-branco-clinico px-3 py-2 text-xs text-cinza-suave">
              Modo demonstração: as alterações não são salvas.
            </p>
          )}

          <div className="flex flex-wrap justify-end gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (confirm(`Excluir o lead ${lead.nome}? Isso apaga o histórico dele.`)) {
                  agir(async () => {
                    const res = await excluirLead(lead.id);
                    if (res.ok) onOpenChange(false);
                    return res;
                  });
                }
              }}
              className="text-coral hover:bg-coral/10"
            >
              <Trash2 className="size-4" /> Excluir
            </Button>
            <Button variant="outline" size="sm" onClick={() => setEditando(true)}>
              <PencilLine className="size-4" /> Editar dados
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <LeadForm
        aberto={editando}
        onOpenChange={setEditando}
        equipe={equipe}
        organizationId={lead.organization_id}
        lead={lead}
      />
    </>
  );
}

function Dado({
  icone: Icone,
  rotulo,
  valor,
  alerta,
}: {
  icone: typeof Phone;
  rotulo: string;
  valor: string | null;
  alerta?: boolean;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icone className="mt-0.5 size-4 shrink-0 text-teal" />
      <div className="min-w-0">
        <dt className="text-xs text-cinza-suave">{rotulo}</dt>
        <dd
          className={cn(
            "truncate text-sm font-medium",
            alerta ? "text-coral" : "text-cinza-texto"
          )}
        >
          {valor || "—"}
        </dd>
      </div>
    </div>
  );
}
