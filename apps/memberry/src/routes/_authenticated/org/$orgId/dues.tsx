import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { listDuesInvoicesOptions, listDuesPaymentsOptions } from '@monobase/sdk-ts/generated/react-query'
import { Badge } from '@monobase/ui'
import { Skeleton } from '@monobase/ui'
import { formatCents } from '@/features/dues/lib/money'
import { ProofUploadForm } from '@/features/dues/components/proof-upload-form'
import { api } from '@/lib/api'
import { CreditCard, Clock, CheckCircle, XCircle, AlertTriangle, Info, Building } from 'lucide-react'

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
    <div className="p-6 space-y-8 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">My Dues</h1>
        <p className="text-sm text-muted-foreground">
          View your dues and submit payment proof for renewal.
        </p>
      </div>

      {/* Unpaid Invoices — Proof Upload */}
      {loadingInvoices ? (
        <Skeleton className="h-48 rounded-xl" />
      ) : unpaidInvoices.length > 0 ? (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Pay Dues
          </h2>
          {unpaidInvoices.map((inv: any) => {
            const existingSubmission = submittedPaymentsByInvoice.get(inv.id)
            return (
              <div
                key={inv.id}
                className="rounded-xl p-5 space-y-4"
                style={{ border: '1px solid var(--color-border-light)' }}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-mono text-sm text-muted-foreground">{inv.invoiceNumber}</p>
                    <p className="text-2xl font-bold font-mono">
                      {formatCents(inv.totalAmount, 'PHP')}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Period: {inv.periodStart} to {inv.periodEnd}
                    </p>
                  </div>
                  <Badge className={STATUS_BADGE[inv.status]?.className ?? ''}>
                    {STATUS_BADGE[inv.status]?.label ?? inv.status}
                  </Badge>
                </div>

                {existingSubmission ? (
                  <div
                    className="rounded-lg p-4"
                    style={{ backgroundColor: 'var(--color-surface-warm)' }}
                  >
                    <div className="flex items-center gap-2 text-sm">
                      {(() => {
                        const s = PAYMENT_STATUS_BADGE[existingSubmission.status]
                        const Icon = s?.icon ?? Clock
                        return (
                          <>
                            <Icon className="h-4 w-4" />
                            <span className="font-medium">
                              Payment {s?.label ?? existingSubmission.status}
                            </span>
                          </>
                        )
                      })()}
                    </div>
                    {existingSubmission.status === 'rejected' && existingSubmission.rejectionReason && (
                      <p className="text-sm text-destructive mt-2">
                        Reason: {existingSubmission.rejectionReason}
                      </p>
                    )}
                    {existingSubmission.status === 'rejected' && (
                      <div className="mt-3">
                        <p className="text-sm text-muted-foreground mb-2">
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
                    <p className="text-sm text-muted-foreground mb-3">
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
              </div>
            )
          })}
        </section>
      ) : isExpired ? (
        <section className="space-y-4">
          <div
            className="rounded-xl p-5 space-y-4"
            style={{ border: '1px solid var(--color-border-light)' }}
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="space-y-2">
                <h2 className="text-lg font-semibold">Membership Period Ended</h2>
                <p className="text-sm text-muted-foreground">
                  Your membership period expired on{' '}
                  <span className="font-medium text-foreground">
                    {expiryDate?.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </span>.
                  All previous dues have been paid. Your organization's treasurer will generate a renewal invoice for the next period.
                </p>
              </div>
            </div>

            <div
              className="rounded-lg p-4 space-y-3"
              style={{ backgroundColor: 'var(--color-surface-warm)' }}
            >
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Info className="w-4 h-4" />
                How Renewal Works
              </h3>
              <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                <li>Your chapter treasurer generates a renewal invoice for the next membership period</li>
                <li>You'll receive a notification when your invoice is ready</li>
                <li>Pay via GCash, bank transfer, or other accepted methods and upload your receipt here</li>
                <li>A chapter officer reviews and confirms your payment</li>
                <li>Your membership is renewed and your new expiry date is updated</li>
              </ol>
              {duesConfig?.amount && (
                <p className="text-sm font-medium mt-2">
                  Annual dues: <span className="font-bold text-[var(--color-primary)]">{formatCents(duesConfig.amount, duesConfig.currency ?? 'PHP')}</span>
                </p>
              )}
            </div>

            <div
              className="rounded-lg p-4 flex items-start gap-3"
              style={{ border: '1px solid var(--color-border-light)' }}
            >
              <Building className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium">Need to renew immediately?</p>
                <p className="text-muted-foreground">
                  Contact your chapter treasurer or organization officer to request a renewal invoice.
                </p>
              </div>
            </div>
          </div>
        </section>
      ) : daysUntilExpiry !== null && daysUntilExpiry > 0 && daysUntilExpiry <= 60 ? (
        <div
          className="rounded-xl p-5"
          style={{ border: '1px solid var(--color-border-light)' }}
        >
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
            <div>
              <h2 className="text-lg font-semibold">All Dues Paid</h2>
              <p className="text-sm text-muted-foreground">
                Your membership is current through{' '}
                <span className="font-medium text-foreground">
                  {expiryDate?.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}
                </span>
                {' '}({daysUntilExpiry} day{daysUntilExpiry !== 1 ? 's' : ''} remaining).
                A renewal invoice will be generated before your membership period ends.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div
          className="rounded-xl p-5"
          style={{ border: '1px solid var(--color-border-light)' }}
        >
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
            <div>
              <h2 className="text-lg font-semibold">All Dues Paid</h2>
              <p className="text-sm text-muted-foreground">
                No outstanding dues.{expiryDate && (
                  <> Your membership is current through{' '}
                  <span className="font-medium text-foreground">
                    {expiryDate.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </span>.</>
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Recent Payment History */}
      {loadingPayments ? (
        <Skeleton className="h-32 rounded-xl" />
      ) : payments.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Payment History</h2>
          <div className="space-y-2">
            {payments.slice(0, 10).map((p: any) => {
              const s = PAYMENT_STATUS_BADGE[p.status]
              return (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-lg px-4 py-3 text-sm"
                  style={{ border: '1px solid var(--color-border-light)' }}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs">{p.receiptNumber}</span>
                    <Badge className={s?.className ?? 'bg-gray-100 text-gray-600'}>
                      {s?.label ?? p.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-mono font-medium">
                      {formatCents(p.amount, p.currency)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {p.paidAt ? new Date(p.paidAt).toLocaleDateString() : '—'}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
