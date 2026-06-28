import { Link } from '@tanstack/react-router'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  StatusBadge,
  type StatusBadgeVariant,
  EmptyState,
  ErrorState,
  Skeleton,
  centavosToPhp,
} from '@monobase/ui'
import { useDuesDashboard, useRecentPayments, useOutstandingInvoices, type DuesStats } from './use-dues'
import { useSelectedOrg } from '../org/use-org'

// ─── Badge helpers ───────────────────────────────────────────────────────────

function paymentVariant(status: string): StatusBadgeVariant {
  if (status === 'completed' || status === 'confirmed') return 'success'
  if (status === 'pending' || status === 'submitted' || status === 'underReview') return 'warning'
  if (status === 'failed' || status === 'rejected' || status === 'expired') return 'error'
  return 'muted'
}

function invoiceVariant(status: string): StatusBadgeVariant {
  if (status === 'paid') return 'success'
  if (status === 'sent' || status === 'generated') return 'info'
  if (status === 'overdue') return 'error'
  return 'muted'
}

// Friendly labels — never leak the raw enum to members (DESIGN.md). Unknown
// values fall back to the raw string.
const PAYMENT_LABEL: Record<string, string> = {
  completed: 'Completed',
  confirmed: 'Confirmed',
  pending: 'Pending',
  submitted: 'Submitted',
  underReview: 'Under review',
  failed: 'Failed',
  rejected: 'Rejected',
  expired: 'Expired',
}

const INVOICE_LABEL: Record<string, string> = {
  paid: 'Paid',
  sent: 'Sent',
  generated: 'Generated',
  overdue: 'Overdue',
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface Payment {
  id: string
  amount: number
  status: string
  [k: string]: unknown
}

interface Invoice {
  id: string
  amount: number
  status: string
  memberName?: string
  [k: string]: unknown
}

export interface DuesViewProps {
  stats: DuesStats
  payments: Payment[]
  invoices: Invoice[]
  paymentsError?: boolean
  invoicesError?: boolean
  onRetryPayments?: () => void
  onRetryInvoices?: () => void
}

// ─── Presentational ──────────────────────────────────────────────────────────

export function DuesView({
  stats,
  payments,
  invoices,
  paymentsError,
  invoicesError,
  onRetryPayments,
  onRetryInvoices,
}: DuesViewProps) {
  return (
    <div className="flex flex-col gap-6 p-4">
      <h1 className="text-title font-semibold text-foreground">Dues</h1>

      {/* Dashboard tiles */}
      <section aria-label="Dues summary" className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-caption text-muted-foreground">Collected</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="tabular-amount text-section font-semibold">{centavosToPhp(stats.totalCollected)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-caption text-muted-foreground">Outstanding</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="tabular-amount text-section font-semibold">{centavosToPhp(stats.totalOutstanding)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-caption text-muted-foreground">Collection Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-section font-semibold">{stats.collectionRate}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-caption text-muted-foreground">Payments received</CardTitle>
          </CardHeader>
          <CardContent>
            {/* paidCount is the count of paid invoices (across periods), not distinct members —
                showing it over memberCount produced a misleading >100% ratio (e.g. "106 / 26"). */}
            <p className="text-section font-semibold">{stats.paidCount}</p>
            {stats.overdueCount > 0 && (
              <p className="text-caption text-error">{stats.overdueCount} overdue</p>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Recent payments */}
      <section aria-label="Recent payments">
        <h2 className="text-section font-semibold mb-3">Recent payments</h2>
        {paymentsError ? (
          <ErrorState message="We couldn't load payments." onRetry={onRetryPayments} />
        ) : payments.length === 0 ? (
          <EmptyState
            headline="No payments yet"
            description="Payments will appear here once members pay their dues."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {payments.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between rounded-lg border border-[var(--color-border-light)] bg-surface px-4 py-3"
              >
                <StatusBadge variant={paymentVariant(p.status)}>{PAYMENT_LABEL[p.status] ?? p.status}</StatusBadge>
                <span className="tabular-amount text-body font-medium">{centavosToPhp(p.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Outstanding invoices */}
      {invoicesError ? (
        <section aria-label="Outstanding invoices">
          <h2 className="text-section font-semibold mb-3">Outstanding invoices</h2>
          <ErrorState message="We couldn't load invoices." onRetry={onRetryInvoices} />
        </section>
      ) : invoices.length > 0 ? (
        <section aria-label="Outstanding invoices">
          <h2 className="text-section font-semibold mb-3">Outstanding invoices</h2>
          <ul className="flex flex-col gap-2">
            {invoices.map((inv) => (
              <li
                key={inv.id}
                className="flex items-center justify-between rounded-lg border border-[var(--color-border-light)] bg-surface px-4 py-3"
              >
                <div className="flex flex-col gap-1">
                  {inv.memberName && (
                    <span className="text-body font-medium text-foreground">{inv.memberName}</span>
                  )}
                  <StatusBadge variant={invoiceVariant(inv.status)}>{INVOICE_LABEL[inv.status] ?? inv.status}</StatusBadge>
                </div>
                <span className="tabular-amount text-body font-medium">{centavosToPhp(inv.amount)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}

// ─── Container ───────────────────────────────────────────────────────────────

export function Dues() {
  const { orgId } = useSelectedOrg()
  const { data: stats, isLoading: statsLoading } = useDuesDashboard(orgId)
  const { data: payments = [], isLoading: paymentsLoading, isError: paymentsError, refetch: refetchPayments } = useRecentPayments(orgId)
  const { data: invoices = [], isLoading: invoicesLoading, isError: invoicesError, refetch: refetchInvoices } = useOutstandingInvoices(orgId)

  if (statsLoading || paymentsLoading || invoicesLoading) {
    return (
      <div className="min-h-screen bg-[var(--color-bg)]">
        <div className="max-w-lg mx-auto pt-4">
          <div className="flex flex-col gap-6 p-4" role="status" aria-label="Loading dues">
            <Skeleton className="h-8 w-32" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 w-full rounded-lg" />
              ))}
            </div>
            <Skeleton className="h-6 w-40" />
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="min-h-screen bg-[var(--color-bg)]">
        <div className="max-w-lg mx-auto pt-4 p-4">
          <Link to="/" className="inline-flex min-h-tap items-center text-body font-medium text-primary underline">
            Roster
          </Link>
          <p className="mt-4 text-body text-muted-foreground">Could not load dues data.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <div className="max-w-lg mx-auto pt-4">
        <DuesView
          stats={stats}
          payments={payments}
          invoices={invoices}
          paymentsError={paymentsError}
          invoicesError={invoicesError}
          onRetryPayments={() => void refetchPayments()}
          onRetryInvoices={refetchInvoices}
        />
      </div>
    </div>
  )
}
