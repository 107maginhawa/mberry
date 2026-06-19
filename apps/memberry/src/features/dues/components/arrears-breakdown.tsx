import { GlassCard } from '@/components/motion/glass-card'
import { formatCents } from '@/features/dues/lib/money'
import { CheckCircle, AlertTriangle } from 'lucide-react'

export interface AgingBucketData {
  current: number
  thirtyDay: number
  sixtyDay: number
  ninetyDay: number
  overNinety: number
  totalOutstanding: number
}

export interface ArrearsInvoice {
  id: string
  invoiceNumber: string
  totalAmount: number
  status: string
  periodStart: string
  periodEnd: string
  dueDate: string
  currency?: string
}

export interface ArrearsBreakdownProps {
  invoices: ArrearsInvoice[]
  currency?: string
  agingBuckets?: AgingBucketData
}

function getDaysOverdue(dueDate: string): number {
  const due = new Date(dueDate)
  const now = new Date()
  const diff = Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24))
  return Math.max(0, diff)
}

function groupByYear(invoices: ArrearsInvoice[]): Record<string, ArrearsInvoice[]> {
  const groups: Record<string, ArrearsInvoice[]> = {}
  for (const inv of invoices) {
    const parsed = inv.periodStart ? new Date(inv.periodStart).getFullYear() : NaN
    const year = Number.isNaN(parsed) ? 'Unknown' : String(parsed)
    if (!groups[year]) groups[year] = []
    groups[year].push(inv)
  }
  return groups
}

const AGING_LABELS = [
  { key: 'current' as const, label: 'Current' },
  { key: 'thirtyDay' as const, label: '30 days' },
  { key: 'sixtyDay' as const, label: '60 days' },
  { key: 'ninetyDay' as const, label: '90 days' },
  { key: 'overNinety' as const, label: '90+ days' },
]

export function ArrearsBreakdown({ invoices, currency = 'PHP', agingBuckets }: ArrearsBreakdownProps) {
  if (invoices.length === 0) {
    return (
      <GlassCard className="p-5">
        <div className="flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-[var(--color-success)] shrink-0" />
          <p className="text-[14px] text-[var(--color-muted)]">All caught up! No outstanding invoices.</p>
        </div>
      </GlassCard>
    )
  }

  const grouped = groupByYear(invoices)
  const years = Object.keys(grouped).sort((a, b) => b.localeCompare(a)) // newest first

  return (
    <div className="space-y-4">
      {/* Aging Buckets Summary */}
      {agingBuckets && (
        <GlassCard className="p-4">
          <h3 className="text-[13px] font-semibold text-[var(--color-muted)] uppercase tracking-wide mb-3">
            Aging Summary
          </h3>
          <div className="grid grid-cols-5 gap-2">
            {AGING_LABELS.map(({ key, label }) => (
              <div key={key} className="text-center">
                <p className="text-[12px] text-[var(--color-muted)]">{label}</p>
                <p className="text-[14px] font-semibold tabular-nums">
                  {formatCents(agingBuckets[key], currency)}
                </p>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* Invoices grouped by year */}
      {years.map((year) => (
        <div key={year} className="space-y-2">
          <h3 className="text-[14px] font-semibold">{year}</h3>
          <GlassCard className="p-1">
            <div className="space-y-1">
              {grouped[year]?.map((inv) => {
                const daysOverdue = getDaysOverdue(inv.dueDate)
                return (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between rounded-[8px] px-4 py-3 text-[14px] hover:bg-[var(--color-surface-elevated-hover)] transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="w-4 h-4 text-[var(--color-warning)] shrink-0" />
                      <span className="font-mono text-[12px]">{inv.invoiceNumber}</span>
                      {daysOverdue > 0 && (
                        <span className="text-[12px] text-[var(--color-error)]">
                          {daysOverdue} day{daysOverdue !== 1 ? 's' : ''} overdue
                        </span>
                      )}
                    </div>
                    <span className="font-mono font-semibold tabular-nums">
                      {formatCents(inv.totalAmount, currency)}
                    </span>
                  </div>
                )
              })}
            </div>
          </GlassCard>
        </div>
      ))}
    </div>
  )
}
