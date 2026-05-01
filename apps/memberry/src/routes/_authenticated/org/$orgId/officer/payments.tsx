import { createFileRoute } from '@tanstack/react-router'
import { DuesInvoiceList } from '@/features/dues/components/dues-invoice-list'

export const Route = createFileRoute('/_authenticated/org/$orgId/officer/payments')({
  component: PaymentsPage,
})

function PaymentsPage() {
  const { orgId } = Route.useParams()

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Dues & Payments</h1>
      <DuesInvoiceList orgId={orgId} tenantId={orgId} />
    </div>
  )
}
