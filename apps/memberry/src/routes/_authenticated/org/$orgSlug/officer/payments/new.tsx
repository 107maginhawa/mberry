import { createFileRoute } from '@tanstack/react-router'
import { RecordPaymentForm } from '@/features/dues/components/record-payment-form'
import { PageShell } from '@/components/patterns/page-shell'
import { GlassCard } from '@/components/motion/glass-card'
import { useOrg } from '@/hooks/use-org'

export const Route = createFileRoute('/_authenticated/org/$orgSlug/officer/payments/new')({
  component: RecordPaymentPage,
})

function RecordPaymentPage() {
  const { orgId, orgSlug } = useOrg()

  return (
    <PageShell
      title="Record Payment"
      subtitle="Manually record a member payment"
      breadcrumbs={[
        { label: 'Officer', href: `/org/${orgSlug}/officer/dashboard` },
        { label: 'Payments', href: `/org/${orgSlug}/officer/payments` },
        { label: 'Record Payment' },
      ]}
    >
      <GlassCard className="p-6">
        <RecordPaymentForm orgId={orgId} />
      </GlassCard>
    </PageShell>
  )
}
