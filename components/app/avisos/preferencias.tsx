"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BellRing, CheckCircle2, Loader2, Send, TriangleAlert } from "lucide-react";
import type { CanalAviso, Role } from "@/lib/supabase/types";
import {
  CANAIS,
  EVENTOS,
  canaisPadraoDoPapel,
  eventosDoPapel,
  type EventoEquipe,
} from "@/lib/comunicacao/eventos";
import { enviarTeste, salvarPreferencias } from "@/lib/actions/avisos";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

type Escolha = Partial<Record<string, CanalAviso[]>>;

/**
 * Por onde cada pessoa quer ser avisada de cada coisa.
 *
 * Mostra o efeito real: a marcação já começa com o padrão do papel, e
 * só o que a pessoa mudar fica gravado. "Voltar ao padrão" apaga a
 * escolha e devolve a régua da clínica.
 */
export function PreferenciasAviso({
  usuarioId,
  papel,
  inicial,
  resumoHora: horaInicial,
  temTelefone,
  temEmail,
  whatsappDaClinica,
  propria,
  demo,
  compacto = false,
}: {
  usuarioId: string;
  papel: Role;
  inicial: Escolha;
  resumoHora: number;
  temTelefone: boolean;
  temEmail: boolean;
  /** A clínica tem um número de WhatsApp conectado para enviar. */
  whatsappDaClinica: boolean;
  /** É a própria pessoa (mostra o botão de teste). */
  propria: boolean;
  demo: boolean;
  compacto?: boolean;
}) {
  const router = useRouter();
  const eventos = eventosDoPapel(papel);
  const [escolha, setEscolha] = useState<Escolha>(inicial);
  const [hora, setHora] = useState(horaInicial);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [testando, setTestando] = useState(false);

  const efetivo = (e: EventoEquipe) => escolha[e] ?? canaisPadraoDoPapel(e, papel);

  function alternar(e: EventoEquipe, c: CanalAviso) {
    const atual = efetivo(e);
    const novo = atual.includes(c) ? atual.filter((x) => x !== c) : [...atual, c];
    setEscolha({ ...escolha, [e]: CANAIS.map((x) => x.id).filter((x) => novo.includes(x)) });
    setAviso(null);
  }

  function salvar() {
    setErro(null);
    setAviso(null);
    startTransition(async () => {
      const res = await salvarPreferencias({ usuarioId, canais: escolha as Record<string, CanalAviso[]>, resumoHora: hora });
      if (!res.ok) {
        setErro(res.erro);
        return;
      }
      setAviso("Avisos salvos.");
      router.refresh();
    });
  }

  function testar() {
    setErro(null);
    setAviso(null);
    setTestando(true);
    startTransition(async () => {
      const res = await enviarTeste();
      setTestando(false);
      if (!res.ok) {
        setErro(res.erro);
        return;
      }
      const partes = res.resultados.map((r) =>
        r.status === "enviado"
          ? `${r.canal === "email" ? "E-mail" : "WhatsApp"} enviado`
          : `${r.canal === "email" ? "E-mail" : "WhatsApp"} não saiu (${r.erro ?? r.status})`
      );
      setAviso(partes.join(" · ") || "Teste enviado.");
    });
  }

  if (!eventos.length) return null;

  const avisoCanal = !temTelefone
    ? "Sem telefone no perfil: os avisos por WhatsApp não chegam."
    : !whatsappDaClinica
      ? "A clínica ainda não conectou um número de WhatsApp: esse canal fica parado até lá."
      : !temEmail
        ? "Sem e-mail na conta: os avisos por e-mail não chegam."
        : null;

  return (
    <div className={cn(!compacto && "rounded-lg border border-border bg-white p-6 shadow-soft")}>
      {!compacto && (
        <div className="flex items-start gap-3">
          <BellRing className="mt-0.5 size-5 shrink-0 text-teal" />
          <div>
            <h2 className="text-lg font-semibold text-azul-medico">Avisos</h2>
            <p className="mt-1 text-sm text-cinza-suave">
              Por onde você quer saber de cada coisa da agenda. Vem marcado o padrão do seu papel.
            </p>
          </div>
        </div>
      )}

      {avisoCanal && (
        <p className="mt-4 flex items-start gap-2 rounded-md bg-alerta/10 px-3 py-2.5 text-sm text-cinza-texto">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-alerta" /> {avisoCanal}
        </p>
      )}

      {/* Grade: no celular cada evento vira um bloco com os três canais */}
      <div className="mt-4 overflow-hidden rounded-lg border border-border">
        <div className="hidden grid-cols-[minmax(0,1fr)_repeat(3,5.5rem)] bg-branco-clinico px-4 py-2 text-xs font-semibold uppercase tracking-wide text-cinza-suave sm:grid">
          <span>Aviso</span>
          {CANAIS.map((c) => (
            <span key={c.id} className="text-center">
              {c.rotulo}
            </span>
          ))}
        </div>
        <ul className="divide-y divide-border">
          {eventos.map((e) => {
            const ativos = efetivo(e);
            return (
              <li key={e} className="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_repeat(3,5.5rem)] sm:items-center">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-cinza-texto">{EVENTOS[e].rotulo}</p>
                  <p className="text-xs text-cinza-suave">{EVENTOS[e].descricao}</p>
                </div>
                <div className="flex gap-2 sm:contents">
                  {CANAIS.map((c) => (
                    <label
                      key={c.id}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-border px-2 py-1.5 text-xs sm:border-0 sm:p-0"
                    >
                      <input
                        type="checkbox"
                        className="size-4 accent-teal"
                        checked={ativos.includes(c.id)}
                        onChange={() => alternar(e, c.id)}
                        disabled={demo}
                        aria-label={`${EVENTOS[e].rotulo} por ${c.rotulo}`}
                      />
                      <span className="sm:sr-only">{c.rotulo}</span>
                    </label>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {eventos.includes("agenda_do_dia") && (
        <div className="mt-4 grid gap-1.5 sm:max-w-xs">
          <Label htmlFor={`resumo-${usuarioId}`}>Horário do resumo da agenda</Label>
          <Select
            id={`resumo-${usuarioId}`}
            value={String(hora)}
            onChange={(ev) => setHora(Number(ev.target.value))}
            disabled={demo}
          >
            {Array.from({ length: 10 }, (_, i) => i + 5).map((h) => (
              <option key={h} value={h}>
                {String(h).padStart(2, "0")}:00
              </option>
            ))}
          </Select>
          <p className="text-xs text-cinza-suave">Só sai nos dias com consulta.</p>
        </div>
      )}

      {erro && <p className="mt-4 rounded-md bg-coral/10 px-4 py-2.5 text-sm text-coral">{erro}</p>}
      {aviso && (
        <p className="mt-4 flex items-start gap-2 rounded-md bg-sucesso/10 px-4 py-2.5 text-sm text-sucesso">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> {aviso}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
        {Object.keys(escolha).length > 0 && (
          <Button type="button" variant="ghost" size="sm" disabled={demo || pending} onClick={() => setEscolha({})}>
            Voltar ao padrão
          </Button>
        )}
        {propria && (
          <Button type="button" variant="outline" size="sm" disabled={demo || pending} onClick={testar}>
            {testando ? <Loader2 className="animate-spin" /> : <Send />} Enviar teste para mim
          </Button>
        )}
        <Button type="button" size="sm" disabled={demo || pending} onClick={salvar}>
          {pending && !testando && <Loader2 className="animate-spin" />} Salvar avisos
        </Button>
      </div>
    </div>
  );
}
