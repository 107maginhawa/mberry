import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/my/payments')({
  component: MyPaymentsPage,
})

function MyPaymentsPage() {
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">My Payments</h1>
      <p className="text-muted-foreground">Your dues invoices and payment history across all organizations.</p>
    </div>
  )
}
