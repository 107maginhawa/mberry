import { Link, useParams } from "@tanstack/react-router"
import { Home, MessageSquare, Calendar, Award, User, Vote, FileText } from "lucide-react"

const MAIN_NAV_ITEMS = [
  { to: "/dashboard", label: "Home", icon: Home },
  { to: "/messages", label: "Messages", icon: MessageSquare, orgScoped: true },
  { to: "/my/events", label: "Activities", icon: Calendar },
  { to: "/my/credits", label: "Credits", icon: Award },
  { to: "/my/profile", label: "Profile", icon: User },
] as const

interface MemberSidebarProps {
  userEmail?: string
}

export function MemberSidebar({ userEmail }: MemberSidebarProps) {
  const { orgSlug } = useParams({ strict: false }) as { orgSlug?: string }

  const governanceItems = orgSlug
    ? [
        { to: `/org/${orgSlug}/elections`, label: "Elections", icon: Vote },
        { to: `/org/${orgSlug}/documents`, label: "Documents", icon: FileText },
      ]
    : []

  return (
    <aside className="hidden md:flex w-[var(--sidebar-width)] bg-[var(--color-surface)] border-r border-[var(--color-border-light)] flex-col shrink-0">
      {/* Logo */}
      <div className="px-4 py-3 border-b border-[var(--color-border-light)]">
        <img src="/memberry-logo.png" alt="Memberry" className="h-10 w-auto" width={120} height={40} />
      </div>

      {/* Navigation */}
      <nav aria-label="Member navigation" className="flex-1 py-3">
        {MAIN_NAV_ITEMS.map((item) => {
          const { label, icon: Icon } = item
          // Messages link is org-scoped — skip if no org context
          const href = 'orgScoped' in item && item.orgScoped && orgSlug
            ? `/org/${orgSlug}${item.to}`
            : 'orgScoped' in item && item.orgScoped
              ? null // Hide org-scoped items when no org
              : item.to
          if (!href) return null
          return (
            <Link
              key={href}
              to={href}
              className="flex items-center gap-2.5 px-5 py-2.5 text-sm text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-warm)] transition-colors duration-150"
              activeProps={{
                className:
                  "flex items-center gap-2.5 px-5 py-2.5 text-sm text-[var(--color-primary)] font-semibold border-l-[3px] border-[var(--color-primary)] pl-[calc(1.25rem-3px)]",
              }}
              activeOptions={{ exact: false }}
            >
              <Icon size={18} className="shrink-0" />
              {label}
            </Link>
          )
        })}
        {governanceItems.length > 0 && (
          <>
            <div className="mx-5 my-2 border-t border-[var(--color-border-light)]" />
            <div className="px-5 py-1.5 text-[0.625rem] font-semibold uppercase tracking-[1.5px] text-[var(--color-muted)]">
              Governance
            </div>
            {governanceItems.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className="flex items-center gap-2.5 px-5 py-2.5 text-sm text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-warm)] transition-colors duration-150"
                activeProps={{
                  className:
                    "flex items-center gap-2.5 px-5 py-2.5 text-sm text-[var(--color-primary)] font-semibold border-l-[3px] border-[var(--color-primary)] pl-[calc(1.25rem-3px)]",
                }}
                activeOptions={{ exact: false }}
              >
                <Icon size={18} className="shrink-0" />
                {label}
              </Link>
            ))}
          </>
        )}
      </nav>

      {/* User */}
      <div className="px-5 py-3 border-t border-[var(--color-border-light)]">
        <p className="text-xs text-[var(--color-muted)] truncate">{userEmail}</p>
      </div>
    </aside>
  )
}
