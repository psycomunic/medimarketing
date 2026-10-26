/**
 * Gera o SQL do seed dos formulários a partir de lib/formularios.
 *
 *   npx tsx scripts/seed-formularios.mts
 *
 * A saída vai no fim do bloco "Diagnóstico da clínica" em
 * supabase/atualizacoes.sql. Rodar de novo no banco é seguro: o insert
 * atualiza a versão existente em vez de duplicar.
 */
import { DIAGNOSTICO_CLINICA, SLUG_DIAGNOSTICO } from "../lib/formularios/diagnostico-clinica";

const json = JSON.stringify(DIAGNOSTICO_CLINICA, null, 2);
// Delimitador próprio: o texto tem aspas e apóstrofos à vontade
const tag = "$schema$";
if (json.includes(tag)) throw new Error("O schema contém o delimitador do SQL");

console.log(`insert into public.formularios_modelos (slug, versao, titulo, descricao, schema, ativo)
values (
  '${SLUG_DIAGNOSTICO}', 1, 'Diagnóstico inicial',
  'Estratégia para o crescimento da clínica',
  ${tag}${json}${tag}::jsonb,
  true
)
on conflict (slug, versao) do update
  set titulo = excluded.titulo,
      descricao = excluded.descricao,
      schema = excluded.schema,
      ativo = excluded.ativo;`);
