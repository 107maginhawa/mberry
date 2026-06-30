import { createFileRoute, Link } from '@tanstack/react-router'
import { NavIcon } from '@monobase/ui'
import { Upload, Wallet, Megaphone, CreditCard, ChevronRight } from '@monobase/ui/icons'

export const Route = createFileRoute('/more')({ component: MorePage })

// "More" hub: the low-frequency officer tools that don't earn a top tab
// (Members + Events do). One primary task — pick a tool — so each row is a big,
// labeled tap target (DESIGN.md ≥48px, icon + text). Dues lives here until
// Slice 3 folds it into member detail (money is a property of a member).
const TOOLS = [
  { to: '/import', label: 'Import roster', desc: 'Add members from a CSV file', icon: Upload },
  { to: '/dues', label: 'Dues', desc: 'Outstanding dues and invoices', icon: Wallet },
  { to: '/announcements', label: 'Announcements', desc: 'Post updates to your chapter', icon: Megaphone },
  { to: '/payment-settings', label: 'Payment settings', desc: 'Connect your PayMongo account', icon: CreditCard },
] as const

function MorePage() {
  return (
    <main className="mx-auto max-w-xl p-4 flex flex-col gap-4">
      <h1 className="text-title font-semibold text-foreground">More</h1>
      <nav aria-label="Tools" className="flex flex-col gap-2">
        {TOOLS.map((t) => (
          <Link
            key={t.to}
            to={t.to}
            className="flex min-h-tap items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 hover:bg-[var(--color-surface-warm)]"
          >
            <NavIcon icon={t.icon} size="lg" className="text-primary" aria-hidden />
            <span className="flex-1">
              <span className="block text-body font-medium text-foreground">{t.label}</span>
              <span className="block text-caption text-muted-foreground">{t.desc}</span>
            </span>
            <NavIcon icon={ChevronRight} size="sm" className="text-muted-foreground" aria-hidden />
          </Link>
        ))}
      </nav>
    </main>
  )
}
