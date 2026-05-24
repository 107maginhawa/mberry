import { Link } from '@tanstack/react-router'
import { GlassCard } from '@/components/motion/glass-card'
import { CountUp } from '@/components/motion/count-up'
import type { ReactNode } from 'react'

type KpiStatus = 'ok' | 'warning' | 'error' | 'info'

interface DashboardKpiCardProps {
  label: string
  value: number
  icon: ReactNode
  href: string
  suffix?: string
  status?: KpiStatus
  change?: { value: string; positive: boolean }
}

const STATUS_BORDER: Record<KpiStatus, string> = {
  ok: '',
  warning: 'ring-1 ring-[var(--color-warning)]/30',
  error: 'ring-1 ring-[var(--color-error)]/30',
  info: 'ring-1 ring-[var(--color-info)]/30',
}

export function DashboardKpiCard({
  label,
  value,
  icon,
  href,
  suffix,
  status = 'ok',
  change,
}: DashboardKpiCardProps) {
  return (
    <Link
      to={href as any}
      className="block group"
    >
      <GlassCard className={`p-4 text-center transition-shadow group-hover:shadow-md ${STATUS_BORDER[status]}`}>
        <div className="flex items-center justify-center gap-1.5 mb-1">
          <span className="text-[var(--color-muted)]">{icon}</span>
          <p className="text-xs font-medium text-[var(--color-muted)] uppercase tracking-wide">
            {label}
          </p>
        </div>
        <p className="text-[28px] font-bold font-display mt-1" style={{ fontVariantNumeric: 'tabular-nums' }}>
          <CountUp value={value} suffix={suffix} />
        </p>
        {change && (
          <p className={`text-xs font-semibold mt-1 ${change.positive ? 'text-[var(--color-success)]' : 'text-[var(--color-error)]'}`}>
            {change.positive ? '+' : ''}{change.value}
          </p>
        )}
      </GlassCard>
    </Link>
  )
}
