import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BotaoPdf } from "./botao-pdf";
import { cn } from "@/lib/utils";

/**
 * DOCUMENTO PARA PDF
 *
 * Toda exportação do painel passa por aqui. Na tela, a folha A4 aparece
 * centralizada sobre um fundo cinza — o que se vê é exatamente o que vai
 * para o arquivo, porque a largura útil da folha na tela (186 mm) é a
 * mesma da impressão. O PDF sai pelo "Salvar como PDF" do navegador,
 * que mantém o texto selecionável e os gráficos vetoriais.
 */

const ESTILO_IMPRESSAO = `
@page { size: A4; margin: 12mm 12mm 16mm; }
@media print {
  html, body { background: #fff !important; }
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .doc-folha { box-shadow: none !important; border: 0 !important; margin: 0 !important; padding: 0 !important; width: auto !important; }
  .doc-fundo { background: #fff !important; padding: 0 !important; }
  .doc-quebra { break-before: page; }
  .doc-bloco { break-inside: avoid; }
  thead { display: table-header-group; }
  tr { break-inside: avoid; }
}
`;

export function Documento({
  titulo,
  subtitulo,
  marca,
  emitidoPara,
  voltar,
  nomeArquivo,
  children,
  acoes,
}: {
  titulo: string;
  subtitulo: string;
  /** Quem assina o documento: a clínica (com logo) ou a Medi Marketing. */
  marca: { nome: string; logoUrl?: string | null; sistema?: boolean };
  /** Linha pequena abaixo do título, ex.: "Preparado para Dr. Fulano". */
  emitidoPara?: string;
  voltar?: { href: string; rotulo: string };
  /** Nome sugerido do arquivo ao salvar. */
  nomeArquivo: string;
  children: React.ReactNode;
  /** Controles extras na barra (ex.: seletor de mês). Não vão para o PDF. */
  acoes?: React.ReactNode;
}) {
  const emitido = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

  return (
    <div className="doc-fundo min-h-screen bg-[#EEF2F4] px-3 py-6 sm:px-6 print:min-h-0">
      <style dangerouslySetInnerHTML={{ __html: ESTILO_IMPRESSAO }} />

      {/* Barra de ações: fica fora do PDF */}
      <div className="mx-auto mb-5 flex max-w-[210mm] flex-wrap items-center justify-between gap-3 print:hidden">
        {voltar ? (
          <Link
            href={voltar.href}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-cinza-suave hover:text-azul-medico"
          >
            <ArrowLeft className="size-4" /> {voltar.rotulo}
          </Link>
        ) : (
          <span />
        )}
        <div className="flex flex-wrap items-center gap-2">
          {acoes}
          <BotaoPdf nomeArquivo={nomeArquivo} />
        </div>
      </div>

      <article className="doc-folha mx-auto w-full max-w-[210mm] overflow-hidden rounded-sm bg-white px-[6mm] py-[10mm] shadow-[0_10px_40px_-12px_rgba(11,79,108,0.25)] sm:px-[12mm] sm:py-[14mm]">
        {/* Cabeçalho */}
        <header className="doc-bloco flex items-start justify-between gap-6 border-b-2 border-azul-medico pb-5">
          <div className="min-w-0">
            {marca.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={marca.logoUrl} alt={marca.nome} className="mb-3 h-11 w-auto max-w-[200px] object-contain object-left" />
            ) : marca.sistema ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src="/logo-medimarketing-email.png" alt="Medi Marketing" className="mb-3 h-6 w-auto" />
            ) : (
              <span className="mb-3 grid size-11 place-items-center rounded-lg bg-azul-medico font-heading text-lg font-bold text-white">
                {marca.nome.charAt(0).toUpperCase()}
              </span>
            )}
            <h1 className="font-heading text-[22px] font-bold leading-tight text-azul-medico">{titulo}</h1>
            <p className="mt-1 text-sm text-cinza-suave">{subtitulo}</p>
            {emitidoPara && <p className="mt-0.5 text-xs text-cinza-suave">{emitidoPara}</p>}
          </div>
          <div className="shrink-0 text-right text-xs leading-relaxed text-cinza-suave">
            <p className="font-semibold text-cinza-texto">{marca.nome}</p>
            <p>Emitido em {emitido}</p>
          </div>
        </header>

        <div className="mt-6 grid gap-7">{children}</div>

        {/* Rodapé com a assinatura da plataforma */}
        <footer className="doc-bloco mt-10 flex items-center justify-between gap-4 border-t border-border pt-3 text-[10px] text-cinza-suave">
          <span>
            {marca.nome} · {titulo}
          </span>
          <span className="flex items-center gap-1.5">
            Gerado com
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-medimarketing-email.png" alt="Medi Marketing" className="h-2.5 w-auto" />
          </span>
        </footer>
      </article>
    </div>
  );
}

/** Seção do documento: título com filete e conteúdo que não se parte. */
export function SecaoDoc({
  titulo,
  descricao,
  children,
  quebrarAntes,
  inteira = true,
}: {
  titulo: string;
  descricao?: string;
  children: React.ReactNode;
  quebrarAntes?: boolean;
  /** Falso para tabelas longas, que podem seguir na página seguinte. */
  inteira?: boolean;
}) {
  return (
    <section className={cn(quebrarAntes && "doc-quebra", inteira && "doc-bloco")}>
      <div className="mb-3 flex items-baseline gap-3">
        <h2 className="shrink-0 font-heading text-[15px] font-semibold text-azul-medico">{titulo}</h2>
        <span className="h-px flex-1 bg-border" />
      </div>
      {descricao && <p className="-mt-1 mb-3 text-xs leading-relaxed text-cinza-suave">{descricao}</p>}
      {children}
    </section>
  );
}

/** Grade de números principais. */
export function KpisDoc({
  itens,
  colunas = 4,
}: {
  itens: { rotulo: string; valor: string; nota?: string; tom?: "bom" | "ruim" | "neutro"; destaque?: boolean }[];
  colunas?: 2 | 3 | 4;
}) {
  return (
    <div
      className={cn(
        "doc-bloco grid gap-2.5",
        colunas === 4 ? "grid-cols-2 sm:grid-cols-4" : colunas === 3 ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2"
      )}
    >
      {itens.map((k) => (
        <div
          key={k.rotulo}
          className={cn(
            "min-w-0 rounded-lg border px-3.5 py-3",
            k.destaque ? "border-azul-medico bg-azul-medico text-white" : "border-border bg-[#F8FBFC]"
          )}
        >
          <p className={cn("text-[10.5px] font-medium uppercase tracking-wide", k.destaque ? "text-white/75" : "text-cinza-suave")}>
            {k.rotulo}
          </p>
          <p className={cn("mt-1 truncate font-heading text-lg font-bold tabular-nums", k.destaque ? "text-white" : "text-azul-medico")}>
            {k.valor}
          </p>
          {k.nota && (
            <p
              className={cn(
                "mt-0.5 truncate text-[11px]",
                k.destaque
                  ? "text-white/80"
                  : k.tom === "bom"
                    ? "text-[#15803D]"
                    : k.tom === "ruim"
                      ? "text-[#B91C1C]"
                      : "text-cinza-suave"
              )}
            >
              {k.nota}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

/** Tabela do documento: cabeçalho repete na página seguinte. */
export function TabelaDoc({
  colunas,
  linhas,
  total,
  vazio = "Nada no período.",
}: {
  colunas: { titulo: string; alinhar?: "esq" | "dir"; largura?: string }[];
  linhas: React.ReactNode[][];
  total?: React.ReactNode[];
  vazio?: string;
}) {
  if (!linhas.length) return <p className="rounded-lg bg-[#F8FBFC] px-4 py-3 text-xs text-cinza-suave">{vazio}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[11.5px]">
        <thead>
          <tr className="border-b-2 border-azul-medico/80">
            {colunas.map((c) => (
              <th
                key={c.titulo}
                style={c.largura ? { width: c.largura } : undefined}
                className={cn(
                  "px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-cinza-suave",
                  c.alinhar === "dir" ? "text-right" : "text-left"
                )}
              >
                {c.titulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((l, i) => (
            <tr key={i} className={cn("border-b border-border", i % 2 === 1 && "bg-[#FAFCFD]")}>
              {l.map((cel, j) => (
                <td
                  key={j}
                  className={cn(
                    "px-2 py-1.5 align-top text-cinza-texto",
                    colunas[j]?.alinhar === "dir" && "text-right tabular-nums"
                  )}
                >
                  {cel}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {total && (
          <tfoot>
            <tr className="border-t-2 border-azul-medico/80 font-semibold text-azul-medico">
              {total.map((cel, j) => (
                <td key={j} className={cn("px-2 py-2", colunas[j]?.alinhar === "dir" && "text-right tabular-nums")}>
                  {cel}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

/** Quadro de leitura: o que o número quer dizer, em uma frase. */
export function NotaDoc({ titulo, children, tom = "info" }: { titulo: string; children: React.ReactNode; tom?: "info" | "alerta" | "bom" }) {
  return (
    <div
      className={cn(
        "doc-bloco rounded-lg border-l-4 px-4 py-3 text-xs leading-relaxed",
        tom === "alerta"
          ? "border-[#D97706] bg-[#FFF8EB] text-cinza-texto"
          : tom === "bom"
            ? "border-[#16A34A] bg-[#F0FBF4] text-cinza-texto"
            : "border-teal bg-verde-menta/60 text-cinza-texto"
      )}
    >
      <p className="mb-0.5 font-semibold text-azul-medico">{titulo}</p>
      {children}
    </div>
  );
}
