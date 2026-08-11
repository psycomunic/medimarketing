"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCheck,
  Facebook,
  Inbox as InboxIcon,
  Instagram,
  Loader2,
  MessageCircle,
  Search,
  Send,
  Sparkles,
  UserCheck,
} from "lucide-react";
import type {
  CanalConversa,
  ConversaComContexto,
  Mensagem,
  Profile,
  StatusConversa,
} from "@/lib/supabase/types";
import {
  atribuirConversa,
  enviarMensagem,
  mudarStatusConversa,
} from "@/lib/actions/atendimento";
import {
  corCanal,
  rotuloCanalConversa,
  rotuloEtapa,
  rotuloStatusConversa,
  tempoRelativo,
} from "@/lib/rotulos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const iconeCanal: Record<CanalConversa, typeof MessageCircle> = {
  whatsapp: MessageCircle,
  instagram: Instagram,
  facebook: Facebook,
};

/** Respostas prontas — a "biblioteca de scripts" do briefing. */
const SCRIPTS: { titulo: string; texto: string }[] = [
  {
    titulo: "Primeiro contato",
    texto:
      "Olá! Que bom que você chegou até a gente 💚 Me conta um pouquinho: o que você gostaria de tratar? Assim já consigo te orientar sobre o melhor caminho.",
  },
  {
    titulo: "Valor com contexto",
    texto:
      "A avaliação é o primeiro passo e custa R$ 350 — nela a doutora examina o seu caso e monta o protocolo certo. Se você fechar o tratamento na mesma semana, esse valor entra como crédito. Prefere um horário de manhã ou de tarde?",
  },
  {
    titulo: "Oferecer horário",
    texto:
      "Tenho dois horários abertos esta semana: quinta às 15h ou sexta às 9h30. Qual fica melhor pra você?",
  },
  {
    titulo: "Contornar o 'vou pensar'",
    texto:
      "Claro, fique à vontade para pensar! Só me diz uma coisa: sua dúvida é mais sobre o valor ou sobre o resultado do tratamento? Assim consigo te ajudar melhor.",
  },
  {
    titulo: "Confirmar consulta",
    texto:
      "Passando para confirmar sua consulta! Nos vemos no horário combinado. Qualquer imprevisto é só me avisar por aqui 💚",
  },
  {
    titulo: "Resgate de falta",
    texto:
      "Senti sua falta hoje 😟 Aconteceu alguma coisa? Consigo te encaixar ainda esta semana, se quiser.",
  },
];

type FiltroStatus = StatusConversa | "todas";

export function Inbox({
  conversas,
  mensagens,
  equipe,
  usuarioId,
  demo,
}: {
  conversas: ConversaComContexto[];
  mensagens: Record<string, Mensagem[]>;
  equipe: Profile[];
  usuarioId: string;
  demo: boolean;
}) {
  const router = useRouter();
  const [selecionadaId, setSelecionadaId] = useState<string | null>(
    conversas[0]?.id ?? null
  );
  const [status, setStatus] = useState<FiltroStatus>("todas");
  const [canal, setCanal] = useState<CanalConversa | "">("");
  const [busca, setBusca] = useState("");
  const [texto, setTexto] = useState("");
  const [scriptsAbertos, setScriptsAbertos] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return conversas.filter((c) => {
      if (status !== "todas" && c.status !== status) return false;
      if (canal && c.canal !== canal) return false;
      if (termo) {
        const alvo = `${c.contato_nome} ${c.contato_identificador} ${c.ultima_mensagem ?? ""}`;
        if (!alvo.toLowerCase().includes(termo)) return false;
      }
      return true;
    });
  }, [conversas, status, canal, busca]);

  const atual = conversas.find((c) => c.id === selecionadaId) ?? null;
  const historico = atual ? mensagens[atual.id] ?? [] : [];

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

  function responder() {
    if (!atual || !texto.trim()) return;
    agir(async () => {
      const res = await enviarMensagem({ conversaId: atual.id, conteudo: texto });
      if (res.ok) setTexto("");
      return res;
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
      {/* Lista de conversas */}
      <aside
        className={cn(
          "flex flex-col overflow-hidden rounded-lg border border-border bg-white shadow-soft",
          // No celular, abrir uma conversa esconde a lista
          atual && "hidden lg:flex"
        )}
      >
        <div className="space-y-3 border-b border-border p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-cinza-suave" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar contato"
              className="h-10 pl-9"
              aria-label="Buscar conversa"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Select
              value={status}
              onChange={(e) => setStatus(e.target.value as FiltroStatus)}
              className="h-9 text-xs"
              aria-label="Filtrar por status"
            >
              <option value="todas">Todos os status</option>
              <option value="aberta">Em aberto</option>
              <option value="pendente">Sem responsável</option>
              <option value="resolvida">Resolvidas</option>
            </Select>
            <Select
              value={canal}
              onChange={(e) => setCanal(e.target.value as CanalConversa | "")}
              className="h-9 text-xs"
              aria-label="Filtrar por canal"
            >
              <option value="">Todos os canais</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="instagram">Instagram</option>
              <option value="facebook">Facebook</option>
            </Select>
          </div>
        </div>

        <ul className="max-h-[520px] flex-1 divide-y divide-border overflow-y-auto lg:max-h-[640px]">
          {filtradas.length === 0 && (
            <li className="px-4 py-12 text-center text-sm text-cinza-suave">
              Nenhuma conversa com esses filtros.
            </li>
          )}
          {filtradas.map((c) => {
            const Icone = iconeCanal[c.canal];
            const ativa = c.id === selecionadaId;
            return (
              <li key={c.id}>
                <button
                  onClick={() => setSelecionadaId(c.id)}
                  className={cn(
                    "flex w-full gap-3 px-3 py-3 text-left transition-colors",
                    ativa ? "bg-verde-menta" : "hover:bg-branco-clinico"
                  )}
                >
                  <span
                    className={cn(
                      "grid size-9 shrink-0 place-items-center rounded-full",
                      corCanal[c.canal]
                    )}
                  >
                    <Icone className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <p className="truncate text-sm font-semibold text-cinza-texto">
                        {c.contato_nome}
                      </p>
                      <span className="ml-auto shrink-0 text-[10px] text-cinza-suave">
                        {tempoRelativo(c.ultima_mensagem_em)}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-cinza-suave">
                      {c.ultima_mensagem ?? "Sem mensagens"}
                    </p>
                    <div className="mt-1 flex items-center gap-1.5">
                      {c.nao_lidas > 0 && (
                        <span className="rounded-full bg-coral px-1.5 py-0.5 text-[10px] font-bold text-white">
                          {c.nao_lidas}
                        </span>
                      )}
                      {c.status === "pendente" && (
                        <span className="rounded-full bg-alerta/12 px-1.5 py-0.5 text-[10px] font-semibold text-alerta">
                          Sem responsável
                        </span>
                      )}
                      {c.status === "resolvida" && (
                        <span className="rounded-full bg-sucesso/12 px-1.5 py-0.5 text-[10px] font-semibold text-sucesso">
                          Resolvida
                        </span>
                      )}
                      {c.etapa_funil && (
                        <span className="truncate rounded-full bg-white px-1.5 py-0.5 text-[10px] text-cinza-suave">
                          {rotuloEtapa[c.etapa_funil]}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      {/* Conversa aberta */}
      <section className="flex min-h-[420px] flex-col overflow-hidden rounded-lg border border-border bg-white shadow-soft">
        {!atual ? (
          <div className="grid flex-1 place-items-center px-6 py-20 text-center text-cinza-suave">
            <div>
              <InboxIcon className="mx-auto size-10 text-teal-claro" />
              <p className="mt-3">Escolha uma conversa para começar.</p>
            </div>
          </div>
        ) : (
          <>
            <header className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
              <button
                onClick={() => setSelecionadaId(null)}
                className="grid size-8 place-items-center rounded-md text-cinza-suave hover:text-azul-medico lg:hidden"
                aria-label="Voltar à lista"
              >
                <ArrowLeft className="size-4" />
              </button>

              <div className="min-w-0 flex-1">
                <p className="truncate font-heading font-semibold text-azul-medico">
                  {atual.contato_nome}
                </p>
                <p className="truncate text-xs text-cinza-suave">
                  {rotuloCanalConversa[atual.canal]} · {atual.contato_identificador}
                  {atual.etapa_funil && ` · ${rotuloEtapa[atual.etapa_funil]}`}
                </p>
              </div>

              <Select
                value={atual.atribuido_a ?? ""}
                onChange={(e) =>
                  agir(() => atribuirConversa(atual.id, e.target.value || null))
                }
                className="h-9 w-auto min-w-[150px] text-xs"
                aria-label="Responsável pela conversa"
                disabled={pending}
              >
                <option value="">Sem responsável</option>
                {equipe.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </Select>

              {atual.atribuido_a !== usuarioId && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() => agir(() => atribuirConversa(atual.id, usuarioId))}
                >
                  <UserCheck className="size-4" /> Assumir
                </Button>
              )}

              <Button
                variant={atual.status === "resolvida" ? "ghost" : "teal"}
                size="sm"
                disabled={pending}
                onClick={() =>
                  agir(() =>
                    mudarStatusConversa(
                      atual.id,
                      atual.status === "resolvida" ? "aberta" : "resolvida"
                    )
                  )
                }
              >
                <CheckCheck className="size-4" />
                {atual.status === "resolvida" ? "Reabrir" : "Resolver"}
              </Button>
            </header>

            {/* Mensagens */}
            <div className="flex-1 space-y-3 overflow-y-auto bg-branco-clinico px-4 py-4 lg:max-h-[420px]">
              {historico.length === 0 && (
                <p className="py-10 text-center text-sm text-cinza-suave">
                  Nenhuma mensagem nesta conversa.
                </p>
              )}
              {historico.map((m) => {
                const daClinica = m.direcao === "saida";
                return (
                  <div
                    key={m.id}
                    className={cn("flex", daClinica ? "justify-end" : "justify-start")}
                  >
                    <div
                      className={cn(
                        "max-w-[80%] rounded-lg px-3.5 py-2.5 text-sm shadow-sm",
                        daClinica
                          ? "rounded-br-sm bg-teal text-white"
                          : "rounded-bl-sm border border-border bg-white text-cinza-texto"
                      )}
                    >
                      <p className="whitespace-pre-wrap">{m.conteudo}</p>
                      <p
                        className={cn(
                          "mt-1 text-[10px]",
                          daClinica ? "text-white/70" : "text-cinza-suave"
                        )}
                      >
                        {daClinica && m.autor_nome ? `${m.autor_nome} · ` : ""}
                        {tempoRelativo(m.created_at)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Respostas rápidas */}
            {scriptsAbertos && (
              <div className="border-t border-border bg-white px-4 py-3">
                <p className="mb-2 text-xs font-semibold text-azul-medico">
                  Respostas rápidas
                </p>
                <div className="flex flex-wrap gap-2">
                  {SCRIPTS.map((s) => (
                    <button
                      key={s.titulo}
                      onClick={() => {
                        setTexto(s.texto);
                        setScriptsAbertos(false);
                      }}
                      className="rounded-full border border-border bg-branco-clinico px-3 py-1.5 text-xs text-cinza-suave transition-colors hover:border-teal hover:text-teal"
                    >
                      {s.titulo}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Composer */}
            <div className="border-t border-border p-3">
              {erro && (
                <p className="mb-2 rounded-md bg-coral/10 px-3 py-2 text-sm text-coral">
                  {erro}
                </p>
              )}
              {demo && (
                <p className="mb-2 rounded-md border border-dashed border-border bg-branco-clinico px-3 py-1.5 text-xs text-cinza-suave">
                  Modo demonstração: a mensagem não é enviada de verdade.
                </p>
              )}
              <div className="flex items-end gap-2">
                <button
                  type="button"
                  onClick={() => setScriptsAbertos((s) => !s)}
                  className={cn(
                    "grid size-10 shrink-0 place-items-center rounded-md border transition-colors",
                    scriptsAbertos
                      ? "border-teal bg-verde-menta text-teal"
                      : "border-border text-cinza-suave hover:text-teal"
                  )}
                  aria-label="Respostas rápidas"
                  title="Respostas rápidas"
                >
                  <Sparkles className="size-4" />
                </button>
                <Textarea
                  rows={2}
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  onKeyDown={(e) => {
                    // Enter envia; Shift+Enter quebra linha
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      responder();
                    }
                  }}
                  placeholder="Escreva sua resposta… (Enter envia, Shift+Enter quebra linha)"
                  className="min-h-[44px] resize-none"
                />
                <Button
                  variant="marca"
                  size="icon"
                  onClick={responder}
                  disabled={pending || !texto.trim()}
                  aria-label="Enviar"
                >
                  {pending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Send className="size-4" />
                  )}
                </Button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
