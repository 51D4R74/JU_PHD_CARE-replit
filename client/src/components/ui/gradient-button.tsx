import * as React from "react";
import { CaretRight } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

interface GradientButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  readonly showCaret?: boolean;
}

const GradientButton = React.forwardRef<HTMLButtonElement, GradientButtonProps>(
  ({ className, children, showCaret = false, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      className={cn(
        "flex w-full min-h-12 items-center justify-center gap-2.5 rounded-2xl",
        "bg-gradient-to-r from-brand-teal to-brand-navy",
        "px-7 py-3.5 text-base font-semibold text-white",
        "shadow-md shadow-brand-teal/15",
        "transition-all hover:shadow-lg hover:shadow-brand-teal/25 hover:brightness-110",
        "active:scale-[0.98]",
        "disabled:opacity-50 disabled:pointer-events-none",
        className,
      )}
      {...props}
    >
      {children}
      {showCaret && <CaretRight className="h-4 w-4" weight="bold" />}
    </button>
  ),
);

GradientButton.displayName = "GradientButton";

export { GradientButton };
