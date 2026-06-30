import type { ReactNode } from "react"
import { cn } from "../lib/utils"

// Minimal vertical timeline: an <ol> with a left rule and a dot per item.
// Router-free, domain-free — reused by member payment history and (later) event
// activity. Tokens only (DESIGN.md).
export function Timeline({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <ol className={cn("relative flex flex-col gap-5 border-l border-[var(--color-border)] pl-6", className)}>
      {children}
    </ol>
  )
}

type TimelineTone = "default" | "success" | "muted" | "error"

const DOT: Record<TimelineTone, string> = {
  default: "bg-[var(--color-primary)]",
  success: "bg-[var(--color-success)]",
  muted: "bg-[var(--color-border)]",
  error: "bg-[var(--color-error)]",
}

export function TimelineItem({
  title,
  meta,
  children,
  tone = "default",
  className,
}: {
  title: ReactNode
  meta?: ReactNode
  children?: ReactNode
  tone?: TimelineTone
  className?: string
}) {
  return (
    <li className={cn("relative", className)}>
      {/* dot centered on the <ol> rule */}
      <span aria-hidden className={cn("absolute -left-6 top-1.5 size-3 -translate-x-1/2 rounded-full ring-4 ring-[var(--color-surface)]", DOT[tone])} />
      <div className="flex flex-col gap-1">
        <div className="text-body font-medium text-foreground">{title}</div>
        {meta && <div className="text-caption text-muted-foreground">{meta}</div>}
        {children}
      </div>
    </li>
  )
}
