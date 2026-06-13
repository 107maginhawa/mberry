import { Link } from '@tanstack/react-router'
import { Button } from '@monobase/ui'
import { CreditCard } from 'lucide-react'
import { formatCents } from '@/features/dues/lib/money'

/**
 * [FIX-009 / Q-PD8] Member "Pay Now" entry point.
 *
 * The cross-org "My Payments" page otherwise dead-ends at payment history with
 * no path to pay. This CTA surfaces outstanding dues and routes the member to
 * the org dues page's self-serve proof-submit flow (`/org/$orgSlug/dues`,
 * `#pay-dues-section`). Renders nothing when there are no open invoices or when
 * there is no resolvable org context.
 */
export interface PayDuesCtaProps {
  /** Number of unpaid (generated/sent/overdue) invoices the member has. */
  openInvoiceCount: number
  /** Slug used to route to the org dues page. */
  orgSlug?: string | null
  /** Total amount due in centavos (optional — for the headline). */
  amountDueCents?: number
  currency?: string
}

export function PayDuesCta({
  openInvoiceCount,
  orgSlug,
  amountDueCents,
  currency = 'PHP',
}: PayDuesCtaProps) {
  if (openInvoiceCount <= 0 || !orgSlug) return null

  const plural = openInvoiceCount === 1 ? 'invoice' : 'invoices'

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-warm)] p-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <CreditCard className="w-5 h-5 shrink-0 mt-0.5 text-[var(--color-accent)]" />
        <div>
          <p className="text-h4">You have {openInvoiceCount} unpaid {plural}</p>
          <p className="text-[13px] text-[var(--color-muted)]">
            {typeof amountDueCents === 'number'
              ? `${formatCents(amountDueCents, currency)} outstanding — pay now to keep your membership current.`
              : 'Pay now to keep your membership current.'}
          </p>
        </div>
      </div>
      <Button asChild>
        <Link to="/org/$orgSlug/dues" params={{ orgSlug }} hash="pay-dues-section">
          Pay Now
        </Link>
      </Button>
    </div>
  )
}
