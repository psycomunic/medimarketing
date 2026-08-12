import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

/**
 * Select nativo estilizado com os tokens da marca. Nativo de propósito:
 * no celular abre o seletor do sistema, que é onde a maior parte dos
 * formulários da landing é preenchida.
 */
const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => (
    <div className="relative">
      <select
        ref={ref}
        className={cn(
          "flex h-11 w-full min-w-0 appearance-none rounded-md border border-input bg-white px-4 py-2 pr-10 text-base text-cinza-texto md:text-sm shadow-sm transition-colors focus-visible:border-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-cinza-suave"
      />
    </div>
  )
);
Select.displayName = "Select";

export { Select };
