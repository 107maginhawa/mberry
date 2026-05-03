import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { Bell, ChevronDown } from 'lucide-react'

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

const STATUS_LABEL: Record<string, string> = {
  active: 'Active',
  grace: 'Grace',
  lapsed: 'Lapsed',
  pending: 'Pending',
}

const SELECTED_ORG_KEY = 'memberry:selectedOrgId'

export function MemberHeader({ userName }: MemberHeaderProps) {
  const [orgs, setOrgs] = useState<OrgMembership[]>([])
  const [notifCount, setNotifCount] = useState(0)
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(
    () => localStorage.getItem(SELECTED_ORG_KEY)
  )
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    fetch('/api/persons/me/memberships', { credentials: 'include' })
      .then((r) => r.ok ? r.json() : { data: [] })
      .then((json) => {
        const data = json.data || []
        setOrgs(data)
        // Default to stored selection, or first org
        if (data.length > 0 && !data.find((o: OrgMembership) => o.organizationId === selectedOrgId)) {
          const defaultId = data[0].organizationId
          setSelectedOrgId(defaultId)
          localStorage.setItem(SELECTED_ORG_KEY, defaultId)
        }
      })
      .catch(() => {})

    fetch('/api/notifs?limit=50&channel=in-app', { credentials: 'include' })
      .then((r) => r.ok ? r.json() : { data: [] })
      .then((json) => {
        const items = json.data || json.items || []
        setNotifCount(items.filter((n: any) => n.status !== 'read').length)
      })
      .catch(() => {})
  }, [])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    if (dropdownOpen) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [dropdownOpen])

  const currentOrg = orgs.find((o) => o.organizationId === selectedOrgId) || orgs[0]
  const hasMultipleOrgs = orgs.length >= 2

  function selectOrg(org: OrgMembership) {
    setSelectedOrgId(org.organizationId)
    localStorage.setItem(SELECTED_ORG_KEY, org.organizationId)
    setDropdownOpen(false)
  }

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-12 px-4 md:px-6 bg-[var(--color-primary)] text-white md:bg-[var(--color-surface)] md:text-[var(--color-text)] md:border-b md:border-[var(--color-border-light)]">
      {/* Left: logo (mobile only) */}
      <div className="flex items-center gap-2 md:hidden">
        <div className="w-6 h-6 rounded-full bg-[var(--color-cream)] flex items-center justify-center">
          <span className="text-[var(--color-primary)] font-display font-bold text-[10px]">M</span>
        </div>
        <span className="font-display text-[16px] font-bold">Memberry</span>
      </div>

      {/* Desktop: user name */}
      <div className="hidden md:block">
        {userName && (
          <span className="text-[14px] text-[var(--color-muted)]">{userName}</span>
        )}
      </div>

      {/* Right: org pill + bell */}
      <div className="flex items-center gap-3">
        {/* Org context pill / switcher */}
        {currentOrg && (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => hasMultipleOrgs ? setDropdownOpen(!dropdownOpen) : navigate({ to: `/org/${currentOrg.organizationId}/members` })}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-medium bg-white/15 md:bg-[var(--color-surface-warm)] md:border md:border-[var(--color-border-light)] md:text-[var(--color-text)] transition-colors hover:bg-white/25 md:hover:bg-[var(--color-surface-warm)]"
            >
              <span
                className={`w-2 h-2 rounded-full ${STATUS_DOT[currentOrg.membershipStatus || 'active'] || STATUS_DOT.active}`}
              />
              <span className="truncate max-w-[120px]">
                {currentOrg.organizationName || currentOrg.membershipNumber || 'Org'}
              </span>
              {hasMultipleOrgs && <ChevronDown size={12} className={`transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />}
            </button>

            {/* Dropdown */}
            {dropdownOpen && hasMultipleOrgs && (
              <div className="absolute right-0 top-full mt-1 w-[280px] bg-[var(--color-surface)] border border-[var(--color-border-light)] rounded-[12px] shadow-lg overflow-hidden z-50">
                <div className="py-1">
                  {orgs.map((org) => (
                    <button
                      key={org.organizationId}
                      onClick={() => selectOrg(org)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[var(--color-surface-warm)] transition-colors ${
                        org.organizationId === selectedOrgId ? 'bg-[var(--color-surface-warm)]' : ''
                      }`}
                    >
                      <span
                        className={`w-2.5 h-2.5 rounded-full shrink-0 ${STATUS_DOT[org.membershipStatus || 'active'] || STATUS_DOT.active}`}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-[var(--color-text)] truncate">
                          {org.organizationName || org.membershipNumber || 'Organization'}
                        </p>
                        <p className="text-[11px] text-[var(--color-muted)]">
                          {STATUS_LABEL[org.membershipStatus || 'active'] || 'Active'}
                          {org.membershipNumber ? ` · ${org.membershipNumber}` : ''}
                        </p>
                      </div>
                      {org.organizationId === selectedOrgId && (
                        <span className="text-[var(--color-primary)] text-[11px] font-semibold shrink-0">Current</span>
                      )}
                    </button>
                  ))}
                </div>
                <div className="border-t border-[var(--color-border-light)]">
                  <Link
                    to="/my/organizations"
                    onClick={() => setDropdownOpen(false)}
                    className="block px-4 py-2.5 text-[12px] font-medium text-[var(--color-primary)] hover:bg-[var(--color-surface-warm)] transition-colors"
                  >
                    View All Memberships
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}

        {/* No orgs — empty state per BR-21 */}
        {orgs.length === 0 && orgs !== null && (
          <Link
            to="/my/organizations"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-medium bg-white/15 md:bg-[var(--color-surface-warm)] md:border md:border-[var(--color-border-light)] md:text-[var(--color-muted)]"
          >
            Join an organization
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
