import { createFileRoute, Link } from '@tanstack/react-router'
import { useMutation } from '@tanstack/react-query'
import { generateDuesInvoicesForOrgMutation } from '@monobase/sdk-ts/generated/react-query'
import { Button } from '@monobase/ui'
import { FinancialDashboard } from '@/features/dues/components/financial-dashboard'
import { PaymentHistoryTable } from '@/features/dues/components/payment-history-table'
import { PendingProofsList } from '@/features/dues/components/pending-proofs-list'
import { PageShell } from '@/components/patterns/page-shell'
import { GlassCard } from '@/components/motion/glass-card'
import { Plus, Bell } from 'lucide-react'
import { toast } from 'sonner'
import { extractErrorMessage } from '@/utils/error'
import { useOrg } from '@/hooks/useOrg'

export const Route = createFileRoute('/_authenticated/org/$orgSlug/officer/payments/')({
  component: OfficerPaymentsPage,
})

function OfficerPaymentsPage() {
  const { orgId, orgSlug } = useOrg()

  const genInvoicesMutOpts = generateDuesInvoicesForOrgMutation()
  const genInvoicesMutation = useMutation({
    ...genInvoicesMutOpts,
    onSuccess: (data: any) => {
      const count = data?.data?.length ?? 0
      toast.success('Dues reminders sent', {
        description: count > 0 ? `${count} reminders queued` : 'Reminder batch queued for processing',
      })
    },
    onError: (err) => {
      toast.error('Failed to send reminders', { description: extractErrorMessage(err, 'Please try again.') })
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
    <PageShell
      title="Dues & Payments"
      subtitle="Manage dues collection and payment records"
      breadcrumbs={[
        { label: 'Officer', href: `/org/${orgSlug}/officer/dashboard` },
        { label: 'Payments' },
      ]}
      actions={
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleSendReminders} disabled={sending}>
            <Bell className="h-4 w-4 mr-2" />
            {sending ? 'Sending...' : 'Send Reminders'}
          </Button>
          <Link to="/org/$orgSlug/officer/payments/new" params={{ orgSlug }}>
            <Button><Plus className="h-4 w-4 mr-2" /> Record Payment</Button>
          </Link>
        </div>
      }
    >
      <div className="space-y-6">
        <FinancialDashboard orgId={orgId} />
        <GlassCard className="p-5">
          <h2 className="text-h4 mb-3">Pending Payment Proofs</h2>
          <PendingProofsList orgId={orgId} />
        </GlassCard>
        <PaymentHistoryTable orgId={orgId} scope="org" />
      </div>
    </PageShell>
  )
}
