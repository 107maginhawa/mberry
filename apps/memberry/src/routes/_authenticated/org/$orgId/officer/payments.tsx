import { createFileRoute, Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { FinancialDashboard } from '@/features/dues/components/financial-dashboard'
import { PaymentHistoryTable } from '@/features/dues/components/payment-history-table'
import { Plus } from 'lucide-react'

export const Route = createFileRoute('/_authenticated/org/$orgId/officer/payments')({
  component: OfficerPaymentsPage,
})

function OfficerPaymentsPage() {
  const { orgId } = Route.useParams()

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dues & Payments</h1>
        <Link to="/org/$orgId/officer/payments/new" params={{ orgId }}>
          <Button><Plus className="h-4 w-4 mr-2" /> Record Payment</Button>
        </Link>
      </div>

      <FinancialDashboard orgId={orgId} />
      <PaymentHistoryTable orgId={orgId} scope="org" />
    </div>
  )
}
