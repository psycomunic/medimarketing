/**
 * Auditoria de rolagem nas telas autenticadas.
 *
 * Cria um usuário descartável, entra pelo formulário de login real e
 * mede cada rota em várias larguras. O usuário é apagado no fim, dê o
 * que der — inclusive se o script quebrar no meio.
 */
import puppeteer from "puppeteer-core";
import { createClient } from "@supabase/supabase-js";

const SB = process.env.NEXT_PUBLIC_SUPABASE_URL;
const admin = createClient(SB, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const EMAIL = "auditoria.scroll@medimarketing.com.br";
const SENHA = "Auditoria!2026#scroll";
const ORG = "d79d2527-6338-4c25-b9de-ce1d3fbe6dd3";

const ROTAS = [
  "/app",
  "/app/agenda",
  "/app/confirmacoes",
  "/app/crm",
  "/app/atendimento",
  "/app/financeiro",
  "/app/indicadores",
  "/app/marketing",
  "/app/retencao",
  "/app/relatorios",
  "/app/disponibilidade",
  "/app/notificacoes",
  "/app/academy",
  "/app/perfil",
  "/app/configuracoes",
  "/app/clinicas",
  "/app/admin/usuarios",
  "/app/admin/academy",
  "/app/admin/comentarios",
];

const LARGURAS = [
  { nome: "320px", w: 320, h: 568 },
  { nome: "360px", w: 360, h: 740 },
  { nome: "375px", w: 375, h: 667 },
  { nome: "430px", w: 430, h: 932 },
  { nome: "768px", w: 768, h: 1024 },
  { nome: "1024px", w: 1024, h: 768 },
];

/**
 * Conteúdo que está sendo cortado por um ancestral que recorta.
 *
 * O `overflow-x-hidden` do layout do app faz a página parecer sã:
 * não há barra de rolagem porque o que sobra é aparado fora da vista.
 * Sem barra e sem aviso, o usuário simplesmente não vê o que ficou do
 * lado de fora — que é justamente o pior dos dois mundos.
 */
function cortados() {
  const achados = [];
  for (const el of document.querySelectorAll("main *")) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    // Sobe até quem recorta de verdade
    let cx = null;
    for (let n = el.parentElement; n; n = n.parentElement) {
      const o = getComputedStyle(n).overflowX;
      if (o === "hidden" || o === "clip") { cx = n; break; }
      if (o === "auto" || o === "scroll") break; // rolagem própria: ok
    }
    if (!cx) continue;
    const rc = cx.getBoundingClientRect();
    const cortado = Math.round(r.right - rc.right);
    if (cortado <= 1) continue;
    achados.push({
      cortado,
      desc: `${el.tagName.toLowerCase()}[${String(el.className).slice(0, 60)}]`,
      texto: (el.textContent || "").trim().slice(0, 40),
    });
  }
  return achados.sort((a, b) => b.cortado - a.cortado).slice(0, 5);
}

function culpados() {
  const d = document.documentElement;
  const fora = [];
  const passa = (el) => el.getBoundingClientRect().right - d.clientWidth > 1;
  const fila = [document.body];
  while (fila.length) {
    const el = fila.shift();
    for (const f of el.children) {
      const s = getComputedStyle(f);
      if (s.position === "fixed") {
        fila.push(f);
        continue;
      }
      if (!passa(f)) {
        fila.push(f);
        continue;
      }
      // Quem já é recortado por um ancestral não cria barra de rolagem
      let recortado = false;
      for (let n = f.parentElement; n; n = n.parentElement) {
        if (["hidden", "clip", "auto", "scroll"].includes(getComputedStyle(n).overflowX)) {
          recortado = true;
          break;
        }
      }
      if (recortado) continue;
      const r = f.getBoundingClientRect();
      fora.push(
        `${Math.round(r.width)}px ${f.tagName.toLowerCase()}[${String(f.className).slice(0, 80)}]`
      );
    }
  }
  return fora.slice(0, 4);
}

let userId = null;
let navegador = null;

try {
  const { data: criado, error } = await admin.auth.admin.createUser({
    email: EMAIL,
    password: SENHA,
    email_confirm: true,
    user_metadata: { nome: "Auditoria de rolagem" },
  });
  if (error) throw new Error(`não criei o usuário: ${error.message}`);
  userId = criado.user.id;

  // O gatilho cria o perfil sem privilégio; aqui damos o que a
  // auditoria precisa para abrir todas as telas.
  await admin
    .from("profiles")
    .update({
      role: "super_admin",
      organization_id: ORG,
      ativo: true,
      aguardando_liberacao: false,
      nome: "Auditoria de rolagem",
    })
    .eq("id", userId);

  navegador = await puppeteer.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true,
    args: ["--no-sandbox", "--hide-scrollbars"],
  });

  const pagina = await navegador.newPage();
  await pagina.setViewport({ width: 1024, height: 900 });
  await pagina.goto("http://localhost:3100/login", { waitUntil: "networkidle0" });
  await pagina.type("#email", EMAIL);
  await pagina.type("#senha", SENHA);
  await Promise.all([
    pagina.waitForNavigation({ waitUntil: "networkidle0", timeout: 45000 }),
    pagina.click('button[type="submit"]'),
  ]);

  if (!pagina.url().includes("/app")) {
    throw new Error(`login não entrou — parou em ${pagina.url()}`);
  }
  console.log("sessão aberta\n");

  let problemas = 0;

  for (const rota of ROTAS) {
    let cabecalho = false;
    for (const v of LARGURAS) {
      await pagina.setViewport({ width: v.w, height: v.h, isMobile: v.w < 700 });
      try {
        await pagina.goto(`http://localhost:3100${rota}`, {
          waitUntil: "networkidle0",
          timeout: 45000,
        });
      } catch {
        console.log(`${rota} — não carregou em ${v.nome}`);
        continue;
      }
      await new Promise((s) => setTimeout(s, 350));

      const excesso = await pagina.evaluate(() => {
        const d = document.documentElement;
        return Math.max(d.scrollWidth, document.body.scrollWidth) - d.clientWidth;
      });
      const aparados = await pagina.evaluate(cortados);

      if (excesso <= 1 && !aparados.length) continue;

      problemas++;
      if (!cabecalho) {
        console.log(`━━ ${rota}`);
        cabecalho = true;
      }
      if (excesso > 1) {
        console.log(`   ${v.nome}: rola ${excesso}px de lado`);
        for (const c of await pagina.evaluate(culpados)) console.log(`      ${c}`);
      }
      for (const a of aparados) {
        console.log(`   ${v.nome}: CORTA ${a.cortado}px  ${a.desc} "${a.texto}"`);
      }
    }
  }

  console.log(problemas ? `\n${problemas} combinações com overflow` : "\nnenhum overflow no app");
} catch (e) {
  console.error("erro:", e.message);
} finally {
  if (navegador) await navegador.close();
  if (userId) {
    await admin.auth.admin.deleteUser(userId);
    console.log("usuário de auditoria apagado");
  }
}
