import { useState } from 'react'
import { Link, useParams } from '@tanstack/react-router'
import { Button, Sheet, SheetContent, SheetHeader, SheetTitle } from '@monobase/ui'
import { POSITION_NAV_CONFIG } from '@/config/position-nav'
import {
  Menu, Bell,
  LayoutDashboard, Users, Inbox, Upload,
  Settings, CreditCard, PieChart, BarChart3,
  Calendar, BookOpen, Megaphone,
  Building, Shield, Award, IdCard, ArrowLeft, Vote,
} from 'lucide-react'

interface OfficerMobileNavProps {
  orgName?: string
  userName?: string
  role?: string
  positions?: Array<{ title: string }>
}

interface NavSection {
  label?: string
  items: { to: string; label: string; icon: React.ComponentType<{ size?: number }> }[]
}

export function OfficerMobileNav({ orgName, userName, role, positions }: OfficerMobileNavProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const { orgSlug } = useParams({ strict: false }) as { orgSlug: string }
  const base = `/org/${orgSlug}/officer`

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
    ]},
    { label: 'GOVERNANCE', items: [
      { to: `${base}/elections`, label: 'Elections', icon: Vote },
    ]},
    { label: 'DOCUMENTS', items: [
      { to: `${base}/reports/credits`, label: 'Credit Reports', icon: Award },
    ]},
    { label: 'SETTINGS', items: [
      { to: `${base}/settings/org`, label: 'Org Profile', icon: Building },
      { to: `${base}/officers`, label: 'Officers', icon: Shield },
      { to: `${base}/settings/membership-categories`, label: 'Categories', icon: IdCard },
      { to: `${base}/settings/gateway`, label: 'Payment Gateway', icon: Settings },
    ]},
  ]

  // Apply same position-based filtering as desktop sidebar
  const allowedSections = new Set<string>()
  allowedSections.add('') // Dashboard always visible
  allowedSections.add('SETTINGS') // SETTINGS always visible
  if (positions && positions.length > 0) {
    for (const pos of positions) {
      const allowed = POSITION_NAV_CONFIG[pos.title.trim().toLowerCase()] || []
      allowed.forEach(s => allowedSections.add(s))
    }
  } else {
    sections.forEach(s => allowedSections.add(s.label || ''))
  }
  const filteredSections = sections.filter(s => allowedSections.has(s.label || ''))

  return (
    <>
      {/* Sticky header — 48px per spec */}
      <header className="md:hidden sticky top-0 z-40 flex items-center justify-between h-12 px-4 bg-[var(--color-primary)] text-white">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setDrawerOpen(true)}
          className="p-1.5"
          aria-label="Open menu"
          aria-expanded={drawerOpen}
        >
          <Menu size={20} />
        </Button>
        <span className="text-[14px] font-semibold truncate max-w-[200px]">
          {orgName || 'Organization'}
        </span>
        <Link to="/my/notifications" className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
          <Bell size={18} />
        </Link>
      </header>

      {/* Sheet drawer — Radix handles focus trap, Escape, scroll lock, ARIA */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent
          side="left"
          className="w-[280px] p-0 bg-[var(--color-primary)] text-white border-r-0 md:hidden"
        >
          <SheetHeader className="px-5 py-4 border-b border-white/[0.12]">
            <SheetTitle className="flex items-center">
              <img src="/memberry-logo-white.png" alt="Memberry" className="h-7 w-auto" />
            </SheetTitle>
          </SheetHeader>

          {orgName && (
            <p className="px-5 py-2 text-[12px] text-white/50 truncate">{orgName}</p>
          )}

          {/* Nav sections */}
          <nav aria-label="Officer navigation" className="flex-1 py-2 overflow-y-auto">
            {filteredSections.map((section, si) => (
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
                    activeOptions={{ exact: false }}
                  >
                    <Icon size={18} />
                    {label}
                  </Link>
                ))}
              </div>
            ))}
          </nav>

          {/* Back to member + user info */}
          <div className="mt-auto border-t border-white/[0.12]">
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
        </SheetContent>
      </Sheet>
    </>
  )
}
