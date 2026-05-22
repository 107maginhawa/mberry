import { Link } from "@tanstack/react-router"
import { Home, Calendar, Award, User } from "lucide-react"

const NAV_ITEMS = [
  { to: "/dashboard", label: "Home", icon: Home },
  { to: "/my/events", label: "Activities", icon: Calendar },
  { to: "/my/credits", label: "Credits", icon: Award },
  { to: "/my/profile", label: "Profile", icon: User },
] as const

interface MemberSidebarProps {
  userEmail?: string
}

export function MemberSidebar({ userEmail }: MemberSidebarProps) {
  return (
    <aside className="hidden md:flex w-[180px] bg-[var(--color-surface)] border-r border-[var(--color-border-light)] flex-col shrink-0">
      {/* Logo */}
      <div className="px-4 py-3 border-b border-[var(--color-border-light)]">
        <img src="/memberry-logo.png" alt="Memberry" className="h-10 w-auto" />
      </div>

      {/* Navigation */}
      <nav aria-label="Member navigation" className="flex-1 py-3">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className="flex items-center gap-2.5 px-5 py-2.5 text-[14px] text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-warm)] transition-colors duration-150"
            activeProps={{
              className:
                "flex items-center gap-2.5 px-5 py-2.5 text-[14px] text-[var(--color-primary)] font-semibold border-l-[3px] border-[var(--color-primary)] pl-[17px]",
            }}
          >
            <Icon size={18} className="shrink-0" />
            {label}
          </Link>
        ))}
      </nav>

      {/* User */}
      <div className="px-5 py-3 border-t border-[var(--color-border-light)]">
        <p className="text-[11px] text-[var(--color-muted)] truncate">{userEmail}</p>
      </div>
    </aside>
  )
}
