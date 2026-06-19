import type { ReactNode } from 'react'

interface GlassCardProps {
  children: ReactNode
  className?: string
}

/**
 * Elevated glass surface card — translucent with backdrop-blur on desktop,
 * opaque fallback on mobile (via CSS tokens). Use for cards that need
 * visual depth/hierarchy.
 */
export function GlassCard({ children, className = '' }: GlassCardProps) {
  return (
    <div
      className={`rounded-md border border-[var(--color-surface-border-glass)] bg-[var(--color-surface-elevated)] backdrop-blur-[var(--surface-blur)] shadow-[var(--shadow-soft)] hover:bg-[var(--color-surface-elevated-hover)] transition-colors ${className}`}
    >
      {children}
    </div>
  )
}
