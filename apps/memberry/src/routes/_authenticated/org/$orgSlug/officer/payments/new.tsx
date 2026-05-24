import { createFileRoute } from '@tanstack/react-router'
import { RecordPaymentForm } from '@/features/dues/components/record-payment-form'
import { PageHeader } from '@/components/patterns/page-header'
import { GlassCard } from '@/components/motion/glass-card'
import { useOrg } from '@/hooks/useOrg'

export const Route = createFileRoute('/_authenticated/org/$orgSlug/officer/payments/new')({
  component: RecordPaymentPage,
})

function RecordPaymentPage() {
  const { orgId, orgSlug } = useOrg()

  return (
    <div className="space-y-6">
      <PageHeader
        title="Record Payment"
        subtitle="Manually record a member payment"
        breadcrumbs={[
          { label: 'Officer', href: `/org/${orgSlug}/officer/dashboard` },
          { label: 'Payments', href: `/org/${orgSlug}/officer/payments` },
          { label: 'Record Payment' },
        ]}
      />
      <GlassCard className="p-6">
        <RecordPaymentForm orgId={orgId} />
      </GlassCard>
    </div>
  )
}
