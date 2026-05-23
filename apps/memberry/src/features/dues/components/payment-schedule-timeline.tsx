import { GlassCard } from '@/components/motion/glass-card'
import { formatCents } from '@/features/dues/lib/money'
import { CalendarDays } from 'lucide-react'

export interface TimelinePeriod {
  id: string
  label: string
  amount: number
  dueDate: string
  status: 'paid' | 'overdue' | 'upcoming'
  paidDate?: string
}

export interface PaymentScheduleTimelineProps {
  periods: TimelinePeriod[]
  currency?: string
}

const STATUS_COLORS = {
  paid: {
    dot: 'bg-emerald-500',
    line: 'bg-emerald-300',
    text: 'text-emerald-600',
    label: 'Paid',
  },
  overdue: {
    dot: 'bg-red-500',
    line: 'bg-red-300',
    text: 'text-red-600',
    label: 'Overdue',
  },
  upcoming: {
    dot: 'bg-gray-400',
    line: 'bg-gray-200',
    text: 'text-[var(--color-muted)]',
    label: 'Upcoming',
  },
} as const

export function PaymentScheduleTimeline({ periods, currency = 'PHP' }: PaymentScheduleTimelineProps) {
  if (periods.length === 0) {
    return (
      <GlassCard className="p-5">
        <div className="flex items-center gap-3">
          <CalendarDays className="w-5 h-5 text-[var(--color-muted)] shrink-0" />
          <p className="text-[14px] text-[var(--color-muted)]">No billing periods to display.</p>
        </div>
      </GlassCard>
    )
  }

  return (
    <GlassCard className="p-5">
      <h3 className="text-[13px] font-semibold text-[var(--color-muted)] uppercase tracking-wide mb-4">
        Payment Schedule
      </h3>
      <div className="overflow-x-auto">
        <div className="flex items-start gap-0 min-w-max">
          {periods.map((period, idx) => {
            const colors = STATUS_COLORS[period.status]
            const isLast = idx === periods.length - 1
            return (
              <div key={period.id} className="flex items-start">
                {/* Timeline node */}
                <div className="flex flex-col items-center min-w-[100px]">
                  {/* Dot marker */}
                  <div
                    data-testid={`timeline-marker-${period.status}`}
                    className={`w-3.5 h-3.5 rounded-full ${colors.dot} ring-2 ring-white shadow-sm`}
                  />
                  {/* Label */}
                  <p className="text-[13px] font-semibold mt-2">{period.label}</p>
                  {/* Amount */}
                  <p className="text-[12px] tabular-nums text-[var(--color-muted)]">
                    {formatCents(period.amount, currency)}
                  </p>
                  {/* Status label */}
                  <p className={`text-[11px] font-medium ${colors.text}`}>
                    {colors.label}
                  </p>
                </div>
                {/* Connecting line */}
                {!isLast && (
                  <div className="flex items-center mt-[6px]">
                    <div className={`h-[2px] w-8 ${colors.line}`} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </GlassCard>
  )
}
