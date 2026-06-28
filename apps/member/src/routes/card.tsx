import { createFileRoute, Link } from '@tanstack/react-router'
import { IdCardView } from '@/features/card/IdCardView'

export const Route = createFileRoute('/card')({ component: CardPage })

function CardPage() {
  return (
    <main className="mx-auto max-w-md p-4">
      <Link to="/dashboard" className="mb-4 inline-flex min-h-tap items-center text-body font-medium text-primary underline">
        ← Back to dashboard
      </Link>
      <h1 className="mb-4 text-section font-semibold text-foreground">Your digital card</h1>
      <IdCardView />
    </main>
  )
}
