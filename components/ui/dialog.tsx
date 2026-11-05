"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogClose = DialogPrimitive.Close;

/**
 * Celular com teclado aberto. O iPhone não encolhe a página quando o
 * teclado sobe: a janela de baixo ficaria atrás dele, com o campo que
 * se está digitando escondido. Aqui a janela acompanha a área visível e
 * o campo em foco é trazido para o meio dela.
 */
function useTeclado(ref: React.RefObject<HTMLDivElement | null>) {
  React.useEffect(() => {
    const el = ref.current;
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (!el || !vv) return;
    const celular = () => window.matchMedia("(max-width: 639px)").matches;

    const ajustar = () => {
      if (!celular()) {
        el.style.removeProperty("bottom");
        el.style.removeProperty("max-height");
        return;
      }
      const teclado = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      if (teclado > 80) {
        el.style.bottom = `${teclado}px`;
        el.style.maxHeight = `${vv.height - 8}px`;
      } else {
        el.style.removeProperty("bottom");
        el.style.removeProperty("max-height");
      }
    };

    const aoFocar = (e: FocusEvent) => {
      const alvo = e.target as HTMLElement | null;
      if (!celular() || !alvo?.matches?.("input, select, textarea")) return;
      // Depois que o teclado terminou de subir
      setTimeout(() => alvo.scrollIntoView({ block: "center", behavior: "smooth" }), 320);
    };

    vv.addEventListener("resize", ajustar);
    vv.addEventListener("scroll", ajustar);
    el.addEventListener("focusin", aoFocar);
    return () => {
      vv.removeEventListener("resize", ajustar);
      vv.removeEventListener("scroll", ajustar);
      el.removeEventListener("focusin", aoFocar);
    };
  }, [ref]);
}

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => {
  const interno = React.useRef<HTMLDivElement | null>(null);
  React.useImperativeHandle(ref, () => interno.current as HTMLDivElement);
  useTeclado(interno);
  return (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-azul-profundo/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
    <DialogPrimitive.Content
      ref={interno}
      className={cn(
        // Celular: painel de baixo para cima, largura toda, respeitando a
        // barra de gestos do iPhone. A partir de sm: janela no centro.
        "fixed inset-x-0 bottom-0 z-50 mx-auto grid max-w-lg max-h-[calc(100dvh-env(safe-area-inset-top)-0.75rem)] w-full grid-cols-[minmax(0,1fr)] gap-4 overflow-y-auto overflow-x-hidden overscroll-contain rounded-t-2xl border border-border bg-white p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-card focus:outline-none",
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-8",
        "sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:max-h-[calc(100dvh-2rem)] sm:mx-0 sm:w-[calc(100vw-2rem)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg sm:pb-6 sm:data-[state=open]:slide-in-from-bottom-0 sm:data-[state=open]:zoom-in-95",
        className
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 z-20 grid size-8 place-items-center rounded-md text-cinza-suave transition-colors hover:bg-verde-menta hover:text-azul-medico focus:outline-none">
        <X className="size-4" />
        <span className="sr-only">Fechar</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
  );
});
DialogContent.displayName = "DialogContent";

function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-1.5 pr-8", className)} {...props} />;
}

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("font-heading text-xl font-semibold text-azul-medico", className)}
    {...props}
  />
));
DialogTitle.displayName = "DialogTitle";

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-cinza-suave", className)}
    {...props}
  />
));
DialogDescription.displayName = "DialogDescription";

export {
  Dialog,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
};
