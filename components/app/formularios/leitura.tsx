"use client";

import {
  linhasMensais,
  linhasTabela,
  numeracao,
  substituirClinica,
  valorMensal,
  valorTexto,
  type CampoMensal,
  type CampoTabela,
  type Respostas,
  type SchemaFormulario,
} from "@/lib/formularios/tipos";
import {
  CabecalhoEtapa,
  CartaoEtapa,
  LinkAnexo,
} from "@/components/app/formularios/comum";
import { rotuloMes } from "@/lib/formularios/formato";

/**
 * As respostas por extenso, etapa por etapa.
 *
 * É a mesma tela para a clínica depois de enviar, para a equipe no
 * detalhe e para a impressão: o que a clínica vê é exatamente o que a
 * equipe leu.
 */
export function LeituraFormulario({
  schema,
  respostas,
  clinica,
  demo,
  token,
}: {
  schema: SchemaFormulario;
  respostas: Respostas;
  clinica: string;
  demo: boolean;
  /** Leitura pelo link público: os anexos abrem pelo token. */
  token?: string;
}) {
  const nums = numeracao(schema);

  return (
    <div className="grid gap-6 print:gap-10">
      {schema.etapas.map((etapa, i) => (
        <CartaoEtapa key={etapa.id}>
          <CabecalhoEtapa indice={i} titulo={etapa.titulo} />
          <div className="mt-6 grid gap-7">
            {etapa.campos.map((campo) => {
              if (campo.tipo === "tabela") {
                return <TabelaLeitura key={campo.id} campo={campo} respostas={respostas} />;
              }
              if (campo.tipo === "tabela_mensal") {
                return (
                  <MensalLeitura key={campo.id} schema={schema} campo={campo} respostas={respostas} />
                );
              }
              const texto = valorTexto(respostas, campo.id).trim();
              const anexos = respostas.anexos?.[campo.id] ?? [];
              return (
                <div key={campo.id} className="print:break-inside-avoid">
                  <h3 className="font-sans text-base font-semibold text-azul-medico">
                    {nums.get(campo.id)}. {substituirClinica(campo.pergunta, clinica)}
                  </h3>
                  {texto ? (
                    <p className="mt-2 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-cinza-texto">
                      {texto}
                    </p>
                  ) : (
                    <NaoInformado />
                  )}
                  {anexos.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {anexos.map((a) => (
                        <LinkAnexo key={a.caminho} anexo={a} demo={demo} token={token} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {etapa.nota_final && (
            <p className="mt-6 text-sm leading-relaxed text-cinza-suave">{etapa.nota_final}</p>
          )}
        </CartaoEtapa>
      ))}
    </div>
  );
}

function NaoInformado() {
  return <p className="mt-2 text-sm italic text-cinza-suave/80">Não informado</p>;
}

function Celula({ valor }: { valor: string }) {
  return valor.trim() ? (
    <span className="break-words">{valor}</span>
  ) : (
    <span className="italic text-cinza-suave/70">—</span>
  );
}

function TabelaLeitura({ campo, respostas }: { campo: CampoTabela; respostas: Respostas }) {
  const linhas = linhasTabela(respostas, campo).filter(
    (l) => l.rotulo.trim() || campo.colunas.some((c) => l[c.id]?.trim())
  );

  return (
    <div>
      {linhas.length === 0 ? (
        <NaoInformado />
      ) : (
        <>
          <table className="hidden w-full border-collapse text-sm md:table print:table">
            <thead>
              <tr className="bg-verde-menta/60 text-left text-azul-medico">
                <th className="border border-border px-3 py-2.5 font-semibold">{campo.rotulo}</th>
                {campo.colunas.map((c) => (
                  <th key={c.id} className="border border-border px-3 py-2.5 font-semibold">
                    {c.titulo}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {linhas.map((l, i) => (
                <tr key={i} className="print:break-inside-avoid">
                  <td className="border border-border px-3 py-2.5 font-medium">
                    <Celula valor={l.rotulo} />
                  </td>
                  {campo.colunas.map((c) => (
                    <td key={c.id} className="border border-border px-3 py-2.5">
                      <Celula valor={l[c.id] ?? ""} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          <div className="grid gap-3 md:hidden print:hidden">
            {linhas.map((l, i) => (
              <dl key={i} className="rounded-lg border border-border p-4 text-sm">
                <dt className="font-semibold text-azul-medico">{l.rotulo || "Sem nome"}</dt>
                {campo.colunas.map((c) => (
                  <div key={c.id} className="mt-2 flex justify-between gap-4">
                    <span className="text-cinza-suave">{c.titulo}</span>
                    <span className="text-right">
                      <Celula valor={l[c.id] ?? ""} />
                    </span>
                  </div>
                ))}
              </dl>
            ))}
          </div>
        </>
      )}
      {campo.nota && <p className="mt-3 text-sm text-cinza-suave">{campo.nota}</p>}
    </div>
  );
}

function MensalLeitura({
  schema,
  campo,
  respostas,
}: {
  schema: SchemaFormulario;
  campo: CampoMensal;
  respostas: Respostas;
}) {
  const valor = valorMensal(respostas, campo);
  const linhas = linhasMensais(schema, respostas, campo);
  const vals = (chave: string) => valor.linhas[chave] ?? Array(campo.meses).fill("");

  return (
    <div>
      <table className="hidden w-full border-collapse text-sm md:table print:table">
        <thead>
          <tr className="bg-verde-menta/60 text-left text-azul-medico">
            <th className="border border-border px-3 py-2.5 font-semibold">{campo.rotulo}</th>
            {valor.meses.map((m, i) => (
              <th key={i} className="border border-border px-3 py-2.5 font-semibold">
                {rotuloMes(m)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={l.chave} className="print:break-inside-avoid">
              <td className="border border-border px-3 py-2.5 font-medium">{l.rotulo}</td>
              {vals(l.chave).map((v, i) => (
                <td key={i} className="border border-border px-3 py-2.5">
                  <Celula valor={v} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="grid gap-3 md:hidden print:hidden">
        {linhas.map((l) => (
          <dl key={l.chave} className="rounded-lg border border-border p-4 text-sm">
            <dt className="font-semibold text-azul-medico">{l.rotulo}</dt>
            {vals(l.chave).map((v, i) => (
              <div key={i} className="mt-2 flex justify-between gap-4">
                <span className="text-cinza-suave">{rotuloMes(valor.meses[i] ?? "")}</span>
                <span className="text-right">
                  <Celula valor={v} />
                </span>
              </div>
            ))}
          </dl>
        ))}
      </div>
      {campo.nota && <p className="mt-3 text-sm text-cinza-suave">{campo.nota}</p>}
    </div>
  );
}
