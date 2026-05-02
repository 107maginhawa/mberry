import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Users, AlertTriangle, UserMinus, TrendingUp, CalendarDays, Bell, ClipboardList, UserX } from 'lucide-react'
import { StatCard } from '@/components/patterns/stat-card'
import { CardSkeleton } from '@/components/patterns/skeleton-loader'
import { PageHeader } from '@/components/patterns/page-header'

interface OfficerDashboardProps {
  orgId: string
}

interface MemberSummary {
  activeCount: number
  graceCount: number
  lapsedCount: number
  pendingCount: number
  totalCount: number
  expiringIn30Days: number
}

interface DuesDashboard {
  collectionRate: number
  upcomingActivities: number
}

export function OfficerDashboard({ orgId }: OfficerDashboardProps) {
  const members = useQuery<MemberSummary>({
    queryKey: ['member-summary', orgId],
    queryFn: async () => {
      const res = await fetch(`/api/membership/members/${orgId}?pageSize=0`)
      const json = await res.json()
      const all = json.data ?? []
      const counts = { activeCount: 0, graceCount: 0, lapsedCount: 0, pendingCount: 0, totalCount: 0, expiringIn30Days: 0 }
      for (const m of all) {
        counts.totalCount++
        if (m.status === 'active') counts.activeCount++
        else if (m.status === 'grace') counts.graceCount++
        else if (m.status === 'lapsed') counts.lapsedCount++
        else if (m.status === 'pending') counts.pendingCount++
        if (m.duesExpiryDate) {
          const expiry = new Date(m.duesExpiryDate)
          const daysLeft = (expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
          if (daysLeft >= 0 && daysLeft <= 30) counts.expiringIn30Days++
        }
      }
      return counts
    },
    retry: false,
  })

  const dues = useQuery<DuesDashboard>({
    queryKey: ['dues-dashboard', orgId],
    queryFn: async () => {
      const res = await fetch(`/api/dues/dashboard/${orgId}`)
      return (await res.json()).data ?? { collectionRate: 0, upcomingActivities: 0 }
    },
    retry: false,
  })

  const isLoading = members.isLoading || dues.isLoading

  const m = members.data
  const d = dues.data

  const collectionRate = d?.collectionRate ?? 0
  const upcomingActivities = d?.upcomingActivities ?? 0

  return (
    <div>
      <PageHeader
        title="Officer Dashboard"
        subtitle="Membership health and action items at a glance"
      />

      {/* Metrics strip */}
      <section className="grid grid-cols-2 md:grid-cols-5 gap-3.5 mb-8">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => <CardSkeleton key={i} />)
        ) : (
          <>
            <StatCard label="Active Members" value={m?.activeCount ?? 0} />
            <StatCard label="Grace Period" value={m?.graceCount ?? 0} />
            <StatCard label="Lapsed" value={m?.lapsedCount ?? 0} />
            <StatCard
              label="Collection Rate"
              value={`${collectionRate}%`}
              change={
                collectionRate > 0
                  ? { value: `${collectionRate}% collected`, positive: collectionRate >= 70 }
                  : undefined
              }
            />
            <StatCard label="Upcoming Activities" value={upcomingActivities} />
          </>
        )}
      </section>

      {/* Smart action cards */}
      <section className="space-y-3">
        <h2 className="text-[16px] font-semibold font-display mb-2">Action Items</h2>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Expiring dues */}
            {(m?.expiringIn30Days ?? 0) > 0 && (
              <ActionCard
                icon={<Bell size={18} className="text-[var(--color-warning)]" />}
                title={`${m!.expiringIn30Days} member${m!.expiringIn30Days !== 1 ? 's' : ''} with expiring dues`}
                description="Send renewal reminders before they lapse"
                href={`/org/${orgId}/officer/roster?status=active&expiring=30`}
                variant="warning"
              />
            )}

            {/* Pending applications */}
            {(m?.pendingCount ?? 0) > 0 && (
              <ActionCard
                icon={<ClipboardList size={18} className="text-[var(--color-info)]" />}
                title={`${m!.pendingCount} pending application${m!.pendingCount !== 1 ? 's' : ''}`}
                description="Review and approve membership applications"
                href={`/org/${orgId}/officer/applications`}
                variant="info"
              />
            )}

            {/* Lapsing members */}
            {(m?.graceCount ?? 0) > 0 && (
              <ActionCard
                icon={<UserMinus size={18} className="text-[var(--color-error)]" />}
                title={`${m!.graceCount} member${m!.graceCount !== 1 ? 's' : ''} in grace period`}
                description="These members are at risk of lapsing — act now"
                href={`/org/${orgId}/officer/roster?status=grace`}
                variant="error"
              />
            )}

            {/* Low collection rate */}
            {collectionRate > 0 && collectionRate < 70 && (
              <ActionCard
                icon={<TrendingUp size={18} className="text-[var(--color-error)]" />}
                title={`Collection rate is ${collectionRate}%`}
                description="Review outstanding dues and follow up with members"
                href={`/org/${orgId}/officer/payments`}
                variant="error"
              />
            )}

            {/* All good */}
            {(m?.expiringIn30Days ?? 0) === 0 &&
              (m?.pendingCount ?? 0) === 0 &&
              (m?.graceCount ?? 0) === 0 &&
              collectionRate >= 70 && (
                <div className="col-span-full rounded-[12px] border border-[var(--color-success-bg)] bg-[var(--color-success-bg)] p-5 flex items-center gap-3">
                  <Users size={20} className="text-[var(--color-success)] shrink-0" />
                  <div>
                    <p className="text-[14px] font-semibold text-[var(--color-success)]">All clear</p>
                    <p className="text-[13px] font-medium text-[var(--color-muted)]">
                      No urgent action items. Keep up the great work!
                    </p>
                  </div>
                </div>
              )}
          </div>
        )}
      </section>

      {/* Quick links */}
      <section className="mt-8">
        <h2 className="text-[16px] font-semibold font-display mb-3">Quick Links</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <QuickLink href={`/org/${orgId}/officer/roster`} icon={<Users size={16} />} label="Roster" />
          <QuickLink href={`/org/${orgId}/officer/applications`} icon={<ClipboardList size={16} />} label="Applications" />
          <QuickLink href={`/org/${orgId}/officer/payments`} icon={<TrendingUp size={16} />} label="Payments" />
          <QuickLink href={`/org/${orgId}/officer/reports/financial`} icon={<CalendarDays size={16} />} label="Reports" />
        </div>
      </section>
    </div>
  )
}

type ActionVariant = 'warning' | 'info' | 'error' | 'success'

const VARIANT_STYLES: Record<ActionVariant, string> = {
  warning: 'border-[var(--color-warning-bg)] bg-[var(--color-warning-bg)]',
  info: 'border-[var(--color-info-bg)] bg-[var(--color-info-bg)]',
  error: 'border-[var(--color-error-bg)] bg-[var(--color-error-bg)]',
  success: 'border-[var(--color-success-bg)] bg-[var(--color-success-bg)]',
}

function ActionCard({
  icon,
  title,
  description,
  href,
  variant = 'info',
}: {
  icon: React.ReactNode
  title: string
  description: string
  href: string
  variant?: ActionVariant
}) {
  return (
    <Link
      to={href as any}
      className={`block rounded-[12px] border p-4 hover:shadow-soft transition-shadow ${VARIANT_STYLES[variant]}`}
    >
      <div className="flex items-start gap-3">
        <span className="shrink-0 mt-0.5">{icon}</span>
        <div>
          <p className="text-[14px] font-semibold">{title}</p>
          <p className="text-[13px] font-medium text-[var(--color-muted)] mt-0.5">{description}</p>
        </div>
      </div>
      <p className="text-[12px] font-semibold text-[var(--color-primary)] mt-3">View &rarr;</p>
    </Link>
  )
}

function QuickLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      to={href as any}
      className="flex items-center gap-2 rounded-[10px] border border-[var(--color-border-light)] bg-[var(--color-surface)] px-4 py-3 text-[13px] font-semibold hover:shadow-soft transition-shadow"
    >
      <span className="text-[var(--color-muted)]">{icon}</span>
      {label}
    </Link>
  )
}
