"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, PencilLine, Trash2 } from "lucide-react";
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
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { excluirTrilha, salvarTrilha } from "@/lib/actions/academy";
import type { Course, NivelTrilha, Role } from "@/lib/supabase/types";

const PAPEIS: { valor: Role; label: string }[] = [
  { valor: "gestor", label: "Gestor(a)" },
  { valor: "secretaria", label: "Atendimento" },
  { valor: "medico", label: "Médico(a)" },
];

/** Gera slug a partir do título, para o admin não precisar pensar nisso. */
function paraSlug(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function FormTrilha({
  trilha,
  proximaOrdem = 0,
}: {
  trilha?: Course;
  proximaOrdem?: number;
}) {
  const router = useRouter();
  const editando = !!trilha;
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [slugTocado, setSlugTocado] = useState(editando);

  const [form, setForm] = useState({
    titulo: trilha?.titulo ?? "",
    slug: trilha?.slug ?? "",
    resumo: trilha?.resumo ?? "",
    descricao: trilha?.descricao ?? "",
    nivel: (trilha?.nivel ?? "essencial") as NivelTrilha,
    papeis: (trilha?.papeis ?? ["gestor", "secretaria", "medico"]) as Role[],
    ordem: trilha?.ordem ?? proximaOrdem,
    publicado: trilha?.publicado ?? false,
  });

  function alterarTitulo(valor: string) {
    setForm((f) => ({
      ...f,
      titulo: valor,
      slug: slugTocado ? f.slug : paraSlug(valor),
    }));
  }

  function alternarPapel(papel: Role) {
    setForm((f) => ({
      ...f,
      papeis: f.papeis.includes(papel)
        ? f.papeis.filter((p) => p !== papel)
        : [...f.papeis, papel],
    }));
  }

  function enviar() {
    setErro(null);
    startTransition(async () => {
      const res = await salvarTrilha({ id: trilha?.id, ...form });
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
            aria-label="Editar trilha"
          >
            <PencilLine className="size-4" />
          </button>
        ) : (
          <Button variant="marca">
            <Plus className="size-4" />
            Nova trilha
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editando ? "Editar trilha" : "Nova trilha"}</DialogTitle>
          <DialogDescription>
            A trilha só aparece para os alunos depois de publicada.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="titulo">Título</Label>
            <Input
              id="titulo"
              value={form.titulo}
              onChange={(e) => alterarTitulo(e.target.value)}
              placeholder="Ex.: Secretária Vendedora"
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="slug">Endereço (slug)</Label>
            <Input
              id="slug"
              value={form.slug}
              onChange={(e) => {
                setSlugTocado(true);
                setForm((f) => ({ ...f, slug: paraSlug(e.target.value) }));
              }}
              placeholder="secretaria-vendedora"
            />
            <p className="text-xs text-cinza-suave">
              /app/academy/{form.slug || "endereco-da-trilha"}
            </p>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="resumo">Resumo (aparece no card)</Label>
            <Input
              id="resumo"
              value={form.resumo}
              onChange={(e) => setForm((f) => ({ ...f, resumo: e.target.value }))}
              placeholder="Uma frase sobre o que a pessoa vai aprender"
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="descricao">Descrição completa</Label>
            <Textarea
              id="descricao"
              rows={3}
              value={form.descricao}
              onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="nivel">Nível</Label>
              <Select
                id="nivel"
                value={form.nivel}
                onChange={(e) =>
                  setForm((f) => ({ ...f, nivel: e.target.value as NivelTrilha }))
                }
              >
                <option value="essencial">Essencial</option>
                <option value="intermediario">Intermediário</option>
                <option value="avancado">Avançado</option>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ordem">Ordem de exibição</Label>
              <Input
                id="ordem"
                inputMode="numeric"
                value={String(form.ordem)}
                onChange={(e) =>
                  setForm((f) => ({ ...f, ordem: Number(e.target.value) || 0 }))
                }
              />
            </div>
          </div>

          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-medium text-cinza-texto">
              Quem vê esta trilha
            </legend>
            <div className="flex flex-wrap gap-4">
              {PAPEIS.map((p) => (
                <label
                  key={p.valor}
                  className="flex cursor-pointer items-center gap-2 text-sm text-cinza-suave"
                >
                  <input
                    type="checkbox"
                    className="size-4 accent-teal"
                    checked={form.papeis.includes(p.valor)}
                    onChange={() => alternarPapel(p.valor)}
                  />
                  {p.label}
                </label>
              ))}
            </div>
          </fieldset>

          <label className="flex cursor-pointer items-center gap-2 rounded-md bg-branco-clinico px-3 py-2.5 text-sm text-cinza-texto">
            <input
              type="checkbox"
              className="size-4 accent-teal"
              checked={form.publicado}
              onChange={(e) =>
                setForm((f) => ({ ...f, publicado: e.target.checked }))
              }
            />
            Publicar trilha (visível para os alunos)
          </label>

          {erro && (
            <p className="rounded-md bg-coral/10 px-3 py-2 text-sm text-coral">
              {erro}
            </p>
          )}

          <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
            {editando ? (
              <BotaoExcluirTrilha id={trilha.id} onPronto={() => setAberto(false)} />
            ) : (
              <span />
            )}
            <div className="flex gap-3">
              <Button variant="ghost" onClick={() => setAberto(false)}>
                Cancelar
              </Button>
              <Button variant="marca" onClick={enviar} disabled={pending}>
                {pending && <Loader2 className="size-4 animate-spin" />}
                Salvar
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function BotaoExcluirTrilha({
  id,
  onPronto,
}: {
  id: string;
  onPronto: () => void;
}) {
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
      <span className="text-coral">Excluir com as aulas?</span>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await excluirTrilha(id);
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
