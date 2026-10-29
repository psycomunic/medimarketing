import Link from "next/link";
import { ArrowRight, MessageSquareQuote } from "lucide-react";
import type { ResumoNps } from "@/lib/avaliacoes";
import { pct } from "@/components/graficos/formato";
import { Painel } from "@/components/app/financeiro/ui";
import { cn } from "@/lib/utils";

/** Faixas usuais do NPS, com a cor de status de cada uma. */
function faixa(nps: number) {
  if (nps >= 75) return { rotulo: "Excelente", cor: "#16A34A", fundo: "bg-[#E9F8EF]", texto: "text-[#15803D]" };
  if (nps >= 50) return { rotulo: "Muito bom", cor: "#1A9E8F", fundo: "bg-verde-menta", texto: "text-teal" };
  if (nps >= 0) return { rotulo: "Razoável", cor: "#D97706", fundo: "bg-[#FFF4E5]", texto: "text-[#9A5B00]" };
  return { rotulo: "Crítico", cor: "#DC2626", fundo: "bg-[#FDECEC]", texto: "text-[#B91C1C]" };
}

const PROMOTOR = "#16A34A";
const NEUTRO = "#D97706";
const DETRATOR = "#DC2626";

const quando = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { day: "numeric", month: "short", timeZone: "America/Sao_Paulo" }).replace(".", "");

/**
 * NPS da clínica: a nota, como as respostas se dividem, a evolução e o
 * que os pacientes escreveram. Detratores aparecem primeiro na leitura
 * porque são os que pedem retorno da equipe.
 */
export function PainelNps({ r, nomes }: { r: ResumoNps; nomes: Record<string, string> }) {
  const configurar = (
    <Link href="/app/configuracoes" className="inline-flex items-center gap-1 text-sm font-medium text-teal hover:underline">
      Configurar <ArrowRight className="size-4" />
    </Link>
  );

  if (!r.instalada)
    return (
      <Painel titulo="Satisfação dos pacientes (NPS)">
        <Aviso texto="A pesquisa de satisfação aparece aqui depois que o SQL da atualização for executado no banco." />
      </Painel>
    );

  if (!r.respostas)
    return (
      <Painel titulo="Satisfação dos pacientes (NPS)" descricao="Últimos 90 dias." acao={configurar}>
        <Aviso
          texto={
            r.ativa
              ? "A pesquisa está ligada. As primeiras respostas aparecem aqui assim que os pacientes responderem."
              : "Ligue o envio automático em Configurações, ou use o botão “Enviar pesquisa” numa consulta realizada."
          }
        />
      </Painel>
    );

  const f = faixa(r.nps ?? 0);
  const total = r.respostas;
  const partes = [
    { nome: "Promotores", sub: "notas 9 e 10", valor: r.promotores, cor: PROMOTOR },
    { nome: "Neutros", sub: "notas 7 e 8", valor: r.neutros, cor: NEUTRO },
    { nome: "Detratores", sub: "notas 0 a 6", valor: r.detratores, cor: DETRATOR },
  ];
  const meses = r.porMes.filter((m) => m.respostas);

  return (
    <Painel
      titulo="Satisfação dos pacientes (NPS)"
      descricao={`${total} resposta${total === 1 ? "" : "s"} nos últimos 90 dias${r.enviadas ? ` · ${pct(Math.min((total / r.enviadas) * 100, 100))} de quem recebeu respondeu` : ""}.`}
      acao={configurar}
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="grid content-start gap-5">
          <div className="flex items-center gap-4">
            <div className={cn("grid size-24 shrink-0 place-items-center rounded-2xl", f.fundo)}>
              <div className="text-center">
                <p className={cn("font-heading text-4xl font-bold leading-none tabular-nums", f.texto)}>{r.nps}</p>
                <p className={cn("mt-1 text-[11px] font-semibold uppercase tracking-wide", f.texto)}>NPS</p>
              </div>
            </div>
            <div className="min-w-0">
              <p className={cn("font-heading text-lg font-semibold", f.texto)}>{f.rotulo}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-cinza-suave">
                Promotores menos detratores. Vai de −100 a 100; acima de 50 já é muito bom.
              </p>
            </div>
          </div>

          <div>
            <div className="flex h-3 gap-0.5 overflow-hidden rounded-full" aria-hidden>
              {partes
                .filter((p) => p.valor)
                .map((p) => (
                  <div key={p.nome} style={{ width: `${(p.valor / total) * 100}%`, background: p.cor }} />
                ))}
            </div>
            <ul className="mt-3 grid gap-1.5 text-sm">
              {partes.map((p) => (
                <li key={p.nome} className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2 text-cinza-texto">
                    <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: p.cor }} />
                    {p.nome}
                    <span className="truncate text-xs text-cinza-suave">{p.sub}</span>
                  </span>
                  <span className="shrink-0 tabular-nums text-cinza-suave">
                    <strong className="text-cinza-texto">{p.valor}</strong> · {pct((p.valor / total) * 100)}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {meses.length > 1 && (
            <div>
              <p className="text-xs font-medium text-cinza-suave">NPS por mês</p>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {r.porMes.map((m) => (
                  <li
                    key={m.mes}
                    className="min-w-12 rounded-md border border-border px-2 py-1 text-center"
                    title={`${m.respostas} resposta${m.respostas === 1 ? "" : "s"}`}
                  >
                    <p className="text-[10px] uppercase text-cinza-suave">{m.mes}</p>
                    <p className="font-heading text-sm font-bold tabular-nums" style={{ color: m.nps === null ? undefined : faixa(m.nps).cor }}>
                      {m.nps ?? "–"}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="min-w-0">
          <p className="text-xs font-medium text-cinza-suave">O que os pacientes escreveram</p>
          {r.comentarios.length ? (
            <ul className="mt-2 grid gap-2.5">
              {r.comentarios.map((c, i) => {
                const cor = c.nota >= 9 ? PROMOTOR : c.nota >= 7 ? NEUTRO : DETRATOR;
                return (
                  <li key={i} className="rounded-lg border border-border px-3.5 py-3">
                    <div className="flex items-start gap-3">
                      <span
                        className="grid size-8 shrink-0 place-items-center rounded-lg font-heading text-sm font-bold tabular-nums text-white"
                        style={{ background: cor }}
                        aria-label={`Nota ${c.nota}`}
                      >
                        {c.nota}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm leading-relaxed text-cinza-texto">“{c.comentario}”</p>
                        <p className="mt-1 text-xs text-cinza-suave">
                          {c.paciente} · {quando(c.quando)}
                          {c.medicoId && nomes[c.medicoId] ? ` · ${nomes[c.medicoId]}` : ""}
                        </p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-2 flex items-center gap-2 rounded-lg bg-branco-clinico px-3 py-3 text-sm text-cinza-suave">
              <MessageSquareQuote className="size-4 shrink-0 text-teal" /> Ninguém deixou comentário ainda.
            </p>
          )}
        </div>
      </div>
    </Painel>
  );
}

function Aviso({ texto }: { texto: string }) {
  return <p className="rounded-lg bg-branco-clinico px-4 py-3 text-sm text-cinza-suave">{texto}</p>;
}
