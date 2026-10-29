import Link from "next/link";
import { CalendarClock, ChevronLeft, ChevronRight, Contact, Copy, Download, MailCheck, Send, UserPlus, UserRoundX, Users } from "lucide-react";
import { exigirModulo } from "@/lib/acesso";
import { getNumerosPacientes, getPacientes, POR_PAGINA, type FiltrosPacientes, type Ordem, type Situacao } from "@/lib/supabase/pacientes";
import { getProfissionais } from "@/lib/supabase/financeiro-dados";
import { getSegmentos } from "@/lib/supabase/followup";
import { Indicador } from "@/components/app/financeiro/ui";
import { FiltrosPacientes as Filtros } from "@/components/app/pacientes/filtros";
import { PacienteDialog } from "@/components/app/pacientes/paciente-dialog";
import { ImportarDialog } from "@/components/app/pacientes/importar-dialog";
import { Avatar, ConsentimentoIcone, dataCurta, relativo } from "@/components/app/pacientes/partes";
import { reais } from "@/components/graficos/formato";

export const metadata = { title: "Pacientes" };

type Busca = { busca?: string; situacao?: string; convenio?: string; profissional?: string; tag?: string; ordem?: string; pagina?: string };

export default async function PacientesPage({ searchParams }: { searchParams: Busca }) {
  const { organizacao, role } = await exigirModulo("pacientes");
  const filtros: FiltrosPacientes = {
    busca: searchParams.busca,
    situacao: searchParams.situacao as Situacao | undefined,
    convenio: searchParams.convenio,
    profissional: searchParams.profissional,
    tag: searchParams.tag,
    ordem: searchParams.ordem as Ordem | undefined,
    pagina: Number(searchParams.pagina) || 1,
  };
  const [dados, numeros, profissionais, segmentos] = await Promise.all([
    getPacientes(filtros),
    getNumerosPacientes(),
    getProfissionais(organizacao?.id ?? null),
    getSegmentos(),
  ]);
  const nomes = Object.fromEntries(profissionais.map((p) => [p.id, p.nome]));
  const pagina = filtros.pagina ?? 1;
  const paginas = Math.max(Math.ceil(dados.total / POR_PAGINA), 1);
  const linkPagina = (n: number) => {
    const p = new URLSearchParams(Object.entries(searchParams).filter(([, v]) => v) as [string, string][]);
    if (n > 1) p.set("pagina", String(n));
    else p.delete("pagina");
    return `/app/pacientes${p.size ? `?${p}` : ""}`;
  };
  const podeImportar = role !== "medico";
  const filtroDisparo = new URLSearchParams(
    Object.entries(searchParams).filter(([k, v]) => v && ["busca", "situacao", "convenio", "profissional", "tag"].includes(k)) as [string, string][]
  );

  return (
    <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] gap-6 px-4 py-8 sm:px-5 md:px-8 md:py-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-verde-menta text-teal">
            <Contact className="size-6" />
          </span>
          <div className="min-w-0">
            <h1 className="text-2xl md:text-3xl">Pacientes</h1>
            <p className="mt-1 text-cinza-suave">
              {role === "medico" ? "Quem você já atendeu, com o histórico de cada um." : "Todos os pacientes da clínica, com histórico, gastos e consentimento."}
            </p>
          </div>
        </div>
        {dados.instalado && (
          <div className="flex flex-wrap gap-2">
            <Link
              href="/app/pacientes/duplicados"
              className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-azul-medico hover:bg-verde-menta"
            >
              <Copy className="size-4" /> Duplicados
            </Link>
            {role === "gestor" || role === "super_admin" ? (
              <a
                href="/app/pacientes/exportar"
                className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-azul-medico hover:bg-verde-menta"
              >
                <Download className="size-4" /> Exportar
              </a>
            ) : null}
            {podeImportar && <ImportarDialog organizationId={organizacao?.id} />}
            <PacienteDialog sugestoesTags={dados.tags} organizationId={organizacao?.id} />
          </div>
        )}
      </header>

      {!dados.instalado ? (
        <div className="rounded-xl border border-border bg-white p-6 text-sm text-cinza-suave shadow-soft">
          O banco de pacientes ainda não foi ativado. Rode o SQL &quot;Banco de pacientes (Fase 1)&quot; no Supabase: ele cria as
          fichas de todos os pacientes que já passaram pela agenda.
        </div>
      ) : (
        <>
          {numeros && (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              <Indicador icone={Users} rotulo="Pacientes" valor={numeros.total.toLocaleString("pt-BR")} nota="Fichas ativas" destaque />
              <Indicador icone={CalendarClock} rotulo="Ativos no ano" valor={numeros.ativos12m.toLocaleString("pt-BR")} nota="Consulta nos últimos 12 meses" />
              <Indicador icone={UserPlus} rotulo="Novos no mês" valor={numeros.novosMes.toLocaleString("pt-BR")} nota="Fichas criadas" />
              <Indicador icone={UserRoundX} rotulo="Sem retorno" valor={numeros.semRetorno.toLocaleString("pt-BR")} nota="Há mais de 6 meses" />
              <Indicador
                icone={MailCheck}
                rotulo="Aceitam campanhas"
                valor={numeros.comConsentimento.toLocaleString("pt-BR")}
                nota={numeros.total ? `${Math.round((numeros.comConsentimento / numeros.total) * 100)}% da base` : "Consentimento LGPD"}
              />
            </div>
          )}

          <Filtros
            convenios={dados.convenios}
            tags={dados.tags}
            profissionais={profissionais.map((p) => ({ id: p.id, nome: p.nome }))}
            segmentos={segmentos}
            organizationId={organizacao?.id}
          />

          <section className="overflow-hidden rounded-xl border border-border bg-white shadow-soft">
            <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-3 text-sm text-cinza-suave">
              <span>
                <strong className="text-cinza-texto">{dados.total.toLocaleString("pt-BR")}</strong> paciente{dados.total === 1 ? "" : "s"}
                {paginas > 1 && ` · página ${pagina} de ${paginas}`}
              </span>
              {podeImportar && dados.total > 0 && filtros.situacao !== "arquivados" && (
                <Link
                  href={`/app/disparos/novo${filtroDisparo.size ? `?${filtroDisparo}` : ""}`}
                  className="inline-flex items-center gap-1.5 rounded-full bg-verde-menta px-3 py-1 text-xs font-semibold text-azul-medico hover:bg-teal/15"
                >
                  <Send className="size-3.5" /> Disparar para {filtroDisparo.size ? "este filtro" : "todos"}
                </Link>
              )}
            </header>

            {dados.lista.length === 0 ? (
              <p className="px-5 py-12 text-center text-sm text-cinza-suave">Nenhum paciente com esses filtros.</p>
            ) : (
              <>
                {/* Tabela no computador */}
                <table className="hidden w-full text-left text-sm md:table">
                  <thead className="bg-branco-clinico text-xs text-cinza-suave">
                    <tr>
                      <th className="px-5 py-2.5 font-medium">Paciente</th>
                      <th className="px-3 py-2.5 font-medium">Convênio</th>
                      <th className="px-3 py-2.5 font-medium">Última consulta</th>
                      <th className="px-3 py-2.5 font-medium">Próxima</th>
                      <th className="px-3 py-2.5 text-right font-medium">Consultas</th>
                      <th className="px-3 py-2.5 text-right font-medium">Total gasto</th>
                      <th className="px-5 py-2.5 font-medium">
                        <span className="sr-only">Campanhas</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {dados.lista.map((p) => (
                      <tr key={p.id} className="group hover:bg-branco-clinico">
                        <td className="px-5 py-3">
                          <Link href={`/app/pacientes/${p.id}`} className="flex min-w-0 items-center gap-3">
                            <Avatar nome={p.nome} />
                            <span className="min-w-0">
                              <span className="block truncate font-medium text-cinza-texto group-hover:text-teal">{p.nome}</span>
                              <span className="block truncate text-xs text-cinza-suave">
                                {p.telefone ?? p.email ?? "Sem contato"}
                                {p.profissional_principal && nomes[p.profissional_principal] ? ` · ${nomes[p.profissional_principal]}` : ""}
                              </span>
                              {p.tags.length > 0 && (
                                <span className="mt-1 flex flex-wrap gap-1">
                                  {p.tags.slice(0, 3).map((t) => (
                                    <span key={t} className="rounded bg-verde-menta px-1.5 py-0.5 text-[10px] font-medium text-azul-medico">
                                      {t}
                                    </span>
                                  ))}
                                </span>
                              )}
                            </span>
                          </Link>
                        </td>
                        <td className="px-3 py-3 text-cinza-texto">{p.convenio ?? "—"}</td>
                        <td className="px-3 py-3">
                          {p.ultima_consulta ? (
                            <>
                              <span className="block text-cinza-texto">{dataCurta(p.ultima_consulta)}</span>
                              <span className="text-xs text-cinza-suave">{relativo(p.ultima_consulta)}</span>
                            </>
                          ) : (
                            <span className="text-cinza-suave">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-cinza-texto">{p.proxima_consulta ? dataCurta(p.proxima_consulta) : <span className="text-cinza-suave">—</span>}</td>
                        <td className="px-3 py-3 text-right tabular-nums text-cinza-texto">
                          {p.consultas_realizadas}
                          {p.faltas > 0 && <span className="block text-xs text-[#7C3AED]">{p.faltas} falta{p.faltas === 1 ? "" : "s"}</span>}
                        </td>
                        <td className="px-3 py-3 text-right font-medium tabular-nums text-cinza-texto">{reais(p.total_gasto)}</td>
                        <td className="px-5 py-3 text-right">
                          <ConsentimentoIcone p={p} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Cartões no celular */}
                <ul className="divide-y divide-border md:hidden">
                  {dados.lista.map((p) => (
                    <li key={p.id}>
                      <Link href={`/app/pacientes/${p.id}`} className="flex items-center gap-3 px-4 py-3 active:bg-branco-clinico">
                        <Avatar nome={p.nome} />
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-1.5">
                            <span className="truncate font-medium text-cinza-texto">{p.nome}</span>
                            <ConsentimentoIcone p={p} />
                          </p>
                          <p className="truncate text-xs text-cinza-suave">
                            {p.ultima_consulta ? `Última: ${dataCurta(p.ultima_consulta)}` : "Sem consulta realizada"}
                            {p.convenio ? ` · ${p.convenio}` : ""}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-sm font-medium tabular-nums text-cinza-texto">{reais(p.total_gasto)}</p>
                          <p className="text-xs text-cinza-suave">{p.consultas_realizadas} consulta{p.consultas_realizadas === 1 ? "" : "s"}</p>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {paginas > 1 && (
              <nav aria-label="Páginas" className="flex items-center justify-between gap-3 border-t border-border px-5 py-3">
                {pagina > 1 ? (
                  <Link href={linkPagina(pagina - 1)} className="inline-flex items-center gap-1 text-sm font-medium text-teal hover:underline">
                    <ChevronLeft className="size-4" /> Anterior
                  </Link>
                ) : (
                  <span />
                )}
                {pagina < paginas && (
                  <Link href={linkPagina(pagina + 1)} className="inline-flex items-center gap-1 text-sm font-medium text-teal hover:underline">
                    Próxima <ChevronRight className="size-4" />
                  </Link>
                )}
              </nav>
            )}
          </section>
        </>
      )}
    </div>
  );
}
