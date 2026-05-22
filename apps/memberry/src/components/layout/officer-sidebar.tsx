import { Link, useParams } from "@tanstack/react-router"
import { POSITION_NAV_CONFIG } from "@/config/position-nav"
import {
  LayoutDashboard,
  Users,
  Inbox,
  Upload,
  Settings,
  CreditCard,
  PieChart,
  BarChart3,
  Calendar,
  BookOpen,
  Megaphone,
  Building,
  Building2,
  Shield,
  Award,
  IdCard,
  ArrowLeft,
  Vote,
} from "lucide-react"

interface NavSection {
  label?: string
  items: {
    to: string
    label: string
    icon: React.ComponentType<{ size?: number; className?: string }>
  }[]
}

interface OfficerSidebarProps {
  orgName?: string
  userEmail?: string
  userName?: string
  role?: string
  positions?: Array<{ title: string }>
}

export function OfficerSidebar({ orgName, userEmail, userName, role, positions }: OfficerSidebarProps) {
  const { orgId } = useParams({ strict: false }) as { orgId: string }
  const base = `/org/${orgId}/officer`

  const sections: NavSection[] = [
    {
      items: [
        { to: `${base}/dashboard`, label: "Dashboard", icon: LayoutDashboard },
      ],
    },
    {
      label: "MEMBERS",
      items: [
        { to: `${base}/roster`, label: "Roster", icon: Users },
        { to: `${base}/applications`, label: "Applications", icon: Inbox },
        { to: `${base}/roster/import`, label: "Import", icon: Upload },
      ],
    },
    {
      label: "FINANCES",
      items: [
        { to: `${base}/settings/dues`, label: "Dues Config", icon: Settings },
        { to: `${base}/payments`, label: "Payment Records", icon: CreditCard },
        { to: `${base}/settings/funds`, label: "Fund Allocation", icon: PieChart },
        { to: `${base}/reports/financial`, label: "Reports", icon: BarChart3 },
      ],
    },
    {
      label: "ACTIVITIES",
      items: [
        { to: `${base}/events`, label: "Events", icon: Calendar },
        { to: `${base}/training`, label: "Trainings", icon: BookOpen },
      ],
    },
    {
      label: "COMMUNICATIONS",
      items: [
        { to: `${base}/communications`, label: "Announcements", icon: Megaphone },
      ],
    },
    {
      label: "GOVERNANCE",
      items: [
        { to: `${base}/elections`, label: "Elections", icon: Vote },
      ],
    },
    {
      label: "DOCUMENTS",
      items: [
        { to: `${base}/reports/credits`, label: "Credit Reports", icon: Award },
      ],
    },
    {
      label: "SETTINGS",
      items: [
        { to: `${base}/settings/org`, label: "Org Profile", icon: Building },
        { to: `${base}/officers`, label: "Officers", icon: Shield },
        { to: `${base}/settings/membership-categories`, label: "Categories", icon: IdCard },
        { to: `${base}/settings/gateway`, label: "Payment Gateway", icon: Settings },
        { to: `${base}/settings/providers`, label: "Providers", icon: Building2 },
      ],
    },
  ]

  const allowedSections = new Set<string>()
  // Dashboard (no label) and SETTINGS always visible to all officers
  allowedSections.add('')
  allowedSections.add('SETTINGS')
  if (positions && positions.length > 0) {
    for (const pos of positions) {
      const allowed = POSITION_NAV_CONFIG[pos.title.trim().toLowerCase()] || []
      allowed.forEach(s => allowedSections.add(s))
    }
  } else {
    // Fallback: show all sections if no position data (safety net)
    sections.forEach(s => allowedSections.add(s.label || ''))
  }

  const filteredSections = sections.filter(s => allowedSections.has(s.label || ''))

  return (
    <aside className="hidden md:flex w-[240px] bg-[var(--color-primary)] text-white flex-col shrink-0">
      {/* Logo + Org Name */}
      <div className="px-4 py-3 border-b border-white/[0.12]">
        <img src="/memberry-logo-white.png" alt="Memberry" className="h-10 w-auto" />
        {orgName && (
          <p className="mt-2 text-[12px] text-white/50 truncate" title={orgName}>
            {orgName}
          </p>
        )}
      </div>

      {/* Navigation */}
      <nav aria-label="Officer navigation" className="flex-1 py-2 overflow-y-auto">
        {filteredSections.map((section, si) => (
          <div key={si} className={si > 0 ? "mt-3" : ""}>
            {section.label && (
              <div className="px-6 py-1.5 text-[10px] font-semibold uppercase tracking-[1.5px] text-white/40">
                {section.label}
              </div>
            )}
            {section.items.map(({ to, label, icon: Icon }, idx) => (
              <Link
                key={`${to}-${idx}`}
                to={to}
                className="flex items-center gap-2.5 px-6 py-2.5 text-[14px] text-white/65 hover:text-white hover:bg-white/[0.08] transition-colors duration-150"
                activeProps={{
                  className:
                    "flex items-center gap-2.5 px-6 py-2.5 text-[14px] text-white font-semibold bg-white/[0.12] border-l-[3px] border-[var(--color-cream)] pl-[21px]",
                }}
                activeOptions={{ exact: false }}
              >
                <Icon size={18} className="shrink-0 opacity-70" />
                {label}
              </Link>
            ))}
          </div>
        ))}
      </nav>

      {/* Back to member view */}
      <div className="px-4 py-2 border-t border-white/[0.12]">
        <Link
          to="/dashboard"
          className="flex items-center gap-2 px-2 py-2 text-[12px] text-white/50 hover:text-white hover:bg-white/[0.08] rounded-[6px] transition-colors"
        >
          <ArrowLeft size={14} />
          Back to Member View
        </Link>
      </div>

      {/* User info */}
      <div className="px-6 py-3 border-t border-white/[0.12]">
        <div className="flex items-center gap-2.5">
          <div className="w-[34px] h-[34px] rounded-full bg-[var(--color-primary-mid)] flex items-center justify-center shrink-0">
            <span className="text-white font-semibold text-[13px]">
              {userName ? userName.split(' ').map(n => n[0]).join('').slice(0, 2) : '?'}
            </span>
          </div>
          <div className="min-w-0">
            {userName && <p className="text-[14px] text-white font-medium truncate">{userName}</p>}
            {role && <p className="text-[12px] text-white/50">{role}</p>}
            {!userName && userEmail && <p className="text-[11px] text-white/50 truncate">{userEmail}</p>}
          </div>
        </div>
      </div>
    </aside>
  )
}
