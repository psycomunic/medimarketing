"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, PencilLine, Trash2, Youtube, Link2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { excluirAula, salvarAula } from "@/lib/actions/academy";
import { ehArquivoDeVideo, urlDeEmbed } from "@/lib/video";
import type { Lesson } from "@/lib/supabase/types";

function paraSlug(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** Cadastro da aula, incluindo o link do vídeo. */
export function FormAula({
  courseId,
  aula,
  proximaOrdem = 1,
}: {
  courseId: string;
  aula?: Lesson;
  proximaOrdem?: number;
}) {
  const router = useRouter();
  const editando = !!aula;
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [slugTocado, setSlugTocado] = useState(editando);

  const [form, setForm] = useState({
    titulo: aula?.titulo ?? "",
    slug: aula?.slug ?? "",
    descricao: aula?.descricao ?? "",
    videoUrl: aula?.video_url ?? "",
    materialUrl: aula?.material_url ?? "",
    duracaoMin: aula?.duracao_min ? String(aula.duracao_min) : "",
    ordem: aula?.ordem ?? proximaOrdem,
    publicado: aula?.publicado ?? true,
  });

  // Prévia do embed: mostra na hora se o link foi entendido
  const preview = form.videoUrl ? urlDeEmbed(form.videoUrl) : null;
  const arquivoDireto =
    !!form.videoUrl && !preview && ehArquivoDeVideo(form.videoUrl);

  function enviar() {
    setErro(null);
    startTransition(async () => {
      const res = await salvarAula({
        id: aula?.id,
        courseId,
        titulo: form.titulo,
        slug: form.slug || paraSlug(form.titulo),
        descricao: form.descricao,
        videoUrl: form.videoUrl,
        materialUrl: form.materialUrl,
        duracaoMin: form.duracaoMin ? Number(form.duracaoMin) : undefined,
        ordem: form.ordem,
        publicado: form.publicado,
      });
      if (!res.ok) {
        setErro(res.erro);
        return;
      }
      setAberto(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        {editando ? (
          <button
            type="button"
            className="rounded-md p-2 text-cinza-suave transition-colors hover:bg-verde-menta hover:text-azul-medico"
            aria-label="Editar aula"
          >
            <PencilLine className="size-4" />
          </button>
        ) : (
          <Button variant="marca">
            <Plus className="size-4" />
            Nova aula
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editando ? "Editar aula" : "Nova aula"}</DialogTitle>
          <DialogDescription>
            Cole o link do YouTube, do Vimeo ou de um arquivo de vídeo.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="a-titulo">Título da aula</Label>
            <Input
              id="a-titulo"
              value={form.titulo}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  titulo: e.target.value,
                  slug: slugTocado ? f.slug : paraSlug(e.target.value),
                }))
              }
              placeholder="Ex.: Os 4 momentos de uma conversa que converte"
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="a-video">Link do vídeo</Label>
            <div className="relative">
              <Youtube className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-cinza-suave" />
              <Input
                id="a-video"
                className="pl-10"
                value={form.videoUrl}
                onChange={(e) => setForm((f) => ({ ...f, videoUrl: e.target.value }))}
                placeholder="https://www.youtube.com/watch?v=..."
              />
            </div>
            {form.videoUrl && (
              <p
                className={
                  "text-xs " +
                  (preview || arquivoDireto ? "text-sucesso" : "text-alerta")
                }
              >
                {preview
                  ? "Link reconhecido: o vídeo vai tocar embutido na aula."
                  : arquivoDireto
                    ? "Arquivo de vídeo: vai tocar no player do navegador."
                    : "Não reconhecemos esse link. Use YouTube, Vimeo ou um arquivo .mp4."}
              </p>
            )}
          </div>

          {preview && (
            <div className="aspect-video overflow-hidden rounded-lg border border-border">
              {/* eslint-disable-next-line jsx-a11y/iframe-has-title */}
              <iframe src={preview} className="size-full" allowFullScreen />
            </div>
          )}

          <div className="grid gap-1.5">
            <Label htmlFor="a-descricao">Descrição</Label>
            <Textarea
              id="a-descricao"
              rows={3}
              value={form.descricao}
              onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
              placeholder="O que a pessoa aprende nesta aula"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="grid gap-1.5">
              <Label htmlFor="a-slug">Endereço (slug)</Label>
              <Input
                id="a-slug"
                value={form.slug}
                onChange={(e) => {
                  setSlugTocado(true);
                  setForm((f) => ({ ...f, slug: paraSlug(e.target.value) }));
                }}
                placeholder="aula-1"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="a-duracao">Duração (min)</Label>
              <Input
                id="a-duracao"
                inputMode="numeric"
                value={form.duracaoMin}
                onChange={(e) =>
                  setForm((f) => ({ ...f, duracaoMin: e.target.value }))
                }
                placeholder="12"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="a-ordem">Ordem</Label>
              <Input
                id="a-ordem"
                inputMode="numeric"
                value={String(form.ordem)}
                onChange={(e) =>
                  setForm((f) => ({ ...f, ordem: Number(e.target.value) || 0 }))
                }
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="a-material">Material de apoio (opcional)</Label>
            <div className="relative">
              <Link2 className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-cinza-suave" />
              <Input
                id="a-material"
                className="pl-10"
                value={form.materialUrl}
                onChange={(e) =>
                  setForm((f) => ({ ...f, materialUrl: e.target.value }))
                }
                placeholder="https://... (PDF, planilha, script)"
              />
            </div>
          </div>

          <label className="flex cursor-pointer items-center gap-2 rounded-md bg-branco-clinico px-3 py-2.5 text-sm text-cinza-texto">
            <input
              type="checkbox"
              className="size-4 accent-teal"
              checked={form.publicado}
              onChange={(e) =>
                setForm((f) => ({ ...f, publicado: e.target.checked }))
              }
            />
            Aula publicada (visível na trilha)
          </label>

          {erro && (
            <p className="rounded-md bg-coral/10 px-3 py-2 text-sm text-coral">
              {erro}
            </p>
          )}

          <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
            {editando ? (
              <BotaoExcluirAula id={aula.id} onPronto={() => setAberto(false)} />
            ) : (
              <span />
            )}
            <div className="flex gap-3">
              <Button variant="ghost" onClick={() => setAberto(false)}>
                Cancelar
              </Button>
              <Button variant="marca" onClick={enviar} disabled={pending}>
                {pending && <Loader2 className="size-4 animate-spin" />}
                Salvar aula
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function BotaoExcluirAula({ id, onPronto }: { id: string; onPronto: () => void }) {
  const router = useRouter();
  const [confirmando, setConfirmando] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!confirmando) {
    return (
      <button
        type="button"
        onClick={() => setConfirmando(true)}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-cinza-suave transition-colors hover:text-coral"
      >
        <Trash2 className="size-4" /> Excluir
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-coral">Confirma excluir?</span>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await excluirAula(id);
            onPronto();
            router.refresh();
          })
        }
        className="font-semibold text-coral hover:underline"
      >
        Sim
      </button>
      <button
        type="button"
        onClick={() => setConfirmando(false)}
        className="text-cinza-suave hover:underline"
      >
        Não
      </button>
    </div>
  );
}
