import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
  {
    variants: {
      variant: {
        confirmada: "bg-sucesso/12 text-sucesso",
        pendente: "bg-alerta/12 text-alerta",
        cancelada: "bg-coral/12 text-coral",
        realizada: "bg-teal/12 text-teal",
        neutro: "bg-verde-menta text-azul-medico",
      },
    },
    defaultVariants: {
      variant: "neutro",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
