import { Link, useParams } from "@tanstack/react-router"
import { NavIcon } from '@monobase/ui'
import {
  Home,
  MessageSquare,
  Calendar,
  CalendarDays,
  Award,
  User,
  FileText,
  ClipboardList,
  ScrollText,
  Settings,
  Users,
  BookOpen,
  Receipt,
  Megaphone,
  Landmark,
  Shield,
  ArrowLeft,
  GraduationCap,
  BookMarked,
  IdCard,
  CreditCard,
  Wallet,
  Clock,
  Download,
} from "lucide-react"

interface NavItem {
  to: string
  label: string
  icon: React.ComponentType<{ size?: number; className?: string }>
}

interface NavSection {
  label?: string
  items: NavItem[]
}

const PERSONAL_SECTIONS: NavSection[] = [
  {
    items: [
      { to: "/dashboard", label: "Home", icon: Home },
      { to: "/my/events", label: "My Events", icon: Calendar },
      { to: "/my/calendar", label: "My Calendar", icon: CalendarDays },
      { to: "/my/bookings", label: "My Bookings", icon: BookMarked },
      { to: "/my/credits", label: "Credits", icon: Award },
      { to: "/my/certificates", label: "Certificates", icon: ScrollText },
      { to: "/my/id-card", label: "Digital ID", icon: IdCard },
    ],
  },
  {
    label: "FINANCES",
    items: [
      { to: "/my/payments", label: "Payments", icon: CreditCard },
      { to: "/my/billing", label: "Billing", icon: Wallet },
    ],
  },
  {
    label: "SERVICES",
    items: [
      { to: "/my/schedule", label: "My Schedule", icon: Clock },
    ],
  },
  {
    label: "Feedback",
    items: [
      { to: "/my/surveys", label: "My Surveys", icon: ClipboardList },
    ],
  },
  {
    label: "ACCOUNT",
    items: [
      { to: "/my/profile", label: "Profile", icon: User },
      { to: "/my/data-export", label: "Data Export", icon: Download },
      { to: "/my/settings", label: "Settings", icon: Settings },
    ],
  },
]

function buildOrgSections(orgSlug: string): NavSection[] {
  const base = `/org/${orgSlug}`
  return [
    {
      items: [
        { to: `${base}/home`, label: "Org Home", icon: Home },
      ],
    },
    {
      label: "MEMBERSHIP",
      items: [
        { to: `${base}/directory`, label: "Directory", icon: Users },
        { to: `${base}/my-cpd`, label: "My CPD", icon: GraduationCap },
      ],
    },
    {
      label: "ACTIVITIES",
      items: [
        { to: `${base}/events`, label: "Events", icon: Calendar },
        { to: `${base}/training`, label: "Training", icon: BookOpen },
      ],
    },
    {
      label: "FINANCES",
      items: [
        { to: `${base}/dues`, label: "My Dues", icon: Receipt },
      ],
    },
    {
      label: "COMMUNICATIONS",
      items: [
        { to: `${base}/messages`, label: "Messages", icon: MessageSquare },
        { to: `${base}/announcements`, label: "Announcements", icon: Megaphone },
      ],
    },
    {
      label: "GOVERNANCE",
      items: [
        { to: `${base}/governance`, label: "Governance", icon: Landmark },
        { to: `${base}/documents`, label: "Documents", icon: FileText },
      ],
    },
  ]
}

interface MemberSidebarProps {
  userEmail?: string
  isOfficer?: boolean
}

export function MemberSidebar({ userEmail, isOfficer }: MemberSidebarProps) {
  const { orgSlug } = useParams({ strict: false }) as { orgSlug?: string }

  const sections = orgSlug ? buildOrgSections(orgSlug) : PERSONAL_SECTIONS

  return (
    <aside className="hidden md:flex w-[var(--sidebar-width)] bg-[var(--color-surface)] border-r border-[var(--color-border-light)] flex-col shrink-0">
      {/* Logo */}
      <div className="px-4 py-3 border-b border-[var(--color-border-light)]">
        <img src="/memberry-logo.png" alt="Memberry" className="h-10 w-auto" width={120} height={40} />
      </div>

      {/* Navigation */}
      <nav aria-label="Member navigation" className="flex-1 py-3 overflow-y-auto">
        {sections.map((section, si) => (
          <div key={si}>
            {si > 0 && (
              <div className="mx-5 my-2 border-t border-[var(--color-border-light)]" />
            )}
            {section.label && (
              <div className="px-5 py-1.5 text-[0.625rem] font-semibold uppercase tracking-[1.5px] text-[var(--color-muted)]">
                {section.label}
              </div>
            )}
            {section.items.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className="flex items-center gap-2.5 px-5 py-2.5 text-sm text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-warm)] transition-colors duration-150"
                activeProps={{
                  className:
                    "flex items-center gap-2.5 px-5 py-2.5 text-sm text-[var(--color-primary)] font-semibold border-l-[3px] border-[var(--color-primary)] pl-[calc(1.25rem-3px)]",
                }}
                activeOptions={{ exact: false }}
              >                <NavIcon icon={Icon} />
                {label}
              </Link>
            ))}
          </div>
        ))}

        {/* Officer Dashboard link (org context only, officer only) */}
        {orgSlug && isOfficer && (
          <>
            <div className="mx-5 my-2 border-t border-[var(--color-border-light)]" />
            <Link
              to={`/org/${orgSlug}/officer/dashboard` as "/"}
              className="flex items-center gap-2.5 px-5 py-2.5 text-sm text-[var(--color-primary)] hover:text-[var(--color-primary)] hover:bg-[var(--color-surface-warm)] transition-colors duration-150 font-medium"
              activeProps={{
                className:
                  "flex items-center gap-2.5 px-5 py-2.5 text-sm text-[var(--color-primary)] font-semibold border-l-[3px] border-[var(--color-primary)] pl-[calc(1.25rem-3px)]",
              }}
              activeOptions={{ exact: false }}
            >              <NavIcon icon={Shield} />
              Officer Dashboard
            </Link>
          </>
        )}

        {/* Back to Personal (org context only) */}
        {orgSlug && (
          <>
            <div className="mx-5 my-2 border-t border-[var(--color-border-light)]" />
            <Link
              to="/dashboard"
              className="flex items-center gap-2.5 px-5 py-2.5 text-sm text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-warm)] transition-colors duration-150"
            >              <NavIcon icon={ArrowLeft} />
              Back to Personal
            </Link>
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
