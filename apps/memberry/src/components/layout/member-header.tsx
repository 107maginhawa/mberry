import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@monobase/ui'
import { Bell, ChevronDown } from 'lucide-react'
import { api } from '@/lib/api'
import { AvatarInitials } from '@/components/patterns/avatar-initials'
import { OrgPickerSheet } from '@/components/layout/org-picker-sheet'
import { useMyOrgs } from '@/hooks/useMyOrgs'

interface MemberHeaderProps {
  userName?: string
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

export function MemberHeader({ userName }: MemberHeaderProps) {
  const { orgs, activeOrgSlug } = useMyOrgs()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  const { data: notifCount = 0 } = useQuery({
    queryKey: ['notif-unread-count'],
    queryFn: async () => {
      const json = await api.get<any>('/api/notifs?limit=50&channel=in-app')
      const items = json.data || json.items || []
      return items.filter((n: any) => n.status !== 'read').length as number
    },
  })

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

  const currentOrg = orgs.find((o) => o.orgSlug === activeOrgSlug) || orgs[0]
  const hasMultipleOrgs = orgs.length >= 2

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
        {/* Mobile: avatar tap → bottom sheet */}
        {currentOrg && (
          <Button
            variant="ghost"
            onClick={() => setSheetOpen(true)}
            className="md:hidden relative p-0"
            aria-label="Switch organization"
          >
            <AvatarInitials
              name={currentOrg.orgName || '?'}
              size="sm"
            />
            {hasMultipleOrgs && (
              <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-white/20 flex items-center justify-center">
                <ChevronDown size={8} className="text-white" />
              </span>
            )}
          </Button>
        )}

        {/* Desktop: org context pill / switcher (unchanged from original) */}
        {currentOrg && (
          <div className="relative hidden md:block" ref={dropdownRef}>
            <Button
              variant="ghost"
              onClick={() => hasMultipleOrgs ? setDropdownOpen(!dropdownOpen) : navigate({ to: `/org/${currentOrg.orgSlug}/home` as '/' })}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-medium bg-[var(--color-surface-warm)] border border-[var(--color-border-light)] text-[var(--color-text)] hover:bg-[var(--color-surface-warm)]"
            >
              <span
                className={`w-2 h-2 rounded-full ${STATUS_DOT[currentOrg.status] || STATUS_DOT.active}`}
              />
              <span className="truncate max-w-[120px]">
                {currentOrg.orgName || currentOrg.memberNumber || 'Org'}
              </span>
              {hasMultipleOrgs && <ChevronDown size={12} className={`transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />}
            </Button>

            {/* Desktop dropdown */}
            {dropdownOpen && hasMultipleOrgs && (
              <div className="absolute right-0 top-full mt-1 w-[280px] bg-[var(--color-surface)] border border-[var(--color-border-light)] rounded-[12px] shadow-lg overflow-hidden z-50">
                <div className="py-1">
                  {orgs.map((org) => (
                    <Button
                      key={org.organizationId}
                      variant="ghost"
                      onClick={() => {
                        setDropdownOpen(false)
                        navigate({ to: `/org/${org.orgSlug}/home` as '/' })
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left ${
                        org.orgSlug === activeOrgSlug ? 'bg-[var(--color-surface-warm)]' : ''
                      }`}
                    >
                      <span
                        className={`w-2.5 h-2.5 rounded-full shrink-0 ${STATUS_DOT[org.status] || STATUS_DOT.active}`}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-[var(--color-text)] truncate">
                          {org.orgName || 'Organization'}
                        </p>
                        <p className="text-[11px] text-[var(--color-muted)]">
                          {STATUS_LABEL[org.status] || 'Active'}
                          {org.memberNumber ? ` · ${org.memberNumber}` : ''}
                        </p>
                      </div>
                      {org.orgSlug === activeOrgSlug && (
                        <span className="text-[var(--color-primary)] text-[11px] font-semibold shrink-0">Current</span>
                      )}
                    </Button>
                  ))}
                </div>
                <div className="border-t border-[var(--color-border-light)]">
                  <Link
                    to={"/my/organizations" as "/"}
                    onClick={() => setDropdownOpen(false)}
                    className="block px-4 py-2.5 text-[12px] font-medium text-[var(--color-primary)] hover:bg-[var(--color-surface-warm)] transition-colors"
                  >
                    Join another organization
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}

        {/* No orgs — empty state */}
        {orgs.length === 0 && (
          <Link
            to={"/my/organizations" as "/"}
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

      {/* Mobile org picker sheet */}
      <OrgPickerSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        orgs={orgs}
        activeOrgSlug={activeOrgSlug}
      />
    </header>
  )
}
