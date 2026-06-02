import { createFileRoute } from '@tanstack/react-router'
import { PageContainer } from '@monobase/ui'
import { PaymentHistoryTable } from '@/features/dues/components/payment-history-table'
import { useOrgContext } from '@/hooks/useOrgContext'
import { PageHeader } from '@/components/patterns/page-header'
import { GlassCard } from '@/components/motion/glass-card'

export const Route = createFileRoute('/_authenticated/my/payments')({
  component: MyPaymentsPage,
})

function MyPaymentsPage() {
  const { orgId } = useOrgContext()
  return (
    <PageContainer width="wide" className="space-y-6">
      <PageHeader
        title="My Payments"
        subtitle="Your dues payments across all organizations"
        breadcrumbs={[
          { label: 'My Account' },
          { label: 'Payments' },
        ]}
      />
      <GlassCard className="p-1">
        <PaymentHistoryTable scope="member" orgId={orgId ?? undefined} />
      </GlassCard>
    </PageContainer>
  )
}
