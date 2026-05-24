import { Link } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'
import { GlassCard } from '@/components/motion/glass-card'
import type { ReactNode } from 'react'

type ModuleHealth = 'healthy' | 'attention' | 'critical'

interface ModuleSummaryCardProps {
  title: string
  icon: ReactNode
  status: ModuleHealth
  metric?: string
  href: string
  secondaryAction?: { label: string; href: string }
}

const HEALTH_DOT: Record<ModuleHealth, string> = {
  healthy: 'bg-[var(--color-success)]',
  attention: 'bg-[var(--color-warning)]',
  critical: 'bg-[var(--color-error)]',
}

export function ModuleSummaryCard({
  title,
  icon,
  status,
  metric,
  href,
  secondaryAction,
}: ModuleSummaryCardProps) {
  return (
    <>
      {/* Desktop card */}
      <Link
        to={href as any}
        className="hidden md:block group"
      >
        <GlassCard className="p-4 transition-shadow group-hover:shadow-md">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-[var(--color-muted)]">{icon}</span>
              <h3 className="text-sm font-semibold">{title}</h3>
            </div>
            <span className={`w-2 h-2 rounded-full ${HEALTH_DOT[status]}`} />
          </div>
          {metric && (
            <p className="text-xs text-[var(--color-muted)] font-medium">{metric}</p>
          )}
          {secondaryAction && (
            <Link
              to={secondaryAction.href as any}
              className="text-xs font-semibold text-[var(--color-primary)] mt-2 inline-block hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {secondaryAction.label}
            </Link>
          )}
        </GlassCard>
      </Link>

      {/* Mobile compact row */}
      <Link
        to={href as any}
        className="md:hidden flex items-center gap-3 px-4 py-3 rounded-[10px] border border-[var(--color-border-light)] bg-[var(--color-surface)] hover:shadow-soft transition-shadow"
      >
        <span className="text-[var(--color-muted)] shrink-0">{icon}</span>
        <span className="text-sm font-semibold flex-1">{title}</span>
        <span className={`w-2 h-2 rounded-full shrink-0 ${HEALTH_DOT[status]}`} />
        {metric && (
          <span className="text-xs text-[var(--color-muted)] font-medium shrink-0">{metric}</span>
        )}
        <ChevronRight size={14} className="text-[var(--color-muted)] shrink-0" />
      </Link>
    </>
  )
}
