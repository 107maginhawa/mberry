import { createFileRoute } from '@tanstack/react-router'
import { PaymentSettings } from '@/features/payment-settings/PaymentSettings'

export const Route = createFileRoute('/payment-settings')({ component: PaymentSettingsPage })

function PaymentSettingsPage() {
  return (
    <main className="mx-auto max-w-xl p-4">
      <h1 className="mb-4 text-title font-semibold text-foreground">Payment settings</h1>
      <PaymentSettings />
    </main>
  )
}
