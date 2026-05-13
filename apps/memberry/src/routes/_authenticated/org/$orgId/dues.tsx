import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { listDuesInvoicesOptions, listDuesPaymentsOptions } from '@monobase/sdk-ts/generated/react-query'
import { Badge } from '@monobase/ui'
import { Skeleton } from '@monobase/ui'
import { formatCents } from '@/features/dues/lib/money'
import { ProofUploadForm } from '@/features/dues/components/proof-upload-form'
import { api } from '@/lib/api'
import { CreditCard, Clock, CheckCircle, XCircle, AlertTriangle, Info, Building, Receipt } from 'lucide-react'
import { PageHeader } from '@/components/patterns/page-header'
import { GlassCard } from '@/components/motion/glass-card'
import { CountUp } from '@/components/motion/count-up'
import { StaggerGrid, StaggerItem } from '@/components/motion/stagger-grid'
import { EmptyState } from '@/components/patterns/empty-state'

export const Route = createFileRoute('/_authenticated/org/$orgId/dues')({
  component: MemberDuesPage,
})

const STATUS_BADGE: Record<string, { className: string; label: string }> = {
  generated: { className: 'bg-yellow-100 text-yellow-800', label: 'Unpaid' },
  sent: { className: 'bg-yellow-100 text-yellow-800', label: 'Unpaid' },
  overdue: { className: 'bg-red-100 text-red-800', label: 'Overdue' },
  paid: { className: 'bg-green-100 text-green-800', label: 'Paid' },
  cancelled: { className: 'bg-gray-100 text-gray-600', label: 'Cancelled' },
}

const PAYMENT_STATUS_BADGE: Record<string, { className: string; label: string; icon: any }> = {
  submitted: { className: 'bg-blue-100 text-blue-800', label: 'Pending Review', icon: Clock },
  confirmed: { className: 'bg-green-100 text-green-800', label: 'Confirmed', icon: CheckCircle },
  rejected: { className: 'bg-red-100 text-red-800', label: 'Rejected', icon: XCircle },
  completed: { className: 'bg-green-100 text-green-800', label: 'Completed', icon: CheckCircle },
}

function MemberDuesPage() {
  const { orgId } = Route.useParams()

  // Fetch membership to check expiry status
  const { data: membershipData } = useQuery({
    queryKey: ['my-membership-for-org', orgId],
    queryFn: async () => {
      const res = await api.get<any>('/api/persons/me/memberships')
      const memberships = res?.data ?? []
      return memberships.find((m: any) => (m.orgId ?? m.organizationId) === orgId) ?? null
    },
    retry: false,
  })

  // Fetch dues config for this org (payment instructions)
  const { data: duesConfig } = useQuery({
    queryKey: ['dues-config-for-org', orgId],
    queryFn: async () => {
      const res = await api.get<any>(`/api/association/member/dues-configs?organizationId=${orgId}`)
      const configs = res?.data ?? []
      return configs[0] ?? null
    },
    retry: false,
  })

  // Fetch invoices for this member (API scopes by session user for member role)
  const { data: invoicesData, isLoading: loadingInvoices } = useQuery({
    ...listDuesInvoicesOptions({
      query: { organizationId: orgId, limit: 10 },
    }),
    select: (d: any) => d?.data ?? [],
  })

  // Fetch payments for this member (API scopes by session user for member role)
  const { data: paymentsData, isLoading: loadingPayments } = useQuery({
    ...listDuesPaymentsOptions({
      query: { organizationId: orgId, limit: 20 },
    }),
    select: (d: any) => d?.data ?? [],
  })

  const invoices = invoicesData ?? []
  const payments = paymentsData ?? []

  // Membership expiry check — only treat as expired if status is not active
  const memberStatus = membershipData?.status
  const expiryDate = membershipData?.duesExpiryDate ? new Date(membershipData.duesExpiryDate) : null
  const isExpired = expiryDate ? expiryDate < new Date() && memberStatus !== 'active' : false
  const daysUntilExpiry = expiryDate ? Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null

  // Find unpaid invoices (can submit proof for)
  const unpaidInvoices = invoices.filter(
    (inv: any) => ['generated', 'sent', 'overdue'].includes(inv.status)
  )

  // Check if any proof is already submitted for each invoice
  const submittedPaymentsByInvoice = new Map<string, any>()
  for (const p of payments) {
    if (p.invoiceId && ['submitted', 'confirmed'].includes(p.status)) {
      submittedPaymentsByInvoice.set(p.invoiceId, p)
    }
  }

  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      <PageHeader
        title="My Dues"
        subtitle="View your dues and submit payment proof for renewal"
        breadcrumbs={[
          { label: 'Organization', href: `/org/${orgId}` },
          { label: 'Dues' },
        ]}
      />

      {/* Unpaid Invoices — Proof Upload */}
      {loadingInvoices ? (
        <div className="space-y-4">
          <Skeleton className="h-6 w-32 rounded-lg" />
          <Skeleton className="h-48 rounded-xl animate-shimmer" />
        </div>
      ) : unpaidInvoices.length > 0 ? (
        <section className="space-y-4">
          <h2 className="text-h3 font-display flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Pay Dues
          </h2>
          <StaggerGrid className="space-y-4">
            {unpaidInvoices.map((inv: any) => {
              const existingSubmission = submittedPaymentsByInvoice.get(inv.id)
              return (
                <StaggerItem key={inv.id}>
                  <GlassCard className="p-5 space-y-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-mono text-[13px] text-[var(--color-muted)]">{inv.invoiceNumber}</p>
                        <p className="text-h2 font-display font-bold tabular-nums">
                          <CountUp value={inv.totalAmount / 100} prefix="₱" format={(n) => n.toLocaleString('en-PH', { minimumFractionDigits: 2 })} />
                        </p>
                        <p className="text-[13px] text-[var(--color-muted)]">
                          Period: {inv.periodStart} to {inv.periodEnd}
                        </p>
                      </div>
                      <Badge className={STATUS_BADGE[inv.status]?.className ?? ''}>
                        {STATUS_BADGE[inv.status]?.label ?? inv.status}
                      </Badge>
                    </div>

                    {existingSubmission ? (
                      <div className="rounded-[8px] p-4 bg-[var(--color-surface-warm)]">
                        <div className="flex items-center gap-2 text-[14px]">
                          {(() => {
                            const s = PAYMENT_STATUS_BADGE[existingSubmission.status]
                            const Icon = s?.icon ?? Clock
                            return (
                              <>
                                <Icon className="h-4 w-4" />
                                <span className="font-semibold">
                                  Payment {s?.label ?? existingSubmission.status}
                                </span>
                              </>
                            )
                          })()}
                        </div>
                        {existingSubmission.status === 'rejected' && existingSubmission.rejectionReason && (
                          <p className="text-[13px] text-[var(--color-error)] mt-2">
                            Reason: {existingSubmission.rejectionReason}
                          </p>
                        )}
                        {existingSubmission.status === 'rejected' && (
                          <div className="mt-3">
                            <p className="text-[13px] text-[var(--color-muted)] mb-2">
                              You can resubmit your proof:
                            </p>
                            <ProofUploadForm
                              invoiceId={inv.id}
                              invoiceAmount={inv.totalAmount}
                              currency="PHP"
                              orgId={orgId}
                            />
                          </div>
                        )}
                      </div>
                    ) : (
                      <div>
                        <p className="text-[13px] text-[var(--color-muted)] mb-3">
                          Upload your GCash screenshot or bank transfer receipt to pay.
                        </p>
                        <ProofUploadForm
                          invoiceId={inv.id}
                          invoiceAmount={inv.totalAmount}
                          currency="PHP"
                          orgId={orgId}
                        />
                      </div>
                    )}
                  </GlassCard>
                </StaggerItem>
              )
            })}
          </StaggerGrid>
        </section>
      ) : isExpired ? (
        <section className="space-y-4">
          <GlassCard className="p-5 space-y-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="space-y-2">
                <h2 className="text-h3 font-display">Membership Period Ended</h2>
                <p className="text-[14px] text-[var(--color-muted)]">
                  Your membership period expired on{' '}
                  <span className="font-semibold text-[var(--color-text)]">
                    {expiryDate?.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </span>.
                  All previous dues have been paid. Your organization's treasurer will generate a renewal invoice for the next period.
                </p>
              </div>
            </div>

            <div className="rounded-[8px] p-4 space-y-3 bg-[var(--color-surface-warm)]">
              <h3 className="text-[14px] font-semibold flex items-center gap-2">
                <Info className="w-4 h-4" />
                How Renewal Works
              </h3>
              <ol className="text-[13px] text-[var(--color-muted)] space-y-2 list-decimal list-inside">
                <li>Your chapter treasurer generates a renewal invoice for the next membership period</li>
                <li>You'll receive a notification when your invoice is ready</li>
                <li>Pay via GCash, bank transfer, or other accepted methods and upload your receipt here</li>
                <li>A chapter officer reviews and confirms your payment</li>
                <li>Your membership is renewed and your new expiry date is updated</li>
              </ol>
              {duesConfig?.amount && (
                <p className="text-[14px] font-semibold mt-2">
                  Annual dues: <span className="font-bold text-[var(--color-primary)]">{formatCents(duesConfig.amount, duesConfig.currency ?? 'PHP')}</span>
                </p>
              )}
            </div>

            <div className="rounded-[8px] p-4 flex items-start gap-3 border border-[var(--color-surface-border-glass)]">
              <Building className="w-4 h-4 text-[var(--color-muted)] shrink-0 mt-0.5" />
              <div className="text-[14px]">
                <p className="font-semibold">Need to renew immediately?</p>
                <p className="text-[var(--color-muted)]">
                  Contact your chapter treasurer or organization officer to request a renewal invoice.
                </p>
              </div>
            </div>
          </GlassCard>
        </section>
      ) : daysUntilExpiry !== null && daysUntilExpiry > 0 && daysUntilExpiry <= 60 ? (
        <GlassCard className="p-5">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
            <div>
              <h2 className="text-h3 font-display">All Dues Paid</h2>
              <p className="text-[14px] text-[var(--color-muted)]">
                Your membership is current through{' '}
                <span className="font-semibold text-[var(--color-text)]">
                  {expiryDate?.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}
                </span>
                {' '}({daysUntilExpiry} day{daysUntilExpiry !== 1 ? 's' : ''} remaining).
                A renewal invoice will be generated before your membership period ends.
              </p>
            </div>
          </div>
        </GlassCard>
      ) : (
        <GlassCard className="p-5">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
            <div>
              <h2 className="text-h3 font-display">All Dues Paid</h2>
              <p className="text-[14px] text-[var(--color-muted)]">
                No outstanding dues.{expiryDate && (
                  <> Your membership is current through{' '}
                  <span className="font-semibold text-[var(--color-text)]">
                    {expiryDate.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </span>.</>
                )}
              </p>
            </div>
          </div>
        </GlassCard>
      )}

      {/* Recent Payment History */}
      {loadingPayments ? (
        <div className="space-y-2">
          <Skeleton className="h-6 w-40 rounded-lg" />
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-lg animate-shimmer" />
          ))}
        </div>
      ) : payments.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-h3 font-display">Payment History</h2>
          <GlassCard className="p-1">
            <div className="overflow-x-auto">
              <div className="space-y-1">
                {payments.slice(0, 10).map((p: any) => {
                  const s = PAYMENT_STATUS_BADGE[p.status]
                  return (
                    <div
                      key={p.id}
                      className="flex items-center justify-between rounded-[8px] px-4 py-3 text-[14px] hover:bg-[var(--color-surface-elevated-hover)] transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-[12px] tabular-nums">{p.receiptNumber}</span>
                        <Badge className={s?.className ?? 'bg-gray-100 text-gray-600'}>
                          {s?.label ?? p.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="font-mono font-semibold tabular-nums">
                          {formatCents(p.amount, p.currency)}
                        </span>
                        <span className="text-[12px] text-[var(--color-muted)]">
                          {p.paidAt ? new Date(p.paidAt).toLocaleDateString() : '—'}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </GlassCard>
        </section>
      ) : (
        <EmptyState
          icon={<Receipt className="w-10 h-10" />}
          headline="No Payment History"
          description="Your payment records will appear here once you've made a dues payment."
        />
      )}
    </div>
  )
}
