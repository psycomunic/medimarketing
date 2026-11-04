"use client";

import { useEffect, useState } from "react";
import { BellOff, BellRing, Loader2, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { removerInscricaoPush, salvarInscricaoPush, testarPush } from "@/lib/actions/push";

type Estado = "carregando" | "sem-suporte" | "instalar-iphone" | "bloqueado" | "ativo" | "inativo";

function chaveVapid(base64: string): Uint8Array {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const bruto = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bruto, (c) => c.charCodeAt(0));
}

/**
 * Notificações neste aparelho: o mesmo pedido do app instalado, para
 * quem prefere ativar depois ou usa pelo navegador do computador.
 */
export function NotificacoesAparelho({ demo }: { demo: boolean }) {
  const [estado, setEstado] = useState<Estado>("carregando");
  const [ocupado, setOcupado] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  useEffect(() => {
    (async () => {
      const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true;
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window) || !vapid) {
        // No iPhone, só o app instalado recebe notificação
        return setEstado(ios && !standalone ? "instalar-iphone" : "sem-suporte");
      }
      if (Notification.permission === "denied") return setEstado("bloqueado");
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      setEstado(sub && Notification.permission === "granted" ? "ativo" : "inativo");
    })().catch(() => setEstado("sem-suporte"));
  }, [vapid]);

  async function ativar() {
    setOcupado(true);
    setMsg(null);
    try {
      const permissao = await Notification.requestPermission();
      if (permissao !== "granted") {
        setEstado(permissao === "denied" ? "bloqueado" : "inativo");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveVapid(vapid!) as BufferSource }));
      const r = await salvarInscricaoPush({ ...(sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } }), aparelho: navigator.userAgent.slice(0, 120) });
      if (!r.ok) setMsg({ ok: false, texto: r.erro });
      else setEstado("ativo");
    } catch {
      setMsg({ ok: false, texto: "O navegador não deixou ativar. Tente de novo pelo app instalado." });
    } finally {
      setOcupado(false);
    }
  }

  async function desativar() {
    setOcupado(true);
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await removerInscricaoPush(sub.endpoint);
      await sub.unsubscribe().catch(() => {});
    }
    setEstado("inativo");
    setOcupado(false);
  }

  async function testar() {
    setOcupado(true);
    const r = await testarPush();
    setMsg(r.ok ? { ok: true, texto: "Enviada! Deve chegar em alguns segundos." } : { ok: false, texto: r.erro });
    setOcupado(false);
  }

  const textos: Record<Estado, string> = {
    carregando: "Verificando este aparelho…",
    "sem-suporte": "Este navegador não recebe notificações. Instale o app da Medi para receber.",
    "instalar-iphone": "No iPhone, as notificações chegam pelo app instalado: toque em Compartilhar → Adicionar à Tela de Início e abra por lá.",
    bloqueado: "As notificações estão bloqueadas para a Medi neste aparelho. Libere nas configurações do navegador ou do celular.",
    ativo: "Este aparelho recebe os avisos que você marcou como “No aparelho” abaixo.",
    inativo: "Receba consulta nova, pedido de remarcação e vaga aberta direto na tela, mesmo com o app fechado.",
  };

  return (
    <section className="rounded-lg border border-border bg-white p-6 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-verde-menta text-teal">
            {estado === "ativo" ? <BellRing className="size-5" /> : estado === "bloqueado" ? <BellOff className="size-5" /> : <Smartphone className="size-5" />}
          </span>
          <div className="min-w-0">
            <h2 className="font-heading text-lg font-semibold text-azul-medico">Notificações neste aparelho</h2>
            <p className="mt-0.5 text-sm text-cinza-suave">{textos[estado]}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {estado === "inativo" && (
            <Button variant="marca" onClick={ativar} disabled={ocupado || demo}>
              {ocupado ? <Loader2 className="size-4 animate-spin" /> : <BellRing className="size-4" />} Ativar
            </Button>
          )}
          {estado === "ativo" && (
            <>
              <Button variant="outline" onClick={testar} disabled={ocupado || demo}>
                {ocupado && <Loader2 className="size-4 animate-spin" />} Enviar teste
              </Button>
              <Button variant="ghost" onClick={desativar} disabled={ocupado || demo}>
                Desativar
              </Button>
            </>
          )}
        </div>
      </div>
      {msg && <p className={msg.ok ? "mt-3 text-sm text-sucesso" : "mt-3 text-sm text-coral"}>{msg.texto}</p>}
    </section>
  );
}
