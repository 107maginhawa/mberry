import { createFileRoute } from '@tanstack/react-router'
import { PaymentHistoryTable } from '@/features/dues/components/payment-history-table'
import { useOrgContext } from '@/hooks/useOrgContext'

export const Route = createFileRoute('/_authenticated/my/payments')({
  component: MyPaymentsPage,
})

function MyPaymentsPage() {
  const { orgId } = useOrgContext()
  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">My Payments</h1>
        <p className="text-muted-foreground">Your dues payments across all organizations.</p>
      </div>
      <PaymentHistoryTable scope="member" orgId={orgId ?? undefined} />
    </div>
  )
}
