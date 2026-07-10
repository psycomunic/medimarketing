import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // CTA principal — coral, usar com parcimônia
        primary:
          "bg-coral text-white shadow-cta hover:bg-[#ff5252] hover:-translate-y-0.5",
        // Ação de marca — azul-médico
        marca:
          "bg-azul-medico text-white shadow-soft hover:bg-azul-profundo hover:-translate-y-0.5",
        // Secundária — teal
        teal: "bg-teal text-white shadow-soft hover:bg-[#158577]",
        // Contorno
        outline:
          "border-2 border-azul-medico/20 bg-white text-azul-medico hover:border-teal hover:text-teal",
        ghost: "text-azul-medico hover:bg-verde-menta",
        link: "text-teal underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-9 px-4",
        md: "h-11 px-6",
        lg: "h-14 px-8 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "marca",
      size: "md",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
