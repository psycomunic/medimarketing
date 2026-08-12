/**
 * Mede overflow horizontal de verdade, num navegador real.
 *
 * Abre cada rota em largura de celular e pergunta ao layout, não ao
 * código, se a página rola de lado — e, quando rola, aponta quais
 * elementos ultrapassam a borda. Adivinhar por grep encontra suspeitos;
 * isto encontra culpados.
 */
import puppeteer from "puppeteer-core";

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const BASE = process.env.BASE ?? "http://localhost:3100";

const LARGURAS = [
  { nome: "320px", w: 320, h: 568 },
  { nome: "360px", w: 360, h: 740 },
  { nome: "375px", w: 375, h: 667 },
  { nome: "393px", w: 393, h: 851 },
  { nome: "430px", w: 430, h: 932 },
  { nome: "768px", w: 768, h: 1024 },
  { nome: "1024px", w: 1024, h: 768 },
];

// Sem barra na variável de ambiente: o Git Bash converte "/" solto
// num caminho do Windows e a rota chega destruída.
const ROTAS = (process.env.ROTAS ?? "")
  .split(",")
  .filter(Boolean)
  .map((r) => (r === "home" ? "/" : `/${r}`));

const navegador = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--no-sandbox", "--hide-scrollbars"],
});

/** Elementos cuja caixa passa da borda direita ou esquerda do viewport. */
function culpadosNoNavegador() {
  const largura = document.documentElement.clientWidth;
  const fora = [];
  for (const el of document.querySelectorAll("body *")) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    const estouro = Math.max(r.right - largura, -r.left);
    if (estouro <= 1) continue;
    const est = getComputedStyle(el);
    if (est.visibility === "hidden" || est.display === "none") continue;
    fora.push({
      tag: el.tagName.toLowerCase(),
      classe: String(el.className || "").slice(0, 120),
      estouro: Math.round(estouro),
      pos: est.position,
    });
  }
  return fora.sort((a, b) => b.estouro - a.estouro).slice(0, 6);
}

let problemas = 0;

for (const rota of ROTAS) {
  const pagina = await navegador.newPage();
  let cabecalhoImpresso = false;

  for (const v of LARGURAS) {
    await pagina.setViewport({ width: v.w, height: v.h, isMobile: v.w < 700 });
    try {
      await pagina.goto(`${BASE}${rota}`, { waitUntil: "networkidle0", timeout: 45000 });
    } catch {
      console.log(`\n${rota} — não carregou`);
      break;
    }
    await new Promise((s) => setTimeout(s, 400));

    const m = await pagina.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      cliente: document.documentElement.clientWidth,
      bodyScroll: document.body.scrollWidth,
    }));

    const excesso = Math.max(m.scroll, m.bodyScroll) - m.cliente;
    if (excesso <= 1) continue;

    problemas++;
    if (!cabecalhoImpresso) {
      console.log(`\n━━ ${rota}`);
      cabecalhoImpresso = true;
    }
    console.log(`   ${v.nome} (${v.w}px): rola ${excesso}px de lado`);

    const culpados = await pagina.evaluate(culpadosNoNavegador);
    for (const c of culpados) {
      console.log(`      +${String(c.estouro).padStart(4)}px  ${c.tag}.${c.classe}`);
    }
  }

  await pagina.close();
}

await navegador.close();
console.log(problemas ? `\n${problemas} combinações com overflow` : "\nnenhum overflow horizontal");
