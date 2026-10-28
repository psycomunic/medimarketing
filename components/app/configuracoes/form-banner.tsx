"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ImageUp, Loader2, Trash2 } from "lucide-react";
import { removerBanner, salvarBanner } from "@/lib/actions/logo";
import { BannerClinica } from "@/components/app/painel/banner-clinica";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Banner do topo da visão geral da clínica. A prévia mostra exatamente
 * como vai aparecer no painel, antes de enviar.
 */
export function FormBanner({
  organizationId,
  nome,
  bannerUrl,
  bannerLink,
  demo,
  className,
}: {
  organizationId: string;
  nome: string;
  bannerUrl: string | null;
  bannerLink: string | null;
  demo: boolean;
  className?: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [previa, setPrevia] = useState<string | null>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [link, setLink] = useState(bannerLink ?? "");
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);
  const [pending, startTransition] = useTransition();

  function escolher(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    setErro(null);
    setSalvo(false);
    if (!f) return;

    if (f.size > 4 * 1024 * 1024) {
      setErro("O banner precisa ter no máximo 4 MB.");
      return;
    }
    setArquivo(f);
    setPrevia(URL.createObjectURL(f));
  }

  function enviar() {
    setErro(null);
    setSalvo(false);
    startTransition(async () => {
      const fd = new FormData();
      if (arquivo) fd.append("banner", arquivo);
      fd.append("link", link);
      fd.append("organizationId", organizationId);

      const res = await salvarBanner(fd);
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
    setSalvo(false);
    startTransition(async () => {
      const res = await removerBanner(organizationId);
      if (!res.ok) {
        setErro(res.erro);
        return;
      }
      setPrevia(null);
      setArquivo(null);
      setLink("");
      router.refresh();
    });
  }

  const mostrando = previa ?? bannerUrl;
  const mudouLink = link.trim() !== (bannerLink ?? "");

  return (
    <section className={cn("rounded-lg border border-border bg-white p-6 shadow-soft", className)}>
      <h2 className="text-lg font-semibold text-azul-medico">Banner do painel</h2>
      <p className="mt-1 text-sm text-cinza-suave">
        Aparece no topo da visão geral para toda a equipe da clínica. Bom para
        boas-vindas, campanha do mês ou um recado da agência.
      </p>

      <div className="mt-5">
        {mostrando ? (
          <BannerClinica url={mostrando} nome={nome} />
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={demo || pending}
            className="grid aspect-[5/1] w-full place-items-center rounded-2xl border border-dashed border-border bg-branco-clinico text-sm text-cinza-suave transition-colors hover:border-teal hover:text-teal"
          >
            <span className="flex items-center gap-2">
              <ImageUp className="size-4" /> Escolher imagem do banner
            </span>
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        id={`banner-${organizationId}`}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        onChange={escolher}
        className="sr-only"
      />

      <div className="mt-4 flex min-w-0 items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={demo || pending}
          onClick={() => inputRef.current?.click()}
          className="shrink-0"
        >
          Escolher arquivo
        </Button>
        <span className="min-w-0 truncate text-sm text-cinza-suave" title={arquivo?.name}>
          {arquivo?.name ?? "Nenhum arquivo escolhido"}
        </span>
      </div>
      <p className="mt-2 text-xs text-cinza-suave">
        PNG, JPG, WEBP ou GIF, até 4 MB. Tamanho ideal: 1600 × 300 px. A imagem
        aparece inteira, sem corte, então o texto pode vir na própria arte.
      </p>

      <div className="mt-4 grid gap-1.5">
        <Label htmlFor={`banner-link-${organizationId}`}>Link ao clicar (opcional)</Label>
        <Input
          id={`banner-link-${organizationId}`}
          value={link}
          onChange={(e) => {
            setLink(e.target.value);
            setSalvo(false);
          }}
          placeholder="/app/academy ou https://..."
          disabled={demo}
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          variant="marca"
          size="sm"
          onClick={enviar}
          disabled={demo || pending || (!arquivo && !(bannerUrl && mudouLink))}
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : <ImageUp className="size-4" />}
          {arquivo ? (bannerUrl ? "Substituir banner" : "Enviar banner") : "Salvar link"}
        </Button>

        {bannerUrl && (
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

      {erro && <p className="mt-4 rounded-md bg-coral/10 px-3 py-2 text-sm text-coral">{erro}</p>}
      {salvo && (
        <p className="mt-4 flex items-center gap-2 rounded-md bg-sucesso/10 px-3 py-2 text-sm text-sucesso">
          <CheckCircle2 className="size-4" /> Banner atualizado.
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
