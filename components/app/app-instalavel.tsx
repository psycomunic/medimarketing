"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Bell, Download, Loader2, RefreshCw, Share, SquarePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { salvarInscricaoPush } from "@/lib/actions/push";
import { cn } from "@/lib/utils";

/**
 * O PAINEL COMO APLICATIVO
 *
 *  - registra o service worker e avisa quando há versão nova;
 *  - convida a instalar (Android e computador pelo botão do próprio
 *    navegador; iPhone e Safari do Mac com o passo a passo, porque lá não
 *    existe botão automático) — e nunca mais depois de instalado;
 *  - na primeira vez que o app instalado abre, pede para ativar as
 *    notificações (o navegador só deixa pedir depois de um toque);
 *  - mostra o número de não lidas no ícone e deixa puxar para atualizar.
 *
 * Tudo o que é escolha da pessoa ("agora não", "já instalei") fica no
 * aparelho, em localStorage.
 */

type EventoInstalar = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const INSTALADO = "medi_app_instalado";
const AVISO_INSTALAR = "medi_app_aviso";
const AVISO_PUSH = "medi_push_aviso";
const VISITAS = "medi_app_visitas";
const DIA = 86_400_000;

const ler = (k: string, sessao = false) => {
  try {
    return (sessao ? sessionStorage : localStorage).getItem(k);
  } catch {
    return null;
  }
};
const gravar = (k: string, v: string, sessao = false) => {
  try {
    (sessao ? sessionStorage : localStorage).setItem(k, v);
  } catch {
    /* modo privado: só não lembra */
  }
};
/** "nunca" ou um instante até quando ficar quieto. */
const silenciado = (k: string) => {
  const v = ler(k);
  return v === "nunca" || (!!v && Number(v) > Date.now());
};

function chaveVapid(base64: string): Uint8Array {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const bruto = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bruto, (c) => c.charCodeAt(0));
}

function descreverAparelho(): string {
  const ua = navigator.userAgent;
  const sistema = /iphone|ipad|ipod/i.test(ua)
    ? "iPhone/iPad"
    : /android/i.test(ua)
      ? "Android"
      : /windows/i.test(ua)
        ? "Windows"
        : /mac/i.test(ua)
          ? "Mac"
          : "Outro";
  const nav = /edg\//i.test(ua) ? "Edge" : /chrome|crios/i.test(ua) ? "Chrome" : /safari/i.test(ua) ? "Safari" : /firefox/i.test(ua) ? "Firefox" : "";
  return [sistema, nav].filter(Boolean).join(" · ");
}

export function AppInstalavel({ naoLidas, versao }: { naoLidas: number; versao: string }) {
  const pathname = usePathname();
  const [instalado, setInstalado] = useState(true); // até medir, não mostra nada
  const [evento, setEvento] = useState<EventoInstalar | null>(null);
  const [plataforma, setPlataforma] = useState<"ios" | "mac" | "outro">("outro");
  const [pronto, setPronto] = useState(false); // já usou o painel o bastante para o convite
  const [convite, setConvite] = useState(false);
  const [guia, setGuia] = useState(false);
  const [pedirPush, setPedirPush] = useState(false);
  const [ativando, setAtivando] = useState(false);
  const [novaVersao, setNovaVersao] = useState<ServiceWorker | null>(null);
  const atualizando = useRef(false);
  const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  /* -------- Instalado? Plataforma? -------- */
  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone) gravar(INSTALADO, "1");
    setInstalado(standalone || ler(INSTALADO) === "1");
    document.documentElement.dataset.app = standalone ? "instalado" : "navegador";

    const ua = navigator.userAgent;
    const ios = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const safariMac = !ios && /macintosh/i.test(ua) && /safari/i.test(ua) && !/chrome|chromium|edg|firefox/i.test(ua);
    setPlataforma(ios ? "ios" : safariMac ? "mac" : "outro");

    const antes = (e: Event) => {
      e.preventDefault();
      // Se o navegador oferece instalar, o app não está instalado (ou foi removido)
      setInstalado(false);
      gravar(INSTALADO, "0");
      setEvento(e as EventoInstalar);
    };
    const depois = () => {
      gravar(INSTALADO, "1");
      setInstalado(true);
      setEvento(null);
      setConvite(false);
    };
    window.addEventListener("beforeinstallprompt", antes);
    window.addEventListener("appinstalled", depois);
    return () => {
      window.removeEventListener("beforeinstallprompt", antes);
      window.removeEventListener("appinstalled", depois);
    };
  }, []);

  /* -------- Convite só depois da segunda tela (ou de 20 s) -------- */
  useEffect(() => {
    const n = Number(ler(VISITAS, true) ?? "0") + 1;
    gravar(VISITAS, String(n), true);
    if (n >= 2) setPronto(true);
  }, [pathname]);
  useEffect(() => {
    const t = setTimeout(() => setPronto(true), 20_000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const pode = !instalado && !silenciado(AVISO_INSTALAR) && (!!evento || plataforma !== "outro");
    setConvite(pronto && pode);
  }, [pronto, instalado, evento, plataforma]);

  /* -------- Service worker e versão nova -------- */
  useEffect(() => {
    if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") return;
    let reg: ServiceWorkerRegistration | undefined;
    const vigiar = (r: ServiceWorkerRegistration) => {
      if (r.waiting && navigator.serviceWorker.controller) setNovaVersao(r.waiting);
      r.addEventListener("updatefound", () => {
        const novo = r.installing;
        novo?.addEventListener("statechange", () => {
          if (novo.state === "installed" && navigator.serviceWorker.controller) setNovaVersao(novo);
        });
      });
    };
    navigator.serviceWorker
      .register(`/sw.js?v=${encodeURIComponent(versao)}`, { scope: "/" })
      .then((r) => {
        reg = r;
        vigiar(r);
      })
      .catch(() => {});
    const aoTrocar = () => {
      if (atualizando.current) window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", aoTrocar);
    // Voltou para o app: confere se saiu versão nova
    const aoVoltar = () => document.visibilityState === "visible" && reg?.update().catch(() => {});
    document.addEventListener("visibilitychange", aoVoltar);
    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", aoTrocar);
      document.removeEventListener("visibilitychange", aoVoltar);
    };
  }, [versao]);

  /* -------- Notificações: pede na primeira abertura do app instalado -------- */
  const inscrever = useCallback(async () => {
    if (!vapid) return false;
    const reg = await navigator.serviceWorker.ready;
    const atual = await reg.pushManager.getSubscription();
    const sub =
      atual ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveVapid(vapid) as BufferSource }));
    const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
    const r = await salvarInscricaoPush({ ...json, aparelho: descreverAparelho() });
    return r.ok;
  }, [vapid]);

  useEffect(() => {
    const standalone = document.documentElement.dataset.app === "instalado";
    if (!standalone || !vapid || !("Notification" in window) || !("PushManager" in window)) return;
    if (process.env.NODE_ENV !== "production") return;
    if (Notification.permission === "granted") {
      // Já permitido: garante que este aparelho está na lista (uma vez por sessão)
      if (ler("medi_push_ok", true) !== "1") {
        inscrever()
          .then((ok) => ok && gravar("medi_push_ok", "1", true))
          .catch(() => {});
      }
      return;
    }
    if (Notification.permission === "default" && !silenciado(AVISO_PUSH)) {
      const t = setTimeout(() => setPedirPush(true), 1200);
      return () => clearTimeout(t);
    }
  }, [instalado, vapid, inscrever]);

  async function ativarPush() {
    setAtivando(true);
    try {
      const permissao = await Notification.requestPermission();
      if (permissao === "granted") {
        await inscrever();
        gravar("medi_push_ok", "1", true);
      } else {
        gravar(AVISO_PUSH, String(Date.now() + 30 * DIA));
      }
    } catch {
      /* o navegador recusou o pedido: tenta de novo outro dia */
      gravar(AVISO_PUSH, String(Date.now() + 7 * DIA));
    }
    setAtivando(false);
    setPedirPush(false);
  }

  /* -------- Número de não lidas no ícone -------- */
  useEffect(() => {
    const nav = navigator as Navigator & { setAppBadge?: (n: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
    if (!nav.setAppBadge) return;
    (naoLidas > 0 ? nav.setAppBadge(naoLidas) : nav.clearAppBadge?.())?.catch(() => {});
  }, [naoLidas]);

  async function instalar() {
    if (evento) {
      await evento.prompt();
      const escolha = await evento.userChoice.catch(() => null);
      setEvento(null);
      if (escolha?.outcome === "dismissed") adiar();
      else setConvite(false);
      return;
    }
    setGuia(true);
  }

  function adiar() {
    gravar(AVISO_INSTALAR, String(Date.now() + 7 * DIA));
    setConvite(false);
    setGuia(false);
  }
  function nuncaMais() {
    gravar(AVISO_INSTALAR, "nunca");
    setConvite(false);
    setGuia(false);
  }
  function jaInstalei() {
    gravar(INSTALADO, "1");
    setInstalado(true);
    setConvite(false);
    setGuia(false);
  }

  return (
    <>
      {/* Versão nova: tem prioridade sobre o convite */}
      {novaVersao ? (
        <Aviso>
          <RefreshCw className="size-5 shrink-0 text-teal" />
          <p className="min-w-0 flex-1 text-sm font-medium text-cinza-texto">Nova versão disponível</p>
          <Button
            size="sm"
            variant="teal"
            onClick={() => {
              atualizando.current = true;
              novaVersao.postMessage("atualizar");
            }}
          >
            Atualizar
          </Button>
        </Aviso>
      ) : (
        convite && (
          <Aviso>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icones-app/icone-192.png" alt="" className="size-11 shrink-0 rounded-xl" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-azul-medico">Instale o app da Medi</p>
              <p className="text-xs leading-snug text-cinza-suave">
                Abre mais rápido, fica na sua tela inicial e avisa das consultas.
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                <Button size="sm" variant="marca" onClick={instalar}>
                  <Download className="size-4" /> {evento ? "Instalar" : "Ver como instalar"}
                </Button>
                <button type="button" onClick={adiar} className="h-9 text-sm font-medium text-cinza-suave hover:text-azul-medico">
                  Agora não
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={nuncaMais}
              aria-label="Não mostrar mais"
              title="Não mostrar mais"
              className="-mr-1 -mt-1 grid size-8 shrink-0 place-items-center self-start rounded-md text-cinza-suave hover:bg-branco-clinico"
            >
              <X className="size-4" />
            </button>
          </Aviso>
        )
      )}

      {/* Passo a passo: iPhone/iPad e Safari do Mac */}
      <Dialog open={guia} onOpenChange={setGuia}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Instalar o app da Medi</DialogTitle>
            <DialogDescription>
              {plataforma === "mac" ? "No Safari do Mac, em dois passos:" : "No iPhone ou iPad, em três toques:"}
            </DialogDescription>
          </DialogHeader>
          <ol className="space-y-3">
            {(plataforma === "mac"
              ? [
                  { icone: SquarePlus, texto: <>No menu <strong>Arquivo</strong>, escolha <strong>Adicionar ao Dock</strong></> },
                  { icone: Download, texto: <>Confirme em <strong>Adicionar</strong>. O app fica no Dock.</> },
                ]
              : [
                  { icone: Share, texto: <>Toque em <strong>Compartilhar</strong> na barra do navegador</> },
                  { icone: SquarePlus, texto: <>Role e toque em <strong>Adicionar à Tela de Início</strong></> },
                  { icone: Download, texto: <>Toque em <strong>Adicionar</strong>. O app aparece na sua tela.</> },
                ]
            ).map((p, i) => (
              <li key={i} className="flex items-center gap-3 rounded-xl border border-border bg-branco-clinico p-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-white text-teal shadow-sm">
                  <p.icone className="size-5" />
                </span>
                <span className="text-sm leading-snug text-cinza-texto">
                  <span className="mr-1 font-semibold text-azul-medico">{i + 1}.</span>
                  {p.texto}
                </span>
              </li>
            ))}
          </ol>
          <div className="mt-2 grid gap-2">
            <Button variant="marca" onClick={jaInstalei}>
              Já instalei
            </Button>
            <Button variant="ghost" onClick={adiar}>
              Agora não
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Primeira abertura do app: ativar as notificações */}
      <Dialog
        open={pedirPush}
        onOpenChange={(o) => {
          if (!o) {
            gravar(AVISO_PUSH, String(Date.now() + 7 * DIA));
            setPedirPush(false);
          }
        }}
      >
        <DialogContent className="max-w-sm text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-full bg-verde-menta text-teal">
            <Bell className="size-7" />
          </span>
          <DialogHeader className="items-center text-center">
            <DialogTitle>Ative as notificações</DialogTitle>
            <DialogDescription>
              Receba neste aparelho os avisos de consulta nova, pedidos de remarcação e vagas abertas, mesmo com o app
              fechado. Você escolhe o que recebe em Meu perfil.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-1 grid gap-2">
            <Button variant="marca" onClick={ativarPush} disabled={ativando}>
              {ativando ? <Loader2 className="size-4 animate-spin" /> : <Bell className="size-4" />} Ativar notificações
            </Button>
            <Button
              variant="ghost"
              disabled={ativando}
              onClick={() => {
                gravar(AVISO_PUSH, String(Date.now() + 7 * DIA));
                setPedirPush(false);
              }}
            >
              Agora não
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <PuxarParaAtualizar />
    </>
  );
}

/**
 * Cartão do rodapé: no celular, acima das barras fixas (navegação e, na
 * demonstração, a barra de papéis); no computador, no canto.
 */
function Aviso({ children }: { children: React.ReactNode }) {
  const [folga, setFolga] = useState(0);
  useEffect(() => {
    const medir = () => {
      const alturas = [...document.querySelectorAll("[data-barra-demo], [data-barra-inferior]")].map(
        (b) => b.getBoundingClientRect().height
      );
      setFolga(alturas.reduce((s, h) => s + h, 0));
    };
    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, []);
  return (
    <div
      role="status"
      style={{ bottom: `calc(${folga}px + 0.75rem)` }}
      className={cn(
        "fixed inset-x-3 z-50 flex items-center gap-3 rounded-2xl border border-border bg-white p-3.5 shadow-card print:hidden",
        "lg:inset-x-auto lg:right-6 lg:w-[22rem]"
      )}
    >
      {children}
    </div>
  );
}

/**
 * No app instalado não existe o botão de recarregar do navegador: puxar
 * a tela para baixo, do topo, atualiza os dados.
 */
function PuxarParaAtualizar() {
  const router = useRouter();
  const [puxada, setPuxada] = useState(0);
  const [atualizando, setAtualizando] = useState(false);
  const inicio = useRef<number | null>(null);
  const distancia = useRef(0);
  const LIMIAR = 72;

  useEffect(() => {
    if (document.documentElement.dataset.app !== "instalado" || !("ontouchstart" in window)) return;

    const aoTocar = (e: TouchEvent) => {
      // Só do topo da página e fora de janelas abertas
      const noTopo = window.scrollY <= 0 && !document.querySelector('[role="dialog"]');
      inicio.current = noTopo ? e.touches[0].clientY : null;
    };
    const aoMover = (e: TouchEvent) => {
      if (inicio.current === null) return;
      const d = e.touches[0].clientY - inicio.current;
      distancia.current = d > 0 ? Math.min(d * 0.5, LIMIAR * 1.4) : 0;
      setPuxada(distancia.current);
    };
    const aoSoltar = () => {
      if (inicio.current === null) return;
      inicio.current = null;
      const puxou = distancia.current >= LIMIAR;
      distancia.current = 0;
      setPuxada(0);
      if (puxou) {
        setAtualizando(true);
        router.refresh();
        setTimeout(() => setAtualizando(false), 900);
      }
    };
    window.addEventListener("touchstart", aoTocar, { passive: true });
    window.addEventListener("touchmove", aoMover, { passive: true });
    window.addEventListener("touchend", aoSoltar);
    return () => {
      window.removeEventListener("touchstart", aoTocar);
      window.removeEventListener("touchmove", aoMover);
      window.removeEventListener("touchend", aoSoltar);
    };
  }, [router]);

  if (!puxada && !atualizando) return null;
  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+0.5rem)] z-[60] flex justify-center"
      style={{ transform: `translateY(${atualizando ? 24 : puxada * 0.6}px)` }}
      aria-hidden
    >
      <span className="grid size-10 place-items-center rounded-full bg-white text-teal shadow-card">
        <RefreshCw
          className={cn("size-5", atualizando && "animate-spin")}
          style={atualizando ? undefined : { transform: `rotate(${puxada * 4}deg)`, opacity: Math.min(1, puxada / LIMIAR) }}
        />
      </span>
    </div>
  );
}
