import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@monobase/ui'
import { Bell, ChevronDown } from 'lucide-react'
import { api } from '@/lib/api'

interface MemberHeaderProps {
  userName?: string
}

interface OrgMembership {
  organizationId: string
  organizationName?: string
  membershipStatus?: string
  membershipNumber?: string
  orgId?: string
  memberNumber?: string
  status?: string
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
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(
    () => localStorage.getItem(SELECTED_ORG_KEY)
  )
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  const { data: orgs = [] } = useQuery({
    queryKey: ['my-memberships'],
    queryFn: async () => {
      const json = await api.get<any>('/api/persons/me/memberships')
      const raw = json.data || []
      return raw.map((m: any) => ({
        ...m,
        organizationId: m.organizationId || m.orgId,
        membershipNumber: m.membershipNumber || m.memberNumber,
        membershipStatus: m.membershipStatus || m.status,
      })) as OrgMembership[]
    },
  })

  const { data: notifCount = 0 } = useQuery({
    queryKey: ['notif-unread-count'],
    queryFn: async () => {
      const json = await api.get<any>('/api/notifs?limit=50&channel=in-app')
      const items = json.data || json.items || []
      return items.filter((n: any) => n.status !== 'read').length as number
    },
  })

  // Default to stored selection, or first org
  useEffect(() => {
    if (orgs.length > 0 && !orgs.find((o) => o.organizationId === selectedOrgId)) {
      const defaultId = orgs[0]!.organizationId
      setSelectedOrgId(defaultId)
      localStorage.setItem(SELECTED_ORG_KEY, defaultId)
    }
  }, [orgs, selectedOrgId])

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
    <header className="sticky top-0 z-30 flex items-center justify-between h-12 px-4 md:px-6 bg-[var(--color-primary)] text-white md:bg-[var(--color-nav-elevated)] md:backdrop-blur-[var(--nav-blur)] md:text-[var(--color-text)] md:border-b md:border-[var(--color-border-light)]">
      {/* Left: logo (mobile only) */}
      <div className="flex items-center md:hidden">
        <img src="/memberry-logo-white.png" alt="Memberry" className="h-6 w-auto" />
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
            <Button
              variant="ghost"
              onClick={() => hasMultipleOrgs ? setDropdownOpen(!dropdownOpen) : navigate({ to: `/org/${currentOrg.organizationId}/members` })}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-medium bg-white/15 md:bg-[var(--color-surface-warm)] md:border md:border-[var(--color-border-light)] md:text-[var(--color-text)] hover:bg-white/25 md:hover:bg-[var(--color-surface-warm)]"
            >
              <span
                className={`w-2 h-2 rounded-full ${STATUS_DOT[currentOrg.membershipStatus || 'active'] || STATUS_DOT.active}`}
              />
              <span className="truncate max-w-[120px]">
                {currentOrg.organizationName || currentOrg.membershipNumber || 'Org'}
              </span>
              {hasMultipleOrgs && <ChevronDown size={12} className={`transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />}
            </Button>

            {/* Dropdown */}
            {dropdownOpen && hasMultipleOrgs && (
              <div className="absolute right-0 top-full mt-1 w-[280px] bg-[var(--color-surface)] border border-[var(--color-border-light)] rounded-[12px] shadow-lg overflow-hidden z-50">
                <div className="py-1">
                  {orgs.map((org) => (
                    <Button
                      key={org.organizationId}
                      variant="ghost"
                      onClick={() => selectOrg(org)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left ${
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
                    </Button>
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
