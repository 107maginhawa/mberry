import type { ReactNode } from "react"
import { cn } from "../lib/utils"

interface BottomTabBarProps {
  /** Tab links — typically TanStack <Link className={bottomTabClass(active)}>. */
  children: ReactNode
}

// Fixed bottom navigation for the officer app's people-first IA (Members /
// Events / More). Mobile-first, thumb-reachable. Router-free, like AppHeader's
// nav slot: the caller supplies the links (and active state) so `packages/ui`
// stays free of any router. Sibling to AppHeader — one shell, no per-app fork
// (DESIGN.md). Labels are mandatory (DESIGN.md forbids icon-only nav), so the
// matching class always stacks an icon over a text label.
export function BottomTabBar({ children }: BottomTabBarProps) {
  return (
    <nav
      aria-label="Sections"
      className="fixed inset-x-0 bottom-0 z-10 flex border-t border-[var(--color-border)] bg-[var(--color-surface)] pb-[env(safe-area-inset-bottom)]"
    >
      {children}
    </nav>
  )
}

/**
 * Class for one bottom-tab link: a ≥48px, equal-width, icon-over-label column.
 * Active = primary (plum); inactive = muted. Pair with `aria-current="page"`
 * on the active link for screen-reader orientation.
 */
export function bottomTabClass(active: boolean) {
  return cn(
    "flex flex-1 min-h-tap flex-col items-center justify-center gap-1 py-2 text-caption font-medium",
    active ? "text-primary" : "text-muted-foreground hover:text-foreground",
  )
}
