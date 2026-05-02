import { createFileRoute } from '@tanstack/react-router'
import { RecordPaymentForm } from '@/features/dues/components/record-payment-form'

export const Route = createFileRoute('/_authenticated/org/$orgId/officer/payments/new')({
  component: RecordPaymentPage,
})

function RecordPaymentPage() {
  const { orgId } = Route.useParams()

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Record Payment</h1>
      <RecordPaymentForm orgId={orgId} />
    </div>
  )
}
