import { createFileRoute } from '@tanstack/react-router'
import { PaymentHistoryTable } from '@/features/dues/components/payment-history-table'
import { useOrgContext } from '@/hooks/use-org-context'
import { PageShell } from '@/components/patterns/page-shell'
import { GlassCard } from '@/components/motion/glass-card'

export const Route = createFileRoute('/_authenticated/my/payments')({
  component: MyPaymentsPage,
})

function MyPaymentsPage() {
  const { orgId } = useOrgContext()
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
        <GlassCard className="p-1">
          <PaymentHistoryTable scope="member" orgId={orgId ?? undefined} />
        </GlassCard>
      </div>
    </PageShell>
  )
}
