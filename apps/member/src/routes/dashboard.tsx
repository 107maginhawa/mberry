import { createFileRoute, Link } from '@tanstack/react-router'
import { PageContainer } from '@monobase/ui'
import { StandingHero } from '@/features/dashboard/StandingHero'
import { ReceiptsTile } from '@/features/dashboard/ReceiptsTile'
import { EventsTile } from '@/features/events/EventsTile'
import { ContactOfficer } from '@/features/org/ContactOfficer'
import { SignOutButton } from '@/features/auth/SignOutButton'

export const Route = createFileRoute('/dashboard')({
  component: DashboardPage,
})

/**
 * DashboardPage — member home as a "poster" (DESIGN.md): StandingHero answers the
 * member's #1 question (standing + dues + Pay CTA) above the fold, with secondary
 * details (receipts, events, digital card) demoted below it.
 *
 * a11y: 18px base via tokens.css; the chapter name is the page h1 (inside the
 * hero); secondary section is labeled; the digital-card link is a ≥48px target.
 */
function DashboardPage() {
  return (
    <div className="min-h-screen bg-background">
      <PageContainer width="narrow" className="py-8 space-y-8">
        {/* Primary: the standing poster */}
        <StandingHero />

        {/* Secondary: supporting details, visually demoted */}
        <section className="space-y-4" aria-label="More about your membership">
          <h2 className="text-large font-semibold text-muted-foreground px-1">Details</h2>
          <ReceiptsTile />
          <EventsTile />
          <Link
            to="/card"
            className="inline-flex min-h-[48px] items-center text-body font-medium text-primary underline"
          >
            View digital card
          </Link>
          <ContactOfficer />
        </section>

        {/* Account control — the emergency exit (Nielsen #3) */}
        <footer className="pt-2">
          <SignOutButton />
        </footer>
      </PageContainer>
    </div>
  )
}
