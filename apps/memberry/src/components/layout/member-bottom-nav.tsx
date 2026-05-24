import { Link, useParams } from "@tanstack/react-router"
import { Home, MessageSquare, Calendar, Award, User, Receipt, Landmark } from "lucide-react"

const PERSONAL_NAV = [
  { to: "/dashboard", label: "Home", icon: Home },
  { to: "/my/events", label: "Events", icon: Calendar },
  { to: "/my/credits", label: "Credits", icon: Award },
  { to: "/my/profile", label: "Profile", icon: User },
]

function buildOrgNav(orgSlug: string) {
  const base = `/org/${orgSlug}`
  return [
    { to: `${base}/home`, label: "Home", icon: Home },
    { to: `${base}/events`, label: "Events", icon: Calendar },
    { to: `${base}/dues`, label: "Dues", icon: Receipt },
    { to: `${base}/messages`, label: "Messages", icon: MessageSquare },
    { to: `${base}/governance`, label: "More", icon: Landmark },
  ]
}

export function MemberBottomNav() {
  const { orgSlug } = useParams({ strict: false }) as { orgSlug?: string }

  const items = orgSlug ? buildOrgNav(orgSlug) : PERSONAL_NAV

  return (
    <nav aria-label="Member navigation" className="md:hidden fixed bottom-0 left-0 right-0 h-[var(--bottom-nav-height)] bg-[var(--color-nav-elevated)] backdrop-blur-[var(--nav-blur)] border-t border-[var(--color-border-light)] flex items-center justify-around z-40">
      {items.map(({ to, label, icon: Icon }) => (
        <Link
          key={to}
          to={to}
          className="flex flex-col items-center justify-center gap-[3px] min-w-[44px] min-h-[44px] text-[var(--color-muted)]"
          activeProps={{ className: "flex flex-col items-center justify-center gap-[3px] min-w-[44px] min-h-[44px] text-[var(--color-primary)]" }}
          activeOptions={{ exact: false }}
        >
          <Icon size={22} />
          <span className="text-xs font-medium">{label}</span>
        </Link>
      ))}
    </nav>
  )
}
