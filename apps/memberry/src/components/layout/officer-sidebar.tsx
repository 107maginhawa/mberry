import { Link, useParams } from "@tanstack/react-router"
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
  Shield,
  Award,
  IdCard,
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
}

export function OfficerSidebar({ orgName, userEmail, userName, role }: OfficerSidebarProps) {
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
      ],
    },
  ]

  return (
    <aside className="hidden md:flex w-[240px] bg-[var(--color-primary)] text-white flex-col shrink-0">
      {/* Logo + Org Name */}
      <div className="px-6 py-5 border-b border-white/[0.12]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-[var(--color-cream)] flex items-center justify-center">
            <span className="text-[var(--color-primary)] font-display font-bold text-[14px]">M</span>
          </div>
          <span className="font-display text-[20px] font-bold text-white">Memberry</span>
        </div>
        {orgName && (
          <p className="mt-2 text-[12px] text-white/50 truncate" title={orgName}>
            {orgName}
          </p>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-2 overflow-y-auto">
        {sections.map((section, si) => (
          <div key={si} className={si > 0 ? "mt-3" : ""}>
            {section.label && (
              <div className="px-6 py-1.5 text-[10px] font-semibold uppercase tracking-[1.5px] text-white/40">
                {section.label}
              </div>
            )}
            {section.items.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className="flex items-center gap-2.5 px-6 py-2.5 text-[14px] text-white/65 hover:text-white hover:bg-white/[0.08] transition-colors duration-150"
                activeProps={{
                  className:
                    "flex items-center gap-2.5 px-6 py-2.5 text-[14px] text-white font-semibold bg-white/[0.12] border-l-[3px] border-[var(--color-cream)] pl-[21px]",
                }}
                activeOptions={{ exact: true }}
              >
                <Icon size={18} className="shrink-0 opacity-70" />
                {label}
              </Link>
            ))}
          </div>
        ))}
      </nav>

      {/* User info */}
      <div className="px-6 py-4 border-t border-white/[0.12]">
        {userName && <p className="text-[14px] text-white font-medium truncate">{userName}</p>}
        {role && <p className="text-[12px] text-white/50">{role}</p>}
        {!userName && userEmail && <p className="text-[11px] text-white/50 truncate">{userEmail}</p>}
      </div>
    </aside>
  )
}
