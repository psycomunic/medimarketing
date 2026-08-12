/**
 * Escreve os modelos de e-mail de conta em `supabase/emails/`.
 *
 * O Supabase não tem API para gravar esses modelos: eles são colados
 * no painel, em Authentication → Emails. Ter os arquivos versionados
 * evita o pior desse arranjo — ninguém saber qual é o texto atual nem
 * conseguir revisar uma mudança.
 *
 * Rode com: npm run emails:auth
 */
import { mkdir, writeFile } from "node:fs/promises";
import { MODELOS_AUTH } from "../lib/email-auth";

const DESTINO = "supabase/emails";

await mkdir(DESTINO, { recursive: true });

const indice: string[] = [
  "# Modelos de e-mail da conta",
  "",
  "Gerados por `npm run emails:auth` a partir de `lib/email-auth.ts`.",
  "Não edite os `.html` à mão: a próxima geração sobrescreve.",
  "",
  "Para aplicar, no painel do Supabase em **Authentication → Emails**,",
  "abra cada modelo, cole o assunto e o corpo, e salve.",
  "",
  "| Modelo no painel | Arquivo | Assunto |",
  "| --- | --- | --- |",
];

for (const m of MODELOS_AUTH) {
  await writeFile(`${DESTINO}/${m.arquivo}`, m.html, "utf8");
  indice.push(`| ${m.painel} | \`${m.arquivo}\` | ${m.assunto} |`);
  console.log(`${m.arquivo.padEnd(28)} ${m.painel}`);
}

await writeFile(`${DESTINO}/README.md`, indice.join("\n") + "\n", "utf8");
console.log(`\n${MODELOS_AUTH.length} modelos em ${DESTINO}/`);
