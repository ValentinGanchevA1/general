import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Form label. Pass `htmlFor` matching a control `id` for a11y association.
 * When used as a visual-only caption (no control), prefer a `<p>`/`<span>` instead.
 */
const Label = React.forwardRef<
  HTMLLabelElement,
  React.ComponentPropsWithoutRef<"label">
>(function Label({ className, htmlFor, ...props }, ref) {
  return (
    <label
      ref={ref}
      htmlFor={htmlFor}
      data-slot="label"
      className={cn(
        "flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
})
Label.displayName = "Label"

export { Label }
