import { useQuery } from '@tanstack/react-query'
import { listDuesPaymentsOptions } from '@monobase/sdk-ts/generated/react-query'
import { GlassCard } from '@/components/motion/glass-card'
import { Skeleton } from '@monobase/ui'
import { formatCents } from '../lib/money'
import { Link } from '@tanstack/react-router'

interface RecentActivityFeedProps {
  orgId: string
  orgSlug: string
  limit?: number
}

interface PaymentItem {
  id: string
  amount?: number | string | null
  status?: string
  paymentMethod?: string | null
  createdAt?: string | null
  person?: { firstName?: string; lastName?: string } | null
  personId?: string | null
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  return date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })
}

export function RecentActivityFeed({ orgId, orgSlug, limit = 5 }: RecentActivityFeedProps) {
  const { data, isLoading, isError } = useQuery({
    ...listDuesPaymentsOptions({
      query: { organizationId: orgId, status: 'completed', limit, offset: 0 },
      headers: { 'x-org-id': orgId },
    } as any),
    select: (d: any) => (d?.data ?? []) as PaymentItem[],
  })

  if (isLoading) {
    return (
      <GlassCard className="p-5">
        <h2 className="text-h4 mb-4">Recent Activity</h2>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded" />
          ))}
        </div>
      </GlassCard>
    )
  }

  if (isError) {
    return (
      <GlassCard className="p-5">
        <h2 className="text-h4 mb-4">Recent Activity</h2>
        <div role="alert" className="p-3 rounded-lg bg-[var(--color-error-bg)] text-[var(--color-error)] text-sm">
          Unable to load recent activity. Please try refreshing the page.
        </div>
      </GlassCard>
    )
  }

  const payments = data ?? []

  if (payments.length === 0) {
    return (
      <GlassCard className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-h4">Recent Activity</h2>
          <Link
            to="/org/$orgSlug/officer/payments"
            params={{ orgSlug }}
            className="text-sm text-[var(--color-primary)] hover:underline"
          >
            View All Payments →
          </Link>
        </div>
        <div className="py-8 text-center text-sm text-[var(--color-muted)]" role="status">
          No payment activity yet. Activity appears after the first payment is recorded.
        </div>
      </GlassCard>
    )
  }

  // Group by relative date
  const grouped = new Map<string, PaymentItem[]>()
  for (const p of payments) {
    const key = p.createdAt ? formatRelativeDate(p.createdAt) : 'Unknown'
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key)!.push(p)
  }

  return (
    <GlassCard className="p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-h4">Recent Activity</h2>
        <Link
          to="/org/$orgSlug/officer/payments"
          params={{ orgSlug }}
          className="text-sm text-[var(--color-primary)] hover:underline"
        >
          View All Payments →
        </Link>
      </div>
      <div className="space-y-4">
        {Array.from(grouped.entries()).map(([dateLabel, items]) => (
          <div key={dateLabel}>
            <p className="text-xs font-medium text-[var(--color-muted)] uppercase tracking-wider mb-2">{dateLabel}</p>
            <div className="space-y-2">
              {items.map((p) => {
                const name = p.person
                  ? `${p.person.firstName ?? ''} ${p.person.lastName ?? ''}`.trim()
                  : 'Unknown member'
                return (
                  <div key={p.id} className="flex items-center justify-between py-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                      <span className="text-sm truncate">
                        {name} paid {formatCents(Number(p.amount ?? 0))}
                      </span>
                      {p.paymentMethod && (
                        <span className="text-xs text-[var(--color-muted)]">via {p.paymentMethod}</span>
                      )}
                    </div>
                    {p.createdAt && (
                      <span className="text-xs text-[var(--color-muted)] shrink-0 ml-2">
                        {formatTime(p.createdAt)}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </GlassCard>
  )
}
