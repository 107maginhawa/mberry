import { Link } from '@tanstack/react-router'
import { EmptyState, ErrorState, Skeleton, StatusBadge } from '@monobase/ui'
import { useSelectedOrg } from '../org/use-org'
import { useRenewals, type RenewalMember } from './use-renewals'

type KnownStatus = 'active' | 'grace' | 'lapsed' | 'pending' | 'suspended'
const STATUS_BADGE: Record<string, KnownStatus> = {
  active: 'active', gracePeriod: 'grace', lapsed: 'lapsed', expired: 'lapsed', pendingPayment: 'pending', suspended: 'suspended',
}

function fmtDate(d: unknown): string {
  if (!d) return ''
  const t = new Date(d as string)
  return Number.isNaN(t.getTime()) || t.getTime() <= 0 ? '' : t.toLocaleDateString('en-PH', { day: 'numeric', month: 'short', year: 'numeric' })
}

function dueSoonMeta(m: RenewalMember): string {
  const when = m.daysLeft === 0 ? 'Renews today' : m.daysLeft === 1 ? 'Renews tomorrow' : `${m.daysLeft} days left`
  const date = fmtDate(m.duesExpiryDate)
  return date ? `${when} · Renews ${date}` : when
}

function MemberRow({ m, meta }: { m: RenewalMember; meta: string }) {
  const badge = STATUS_BADGE[m.status]
  return (
    <li>
      <Link
        to="/members/$membershipId"
        params={{ membershipId: m.membershipId }}
        aria-label={`View ${m.name}`}
        className="flex items-center justify-between gap-3 rounded-lg border border-[var(--color-border-light)] bg-surface px-4 py-3"
      >
        <div className="flex flex-col gap-1 min-w-0">
          <span className="text-body font-medium text-foreground truncate">{m.name}</span>
          <span className="text-caption text-muted-foreground truncate">
            {[m.memberNumber, meta].filter(Boolean).join(' · ')}
          </span>
        </div>
        {badge ? <StatusBadge status={badge} /> : <StatusBadge variant="muted">{m.status}</StatusBadge>}
      </Link>
    </li>
  )
}

function Section({ title, members, metaFor }: { title: string; members: RenewalMember[]; metaFor: (m: RenewalMember) => string }) {
  if (members.length === 0) return null
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-section font-semibold text-foreground">{title} ({members.length})</h2>
      <ul className="flex flex-col gap-3">
        {members.map((m) => <MemberRow key={m.membershipId} m={m} meta={metaFor(m)} />)}
      </ul>
    </section>
  )
}

export function Renewals() {
  const { orgId } = useSelectedOrg()
  const { status, buckets, total, shown, refetch } = useRenewals(orgId)

  return (
    <main className="mx-auto max-w-xl p-4 flex flex-col gap-6">
      <Link to="/more" className="inline-flex min-h-tap items-center text-body text-primary">← Back to More</Link>
      <h1 className="text-title font-semibold text-foreground">Renewals</h1>

      {status === 'loading' || status === 'idle' ? (
        <div className="flex flex-col gap-3" role="status" aria-label="Loading renewals">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
        </div>
      ) : status === 'error' ? (
        <ErrorState message="We couldn't load renewals. You may need officer access." onRetry={refetch} />
      ) : status === 'empty' ? (
        <EmptyState headline="Everyone's up to date" description="No members are due to renew, in grace, or lapsed." />
      ) : (
        <>
          {total > shown && (
            <p role="alert" className="text-caption text-warning">
              Based on the first {shown} of {total} members — these buckets may be incomplete for a
              larger chapter. Use the directory’s filters to see everyone.
            </p>
          )}
          <Section title="Due soon" members={buckets.dueSoon} metaFor={dueSoonMeta} />
          <Section title="In grace" members={buckets.grace} metaFor={(m) => (fmtDate(m.duesExpiryDate) ? `Expired ${fmtDate(m.duesExpiryDate)}` : 'In grace period')} />
          <Section title="Lapsed" members={buckets.lapsed} metaFor={(m) => (fmtDate(m.duesExpiryDate) ? `Lapsed ${fmtDate(m.duesExpiryDate)}` : 'Lapsed')} />
        </>
      )}
    </main>
  )
}
