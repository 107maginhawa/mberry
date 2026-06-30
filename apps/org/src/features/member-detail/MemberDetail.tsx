import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { toast } from 'sonner'
import {
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Skeleton,
  StatusBadge,
  Timeline,
  TimelineItem,
  centavosToPhp,
} from '@monobase/ui'
import { useSelectedOrg } from '../org/use-org'
import { RecordPaymentDialog } from './RecordPaymentDialog'
import {
  canVoid,
  useMemberOutstanding,
  useMemberPayments,
  useRefundPayment,
  useRenewMembership,
  useRosterMember,
  type MemberPayment,
} from './use-member-detail'

type KnownStatus = 'active' | 'grace' | 'lapsed' | 'pending' | 'suspended'
const STATUS_BADGE: Record<string, KnownStatus> = {
  active: 'active', gracePeriod: 'grace', lapsed: 'lapsed', pendingPayment: 'pending', suspended: 'suspended',
}
const METHOD_LABEL: Record<string, string> = {
  cash: 'Cash', gcash: 'GCash', check: 'Check', bankTransfer: 'Bank transfer', online: 'Online', other: 'Other',
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || '?'
}
function fmtDate(d: unknown): string {
  if (!d) return ''
  const t = new Date(d as string)
  return Number.isNaN(t.getTime()) ? '' : t.toLocaleDateString('en-PH', { day: 'numeric', month: 'short', year: 'numeric' })
}

function PaymentRow({ p, onVoid }: { p: MemberPayment; onVoid: (p: MemberPayment) => void }) {
  const refunded = p.status === 'refunded' || p.status === 'partiallyRefunded'
  const tone = refunded ? 'muted' : p.status === 'completed' ? 'success' : 'default'
  const meta = [fmtDate(p.paidAt), p.receiptNumber ? `Receipt ${p.receiptNumber}` : null].filter(Boolean).join(' · ')
  return (
    <TimelineItem
      tone={tone}
      title={
        <span className="flex items-center gap-2">
          <span className="tabular-amount">{centavosToPhp(p.amount)}</span>
          <span className="text-muted-foreground">· {METHOD_LABEL[p.paymentMethod] ?? p.paymentMethod}</span>
          {p.status === 'refunded' && <StatusBadge variant="muted">Voided</StatusBadge>}
          {p.status === 'partiallyRefunded' && <StatusBadge variant="muted">Partially refunded</StatusBadge>}
        </span>
      }
      meta={meta || undefined}
    >
      {canVoid(p) && (
        <Button variant="outline" className="min-h-tap mt-1 self-start" onClick={() => onVoid(p)}>
          Void / refund
        </Button>
      )}
    </TimelineItem>
  )
}

export function MemberDetail({ membershipId }: { membershipId: string }) {
  const { orgId } = useSelectedOrg()
  const { member, isLoading, isError, refetch } = useRosterMember(membershipId, orgId)
  const personId = member?.personId ?? null
  const { payments, isLoading: payLoading, refetch: refetchPay } = useMemberPayments(personId)
  const { outstanding, openCount } = useMemberOutstanding(membershipId)
  const renew = useRenewMembership()
  const refund = useRefundPayment()
  const [renewOpen, setRenewOpen] = useState(false)
  const [voidTarget, setVoidTarget] = useState<MemberPayment | null>(null)

  // While the selected org is still resolving the member query is disabled (not loading),
  // so treat "no org yet, no member yet" as loading — never flash the access error.
  if (isLoading || (!orgId && !member)) {
    return (
      <div className="flex flex-col gap-4 p-4" role="status" aria-label="Loading member">
        <Skeleton className="h-20 w-full rounded-lg" />
        <Skeleton className="h-12 w-full rounded-lg" />
        <Skeleton className="h-40 w-full rounded-lg" />
      </div>
    )
  }
  if (isError || !member) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <BackLink />
        <ErrorState message="We couldn't load this member. You may need officer access." onRetry={refetch} />
      </div>
    )
  }

  const badge = STATUS_BADGE[member.status]

  function confirmRenew() {
    renew.mutate(
      { membershipId },
      { onSuccess: () => toast.success('Membership renewed'), onError: (e) => toast.error(e.message) },
    )
    setRenewOpen(false)
  }
  function confirmVoid() {
    if (!voidTarget) return
    refund.mutate(
      { paymentId: voidTarget.id },
      { onSuccess: () => toast.success('Payment voided'), onError: (e) => toast.error(e.message) },
    )
    setVoidTarget(null)
  }

  return (
    <div className="flex flex-col gap-5 p-4">
      <BackLink />

      {/* Header */}
      <div className="flex items-center gap-4">
        <span aria-hidden className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary-subtle text-large font-semibold text-primary">
          {initials(member.name)}
        </span>
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-title font-semibold text-foreground">{member.name}</h1>
            {badge ? <StatusBadge status={badge} /> : <StatusBadge variant="muted">{member.status}</StatusBadge>}
          </div>
          <p className="text-caption text-muted-foreground">
            {[member.memberNumber, member.tier].filter(Boolean).join(' · ')}
            {member.joinedAt && ` · Member since ${fmtDate(member.joinedAt)}`}
          </p>
        </div>
      </div>

      {/* Standing band */}
      <div className="rounded-lg border border-[var(--color-border-light)] bg-surface p-4">
        {openCount > 0 ? (
          <p className="text-body text-foreground">
            <span className="tabular-amount font-semibold">{centavosToPhp(outstanding)}</span> outstanding ·{' '}
            {openCount} invoice{openCount === 1 ? '' : 's'}
          </p>
        ) : (
          <p className="text-body text-foreground">In good standing</p>
        )}
        {member.duesExpiryDate && (
          <p className="text-caption text-muted-foreground">Renews {fmtDate(member.duesExpiryDate)}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <Button asChild variant="outline" className="min-h-tap">
          <Link to="/members/$membershipId/send" params={{ membershipId }} search={{ personId: personId ?? undefined, name: member.name }}>
            Send pay-link
          </Link>
        </Button>
        {orgId && personId && <RecordPaymentDialog orgId={orgId} personId={personId} memberName={member.name} />}
        <Button variant="outline" className="min-h-tap" onClick={() => setRenewOpen(true)} disabled={renew.isPending}>
          Renew
        </Button>
      </div>

      {/* Payment history */}
      <section className="flex flex-col gap-3">
        <h2 className="text-section font-semibold text-foreground">Payment history</h2>
        {payLoading ? (
          <Skeleton className="h-32 w-full rounded-lg" />
        ) : payments.length === 0 ? (
          <EmptyState headline="No payments recorded yet" description="Record a cash or GCash payment, or send a pay-link." />
        ) : (
          <Timeline>
            {payments.map((p) => (
              <PaymentRow key={p.id} p={p} onVoid={setVoidTarget} />
            ))}
          </Timeline>
        )}
      </section>

      <ConfirmDialog
        open={renewOpen}
        onOpenChange={setRenewOpen}
        title="Renew this membership?"
        description="This extends the member's dues period by your chapter's billing cycle."
        confirmLabel="Renew membership"
        onConfirm={confirmRenew}
      />
      <ConfirmDialog
        open={voidTarget != null}
        onOpenChange={(o) => { if (!o) setVoidTarget(null) }}
        title="Void this payment?"
        description={voidTarget ? `This refunds ${centavosToPhp(voidTarget.amount)} and reverses the membership extension. Use this to correct a mistaken entry.` : ''}
        confirmLabel="Void payment"
        onConfirm={confirmVoid}
      />
    </div>
  )
}

function BackLink() {
  return (
    <Link to="/" className="inline-flex min-h-tap items-center text-body text-primary">
      ← Back to members
    </Link>
  )
}
