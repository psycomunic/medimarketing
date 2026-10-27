"use client";

import { useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { abrirAnexoLink } from "@/lib/actions/formulario-link";
import type { Anexo, SchemaFormulario } from "@/lib/formularios/tipos";
import { substituirClinica, totalPerguntas } from "@/lib/formularios/tipos";
import { tamanhoArquivo } from "@/lib/formularios/formato";
import { cn } from "@/lib/utils";

export const BUCKET_ANEXOS = "diagnosticos";

/** Topo do questionário, no tom do HTML que a clínica já conhecia. */
export function CapaFormulario({
  schema,
  clinica,
  children,
}: {
  schema: SchemaFormulario;
  clinica: string;
  children?: React.ReactNode;
}) {
  return (
    <header>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal">
        {schema.intro.eyebrow}
      </p>
      <h1 className="mt-4 max-w-2xl text-3xl leading-tight md:text-5xl">
        {schema.intro.titulo}
        <span className="block text-teal">{schema.intro.destaque}</span>
      </h1>
      <p className="mt-5 max-w-2xl text-base leading-relaxed text-cinza-suave">
        {substituirClinica(schema.intro.texto, clinica)}
      </p>
      <dl className="mt-6 flex flex-wrap gap-x-10 gap-y-3 text-xs uppercase tracking-wide text-cinza-suave">
        <div>
          <dt>Preparado para</dt>
          <dd className="mt-0.5 text-sm font-semibold normal-case tracking-normal text-azul-medico">
            {clinica}
          </dd>
        </div>
        <div>
          <dt>Por</dt>
          <dd className="mt-0.5 text-sm font-semibold normal-case tracking-normal text-azul-medico">
            MediMarketing
          </dd>
        </div>
        <div>
          <dt>Conteúdo</dt>
          <dd className="mt-0.5 text-sm font-semibold normal-case tracking-normal text-azul-medico">
            {schema.etapas.length} etapas · {totalPerguntas(schema)} perguntas
          </dd>
        </div>
      </dl>
      {children}
    </header>
  );
}

export function CabecalhoEtapa({
  indice,
  titulo,
  instrucao,
}: {
  indice: number;
  titulo: string;
  instrucao?: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-verde-menta text-sm font-semibold text-teal">
          {String(indice + 1).padStart(2, "0")}
        </span>
        <h2 className="text-xl md:text-2xl">{titulo}</h2>
      </div>
      {instrucao && (
        <p className="mt-4 text-sm leading-relaxed text-cinza-suave">{instrucao}</p>
      )}
    </div>
  );
}

export function CartaoEtapa({
  id,
  className,
  children,
}: {
  id?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className={cn(
        "rounded-[1.25rem] border border-border bg-white p-5 shadow-soft md:p-8 print:break-inside-auto print:rounded-none print:border-0 print:p-0 print:shadow-none",
        className
      )}
    >
      {children}
    </section>
  );
}

/**
 * Abre um anexo com link assinado de um minuto.
 *
 * O bucket é privado: o link só é gerado na hora do clique, com a
 * sessão de quem clicou, e a RLS do Storage decide se ele pode ler.
 */
export function LinkAnexo({
  anexo,
  demo,
  token,
}: {
  anexo: Anexo;
  demo: boolean;
  /** Pelo link público não há sessão: o servidor assina depois de conferir o token. */
  token?: string;
}) {
  const [abrindo, setAbrindo] = useState(false);
  const [erro, setErro] = useState(false);

  async function abrir() {
    if (demo) return;
    setAbrindo(true);
    setErro(false);
    let url: string | null = null;
    if (token) {
      const res = await abrirAnexoLink(token, anexo.caminho);
      url = res.ok ? res.url : null;
    } else {
      const { data } = await createClient()
        .storage.from(BUCKET_ANEXOS)
        .createSignedUrl(anexo.caminho, 60);
      url = data?.signedUrl ?? null;
    }
    setAbrindo(false);
    if (url) window.open(url, "_blank", "noopener");
    else setErro(true);
  }

  return (
    <button
      type="button"
      onClick={abrir}
      className="inline-flex min-w-0 items-center gap-2 rounded-md border border-border bg-branco-clinico px-3 py-2 text-left text-sm text-azul-medico hover:border-teal"
    >
      {abrindo ? <Loader2 className="size-4 shrink-0 animate-spin" /> : <FileText className="size-4 shrink-0 text-teal" />}
      <span className="min-w-0 truncate">{anexo.nome}</span>
      <span className="shrink-0 text-xs text-cinza-suave">
        {erro ? "não abriu" : tamanhoArquivo(anexo.tamanho)}
      </span>
    </button>
  );
}
