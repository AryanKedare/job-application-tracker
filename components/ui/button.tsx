import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold tracking-[-0.01em] transition-[transform,background-color,border-color,color,box-shadow] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#090b10] disabled:pointer-events-none disabled:opacity-45 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default: "border border-blue-300/15 bg-blue-500 text-white shadow-[0_8px_24px_rgba(38,105,255,0.28)] hover:bg-blue-400",
        destructive: "border border-red-300/15 bg-red-500 text-white shadow-[0_8px_24px_rgba(239,68,68,0.2)] hover:bg-red-400",
        outline: "border border-white/10 bg-white/[0.045] text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] hover:border-white/[0.16] hover:bg-white/[0.08]",
        secondary: "border border-white/10 bg-white/[0.08] text-slate-100 hover:bg-white/[0.12]",
        ghost: "text-slate-300 hover:bg-white/[0.07] hover:text-white",
        link: "text-blue-300 underline-offset-4 hover:text-blue-200 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-lg px-3",
        lg: "h-12 rounded-xl px-6 text-[15px]",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
