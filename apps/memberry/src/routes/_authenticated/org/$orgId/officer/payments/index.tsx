import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { FinancialDashboard } from '@/features/dues/components/financial-dashboard'
import { PaymentHistoryTable } from '@/features/dues/components/payment-history-table'
import { Plus, Bell } from 'lucide-react'
import { toast } from 'sonner'

export const Route = createFileRoute('/_authenticated/org/$orgId/officer/payments/')({
  component: OfficerPaymentsPage,
})

function OfficerPaymentsPage() {
  const { orgId } = Route.useParams()
  const [sending, setSending] = useState(false)

  async function handleSendReminders() {
    setSending(true)
    try {
      const data = await api.post<{ count: number }>('/api/association/member/dues-invoices/generate', { organizationId: orgId })
      toast.success('Dues reminders sent', {
        description: data.count > 0 ? `${data.count} reminders queued` : 'Reminder batch queued for processing',
      })
    } catch {
      toast.error('Failed to send reminders')
    } finally {
      setSending(false)
    }
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
      <PaymentHistoryTable orgId={orgId} scope="org" />
    </div>
  )
}
