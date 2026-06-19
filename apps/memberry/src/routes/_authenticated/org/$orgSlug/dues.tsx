import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { listDuesInvoicesOptions, listDuesPaymentsOptions } from '@monobase/sdk-ts/generated/react-query'
import { Button, Skeleton } from '@monobase/ui'
import { PageShell } from '@/components/patterns/page-shell'
import { formatCents } from '@/features/dues/lib/money'
import { ProofUploadForm } from '@/features/dues/components/proof-upload-form'
import { DuesStatusCard } from '@/features/dues/components/dues-status-card'
import type { DuesStatusCardProps } from '@/features/dues/components/dues-status-card'
import { DuesStatusBadge } from '@/features/dues/components/dues-status-badge'
import { ArrearsBreakdown } from '@/features/dues/components/arrears-breakdown'
import { PaymentScheduleTimeline } from '@/features/dues/components/payment-schedule-timeline'
import type { TimelinePeriod } from '@/features/dues/components/payment-schedule-timeline'
import { buildPaymentCsv, downloadCsv } from '@/features/dues/lib/csv-export'
import { api } from '@/lib/api'
import { CreditCard, CheckCircle, AlertTriangle, Info, Building, Receipt, Download } from 'lucide-react'
import { useOrg } from '@/hooks/use-org'
import { ErrorState } from '@/components/patterns/error-state'
import { GlassCard } from '@/components/motion/glass-card'
import { CountUp } from '@/components/motion/count-up'
import { StaggerGrid, StaggerItem } from '@/components/motion/stagger-grid'
import { EmptyState } from '@/components/patterns/empty-state'

export const Route = createFileRoute('/_authenticated/org/$orgSlug/dues')({
  component: MemberDuesPage,
})

/** API serves period bounds as Date or ISO string; render a stable date label. */
function fmtPeriod(value: string | Date | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-PH')
}

function MemberDuesPage() {
  const { orgId, orgSlug } = useOrg()

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
  const invoicesQuery = useQuery({
    ...listDuesInvoicesOptions({
      query: { organizationId: orgId, limit: 10 },
    }),
    select: (d: any) => d?.data ?? [],
  })
  const { data: invoicesData, isLoading: loadingInvoices } = invoicesQuery

  // Fetch payments for this member (API scopes by session user for member role)
  const paymentsQuery = useQuery({
    ...listDuesPaymentsOptions({
      query: { organizationId: orgId, limit: 20 },
    }),
    select: (d: any) => d?.data ?? [],
  })
  const { data: paymentsData, isLoading: loadingPayments } = paymentsQuery

  // Fetch aging buckets for this org
  const { data: agingBucketsData } = useQuery({
    queryKey: ['aging-buckets-for-org', orgId],
    queryFn: async () => {
      return api.get<any>(`/api/association/member/aging-buckets/${orgId}`)
    },
    retry: false,
  })

  if (invoicesQuery.isError || paymentsQuery.isError) {
    return (
      <div className="p-6 max-w-2xl">
        <ErrorState
          message="Could not load dues"
          onRetry={() => {
            invoicesQuery.refetch()
            paymentsQuery.refetch()
          }}
        />
      </div>
    )
  }

  const invoices = invoicesData ?? []
  const payments = paymentsData ?? []

  // Membership expiry check — only treat as expired if status is not active
  const memberStatus = membershipData?.status
  const expiryDate = membershipData?.duesExpiryDate ? new Date(membershipData.duesExpiryDate) : null
  const isExpired = expiryDate ? expiryDate < new Date() && memberStatus !== 'active' : false
  const daysUntilExpiry = expiryDate ? Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null

  // Derive dues status for DuesStatusCard
  const duesStatus: DuesStatusCardProps['status'] | null = (() => {
    if (!memberStatus) return null
    if (memberStatus === 'active' && daysUntilExpiry !== null && daysUntilExpiry <= 0) return 'overdue'
    if (memberStatus === 'active' && daysUntilExpiry !== null && daysUntilExpiry <= 30) return 'gracePeriod'
    if (memberStatus === 'active') return 'active'
    if (memberStatus === 'lapsed' || memberStatus === 'expired') return 'lapsed'
    if (memberStatus === 'pendingPayment') return 'pendingPayment'
    return 'active'
  })()

  // Find unpaid invoices (can submit proof for)
  const unpaidInvoices = invoices.filter(
    (inv: any) => ['generated', 'sent', 'overdue'].includes(inv.status)
  )

  // Derive timeline periods from invoices + payments
  const timelinePeriods: TimelinePeriod[] = (() => {
    const allInvoices = invoices as any[]
    return allInvoices.map((inv: any) => {
      const matchedPayment = (payments as any[]).find(
        (p: any) => p.invoiceId === inv.id && p.status === 'confirmed'
      )
      const isPaid = !!matchedPayment || inv.status === 'paid'
      const isOverdue = ['overdue'].includes(inv.status)
      const periodYear = inv.periodStart ? new Date(inv.periodStart).getFullYear() : NaN
      const year = Number.isNaN(periodYear) ? '' : String(periodYear)
      return {
        id: inv.id,
        label: year,
        amount: Number(inv.totalAmount ?? 0),
        dueDate: inv.dueDate ?? inv.periodEnd ?? '',
        status: isPaid ? 'paid' as const : isOverdue ? 'overdue' as const : 'upcoming' as const,
        paidDate: matchedPayment?.paidAt,
      }
    })
  })()

  // CSV export for payment history
  function exportPaymentsCsv() {
    if (payments.length === 0) return
    const csv = buildPaymentCsv(payments as any[])
    downloadCsv(csv, 'payment-history.csv')
  }

  // Check if any proof is already submitted for each invoice
  const submittedPaymentsByInvoice = new Map<string, any>()
  for (const p of payments) {
    if (p.invoiceId && ['submitted', 'confirmed'].includes(p.status)) {
      submittedPaymentsByInvoice.set(p.invoiceId, p)
    }
  }

  return (
    <PageShell
      title="My Dues"
      subtitle="View your dues and submit payment proof for renewal"
      breadcrumbs={[
        { label: 'Organization', href: `/org/${orgSlug}` },
        { label: 'Dues' },
      ]}
      maxWidth="default"
    >
      <div className="space-y-8">
      {/* Dues Status Summary Card */}
      {duesStatus && (
        <DuesStatusCard
          status={duesStatus}
          expiryDate={expiryDate?.toISOString()}
          nextPaymentAmount={unpaidInvoices[0]?.totalAmount}
          nextPaymentDueDate={unpaidInvoices[0]?.dueDate ?? unpaidInvoices[0]?.periodEnd}
          currency={duesConfig?.currency ?? 'PHP'}
          onPayNow={unpaidInvoices.length > 0 ? () => {
            document.getElementById('pay-dues-section')?.scrollIntoView({ behavior: 'smooth' })
          } : undefined}
        />
      )}

      {/* Arrears Breakdown */}
      {!loadingInvoices && (
        <section className="space-y-3">
          <h2 className="text-h3">Outstanding Dues</h2>
          <ArrearsBreakdown
            invoices={unpaidInvoices}
            currency={duesConfig?.currency ?? 'PHP'}
            agingBuckets={agingBucketsData ? {
              current: agingBucketsData.current ?? 0,
              thirtyDay: agingBucketsData.thirtyDay ?? 0,
              sixtyDay: agingBucketsData.sixtyDay ?? 0,
              ninetyDay: agingBucketsData.ninetyDay ?? 0,
              overNinety: agingBucketsData.overNinety ?? 0,
              totalOutstanding: agingBucketsData.totalOutstanding ?? 0,
            } : undefined}
          />
        </section>
      )}

      {/* Payment Schedule Timeline */}
      {!loadingInvoices && timelinePeriods.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-h3">Payment Timeline</h2>
          <PaymentScheduleTimeline
            periods={timelinePeriods}
            currency={duesConfig?.currency ?? 'PHP'}
          />
        </section>
      )}

      {/* Unpaid Invoices — Proof Upload */}
      {loadingInvoices ? (
        <div className="space-y-4">
          <Skeleton className="h-6 w-32 rounded-lg" />
          <Skeleton className="h-48 rounded-xl animate-shimmer" />
        </div>
      ) : unpaidInvoices.length > 0 ? (
        <section id="pay-dues-section" className="space-y-4">
          <h2 className="text-h3 flex items-center gap-2">
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
                          <CountUp value={Number(inv.totalAmount ?? 0) / 100} prefix="₱" format={(n) => n.toLocaleString('en-PH', { minimumFractionDigits: 2 })} />
                        </p>
                        <p className="text-[13px] text-[var(--color-muted)]">
                          Period: {fmtPeriod(inv.periodStart)} to {fmtPeriod(inv.periodEnd)}
                        </p>
                      </div>
                      <DuesStatusBadge type="invoice" status={inv.status} />
                    </div>

                    {existingSubmission ? (
                      <div className="rounded-sm p-4 bg-[var(--color-surface-warm)]">
                        <div className="flex items-center gap-2 text-[14px]">
                          <DuesStatusBadge type="payment" status={existingSubmission.status} />
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
                              currency={duesConfig?.currency ?? 'PHP'}
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
                          currency={duesConfig?.currency ?? 'PHP'}
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
              <AlertTriangle className="w-5 h-5 text-[var(--color-warning)] shrink-0 mt-0.5" />
              <div className="space-y-2">
                <h2 className="text-h3">Membership Period Ended</h2>
                <p className="text-[14px] text-[var(--color-muted)]">
                  Your membership period expired on{' '}
                  <span className="font-semibold text-[var(--color-text)]">
                    {expiryDate?.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </span>.
                  All previous dues have been paid. Your organization's treasurer will generate a renewal invoice for the next period.
                </p>
              </div>
            </div>

            <div className="rounded-sm p-4 space-y-3 bg-[var(--color-surface-warm)]">
              <h3 className="text-h4 flex items-center gap-2">
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

            <div className="rounded-sm p-4 flex items-start gap-3 border border-[var(--color-surface-border-glass)]">
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
            <CheckCircle className="w-5 h-5 text-[var(--color-success)] shrink-0 mt-0.5" />
            <div>
              <h2 className="text-h3">All Dues Paid</h2>
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
            <CheckCircle className="w-5 h-5 text-[var(--color-success)] shrink-0 mt-0.5" />
            <div>
              <h2 className="text-h3">All Dues Paid</h2>
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
          <div className="flex items-center justify-between">
            <h2 className="text-h3">Payment History</h2>
            <Button variant="outline" size="sm" onClick={exportPaymentsCsv} aria-label="Export payment history as CSV">
              <Download className="w-4 h-4 mr-1.5" />
              Export CSV
            </Button>
          </div>
          <GlassCard className="p-1">
            <div className="overflow-x-auto">
              <div className="space-y-1">
                {payments.slice(0, 10).map((p: any) => {
                  return (
                    <div
                      key={p.id}
                      className="flex items-center justify-between rounded-sm px-4 py-3 text-[14px] hover:bg-[var(--color-surface-elevated-hover)] transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-[12px] tabular-nums">{p.receiptNumber}</span>
                        <DuesStatusBadge type="payment" status={p.status} />
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="font-mono font-semibold tabular-nums">
                          {formatCents(p.amount, p.currency)}
                        </span>
                        <span className="text-[12px] text-[var(--color-muted)]">
                          {p.paidAt ? new Date(p.paidAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
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
    </PageShell>
  )
}
