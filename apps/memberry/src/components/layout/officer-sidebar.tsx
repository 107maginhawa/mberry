import { Link, useParams } from "@tanstack/react-router"
import { POSITION_NAV_CONFIG } from "@/config/position-nav"
import {
  LayoutDashboard,
  Users,
  Inbox,
  Upload,
  Settings,
  CreditCard,
  BarChart3,
  Calendar,
  BookOpen,
  Megaphone,
  MessageSquare,
  FileBarChart,
  Building,
  Building2,
  Shield,
  Award,
  IdCard,
  ArrowLeft,
  Vote,
  FileSpreadsheet,
  FileText,
  TrendingUp,
  Receipt,
  UserCheck,
  Wallet,
  CalendarClock,
  ClipboardList,
  Star,
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
  const { orgSlug } = useParams({ strict: false }) as { orgSlug: string }
  const base = `/org/${orgSlug}/officer`

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
        { to: `${base}/finances`, label: "Overview", icon: TrendingUp },
        { to: `${base}/finances/invoices`, label: "Invoices", icon: Receipt },
        { to: `${base}/payments`, label: "Payments", icon: CreditCard },
        { to: `${base}/finances/members`, label: "Members", icon: UserCheck },
        { to: `${base}/finances/dues`, label: "Dues Schedule", icon: CalendarClock },
        { to: `${base}/finances/assessments`, label: "Assessments", icon: FileSpreadsheet },
        { to: `${base}/finances/funds`, label: "Funds", icon: Wallet },
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
        { to: `${base}/messages`, label: "Channels", icon: MessageSquare },
        { to: `${base}/communications`, label: "Announcements", icon: Megaphone },
        { to: `${base}/communications/templates`, label: "Templates", icon: FileBarChart },
      ],
    },
    {
      label: "GOVERNANCE",
      items: [
        { to: `${base}/elections`, label: "Elections", icon: Vote },
      ],
    },
    {
      label: "FEEDBACK",
      items: [
        { to: `${base}/surveys`, label: "Surveys", icon: ClipboardList },
        { to: `${base}/reviews`, label: "Reviews", icon: Star },
      ],
    },
    {
      label: "DOCUMENTS",
      items: [
        { to: `${base}/documents`, label: "Document Library", icon: FileText },
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
    <aside className="hidden md:flex w-[64px] lg:w-[240px] bg-[var(--color-primary)] text-white flex-col shrink-0 transition-[width] duration-200">
      {/* Logo + Org Name */}
      <div className="px-3 lg:px-4 py-3 border-b border-white/[0.12]">
        <img src="/memberry-logo-white.png" alt="Memberry" className="h-10 w-auto lg:block hidden" />
        <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center mx-auto lg:hidden">
          <span className="text-white font-bold text-sm">M</span>
        </div>
        {orgName && (
          <p className="mt-2 text-xs text-white/50 truncate hidden lg:block" title={orgName}>
            {orgName}
          </p>
        )}
      </div>

      {/* Navigation */}
      <nav aria-label="Officer navigation" className="flex-1 py-2 overflow-y-auto">
        {filteredSections.map((section, si) => (
          <div key={si} className={si > 0 ? "mt-3" : ""}>
            {section.label && (
              <div className="hidden lg:block px-6 py-1.5 text-[0.625rem] font-semibold uppercase tracking-[1.5px] text-white/40">
                {section.label}
              </div>
            )}
            {si > 0 && (
              <div className="lg:hidden mx-3 my-1 border-t border-white/[0.08]" />
            )}
            {section.items.map(({ to, label, icon: Icon }, idx) => (
              <Link
                key={`${to}-${idx}`}
                to={to}
                title={label}
                className="flex items-center justify-center lg:justify-start gap-2.5 px-0 lg:px-6 py-2.5 text-sm text-white/65 hover:text-white hover:bg-white/[0.08] transition-colors duration-150"
                activeProps={{
                  className:
                    "flex items-center justify-center lg:justify-start gap-2.5 px-0 lg:px-6 py-2.5 text-sm text-white font-semibold bg-white/[0.12] border-l-[3px] border-[var(--color-cream)] lg:pl-[21px]",
                }}
                activeOptions={{ exact: false }}
              >
                <Icon size={18} className="shrink-0 opacity-70" />
                <span className="hidden lg:inline">{label}</span>
              </Link>
            ))}
          </div>
        ))}
      </nav>

      {/* Back to member view */}
      <div className="px-2 lg:px-4 py-2 border-t border-white/[0.12]">
        <Link
          to="/dashboard"
          title="Back to Member View"
          className="flex items-center justify-center lg:justify-start gap-2 px-2 py-2 text-xs text-white/50 hover:text-white hover:bg-white/[0.08] rounded-[6px] transition-colors"
        >
          <ArrowLeft size={14} />
          <span className="hidden lg:inline">Back to Member View</span>
        </Link>
      </div>

      {/* User info */}
      <div className="px-2 lg:px-6 py-3 border-t border-white/[0.12]">
        <div className="flex items-center justify-center lg:justify-start gap-2.5">
          <div className="w-[34px] h-[34px] rounded-full bg-[var(--color-primary-mid)] flex items-center justify-center shrink-0">
            <span className="text-white font-semibold text-sm">
              {userName ? userName.split(' ').map(n => n[0]).join('').slice(0, 2) : '?'}
            </span>
          </div>
          <div className="min-w-0 hidden lg:block">
            {userName && <p className="text-sm text-white font-medium truncate">{userName}</p>}
            {role && <p className="text-xs text-white/50">{role}</p>}
            {!userName && userEmail && <p className="text-xs text-white/50 truncate">{userEmail}</p>}
          </div>
        </div>
      </div>
    </aside>
  )
}
