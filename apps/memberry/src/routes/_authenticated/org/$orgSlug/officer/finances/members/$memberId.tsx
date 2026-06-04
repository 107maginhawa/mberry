import { createFileRoute, Link } from '@tanstack/react-router'
import { useOrg } from '@/hooks/useOrg'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Skeleton, Badge } from '@monobase/ui'
import { Button } from '@monobase/ui'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@monobase/ui'
import { GlassCard } from '@/components/motion/glass-card'
import { PageShell } from '@/components/patterns/page-shell'
import { ErrorState } from '@/components/patterns/error-state'
import { DuesStatusBadge } from '@/features/dues/components/dues-status-badge'
import { formatCents } from '@/features/dues/lib/money'
import { MoreHorizontal, CreditCard, Bell, FileText, Plus } from 'lucide-react'
import { toast } from 'sonner'

export const Route = createFileRoute('/_authenticated/org/$orgSlug/officer/finances/members/$memberId')({
  component: MemberFinancialDetailPage,
})

function MemberFinancialDetailPage() {
  const { orgId, orgSlug } = useOrg()
  const { memberId } = Route.useParams()

  const { data: summary, isLoading, isError, refetch } = useQuery({
    queryKey: ['dues-member-summary', orgId, memberId],
    queryFn: () =>
      api.get(`/api/association/member/dues-member-summary/${orgId}/${memberId}`).then((r: any) => r.data),
    enabled: !!orgId && !!memberId,
  })

  const memberFinanceBreadcrumbs = [
    { label: 'Officer', href: `/org/${orgSlug}/officer/dashboard` },
    { label: 'Finances', href: `/org/${orgSlug}/officer/finances` },
    { label: 'Members', href: `/org/${orgSlug}/officer/finances/members` },
  ]

  if (isError) {
    return (
      <PageShell title="Member" breadcrumbs={memberFinanceBreadcrumbs}>
        <div className="p-6 max-w-2xl">
          <ErrorState message="Could not load member finances" onRetry={() => refetch()} />
        </div>
      </PageShell>
    )
  }

  if (isLoading) {
    return (
      <PageShell title="Member" breadcrumbs={memberFinanceBreadcrumbs}>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="flex gap-6">
            <Skeleton className="h-96 w-[280px] shrink-0" />
            <Skeleton className="h-96 flex-1" />
          </div>
        </div>
      </PageShell>
    )
  }

  const name = summary?.person
    ? `${summary.person.firstName ?? ''} ${summary.person.lastName ?? ''}`.trim()
    : 'Unknown Member'
  const email = summary?.person?.email ?? '—'
  const memberSince = summary?.joinedAt
    ? new Date(summary.joinedAt).toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })
    : '—'
  const category = summary?.category?.name ?? '—'
  const chapter = summary?.chapter?.name ?? '—'
  const outstanding = Number(summary?.balance ?? 0)
  const unpaidCount = (summary?.invoices ?? []).filter((inv: any) => ['generated', 'sent', 'overdue'].includes(inv.status)).length
  const overdueSince = summary?.overdueSince
    ? new Date(summary.overdueSince).toLocaleDateString('en-PH', { month: 'short', year: 'numeric' })
    : null
  const lifetimePaid = Number(summary?.lifetimePaid ?? 0)

  const invoices = summary?.invoices ?? []
  const payments = summary?.payments ?? []
  const timeline = summary?.statusTimeline ?? []
  const assessments = summary?.assessments ?? []

  return (
    <PageShell
      title={name}
      breadcrumbs={[...memberFinanceBreadcrumbs, { label: name }]}
    >
      <div className="flex flex-col lg:flex-row gap-5">
        {/* Sidebar */}
        <div className="w-full lg:w-[280px] shrink-0 space-y-4">
          <GlassCard className="p-5">
            <h2 className="font-semibold text-lg mb-1">{name}</h2>
            <p className="text-sm text-[var(--color-muted)]">{email}</p>
            <p className="text-sm text-[var(--color-muted)] mt-1">Member since {memberSince}</p>
            <p className="text-sm text-[var(--color-muted)]">Category: {category}</p>
            <p className="text-sm text-[var(--color-muted)]">Chapter: {chapter}</p>
          </GlassCard>

          <GlassCard className="p-5">
            <p className="text-sm text-[var(--color-muted)] mb-1">Outstanding</p>
            <p className={`text-2xl font-bold tabular-nums ${outstanding > 0 ? 'text-[var(--color-error)]' : 'text-[var(--color-success)]'}`}>
              {formatCents(outstanding)}
            </p>
            {unpaidCount > 0 && (
              <p className="text-xs text-[var(--color-muted)] mt-1">{unpaidCount} unpaid invoice{unpaidCount > 1 ? 's' : ''}</p>
            )}
            {overdueSince && (
              <p className="text-xs text-[var(--color-error)] mt-0.5">Overdue since {overdueSince}</p>
            )}
          </GlassCard>

          <GlassCard className="p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium">Actions</p>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-xs">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => toast.info('Record payment coming soon')}>
                    <CreditCard className="h-4 w-4 mr-2" /> Record Payment
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => toast.info('Send reminder coming soon')}>
                    <Bell className="h-4 w-4 mr-2" /> Send Reminder
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => toast.info('Create invoice coming soon')}>
                    <FileText className="h-4 w-4 mr-2" /> Create Invoice
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => toast.info('Add assessment coming soon')}>
                    <Plus className="h-4 w-4 mr-2" /> Add Assessment
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </GlassCard>

          {assessments.length > 0 && (
            <GlassCard className="p-5">
              <p className="text-sm font-medium mb-2">Assessments</p>
              <div className="space-y-2">
                {assessments.map((a: any) => (
                  <div key={a.id} className="flex items-center justify-between text-sm">
                    <span>{a.name}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs">{formatCents(a.amount)}</span>
                      <span className={`text-xs ${a.status === 'paid' ? 'text-[var(--color-success)]' : 'text-[var(--color-muted)]'}`}>
                        {a.status === 'paid' ? '✓' : '○'} {a.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>
          )}

          <GlassCard className="p-5">
            <p className="text-sm font-medium mb-2">Metadata</p>
            <div className="space-y-1 text-xs text-[var(--color-muted)] font-mono">
              <p>member_id: {memberId}</p>
              {summary?.personId && <p>person_id: {summary.personId}</p>}
            </div>
          </GlassCard>
        </div>

        {/* Right panel — single scrollable view, NO tabs */}
        <div className="flex-1 space-y-5 min-w-0">
          {/* Balance summary */}
          <GlassCard className="p-5">
            <h3 className="text-sm font-medium text-[var(--color-muted)] uppercase tracking-wider mb-3">Balance</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-2xl font-bold tabular-nums">{formatCents(outstanding)}</p>
                <p className="text-xs text-[var(--color-muted)]">overdue</p>
              </div>
              <div>
                <p className="text-2xl font-bold tabular-nums">{formatCents(lifetimePaid)}</p>
                <p className="text-xs text-[var(--color-muted)]">lifetime</p>
              </div>
            </div>
            {summary?.nextDueDate && (
              <p className="text-sm text-[var(--color-muted)] mt-3">
                Next due: {new Date(summary.nextDueDate).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
            )}
            {summary?.duesAmount && (
              <p className="text-sm text-[var(--color-muted)]">
                Amount: {formatCents(summary.duesAmount)}/year
              </p>
            )}
          </GlassCard>

          {/* Invoices */}
          <GlassCard className="p-5">
            <h3 className="text-sm font-medium text-[var(--color-muted)] uppercase tracking-wider mb-3">Invoices</h3>
            {invoices.length === 0 ? (
              <p className="text-sm text-[var(--color-muted)] py-4 text-center">No invoices yet</p>
            ) : (
              <div className="space-y-3">
                {invoices.map((inv: any) => (
                  <div key={inv.id} className="flex items-center justify-between">
                    <div>
                      <p className="font-mono text-sm">{inv.invoiceNumber}</p>
                      <p className="text-xs text-[var(--color-muted)]">
                        {inv.periodStart && new Date(inv.periodStart).toLocaleDateString('en-PH', { month: 'short', year: 'numeric' })}
                        {' — '}
                        {inv.periodEnd && new Date(inv.periodEnd).toLocaleDateString('en-PH', { month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm">{formatCents(inv.totalAmount)}</span>
                      <DuesStatusBadge status={inv.status} type="invoice" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>

          {/* Payments */}
          <GlassCard className="p-5">
            <h3 className="text-sm font-medium text-[var(--color-muted)] uppercase tracking-wider mb-3">Payments</h3>
            {payments.length === 0 ? (
              <p className="text-sm text-[var(--color-muted)] py-4 text-center">No payments yet</p>
            ) : (
              <div className="space-y-3">
                {payments.map((pay: any) => (
                  <div key={pay.id} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm">
                        {pay.createdAt && new Date(pay.createdAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                      <p className="text-xs text-[var(--color-muted)]">{pay.paymentMethod ?? 'Unknown'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm">{formatCents(pay.amount)}</span>
                      <DuesStatusBadge status={pay.status} type="payment" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>

          {/* Activity */}
          {timeline.length > 0 && (
            <GlassCard className="p-5">
              <h3 className="text-sm font-medium text-[var(--color-muted)] uppercase tracking-wider mb-3">Activity</h3>
              <div className="space-y-2">
                {timeline.map((entry: any, i: number) => (
                  <div key={i} className="flex items-center gap-3 text-sm">
                    <span className="text-xs text-[var(--color-muted)] w-20 shrink-0">
                      {entry.changedAt && new Date(entry.changedAt).toLocaleDateString('en-PH', { month: 'short', year: 'numeric' })}
                    </span>
                    {entry.fromStatus ? (
                      <span>
                        Status → <Badge className="text-xs">{entry.toStatus}</Badge>
                      </span>
                    ) : (
                      <span>{entry.description ?? `Status: ${entry.toStatus}`}</span>
                    )}
                  </div>
                ))}
              </div>
            </GlassCard>
          )}
        </div>
      </div>
    </PageShell>
  )
}
