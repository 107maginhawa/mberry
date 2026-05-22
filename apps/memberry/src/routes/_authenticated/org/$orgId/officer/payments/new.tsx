import { createFileRoute } from '@tanstack/react-router'
import { RecordPaymentForm } from '@/features/dues/components/record-payment-form'
import { PageHeader } from '@/components/patterns/page-header'
import { GlassCard } from '@/components/motion/glass-card'

export const Route = createFileRoute('/_authenticated/org/$orgId/officer/payments/new')({
  component: RecordPaymentPage,
})

function RecordPaymentPage() {
  const { orgId } = Route.useParams()

  return (
    <div className="space-y-6">
      <PageHeader
        title="Record Payment"
        subtitle="Manually record a member payment"
        breadcrumbs={[
          { label: 'Officer', href: `/org/${orgId}/officer/dashboard` },
          { label: 'Payments', href: `/org/${orgId}/officer/payments` },
          { label: 'Record Payment' },
        ]}
      />
      <GlassCard className="p-6">
        <RecordPaymentForm orgId={orgId} />
      </GlassCard>
    </div>
  )
}
