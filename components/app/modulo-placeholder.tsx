import { Check, Rocket } from "lucide-react";
import { moduloPorId, type ModuloId } from "@/lib/rbac";

/**
 * Tela padrão dos módulos que ainda vão ganhar dados reais.
 *
 * Mostra o que o módulo fará, em que fase entra e o que já dá para ir
 * preparando — para o painel navegar inteiro desde a Fase 1 sem telas
 * vazias sem explicação.
 */
export function ModuloPlaceholder({
  id,
  itens,
  nota,
}: {
  id: ModuloId;
  itens: string[];
  nota?: string;
}) {
  const modulo = moduloPorId(id);
  if (!modulo) return null;

  const Icone = modulo.icone;

  return (
    <div className="mx-auto max-w-4xl px-5 py-8 md:px-8 md:py-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-verde-menta text-teal">
            <Icone className="size-6" />
          </span>
          <div>
            <h1 className="text-2xl md:text-3xl">{modulo.label}</h1>
            <p className="mt-1 max-w-xl text-cinza-suave">{modulo.resumo}</p>
          </div>
        </div>
        <span className="rounded-full bg-alerta/12 px-3 py-1 text-xs font-semibold text-alerta">
          Fase {modulo.fase}
        </span>
      </header>

      <section className="mt-8 rounded-lg border border-border bg-white p-6 shadow-soft md:p-8">
        <div className="flex items-center gap-2 text-teal">
          <Rocket className="size-5" />
          <h2 className="font-heading text-lg font-semibold text-azul-medico">
            O que vem aqui
          </h2>
        </div>
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {itens.map((item) => (
            <li key={item} className="flex items-start gap-2.5 text-sm">
              <Check className="mt-0.5 size-4 shrink-0 text-teal" />
              <span className="text-cinza-suave">{item}</span>
            </li>
          ))}
        </ul>

        <p className="mt-7 rounded-md border border-dashed border-border bg-branco-clinico px-4 py-3 text-sm text-cinza-suave">
          {nota ??
            `Este módulo entra na Fase ${modulo.fase} do roadmap. A estrutura de acesso já está pronta: quem entra aqui é exatamente quem tem permissão.`}
        </p>
      </section>
    </div>
  );
}
