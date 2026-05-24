import { Link, useParams } from "@tanstack/react-router"
import { Home, MessageSquare, Calendar, Award, User, Vote } from "lucide-react"

const MAIN_NAV_ITEMS = [
  { to: "/dashboard", label: "Home", icon: Home },
  { to: "/messages", label: "Messages", icon: MessageSquare, orgScoped: true },
  { to: "/my/events", label: "Activities", icon: Calendar },
  { to: "/my/credits", label: "Credits", icon: Award },
  { to: "/my/profile", label: "Profile", icon: User },
] as const

export function MemberBottomNav() {
  const { orgSlug } = useParams({ strict: false }) as { orgSlug?: string }

  const resolvedItems = MAIN_NAV_ITEMS
    .map(item => {
      if ('orgScoped' in item && item.orgScoped) {
        if (!orgSlug) return null
        return { ...item, to: `/org/${orgSlug}${item.to}` }
      }
      return item
    })
    .filter(Boolean) as Array<{ to: string; label: string; icon: typeof Home }>

  const allItems = orgSlug
    ? [
        ...resolvedItems,
        { to: `/org/${orgSlug}/elections` as any, label: "Elections", icon: Vote },
      ]
    : resolvedItems

  return (
    <nav aria-label="Member navigation" className="md:hidden fixed bottom-0 left-0 right-0 h-[var(--bottom-nav-height)] bg-[var(--color-nav-elevated)] backdrop-blur-[var(--nav-blur)] border-t border-[var(--color-border-light)] flex items-center justify-around z-40">
      {allItems.map(({ to, label, icon: Icon }) => (
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
