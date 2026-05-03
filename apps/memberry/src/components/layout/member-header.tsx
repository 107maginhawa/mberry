import { useState, useEffect } from 'react'
import { Link } from '@tanstack/react-router'
import { Bell } from 'lucide-react'

interface MemberHeaderProps {
  userName?: string
}

interface OrgMembership {
  organizationId: string
  organizationName?: string
  membershipStatus?: string
  membershipNumber?: string
}

const STATUS_DOT: Record<string, string> = {
  active: 'bg-[var(--color-success)]',
  grace: 'bg-[var(--color-warning)]',
  lapsed: 'bg-[var(--color-error)]',
  pending: 'bg-[var(--color-info)]',
}

export function MemberHeader({ userName }: MemberHeaderProps) {
  const [orgs, setOrgs] = useState<OrgMembership[]>([])
  const [notifCount, setNotifCount] = useState(0)

  useEffect(() => {
    fetch('/api/persons/me/memberships', { credentials: 'include' })
      .then((r) => r.ok ? r.json() : { data: [] })
      .then((json) => setOrgs(json.data || []))
      .catch(() => {})

    fetch('/api/notifications?limit=1&status=delivered&channel=in-app', { credentials: 'include' })
      .then((r) => r.ok ? r.json() : { data: [] })
      .then((json) => {
        const items = json.data || json.items || []
        setNotifCount(items.length)
      })
      .catch(() => {})
  }, [])

  const primaryOrg = orgs[0]

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-12 px-4 md:px-6 bg-[var(--color-primary)] text-white md:bg-[var(--color-surface)] md:text-[var(--color-text)] md:border-b md:border-[var(--color-border-light)]">
      {/* Left: logo (mobile only — desktop has sidebar) */}
      <div className="flex items-center gap-2 md:hidden">
        <div className="w-6 h-6 rounded-full bg-[var(--color-cream)] flex items-center justify-center">
          <span className="text-[var(--color-primary)] font-display font-bold text-[10px]">M</span>
        </div>
        <span className="font-display text-[16px] font-bold">Memberry</span>
      </div>

      {/* Desktop: greeting */}
      <div className="hidden md:block">
        {userName && (
          <span className="text-[14px] text-[var(--color-muted)]">
            {userName}
          </span>
        )}
      </div>

      {/* Right: org pill + bell */}
      <div className="flex items-center gap-3">
        {/* Org context pill */}
        {primaryOrg && (
          <Link
            to={`/org/${primaryOrg.organizationId}/members`}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-medium bg-white/15 md:bg-[var(--color-surface-warm)] md:border md:border-[var(--color-border-light)] md:text-[var(--color-text)]"
          >
            <span
              className={`w-2 h-2 rounded-full ${STATUS_DOT[primaryOrg.membershipStatus || 'active'] || STATUS_DOT.active}`}
            />
            <span className="truncate max-w-[120px]">
              {primaryOrg.organizationName || primaryOrg.membershipNumber || 'Org'}
            </span>
          </Link>
        )}

        {/* Notification bell */}
        <Link
          to="/my/notifications"
          className="relative p-1.5 rounded-full hover:bg-white/10 md:hover:bg-[var(--color-surface-warm)] transition-colors"
        >
          <Bell size={18} />
          {notifCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-[var(--color-error)] text-white text-[10px] font-bold px-1">
              {notifCount}
            </span>
          )}
        </Link>
      </div>
    </header>
  )
}
