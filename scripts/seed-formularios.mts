/**
 * Gera o SQL do seed dos formulários a partir de lib/formularios.
 *
 *   npx tsx scripts/seed-formularios.mts [slug]
 *
 * Sem argumento, gera todos. A saída vai em supabase/atualizacoes.sql.
 * Rodar de novo no banco é seguro: o insert atualiza a versão existente
 * em vez de duplicar.
 */
import { DIAGNOSTICO_CLINICA, SLUG_DIAGNOSTICO } from "../lib/formularios/diagnostico-clinica";
import { CHECKIN_MENSAL, SLUG_CHECKIN } from "../lib/formularios/checkin-mensal";
import type { SchemaFormulario } from "../lib/formularios/tipos";

const MODELOS: { slug: string; titulo: string; descricao: string; schema: SchemaFormulario }[] = [
  {
    slug: SLUG_DIAGNOSTICO,
    titulo: "Diagnóstico inicial",
    descricao: "Estratégia para o crescimento da clínica",
    schema: DIAGNOSTICO_CLINICA,
  },
  {
    slug: SLUG_CHECKIN,
    titulo: "Check-in mensal",
    descricao: "Os números do mês para acompanhar a evolução",
    schema: CHECKIN_MENSAL,
  },
];

// Delimitador próprio: o texto tem aspas e apóstrofos à vontade
const tag = "$schema$";
const filtro = process.argv[2];

for (const m of MODELOS.filter((x) => !filtro || x.slug === filtro)) {
  const json = JSON.stringify(m.schema, null, 2);
  if (json.includes(tag)) throw new Error(`${m.slug}: o schema contém o delimitador do SQL`);

  console.log(`insert into public.formularios_modelos (slug, versao, titulo, descricao, schema, ativo)
values (
  '${m.slug}', 1, '${m.titulo}',
  '${m.descricao}',
  ${tag}${json}${tag}::jsonb,
  true
)
on conflict (slug, versao) do update
  set titulo = excluded.titulo,
      descricao = excluded.descricao,
      schema = excluded.schema,
      ativo = excluded.ativo;
`);
}
