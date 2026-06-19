/**
 * OrgPickerSheet — mobile bottom sheet for org switching.
 *
 * Shows org list with status dots, role badges, and "Join another org" link.
 * Triggered from mobile header avatar tap.
 */

import { Link, useNavigate } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import {
  Button,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  Badge,
} from '@monobase/ui'
import { AvatarInitials } from '@/components/patterns/avatar-initials'
import type { OrgMembership } from '@/hooks/use-my-orgs'

const STATUS_DOT: Record<string, string> = {
  active: 'bg-[var(--color-success)]',
  grace: 'bg-[var(--color-warning)]',
  lapsed: 'bg-[var(--color-error)]',
  pending: 'bg-[var(--color-info)]',
}

const STATUS_LABEL: Record<string, string> = {
  active: 'Active',
  grace: 'Grace Period',
  lapsed: 'Lapsed',
  pending: 'Pending',
}

interface OrgPickerSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  orgs: OrgMembership[]
  activeOrgSlug: string | null
  officerOrgIds?: Set<string>
}

export function OrgPickerSheet({
  open,
  onOpenChange,
  orgs,
  activeOrgSlug,
  officerOrgIds,
}: OrgPickerSheetProps) {
  const navigate = useNavigate()

  function handleSelectOrg(org: OrgMembership) {
    onOpenChange(false)
    navigate({ to: `/org/${org.orgSlug}/home` as '/' })
  }

  function getRoleLabel(org: OrgMembership): string {
    if (officerOrgIds?.has(org.organizationId)) return 'Officer'
    return 'Member'
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-[16px] max-h-[70vh]">
        <SheetHeader className="pb-3 border-b border-[var(--color-border-light)]">
          <SheetTitle className="text-base">Your Organizations</SheetTitle>
        </SheetHeader>

        <div className="py-2 overflow-y-auto">
          {orgs.map((org) => {
            const isActive = org.orgSlug === activeOrgSlug
            const role = getRoleLabel(org)

            return (
              <Button
                variant="ghost"
                key={org.organizationId}
                onClick={() => handleSelectOrg(org)}
                className={`w-full flex items-center gap-3 px-4 py-3 h-auto rounded-sm transition-colors ${
                  isActive
                    ? 'bg-[var(--color-surface-warm)]'
                    : 'hover:bg-[var(--color-surface-warm)]'
                }`}
              >
                <AvatarInitials
                  name={org.orgName || '?'}
                  size="sm"
                  statusRing={isActive ? 'info' : undefined}
                />
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-medium text-[var(--color-text)] truncate">
                    {org.orgName || 'Organization'}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[org.status] || STATUS_DOT.active}`}
                    />
                    <span className="text-xs text-[var(--color-muted)]">
                      {STATUS_LABEL[org.status] || 'Active'}
                    </span>
                    {org.memberNumber && (
                      <span className="text-xs text-[var(--color-muted)]">
                        · #{org.memberNumber}
                      </span>
                    )}
                  </div>
                </div>
                <Badge variant="secondary" className="text-[0.625rem] px-1.5 py-0 shrink-0">
                  {role}
                </Badge>
                {isActive && (
                  <span className="text-[var(--color-primary)] text-xs font-semibold shrink-0">
                    Current
                  </span>
                )}
              </Button>
            )
          })}
        </div>

        {/* Join another org */}
        <div className="pt-2 border-t border-[var(--color-border-light)]">
          <Link
            to={"/my/organizations" as "/"}
            onClick={() => onOpenChange(false)}
            className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-[var(--color-primary)] hover:bg-[var(--color-surface-warm)] rounded-sm transition-colors"
          >
            <Plus size={16} />
            Join another organization
          </Link>
        </div>
      </SheetContent>
    </Sheet>
  )
}
