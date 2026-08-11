"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { CheckCircle2, ImageUp, Loader2, Trash2 } from "lucide-react";
import { removerLogo, salvarLogo } from "@/lib/actions/logo";
import { Button } from "@/components/ui/button";

/**
 * Upload da logo da clínica.
 *
 * A prévia é local (URL.createObjectURL) para a pessoa ver o resultado
 * antes de enviar — trocar de logo é uma decisão visual, e esperar o
 * upload para descobrir que ficou torta é frustrante.
 */
export function FormLogo({
  organizationId,
  nome,
  logoUrl,
  demo,
}: {
  organizationId: string;
  nome: string;
  logoUrl: string | null;
  demo: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [previa, setPrevia] = useState<string | null>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);
  const [pending, startTransition] = useTransition();

  function escolher(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    setErro(null);
    setSalvo(false);
    if (!f) return;

    if (f.size > 2 * 1024 * 1024) {
      setErro("A imagem precisa ter no máximo 2 MB.");
      return;
    }
    setArquivo(f);
    setPrevia(URL.createObjectURL(f));
  }

  function enviar() {
    if (!arquivo) return;
    setErro(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.append("logo", arquivo);
      fd.append("organizationId", organizationId);

      const res = await salvarLogo(fd);
      if (!res.ok) {
        setErro(res.erro);
        return;
      }
      setSalvo(true);
      setArquivo(null);
      setPrevia(null);
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    });
  }

  function remover() {
    setErro(null);
    startTransition(async () => {
      const res = await removerLogo(organizationId);
      if (!res.ok) {
        setErro(res.erro);
        return;
      }
      setPrevia(null);
      setArquivo(null);
      router.refresh();
    });
  }

  const mostrando = previa ?? logoUrl;

  return (
    <section className="rounded-lg border border-border bg-white p-6 shadow-soft">
      <h2 className="text-lg font-semibold text-azul-medico">Logo da clínica</h2>
      <p className="mt-1 text-sm text-cinza-suave">
        Aparece no painel da sua equipe e, principalmente, na página que o
        paciente abre para confirmar a consulta.
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-5">
        <div className="grid h-24 w-40 shrink-0 place-items-center rounded-lg border border-dashed border-border bg-branco-clinico p-2">
          {mostrando ? (
            <Image
              src={mostrando}
              alt={nome}
              width={140}
              height={80}
              unoptimized
              className="max-h-20 w-auto object-contain"
            />
          ) : (
            <span className="grid size-14 place-items-center rounded-lg bg-azul-medico font-heading text-xl font-bold text-white">
              {nome.charAt(0).toUpperCase()}
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            onChange={escolher}
            className="block w-full text-sm text-cinza-suave file:mr-3 file:cursor-pointer file:rounded-full file:border-0 file:bg-verde-menta file:px-4 file:py-2 file:text-sm file:font-semibold file:text-azul-medico hover:file:bg-teal-claro/40"
          />
          <p className="mt-2 text-xs text-cinza-suave">
            PNG, JPG, WEBP ou SVG, até 2 MB. Fundo transparente fica melhor
            sobre o branco do painel.
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="marca"
              size="sm"
              onClick={enviar}
              disabled={!arquivo || pending || demo}
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ImageUp className="size-4" />
              )}
              {logoUrl ? "Substituir logo" : "Enviar logo"}
            </Button>

            {logoUrl && (
              <Button
                variant="ghost"
                size="sm"
                onClick={remover}
                disabled={pending || demo}
                className="text-coral hover:bg-coral/10"
              >
                <Trash2 className="size-4" /> Remover
              </Button>
            )}
          </div>
        </div>
      </div>

      {erro && (
        <p className="mt-4 rounded-md bg-coral/10 px-3 py-2 text-sm text-coral">{erro}</p>
      )}
      {salvo && (
        <p className="mt-4 flex items-center gap-2 rounded-md bg-sucesso/10 px-3 py-2 text-sm text-sucesso">
          <CheckCircle2 className="size-4" /> Logo atualizada.
        </p>
      )}
      {demo && (
        <p className="mt-4 rounded-md border border-dashed border-border bg-branco-clinico px-3 py-2 text-xs text-cinza-suave">
          Modo demonstração: o envio não é salvo.
        </p>
      )}
    </section>
  );
}
