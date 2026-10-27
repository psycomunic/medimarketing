"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, Upload } from "lucide-react";
import { importarDiagnostico } from "@/lib/actions/evolucao";
import { lerValor, inteiro } from "@/lib/formularios/numeros";
import { CAMPOS_IMPORTACAO, type MesImportacao } from "@/lib/evolucao";
import { mesPorExtenso } from "@/lib/indicadores";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const fmt = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });

/** O texto que vai na célula: número já legível, com "~" se era aproximado. */
function textoInicial(c: { valor: number | null; estimativa: boolean; semDado: boolean; texto: string }) {
  if (c.semDado) return "não medimos";
  if (c.valor === null) return c.texto.trim() ? c.texto : "";
  return `${c.estimativa ? "~" : ""}${fmt.format(c.valor)}`;
}

type Plano = {
  metaFaturamento: string;
  metaLeads: string;
  metaConsultas: string;
  prazo: string;
  criterio: string;
  prioridades: string;
  obstaculo: string;
  observacoes: string;
};

export function ImportarDiagnostico({
  respostaId,
  clinica,
  meses,
  existentes,
  planoInicial,
  metaTexto,
  checkin,
  comentarioInicial,
  demo,
}: {
  respostaId: string;
  clinica: string;
  meses: MesImportacao[];
  /** Meses que já têm lançamento no painel, com a origem. */
  existentes: Record<string, string>;
  planoInicial: Plano;
  metaTexto: string;
  /** Check-in mensal: só os números do mês, sem marco zero nem metas. */
  checkin: boolean;
  comentarioInicial: string;
  demo: boolean;
}) {
  const router = useRouter();
  const [celulas, setCelulas] = useState<Record<string, string>>(() => {
    const ini: Record<string, string> = {};
    for (const m of meses) {
      for (const c of CAMPOS_IMPORTACAO) ini[`${m.mes}|${c.campo}`] = textoInicial(m.campos[c.campo]);
      for (const [s, cel] of Object.entries(m.receitas)) ini[`${m.mes}|r:${s}`] = textoInicial(cel);
    }
    return ini;
  });
  const [plano, setPlano] = useState<Plano>(planoInicial);
  const [comentario, setComentario] = useState(comentarioInicial);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const servicos = [...new Set(meses.flatMap((m) => Object.keys(m.receitas)))];
  const sobrescreve = meses.filter((m) => existentes[m.mes]);

  function ler(chave: string, contagem: boolean) {
    const v = lerValor(celulas[chave]);
    return contagem ? inteiro(v) : v;
  }

  function confirmar() {
    setErro(null);
    const num = (s: string) => lerValor(s).valor;
    startTransition(async () => {
      const res = await importarDiagnostico({
        respostaId,
        meses: meses.map((m) => {
          const valores: Record<string, number | null> = {};
          const estimados: string[] = [];
          const semDado: string[] = [];
          for (const c of CAMPOS_IMPORTACAO) {
            const v = ler(`${m.mes}|${c.campo}`, !c.moeda);
            valores[c.campo] = v.valor;
            if (v.estimativa) estimados.push(c.campo);
            if (v.semDado || v.valor === null) semDado.push(c.campo);
          }
          const receitas: Record<string, number> = {};
          for (const s of servicos) {
            const v = ler(`${m.mes}|r:${s}`, false);
            if (v.valor !== null) receitas[s] = v.valor;
          }
          return { mes: m.mes, valores, estimados, semDado, receitas };
        }),
        comentario,
        plano: checkin ? null : {
          metaFaturamento: num(plano.metaFaturamento),
          metaLeads: num(plano.metaLeads),
          metaConsultas: num(plano.metaConsultas),
          prazo: plano.prazo,
          criterio: plano.criterio,
          prioridades: plano.prioridades,
          obstaculo: plano.obstaculo,
          observacoes: plano.observacoes,
        },
      });
      if (!res.ok) {
        setErro(res.erro);
        return;
      }
      router.push(`/app/clinicas/${res.organizationId}`);
    });
  }

  const linha = (chave: string, rotulo: string, contagem: boolean) => (
    <tr key={chave}>
      <th scope="row" className="border border-border px-3 py-2 text-left font-medium text-cinza-texto">
        {rotulo}
      </th>
      {meses.map((m) => {
        const k = `${m.mes}|${chave}`;
        const v = ler(k, contagem);
        const invalido = !!celulas[k]?.trim() && v.valor === null && !v.semDado;
        return (
          <td key={k} className="border border-border px-2 py-1.5 align-top">
            <input
              value={celulas[k] ?? ""}
              onChange={(e) => setCelulas((c) => ({ ...c, [k]: e.target.value }))}
              aria-label={`${rotulo}, ${mesPorExtenso(m.mes)}`}
              className={cn(
                "h-9 w-full min-w-0 rounded-md border bg-white px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                invalido ? "border-coral" : "border-input"
              )}
            />
            <span className="mt-1 block text-[11px] leading-tight">
              {v.semDado || (v.valor === null && !invalido) ? (
                <span className="text-cinza-suave">sem dado</span>
              ) : invalido ? (
                <span className="text-coral">não entendi o número</span>
              ) : v.estimativa ? (
                <span className="font-semibold text-alerta">estimado</span>
              ) : (
                <span className="text-teal">ok</span>
              )}
            </span>
          </td>
        );
      })}
    </tr>
  );

  return (
    <div className="mt-8 grid gap-6">
      <section className="rounded-lg border border-border bg-white p-5 shadow-soft md:p-6">
        <h2 className="text-lg font-semibold text-azul-medico">
          {checkin ? "Números do mês" : "Números dos três meses"}
        </h2>
        <p className="mt-1 text-sm text-cinza-suave">
          Lidos do que a {clinica} escreveu. Confira cada valor: use “~” na frente para marcar
          estimativa e deixe vazio (ou “não medimos”) quando não houver dado.
        </p>

        {sobrescreve.length > 0 && (
          <p className="mt-4 flex gap-2 rounded-md bg-alerta/10 p-3 text-sm text-cinza-texto">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-alerta" />
            {sobrescreve.map((m) => mesPorExtenso(m.mes)).join(", ")}{" "}
            {sobrescreve.length === 1 ? "já tem lançamento" : "já têm lançamentos"} no painel. A
            importação substitui esses meses.
          </p>
        )}

        {meses.length === 0 ? (
          <p className="mt-4 text-sm text-coral">
            O diagnóstico não tem os meses preenchidos na Etapa 05. Peça à clínica para indicar os
            meses ou reabra o diagnóstico.
          </p>
        ) : (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[40rem] border-collapse text-sm">
              <thead>
                <tr className="bg-verde-menta/60 text-left text-azul-medico">
                  <th className="w-[34%] border border-border px-3 py-2.5 font-semibold">Indicador</th>
                  {meses.map((m) => (
                    <th key={m.mes} className="border border-border px-3 py-2.5 font-semibold">
                      {mesPorExtenso(m.mes)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {CAMPOS_IMPORTACAO.map((c) =>
                  linha(c.campo, `${c.rotulo}${c.moeda ? " (R$)" : ""}`, !c.moeda)
                )}
                {servicos.map((s) => linha(`r:${s}`, `Receita de ${s} (R$)`, false))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-border bg-white p-5 shadow-soft md:p-6">
        <h2 className="text-lg font-semibold text-azul-medico">Comentário do mês</h2>
        <p className="mt-1 text-sm text-cinza-suave">
          Aparece para a clínica no relatório do mês. Parte do que ela contou sobre o período.
        </p>
        <Textarea
          className="mt-3"
          rows={3}
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
          aria-label="Comentário do mês"
          placeholder="O que explica os números deste mês?"
        />
      </section>

      {!checkin && (
      <section className="rounded-lg border border-border bg-white p-5 shadow-soft md:p-6">
        <h2 className="text-lg font-semibold text-azul-medico">Marco zero e metas</h2>
        <p className="mt-1 text-sm text-cinza-suave">
          Os meses acima viram o ponto de partida. Cada mês lançado depois é comparado com eles.
        </p>
        {metaTexto && (
          <p className="mt-4 rounded-md bg-branco-clinico p-3 text-sm text-cinza-texto">
            <span className="font-semibold text-azul-medico">A clínica escreveu:</span> {metaTexto}
          </p>
        )}

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="grid gap-1.5">
            <Label htmlFor="meta-fat">Meta de faturamento mensal (R$)</Label>
            <Input id="meta-fat" inputMode="decimal" value={plano.metaFaturamento} onChange={(e) => setPlano((p) => ({ ...p, metaFaturamento: e.target.value }))} placeholder="120.000" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="meta-prazo">Prazo</Label>
            <Input id="meta-prazo" type="month" value={plano.prazo} onChange={(e) => setPlano((p) => ({ ...p, prazo: e.target.value }))} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="meta-leads">Meta de leads/mês (opcional)</Label>
            <Input id="meta-leads" inputMode="numeric" value={plano.metaLeads} onChange={(e) => setPlano((p) => ({ ...p, metaLeads: e.target.value }))} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="meta-cons">Meta de consultas/mês (opcional)</Label>
            <Input id="meta-cons" inputMode="numeric" value={plano.metaConsultas} onChange={(e) => setPlano((p) => ({ ...p, metaConsultas: e.target.value }))} />
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="pl-crit">Critério financeiro</Label>
            <Textarea id="pl-crit" rows={3} value={plano.criterio} onChange={(e) => setPlano((p) => ({ ...p, criterio: e.target.value }))} placeholder="Vendido, realizado ou recebido? De qual sistema?" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="pl-obs">Principal obstáculo</Label>
            <Textarea id="pl-obs" rows={3} value={plano.obstaculo} onChange={(e) => setPlano((p) => ({ ...p, obstaculo: e.target.value }))} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="pl-prio">Prioridades</Label>
            <Textarea id="pl-prio" rows={3} value={plano.prioridades} onChange={(e) => setPlano((p) => ({ ...p, prioridades: e.target.value }))} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="pl-nota">Observações (a clínica vê)</Label>
            <Textarea id="pl-nota" rows={3} value={plano.observacoes} onChange={(e) => setPlano((p) => ({ ...p, observacoes: e.target.value }))} />
          </div>
        </div>
      </section>
      )}

      {erro && <p className="text-sm text-coral">{erro}</p>}

      <div className="flex justify-end">
        <Button type="button" variant="primary" onClick={confirmar} disabled={pending || demo || meses.length === 0}>
          {pending ? <Loader2 className="animate-spin" /> : <Upload />}
          {demo ? "Indisponível na demonstração" : "Levar para o painel"}
        </Button>
      </div>
    </div>
  );
}
