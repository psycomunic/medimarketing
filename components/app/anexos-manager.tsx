"use client";

import { useEffect, useRef, useState } from "react";
import {
  Paperclip,
  Upload,
  FileText,
  Image as ImageIcon,
  Download,
  Trash2,
  Loader2,
} from "lucide-react";
import {
  listarAnexos,
  salvarAnexo,
  removerAnexo,
  type AnexoComUrl,
} from "@/lib/actions/anexos";
import { formatarTamanho } from "@/lib/agenda";
import { cn } from "@/lib/utils";

const TIPOS_ACEITOS =
  ".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,image/*,application/pdf";

export function AnexosManager({
  consultaId,
  demo,
}: {
  consultaId: string;
  demo: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [anexos, setAnexos] = useState<AnexoComUrl[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Carrega os anexos ao abrir a consulta
  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    listarAnexos(consultaId).then((lista) => {
      if (ativo) {
        setAnexos(lista);
        setCarregando(false);
      }
    });
    return () => {
      ativo = false;
    };
  }, [consultaId]);

  async function onArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite reenviar o mesmo arquivo
    if (!file) return;
    setErro(null);

    if (file.size > 10 * 1024 * 1024) {
      setErro("Arquivo muito grande (máx. 10 MB).");
      return;
    }

    // MODO DEMO: mostra o arquivo localmente (não persiste)
    if (demo) {
      const local: AnexoComUrl = {
        id: crypto.randomUUID(),
        consulta_id: consultaId,
        medico_id: "demo",
        nome: file.name,
        caminho: "demo",
        tipo: file.type || null,
        tamanho: file.size,
        created_at: new Date().toISOString(),
        url: URL.createObjectURL(file),
      };
      setAnexos((a) => [local, ...a]);
      return;
    }

    setEnviando(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await salvarAnexo(consultaId, fd);
    setEnviando(false);
    if (res.ok && res.anexo) setAnexos((a) => [res.anexo!, ...a]);
    else if (!res.ok) setErro(res.erro);
  }

  async function onRemover(a: AnexoComUrl) {
    setErro(null);
    if (demo) {
      setAnexos((lista) => lista.filter((x) => x.id !== a.id));
      return;
    }
    setAnexos((lista) => lista.filter((x) => x.id !== a.id)); // otimista
    const res = await removerAnexo(a.id, a.caminho);
    if (!res.ok) setErro(res.erro);
  }

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-sm font-medium text-cinza-texto">
          <Paperclip className="size-4 text-teal" /> Anexos
          {anexos.length > 0 && (
            <span className="rounded-full bg-verde-menta px-1.5 text-xs text-azul-medico">
              {anexos.length}
            </span>
          )}
        </span>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={enviando}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-white px-3 py-1.5 text-xs font-semibold text-azul-medico transition-colors hover:border-teal hover:text-teal disabled:opacity-50"
        >
          {enviando ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Upload className="size-3.5" />
          )}
          Anexar documento
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={TIPOS_ACEITOS}
          onChange={onArquivo}
          className="hidden"
        />
      </div>

      {erro && <p className="text-xs text-coral">{erro}</p>}

      {carregando ? (
        <p className="py-3 text-center text-xs text-cinza-suave">Carregando…</p>
      ) : anexos.length === 0 ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex flex-col items-center gap-1 rounded-lg border border-dashed border-border bg-branco-clinico py-6 text-center text-xs text-cinza-suave transition-colors hover:border-teal-claro hover:bg-verde-menta/30"
        >
          <Upload className="size-5 text-teal-claro" />
          Arraste ou clique para anexar exames, encaminhamentos, receitas…
          <span className="text-cinza-suave/70">PDF, imagem ou Word · até 10 MB</span>
        </button>
      ) : (
        <ul className="grid gap-1.5">
          {anexos.map((a) => {
            const isImg = (a.tipo ?? "").startsWith("image/");
            const Icone = isImg ? ImageIcon : FileText;
            return (
              <li
                key={a.id}
                className="flex items-center gap-3 rounded-lg border border-border bg-white px-3 py-2"
              >
                <span
                  className={cn(
                    "grid size-9 shrink-0 place-items-center rounded-md",
                    isImg ? "bg-teal/10 text-teal" : "bg-coral/10 text-coral"
                  )}
                >
                  <Icone className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-cinza-texto">
                    {a.nome}
                  </p>
                  <p className="text-xs text-cinza-suave">
                    {formatarTamanho(a.tamanho)}
                    {demo && a.caminho === "demo" && " · pré-visualização (não salva)"}
                  </p>
                </div>
                {a.url ? (
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    download={a.nome}
                    className="grid size-8 place-items-center rounded-md text-cinza-suave transition-colors hover:bg-verde-menta hover:text-teal"
                    aria-label={`Baixar ${a.nome}`}
                  >
                    <Download className="size-4" />
                  </a>
                ) : (
                  <span
                    className="grid size-8 place-items-center text-cinza-suave/40"
                    title="Disponível ao conectar o Supabase"
                  >
                    <Download className="size-4" />
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => onRemover(a)}
                  className="grid size-8 place-items-center rounded-md text-cinza-suave transition-colors hover:bg-coral/10 hover:text-coral"
                  aria-label={`Remover ${a.nome}`}
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
