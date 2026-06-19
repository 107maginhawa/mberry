import { useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, NavIcon } from '@monobase/ui'
import { Bell, ChevronDown } from 'lucide-react'
import { api } from '@/lib/api'
import { AvatarInitials } from '@/components/patterns/avatar-initials'
import { OrgPickerSheet } from '@/components/layout/org-picker-sheet'
import { useMyOrgs } from '@/hooks/use-my-orgs'

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
  const [sheetOpen, setSheetOpen] = useState(false)
  const navigate = useNavigate()

  const { data: notifCount = 0 } = useQuery({
    queryKey: ['notif-unread-count'],
    queryFn: async () => {
      const json = await api.get<any>('/api/notifs?limit=50&channel=in-app')
      const items = json.data || json.items || []
      return items.filter((n: any) => n.status !== 'read').length as number
    },
  })

  const currentOrg = orgs.find((o) => o.orgSlug === activeOrgSlug) || orgs[0]
  const hasMultipleOrgs = orgs.length >= 2

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-12 px-4 md:px-6 bg-[var(--color-primary)] text-white md:bg-[var(--color-nav-elevated)] md:backdrop-blur-[var(--nav-blur)] md:text-[var(--color-text)] md:border-b md:border-[var(--color-border-light)]">
      {/* Left: logo (mobile only) */}
      <div className="flex items-center md:hidden">
        <img src="/memberry-logo-white.png" alt="Memberry" className="h-6 w-auto" width={96} height={24} />
      </div>

      {/* Desktop: user name */}
      <div className="hidden md:block">
        {userName && (
          <span className="text-sm text-[var(--color-muted)]">{userName}</span>
        )}
      </div>

      {/* Right: org pill + bell */}
      <div className="flex items-center gap-3">
        {/* Mobile: avatar tap → bottom sheet */}
        {currentOrg && (
          <Button
            variant="ghost"
            onClick={() => setSheetOpen(true)}
            className="md:hidden relative p-0 min-w-[44px] min-h-[44px]"
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

        {/* Desktop: org context pill / switcher */}
        {currentOrg && (
          <div className="hidden md:block">
            {hasMultipleOrgs ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  {/* ui-c-exempt: methodology-carry — status pill rendered as Button (clickable badge) */}
                  <Button
                    variant="ghost"
                    className="group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[var(--color-surface-warm)] border border-[var(--color-border-light)] text-[var(--color-text)] hover:bg-[var(--color-surface-warm)]"
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${STATUS_DOT[currentOrg.status] || STATUS_DOT.active}`}
                    />
                    <span className="truncate max-w-[120px]">
                      {currentOrg.orgName || currentOrg.memberNumber || 'Org'}
                    </span>
                    <ChevronDown size={12} className="transition-transform group-data-[state=open]:rotate-180" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[var(--dropdown-width)] rounded-md p-0 overflow-hidden">
                  {orgs.map((org) => (
                    <DropdownMenuItem
                      key={org.organizationId}
                      onSelect={() => navigate({ to: `/org/${org.orgSlug}/home` as '/' })}
                      className={`flex items-center gap-3 px-4 py-3 cursor-pointer ${
                        org.orgSlug === activeOrgSlug ? 'bg-[var(--color-surface-warm)]' : ''
                      }`}
                    >
                      <span
                        className={`w-2.5 h-2.5 rounded-full shrink-0 ${STATUS_DOT[org.status] || STATUS_DOT.active}`}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[var(--color-text)] truncate">
                          {org.orgName || 'Organization'}
                        </p>
                        <p className="text-xs text-[var(--color-muted)]">
                          {STATUS_LABEL[org.status] || 'Active'}
                          {org.memberNumber ? ` · ${org.memberNumber}` : ''}
                        </p>
                      </div>
                      {org.orgSlug === activeOrgSlug && (
                        <span className="text-[var(--color-primary)] text-xs font-semibold shrink-0">Current</span>
                      )}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator className="m-0" />
                  <DropdownMenuItem
                    onSelect={() => navigate({ to: '/my/organizations' as '/' })}
                    className="px-4 py-2.5 text-xs font-medium text-[var(--color-primary)] cursor-pointer"
                  >
                    Join another organization
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button
                variant="ghost"
                onClick={() => navigate({ to: `/org/${currentOrg.orgSlug}/home` as '/' })}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[var(--color-surface-warm)] border border-[var(--color-border-light)] text-[var(--color-text)] hover:bg-[var(--color-surface-warm)]"
              >
                <span
                  className={`w-2 h-2 rounded-full ${STATUS_DOT[currentOrg.status] || STATUS_DOT.active}`}
                />
                <span className="truncate max-w-[120px]">
                  {currentOrg.orgName || currentOrg.memberNumber || 'Org'}
                </span>
              </Button>
            )}
          </div>
        )}

        {/* No orgs — empty state */}
        {orgs.length === 0 && (
          <Link
            to={"/my/organizations" as "/"}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-white/15 md:bg-[var(--color-surface-warm)] md:border md:border-[var(--color-border-light)] md:text-[var(--color-muted)]"
          >
            Join an organization
          </Link>
        )}

        {/* Notification bell */}
        <Link
          to="/my/notifications"
          aria-label="Notifications"
          className="relative p-1.5 rounded-full hover:bg-white/10 md:hover:bg-[var(--color-surface-warm)] transition-colors"
        >          <NavIcon icon={Bell} />
          {notifCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-[var(--color-error)] text-white text-[0.625rem] font-bold px-1">
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
