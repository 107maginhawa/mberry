import { createFileRoute, Link } from '@tanstack/react-router'
import { useSession } from '@/features/auth/use-session'
import { MembershipTile } from '@/features/dashboard/MembershipTile'
import { DuesOwedTile } from '@/features/dashboard/DuesOwedTile'
import { ReceiptsTile } from '@/features/dashboard/ReceiptsTile'
import { EventsTile } from '@/features/events/EventsTile'

export const Route = createFileRoute('/dashboard')({
  component: DashboardPage,
})

/**
 * DashboardPage — read-only member dashboard. Three tiles: membership status,
 * dues owed, payment receipts. One primary screen (DESIGN.md).
 *
 * a11y: 18px base via tokens.css, min-h-tap on interactive elements (tiles are
 * informational — no tap targets needed here), labeled sections via headings.
 */
function DashboardPage() {
  const { memberships } = useSession()
  // Greeting: use first membership's orgName if available, fall back to generic.
  const firstMembership = memberships && memberships.length > 0 ? memberships[0] : null
  const orgName = firstMembership
    ? (firstMembership as { orgName?: string | null }).orgName ?? null
    : null

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Header — member greeting */}
        <header className="space-y-1">
          <h1 className="text-section font-bold text-foreground">
            {orgName ? `Welcome, ${orgName} member` : 'My Dashboard'}
          </h1>
          <p className="text-body text-muted-foreground">
            Your membership summary
          </p>
        </header>

        {/* Tiles — one primary screen, stacked for mobile-first */}
        <main className="space-y-4">
          <MembershipTile />
          <DuesOwedTile />
          <ReceiptsTile />
          <EventsTile />
          <Link
            to="/card"
            className="inline-flex min-h-[48px] items-center text-body font-medium text-primary underline"
          >
            View digital card
          </Link>
        </main>
      </div>
    </div>
  )
}
