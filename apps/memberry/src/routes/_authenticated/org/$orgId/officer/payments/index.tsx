import { createFileRoute, Link } from '@tanstack/react-router'
import { useMutation } from '@tanstack/react-query'
import { generateDuesInvoicesForOrgMutation } from '@monobase/sdk-ts/generated/react-query'
import { Button } from '@monobase/ui'
import { FinancialDashboard } from '@/features/dues/components/financial-dashboard'
import { PaymentHistoryTable } from '@/features/dues/components/payment-history-table'
import { PendingProofsList } from '@/features/dues/components/pending-proofs-list'
import { Plus, Bell } from 'lucide-react'
import { toast } from 'sonner'

export const Route = createFileRoute('/_authenticated/org/$orgId/officer/payments/')({
  component: OfficerPaymentsPage,
})

function OfficerPaymentsPage() {
  const { orgId } = Route.useParams()

  const genInvoicesMutOpts = generateDuesInvoicesForOrgMutation()
  const genInvoicesMutation = useMutation({
    ...genInvoicesMutOpts,
    onSuccess: (data: any) => {
      const count = data?.data?.length ?? 0
      toast.success('Dues reminders sent', {
        description: count > 0 ? `${count} reminders queued` : 'Reminder batch queued for processing',
      })
    },
    onError: () => {
      toast.error('Failed to send reminders')
    },
  })

  const sending = genInvoicesMutation.isPending

  function handleSendReminders() {
    const now = new Date()
    const periodStart = new Date(now.getFullYear(), 0, 1)
    const periodEnd = new Date(now.getFullYear(), 11, 31)
    genInvoicesMutation.mutate({
      body: { organizationId: orgId, periodStart, periodEnd },
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-[24px] font-display font-bold">Dues & Payments</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleSendReminders} disabled={sending}>
            <Bell className="h-4 w-4 mr-2" />
            {sending ? 'Sending...' : 'Send Reminders'}
          </Button>
          <Link to="/org/$orgId/officer/payments/new" params={{ orgId }}>
            <Button><Plus className="h-4 w-4 mr-2" /> Record Payment</Button>
          </Link>
        </div>
      </div>
      <FinancialDashboard orgId={orgId} />
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Pending Payment Proofs</h2>
        <PendingProofsList orgId={orgId} />
      </section>
      <PaymentHistoryTable orgId={orgId} scope="org" />
    </div>
  )
}
