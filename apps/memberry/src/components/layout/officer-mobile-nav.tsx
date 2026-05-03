import { useState } from 'react'
import { Link, useParams } from '@tanstack/react-router'
import {
  Menu, X, Bell,
  LayoutDashboard, Users, Inbox, Upload,
  Settings, CreditCard, PieChart, BarChart3,
  Calendar, BookOpen, Megaphone, Mail,
  Building, Shield, Award, IdCard, ArrowLeft, Plug,
} from 'lucide-react'

interface OfficerMobileNavProps {
  orgName?: string
  userName?: string
  role?: string
}

interface NavSection {
  label?: string
  items: { to: string; label: string; icon: React.ComponentType<{ size?: number }> }[]
}

export function OfficerMobileNav({ orgName, userName, role }: OfficerMobileNavProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const { orgId } = useParams({ strict: false }) as { orgId: string }
  const base = `/org/${orgId}/officer`

  const sections: NavSection[] = [
    { items: [{ to: `${base}/dashboard`, label: 'Dashboard', icon: LayoutDashboard }] },
    { label: 'MEMBERS', items: [
      { to: `${base}/roster`, label: 'Roster', icon: Users },
      { to: `${base}/applications`, label: 'Applications', icon: Inbox },
      { to: `${base}/roster/import`, label: 'Import', icon: Upload },
    ]},
    { label: 'FINANCES', items: [
      { to: `${base}/settings/dues`, label: 'Dues Config', icon: Settings },
      { to: `${base}/payments`, label: 'Payment Records', icon: CreditCard },
      { to: `${base}/settings/funds`, label: 'Fund Allocation', icon: PieChart },
      { to: `${base}/reports/financial`, label: 'Reports', icon: BarChart3 },
    ]},
    { label: 'ACTIVITIES', items: [
      { to: `${base}/events`, label: 'Events', icon: Calendar },
      { to: `${base}/training`, label: 'Trainings', icon: BookOpen },
    ]},
    { label: 'COMMUNICATIONS', items: [
      { to: `${base}/communications`, label: 'Announcements', icon: Megaphone },
      { to: `${base}/communications`, label: 'Email Templates', icon: Mail },
    ]},
    { label: 'DOCUMENTS', items: [
      { to: `${base}/reports/credits`, label: 'Credit Reports', icon: Award },
      { to: `${base}/reports/credits`, label: 'Member Cards', icon: IdCard },
      { to: `${base}/reports/credits`, label: 'Certificates', icon: Award },
    ]},
    { label: 'SETTINGS', items: [
      { to: `${base}/settings/org`, label: 'Org Profile', icon: Building },
      { to: `${base}/officers`, label: 'Officers', icon: Shield },
      { to: `${base}/settings/membership-categories`, label: 'Categories', icon: IdCard },
      { to: `${base}/settings/gateway`, label: 'Payment Gateway', icon: Settings },
      { to: `${base}/settings/gateway`, label: 'Integrations', icon: Plug },
    ]},
  ]

  return (
    <>
      {/* Sticky header — 48px per spec */}
      <header className="md:hidden sticky top-0 z-40 flex items-center justify-between h-12 px-4 bg-[var(--color-primary)] text-white">
        <button
          onClick={() => setDrawerOpen(true)}
          className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>
        <span className="text-[14px] font-semibold truncate max-w-[200px]">
          {orgName || 'Organization'}
        </span>
        <Link to="/my/notifications" className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
          <Bell size={18} />
        </Link>
      </header>

      {/* Full-screen drawer */}
      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setDrawerOpen(false)}
          />
          {/* Drawer panel */}
          <div className="absolute inset-y-0 left-0 w-[280px] bg-[var(--color-primary)] text-white flex flex-col animate-in slide-in-from-left duration-200">
            {/* Drawer header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.12]">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-[var(--color-cream)] flex items-center justify-center">
                  <span className="text-[var(--color-primary)] font-display font-bold text-[11px]">M</span>
                </div>
                <span className="font-display text-[16px] font-bold">Memberry</span>
              </div>
              <button
                onClick={() => setDrawerOpen(false)}
                className="p-1 rounded-lg hover:bg-white/10"
                aria-label="Close menu"
              >
                <X size={18} />
              </button>
            </div>

            {orgName && (
              <p className="px-5 py-2 text-[12px] text-white/50 truncate">{orgName}</p>
            )}

            {/* Nav sections */}
            <nav className="flex-1 py-2 overflow-y-auto">
              {sections.map((section, si) => (
                <div key={si} className={si > 0 ? 'mt-2' : ''}>
                  {section.label && (
                    <div className="px-5 py-1.5 text-[10px] font-semibold uppercase tracking-[1.5px] text-white/40">
                      {section.label}
                    </div>
                  )}
                  {section.items.map(({ to, label, icon: Icon }) => (
                    <Link
                      key={`${to}-${label}`}
                      to={to}
                      onClick={() => setDrawerOpen(false)}
                      className="flex items-center gap-2.5 px-5 py-2.5 text-[14px] text-white/65 hover:text-white hover:bg-white/[0.08] transition-colors"
                      activeProps={{
                        className: 'flex items-center gap-2.5 px-5 py-2.5 text-[14px] text-white font-semibold bg-white/[0.12] border-l-[3px] border-[var(--color-cream)] pl-[17px]',
                      }}
                      activeOptions={{ exact: true }}
                    >
                      <Icon size={18} />
                      {label}
                    </Link>
                  ))}
                </div>
              ))}
            </nav>

            {/* Back to member + user info */}
            <div className="border-t border-white/[0.12]">
              <Link
                to="/dashboard"
                onClick={() => setDrawerOpen(false)}
                className="flex items-center gap-2 px-5 py-2.5 text-[12px] text-white/50 hover:text-white hover:bg-white/[0.08] transition-colors"
              >
                <ArrowLeft size={14} />
                Back to Member View
              </Link>
            </div>
            <div className="px-5 py-3 border-t border-white/[0.12]">
              {userName && <p className="text-[13px] text-white font-medium truncate">{userName}</p>}
              {role && <p className="text-[11px] text-white/50">{role}</p>}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
