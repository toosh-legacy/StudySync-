import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center font-semibold whitespace-nowrap select-none transition-all outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "brutal-border bg-primary text-primary-foreground brutal-shadow press hover:bg-primary/90 hover:brutal-shadow-accent",
        accent:
          "brutal-border bg-accent text-accent-foreground brutal-shadow press hover:bg-accent/90",
        gold:
          "brutal-border bg-[color:var(--gold)] text-foreground brutal-shadow press hover:opacity-90",
        outline:
          "brutal-border bg-card text-foreground brutal-shadow-sm press hover:bg-muted",
        secondary:
          "brutal-border bg-secondary text-secondary-foreground brutal-shadow press hover:bg-secondary/90",
        ghost:
          "border-transparent bg-transparent text-foreground hover:bg-muted/60",
        destructive:
          "brutal-border bg-destructive text-primary-foreground brutal-shadow press hover:opacity-90",
        link: "text-primary underline-offset-4 hover:underline border-transparent",
      },
      size: {
        default: "h-10 px-4 py-2 text-sm gap-1.5",
        xs: "h-6 px-2 text-[11px] gap-1",
        sm: "h-8 px-3 text-xs gap-1.5",
        lg: "h-12 px-6 text-base gap-2",
        xl: "h-14 px-8 text-lg gap-2",
        icon: "h-10 w-10",
        "icon-sm": "h-8 w-8",
        "icon-lg": "h-12 w-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
