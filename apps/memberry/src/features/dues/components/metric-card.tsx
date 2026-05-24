import { GlassCard } from '@/components/motion/glass-card'
import { CountUp } from '@/components/motion/count-up'
import { ArrowUp, ArrowDown } from 'lucide-react'

interface MetricCardProps {
  label: string
  value: number
  format?: (n: number) => string
  prefix?: string
  changePercent?: number
  changeLabel?: string
  icon: React.ReactNode
}

export function MetricCard({ label, value, format, prefix, changePercent, changeLabel = 'vs last quarter', icon }: MetricCardProps) {
  const isPositive = (changePercent ?? 0) > 0
  const isNegative = (changePercent ?? 0) < 0
  const changeColor = isPositive ? 'text-emerald-600' : isNegative ? 'text-red-600' : 'text-[var(--color-muted)]'

  return (
    <GlassCard className="p-5">
      <div className="flex items-center gap-3 mb-3">
        {icon}
        <span className="text-sm font-medium text-[var(--color-muted)]">{label}</span>
      </div>
      <p className="text-2xl font-bold tabular-nums font-display">
        <CountUp value={value} prefix={prefix} format={format} />
      </p>
      {changePercent !== undefined && (
        <div className={`flex items-center gap-1 mt-1 text-xs ${changeColor}`}>
          {isPositive && <ArrowUp className="h-3 w-3" />}
          {isNegative && <ArrowDown className="h-3 w-3" />}
          <span>{isPositive ? '+' : ''}{changePercent}% {changeLabel}</span>
        </div>
      )}
    </GlassCard>
  )
}

export function MetricCardSkeleton() {
  return (
    <GlassCard className="p-5 animate-pulse">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-lg bg-gray-200" />
        <div className="h-4 w-24 bg-gray-200 rounded" />
      </div>
      <div className="h-7 w-20 bg-gray-200 rounded mt-1" />
      <div className="h-3 w-32 bg-gray-200 rounded mt-2" />
    </GlassCard>
  )
}
