import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { listDuesInvoicesOptions } from '@monobase/sdk-ts/generated/react-query'
import { PaymentHistoryTable } from '@/features/dues/components/payment-history-table'
import { PayDuesCta } from '@/features/dues/components/pay-dues-cta'
import { useOrgContext } from '@/hooks/use-org-context'
import { useMyOrgs } from '@/hooks/use-my-orgs'
import { PageShell } from '@/components/patterns/page-shell'
import { GlassCard } from '@/components/motion/glass-card'

export const Route = createFileRoute('/_authenticated/my/payments')({
  component: MyPaymentsPage,
})

function MyPaymentsPage() {
  const { orgId } = useOrgContext()
  const { orgs } = useMyOrgs()
  const orgSlug = orgId ? orgs.find((o) => o.organizationId === orgId)?.orgSlug : undefined

  // [FIX-009 / Q-PD8] Resolve the member's open invoices for the active org so the
  // page is a reachable "Pay Now" entry point (member role self-scopes per FIX-006).
  const invoicesQuery = useQuery({
    ...listDuesInvoicesOptions({ query: { organizationId: orgId ?? '', limit: 50 } }),
    enabled: !!orgId,
    select: (d: any) => d?.data ?? [],
  })
  const openInvoices = ((invoicesQuery.data as any[]) ?? []).filter((inv) =>
    ['generated', 'sent', 'overdue'].includes(inv.status),
  )
  const amountDueCents = openInvoices.reduce((sum, inv) => sum + Number(inv.totalAmount ?? 0), 0)

  return (
    <PageShell
      title="My Payments"
      subtitle="Your dues payments across all organizations"
      breadcrumbs={[
        { label: 'My Account' },
        { label: 'Payments' },
      ]}
      maxWidth="wide"
    >
      <div className="space-y-6">
        <PayDuesCta
          openInvoiceCount={openInvoices.length}
          orgSlug={orgSlug}
          amountDueCents={amountDueCents}
        />
        <GlassCard className="p-1">
          <PaymentHistoryTable scope="member" orgId={orgId ?? undefined} />
        </GlassCard>
      </div>
    </PageShell>
  )
}
