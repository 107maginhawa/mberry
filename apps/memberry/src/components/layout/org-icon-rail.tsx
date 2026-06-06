/**
 * OrgIconRail — Slack-style vertical icon rail for multi-org switching.
 *
 * Desktop only (hidden on mobile — mobile uses OrgPickerSheet).
 * Shows org avatars stacked vertically with active ring indicator.
 * Bottom "+" button navigates to /join.
 */

import { Link, useNavigate } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { Button, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger, Badge, NavIcon } from '@monobase/ui'
import { AvatarInitials } from '@/components/patterns/avatar-initials'
import { useMyOrgs, type OrgMembership } from '@/hooks/use-my-orgs'

const ROLE_LABEL: Record<string, string> = {
  active: 'Member',
  grace: 'Member',
  lapsed: 'Lapsed',
  pending: 'Pending',
}

interface OrgIconRailProps {
  /** Officer positions keyed by orgId, from parent context or query */
  officerOrgIds?: Set<string>
}

export function OrgIconRail({ officerOrgIds }: OrgIconRailProps) {
  const { orgs, activeOrgSlug, error } = useMyOrgs()
  const navigate = useNavigate()

  if (error) {
    return (
      <aside className="hidden md:flex w-[var(--rail-width)] bg-[var(--color-surface)] border-r border-[var(--color-border-light)] flex-col items-center py-3 shrink-0">
        <span className="text-[0.625rem] text-[var(--color-muted)] text-center px-1">Failed to load orgs</span>
      </aside>
    )
  }

  if (orgs.length === 0) {
    return (
      <aside className="hidden md:flex w-[var(--rail-width)] bg-[var(--color-surface)] border-r border-[var(--color-border-light)] flex-col items-center py-3 shrink-0">
        <Link
          to={"/my/organizations" as "/"}
          className="flex items-center justify-center w-[34px] h-[34px] rounded-[12px] border-2 border-dashed border-[var(--color-border-light)] text-[var(--color-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors"
          aria-label="Join an organization"
        >          <NavIcon icon={Plus} />
        </Link>
      </aside>
    )
  }

  function getRoleBadge(org: OrgMembership): string {
    if (officerOrgIds?.has(org.organizationId)) return 'Officer'
    return ROLE_LABEL[org.status] || 'Member'
  }

  return (
    <aside className="hidden md:flex w-[var(--rail-width)] bg-[var(--color-surface)] border-r border-[var(--color-border-light)] flex-col items-center py-3 shrink-0 gap-1">
      <TooltipProvider delayDuration={200}>
        {/* Org avatars */}
        <nav aria-label="Organization switcher" className="flex flex-col items-center gap-2 flex-1">
          {orgs.map((org) => {
            const isActive = org.orgSlug === activeOrgSlug
            const role = getRoleBadge(org)

            return (
              <Tooltip key={org.organizationId}>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    onClick={() =>
                      navigate({ to: `/org/${org.orgSlug}/home` as '/' })
                    }
                    className={`relative rounded-[12px] p-0 transition-all duration-150 ${
                      isActive
                        ? 'ring-2 ring-[var(--color-primary)] ring-offset-2'
                        : 'hover:ring-2 hover:ring-[var(--color-border-light)] hover:ring-offset-1'
                    }`}
                    aria-label={`Switch to ${org.orgName}`}
                    aria-current={isActive ? 'true' : undefined}
                  >
                    <AvatarInitials
                      name={org.orgName || '?'}
                      size="sm"
                    />
                    {/* Active indicator bar */}
                    {isActive && (
                      <span className="absolute -left-[10px] top-1/2 -translate-y-1/2 w-[3px] h-[20px] rounded-r-full bg-[var(--color-primary)]" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right" className="flex items-center gap-2">
                  <span>{org.orgName}</span>
                  <Badge variant="secondary" className="text-[0.625rem] px-1.5 py-0">
                    {role}
                  </Badge>
                </TooltipContent>
              </Tooltip>
            )
          })}
        </nav>

        {/* Join another org */}
        <div className="mt-auto pt-2 border-t border-[var(--color-border-light)]">
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                to={"/my/organizations" as "/"}
                className="flex items-center justify-center w-[34px] h-[34px] rounded-[12px] border-2 border-dashed border-[var(--color-border-light)] text-[var(--color-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors"
                aria-label="Join another organization"
              >                <NavIcon icon={Plus} />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">Join another org</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    </aside>
  )
}
