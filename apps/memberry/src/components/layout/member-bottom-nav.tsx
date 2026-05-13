import { Link } from "@tanstack/react-router"
import { Home, Calendar, Award, User } from "lucide-react"

const NAV_ITEMS = [
  { to: "/dashboard", label: "Home", icon: Home },
  { to: "/my/events", label: "Activities", icon: Calendar },
  { to: "/my/credits", label: "Credits", icon: Award },
  { to: "/my/profile", label: "Profile", icon: User },
] as const

export function MemberBottomNav() {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 h-[68px] bg-[var(--color-nav-elevated)] backdrop-blur-[var(--nav-blur)] border-t border-[var(--color-border-light)] flex items-center justify-around z-40">
      {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
        <Link
          key={to}
          to={to}
          className="flex flex-col items-center gap-[3px] text-[var(--color-muted)]"
          activeProps={{ className: "flex flex-col items-center gap-[3px] text-[var(--color-primary)]" }}
        >
          <Icon size={22} />
          <span className="text-[11px] font-medium">{label}</span>
        </Link>
      ))}
    </nav>
  )
}
