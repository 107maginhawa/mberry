import { createFileRoute, Link } from '@tanstack/react-router'
import { PaymentSettings } from '@/features/payment-settings/PaymentSettings'

export const Route = createFileRoute('/payment-settings')({ component: PaymentSettingsPage })

function PaymentSettingsPage() {
  return (
    <main className="mx-auto max-w-xl p-4">
      <Link
        to="/"
        className="mb-4 inline-flex min-h-[48px] items-center text-body font-medium text-primary underline"
      >
        ← Back to dashboard
      </Link>
      <PaymentSettings />
    </main>
  )
}
