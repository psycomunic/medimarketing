/**
 * Gera os ícones e as telas de abertura do app (PWA) a partir da marca
 * da Medi Marketing: o círculo azul com a cruz verde.
 *
 *   node scripts/gerar-icones-app.mjs
 *
 * Saída em public/icones-app/. Para trocar a marca, mude CRUZ/CIRCULO (ou a logo
 * empilhada usada nas telas de abertura) e rode de novo.
 *
 * Usa o Chrome instalado na máquina (puppeteer-core), como os scripts de
 * auditoria.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import puppeteer from "puppeteer-core";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const saida = join(raiz, "public", "icones-app");
mkdirSync(saida, { recursive: true });

const AZUL = "#0B4F6C";
const VERDE = "#1A9E8F";
const FUNDO = "#F8FBFC";

// Marca no sistema de coordenadas da logo empilhada (círculo de 1726,68)
const LADO = 1726.68;
const CRUZ =
  "M767.33 501.83l192.03 0c9.75,0 17.72,7.97 17.72,17.72l0 230.06 230.06 0c9.75,0 17.72,7.97 17.72,17.72l0 192.03c0,9.75 -7.98,17.72 -17.72,17.72l-230.06 0 0 230.06c0,9.74 -7.97,17.72 -17.72,17.72l-192.03 0c-9.75,0 -17.72,-7.98 -17.72,-17.72l0 -230.06 -230.06 0c-9.75,0 -17.72,-7.97 -17.72,-17.72l0 -192.03c0,-9.75 7.97,-17.72 17.72,-17.72l230.06 0 0 -230.06c0,-9.75 7.97,-17.72 17.72,-17.72z";

/**
 * O ícone do app: botão verde em relevo com a cruz branca (enviado pela
 * Medi). Se existir public/icone-app-origem.png (a arte original, quadrada,
 * fundo transparente), ela é usada no lugar deste desenho.
 */
const ORIGEM = join(raiz, "public", "icone-app-origem.png");
const temOrigem = existsSync(ORIGEM);
const arteBotao = temOrigem
  ? `<img src="data:image/png;base64,${readFileSync(ORIGEM).toString("base64")}" style="width:100%;height:100%;display:block"/>`
  : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1080" width="100%" height="100%">
  <defs>
    <linearGradient id="aro" x1="0.12" y1="0.1" x2="0.88" y2="0.92">
      <stop offset="0" stop-color="#0E8C78"/>
      <stop offset="0.22" stop-color="#6FE0DA"/>
      <stop offset="0.45" stop-color="#25A396"/>
      <stop offset="0.72" stop-color="#0E8C78"/>
      <stop offset="0.9" stop-color="#00553C"/>
      <stop offset="1" stop-color="#00664A"/>
    </linearGradient>
    <radialGradient id="face" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0.86" stop-color="#24A396"/>
      <stop offset="1" stop-color="#24A396" stop-opacity="0"/>
    </radialGradient>
    <filter id="sombra" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="10" stdDeviation="9" flood-color="#0A4F45" flood-opacity="0.55"/>
    </filter>
    <filter id="sombraCruz" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="2" dy="6" stdDeviation="5" flood-color="#0A4F45" flood-opacity="0.45"/>
    </filter>
  </defs>
  <circle cx="540" cy="540" r="538" fill="url(#aro)"/>
  <circle cx="540" cy="540" r="512" fill="url(#face)"/>
  <circle cx="540" cy="540" r="470" fill="#24A396"/>
  <circle cx="540" cy="540" r="342" fill="#1C9E91" filter="url(#sombra)"/>
  <g filter="url(#sombraCruz)" fill="#FFFFFF">
    <rect x="468" y="316" width="142" height="450" rx="11"/>
    <rect x="314" y="470" width="452" height="142" rx="11"/>
  </g>
</svg>`;

/** O botão inteiro, fundo transparente: ícone "any" (computador, Android). */
const svgCirculo = `<div style="width:100%;height:100%">${arteBotao}</div>`;

/**
 * Quadrado azul cheio com a cruz: o Android recorta em círculo/gota
 * (maskable) e o iPhone arredonda os cantos. A cruz fica dentro da zona
 * segura (80% do centro), então nenhum recorte a corta.
 */
const svgCheio = `<div style="width:100%;height:100%;display:grid;place-items:center;background:linear-gradient(145deg,#2BB0A2,#0E8C78)">
  <div style="width:84%;height:84%">${arteBotao}</div></div>`;

/** Só a cruz, branca: o Android pinta o selo da notificação com ela. */
const svgSelo = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="400 400 926.68 926.68">
  <path d="${CRUZ}" fill="#FFFFFF"/></svg>`;

const ICONES = [
  { arquivo: "icone-192.png", svg: svgCirculo, lado: 192 },
  { arquivo: "icone-512.png", svg: svgCirculo, lado: 512 },
  { arquivo: "icone-maskable-192.png", svg: svgCheio, lado: 192 },
  { arquivo: "icone-maskable-512.png", svg: svgCheio, lado: 512 },
  { arquivo: "apple-touch-icon.png", svg: svgCheio, lado: 180 },
  { arquivo: "selo-96.png", svg: svgSelo, lado: 96 },
];

// Telas de abertura do iPhone/iPad: largura e altura em pontos, densidade
export const TELAS_ABERTURA = [
  [430, 932, 3],
  [393, 852, 3],
  [428, 926, 3],
  [390, 844, 3],
  [375, 812, 3],
  [414, 896, 3],
  [414, 896, 2],
  [375, 667, 2],
  [820, 1180, 2],
  [834, 1194, 2],
  [1024, 1366, 2],
];

const navegador = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: "new",
});
const pagina = await navegador.newPage();

for (const i of ICONES) {
  await pagina.setViewport({ width: i.lado, height: i.lado });
  const conteudo = i.svg.startsWith("<svg") ? i.svg.replace("<svg ", `<svg width="${i.lado}" height="${i.lado}" `) : i.svg;
  await pagina.setContent(
    `<html><body style="margin:0;width:${i.lado}px;height:${i.lado}px;background:transparent">${conteudo}</body></html>`
  );
  await pagina.waitForFunction(() => [...document.images].every((im) => im.complete));
  await pagina.screenshot({ path: join(saida, i.arquivo), omitBackground: true });
  console.log("ícone", i.arquivo);
}

// A logo empilhada no meio da tela clara, como o app abre
const logo = readFileSync(join(raiz, "public", "logo-medimarketing-empilhada.svg"), "utf8");
const logoDados = `data:image/svg+xml;base64,${Buffer.from(logo).toString("base64")}`;
for (const [w, h, dpr] of TELAS_ABERTURA) {
  await pagina.setViewport({ width: w, height: h, deviceScaleFactor: dpr });
  await pagina.setContent(`<html><body style="margin:0;height:100vh;display:grid;place-items:center;background:${FUNDO}">
    <img src="${logoDados}" style="width:${Math.min(w * 0.56, 300)}px"></body></html>`);
  await pagina.waitForFunction(() => document.images[0]?.complete);
  const nome = `abertura-${w * dpr}x${h * dpr}.png`;
  await pagina.screenshot({ path: join(saida, nome) });
  console.log("abertura", nome);
}

await navegador.close();
writeFileSync(join(saida, "LEIA-ME.txt"), "Gerado por scripts/gerar-icones-app.mjs — não edite à mão.\n");
console.log(temOrigem ? "usou a arte original (icone-app-origem.png)" : "usou o desenho em vetor do botão");
console.log("pronto em", pathToFileURL(saida).href);
