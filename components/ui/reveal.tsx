"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Wrapper de animação sutil (fade + slide) ao entrar na viewport.
 * Usado com moderação na landing, conforme diretriz do briefing.
 *
 * Nasce com `min-w-0` porque quase sempre é filho de um grid ou de um
 * flex, e a regra padrão `min-width: auto` impede esses filhos de
 * encolher abaixo do próprio conteúdo. Um campo de formulário dentro
 * bastava para esticar a coluna inteira e fazer a página rolar de lado
 * no celular.
 */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={cn("min-w-0", className)}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
