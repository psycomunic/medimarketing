/*
 * Service worker do app da Medi Marketing.
 *
 * Guarda só o que é do app (código, fontes, ícones), para abrir rápido.
 * Dados de paciente nunca vão para o cache do aparelho: as telas vêm
 * sempre do servidor, e sem internet aparece a página "sem conexão".
 *
 * A versão vem do endereço (/sw.js?v=<commit>): cada publicação gera um
 * service worker novo, e o painel oferece "Atualizar" quando ele chega.
 */
const VERSAO = new URL(self.location.href).searchParams.get("v") || "local";
const CACHE = `medi-app-${VERSAO}`;
const OFFLINE = "/offline.html";
const PRECACHE = [OFFLINE, "/icones-app/icone-192.png", "/icones-app/selo-96.png", "/favicon.svg"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    (async () => {
      const nomes = await caches.keys();
      await Promise.all(nomes.filter((n) => n.startsWith("medi-app-") && n !== CACHE).map((n) => caches.delete(n)));
      await self.clients.claim();
    })()
  );
});

// O painel pede para a versão nova assumir quando a pessoa toca em "Atualizar"
self.addEventListener("message", (e) => {
  if (e.data === "atualizar") self.skipWaiting();
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Código e fontes com hash no nome: nunca mudam, podem vir do cache
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icones-app/")) {
    e.respondWith(
      caches.match(req).then(
        (salvo) =>
          salvo ||
          fetch(req).then((resp) => {
            if (resp.ok) {
              const copia = resp.clone();
              caches.open(CACHE).then((c) => c.put(req, copia));
            }
            return resp;
          })
      )
    );
    return;
  }

  // Telas: sempre da rede; sem conexão, a página de aviso
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).catch(() => caches.match(OFFLINE)));
  }
});

/* ------------------------------ Notificações ------------------------------ */

self.addEventListener("push", (e) => {
  let d = {};
  try {
    d = e.data ? e.data.json() : {};
  } catch {
    d = { titulo: e.data ? e.data.text() : "Medi Marketing" };
  }
  e.waitUntil(
    self.registration.showNotification(d.titulo || "Medi Marketing", {
      body: d.corpo || "",
      icon: "/icones-app/icone-192.png",
      badge: "/icones-app/selo-96.png",
      tag: d.tag || undefined,
      renotify: !!d.tag,
      data: { url: d.url || "/app" },
    })
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const destino = new URL(e.notification.data?.url || "/app", self.location.origin).href;
  e.waitUntil(
    (async () => {
      const abertas = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      // Já tem o app aberto: leva para a tela do aviso nele mesmo
      for (const c of abertas) {
        if (new URL(c.url).origin === self.location.origin && "focus" in c) {
          await c.focus();
          if ("navigate" in c) return c.navigate(destino);
          return;
        }
      }
      return self.clients.openWindow(destino);
    })()
  );
});
