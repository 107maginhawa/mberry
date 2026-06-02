import * as React from "react"
import { cn } from "../lib/utils"

export type PageContainerWidth = "xs" | "narrow" | "default" | "wide" | "full"

const WIDTH_CLASSES: Record<PageContainerWidth, string> = {
  xs: "max-w-md",
  narrow: "max-w-2xl",
  default: "max-w-3xl",
  wide: "max-w-content",
  full: "max-w-none",
}

export interface PageContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  width?: PageContainerWidth
  as?: React.ElementType
}

export const PageContainer = React.forwardRef<HTMLDivElement, PageContainerProps>(
  ({ width = "default", as: Component = "div", className, ...props }, ref) => (
    <Component
      ref={ref}
      className={cn("mx-auto w-full px-4 sm:px-6", WIDTH_CLASSES[width], className)}
      {...props}
    />
  ),
)
PageContainer.displayName = "PageContainer"
