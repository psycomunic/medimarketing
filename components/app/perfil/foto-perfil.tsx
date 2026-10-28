"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { removerFoto, salvarFoto } from "@/lib/actions/perfil";
import { cn } from "@/lib/utils";

/** Iniciais de nome e sobrenome, para quando não há foto. */
export function iniciais(nome: string | null): string {
  const partes = (nome ?? "").trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return "?";
  return ((partes[0][0] ?? "") + (partes.length > 1 ? partes[partes.length - 1][0] : "")).toUpperCase();
}

/**
 * Foto de perfil com o botão de câmera por cima. Envia assim que a
 * pessoa escolhe a imagem: a prévia aparece na hora, sem um segundo
 * clique em "salvar".
 */
export function FotoPerfil({
  nome,
  fotoUrl,
  demo,
  className,
}: {
  nome: string | null;
  fotoUrl: string | null;
  demo: boolean;
  className?: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [previa, setPrevia] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function escolher(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (inputRef.current) inputRef.current.value = "";
    setErro(null);
    if (!f) return;
    if (f.size > 3 * 1024 * 1024) {
      setErro("A foto precisa ter no máximo 3 MB.");
      return;
    }
    setPrevia(URL.createObjectURL(f));
    startTransition(async () => {
      const fd = new FormData();
      fd.append("foto", f);
      const res = await salvarFoto(fd);
      if (!res.ok) {
        setErro(res.erro);
        setPrevia(null);
        return;
      }
      router.refresh();
    });
  }

  function remover() {
    setErro(null);
    startTransition(async () => {
      const res = await removerFoto();
      if (!res.ok) {
        setErro(res.erro);
        return;
      }
      setPrevia(null);
      router.refresh();
    });
  }

  const mostrando = previa ?? fotoUrl;

  return (
    <div className={cn("flex flex-col items-center gap-2 sm:items-start", className)}>
      <div className="relative">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={demo || pending}
          className="group relative block size-28 overflow-hidden rounded-full border-4 border-white bg-azul-medico shadow-card focus:outline-none focus-visible:ring-2 focus-visible:ring-teal"
          aria-label={fotoUrl ? "Trocar foto de perfil" : "Adicionar foto de perfil"}
        >
          {mostrando ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={mostrando} alt="" className="size-full object-cover" />
          ) : (
            <span className="grid size-full place-items-center font-heading text-3xl font-bold text-white">
              {iniciais(nome)}
            </span>
          )}
          <span
            className={cn(
              "absolute inset-0 grid place-items-center bg-azul-profundo/55 text-white transition-opacity",
              pending ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            )}
          >
            {pending ? <Loader2 className="size-6 animate-spin" /> : <Camera className="size-6" />}
          </span>
        </button>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={demo || pending}
          className="absolute bottom-1 right-1 grid size-9 place-items-center rounded-full border-2 border-white bg-teal text-white shadow-soft transition-transform hover:scale-105"
          aria-label="Escolher foto"
        >
          <Camera className="size-4" />
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={escolher}
        className="sr-only"
      />

      {fotoUrl && !pending && (
        <button
          type="button"
          onClick={remover}
          disabled={demo}
          className="inline-flex items-center gap-1 text-xs font-medium text-cinza-suave hover:text-coral"
        >
          <Trash2 className="size-3.5" /> Remover foto
        </button>
      )}
      {erro && <p className="max-w-[14rem] text-center text-xs text-coral sm:text-left">{erro}</p>}
    </div>
  );
}
