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
    <aside className="hidden md:flex w-[250px] bg-[var(--color-primary)] text-white flex-col shrink-0">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-white/[0.12]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-[var(--color-cream)] flex items-center justify-center">
            <span className="text-[var(--color-primary)] font-display font-bold text-[14px]">M</span>
          </div>
          <span className="font-display text-[20px] font-bold text-white">Memberry</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className="flex items-center gap-2.5 px-6 py-2.5 text-[14px] text-white/65 hover:text-white hover:bg-white/[0.08] transition-colors duration-150"
            activeProps={{
              className:
                "flex items-center gap-2.5 px-6 py-2.5 text-[14px] text-white font-semibold bg-white/[0.12] border-l-[3px] border-[var(--color-cream)] pl-[21px]",
            }}
          >
            <Icon size={18} className="shrink-0" />
            {label}
          </Link>
        ))}
      </nav>

      {/* User */}
      <div className="px-6 py-4 border-t border-white/[0.12]">
        <p className="text-[11px] text-white/50 truncate">{userEmail}</p>
      </div>
    </aside>
  )
}
