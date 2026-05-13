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
      className={`rounded-[14px] bg-[var(--color-surface-elevated)] backdrop-blur-[var(--surface-blur)] shadow-[var(--shadow-soft)] hover:bg-[var(--color-surface-elevated-hover)] transition-colors ${className}`}
      style={{
        borderTop: '1px solid var(--color-surface-border-glass)',
        borderLeft: '1px solid var(--color-surface-border-glass)',
        borderRight: '1px solid var(--color-surface-border-glass-bottom)',
        borderBottom: '1px solid var(--color-surface-border-glass-bottom)',
      }}
    >
      {children}
    </div>
  )
}
