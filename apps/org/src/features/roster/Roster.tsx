import { Link } from '@tanstack/react-router'
import { Button, EmptyState, StatusBadge } from '@monobase/ui'
import { useOrgs, useSelectedOrg } from '../org/use-org'
import { OrgPicker } from '../org/OrgPicker'
import { useRoster, type RosterMember } from './use-roster'

// Known membership statuses that StatusBadge renders with colour + label.
// Others fall through to variant="muted" with the raw status text.
const KNOWN_STATUSES = new Set(['active', 'grace', 'lapsed', 'pending', 'suspended'])
type KnownStatus = 'active' | 'grace' | 'lapsed' | 'pending' | 'suspended'

// Shared nav-link style — ≥48px tap target, token color (DESIGN.md).
const NAV_LINK = 'inline-flex min-h-tap items-center text-body font-medium text-primary underline'

// ─── Presentational ─────────────────────────────────────────────────────────

export interface RosterViewProps {
  orgName: string
  members: RosterMember[]
  /** True when the roster query errored (e.g. 403 — not an officer/admin). */
  errored?: boolean
  /** Maps a member to a send-pay-link href. Defaults to /members/:id/send */
  linkFor?: (member: RosterMember) => string
}

export function RosterView({ orgName, members, errored, linkFor }: RosterViewProps) {
  const href = linkFor ?? ((m: RosterMember) => `/members/${m.membershipId}/send`)

  if (errored) {
    return (
      <div className="flex flex-col gap-4 p-4">
        {orgName && <h1 className="text-title font-semibold text-foreground">{orgName}</h1>}
        <EmptyState
          headline="Roster unavailable"
          description="You need officer or admin access to view this chapter's roster."
        />
      </div>
    )
  }

  if (members.length === 0) {
    return (
      <div className="flex flex-col gap-4 p-4">
        {orgName && <h1 className="text-title font-semibold text-foreground">{orgName}</h1>}
        <EmptyState headline="No members yet" description="Import your roster to get started." />
        <Button asChild className="min-h-tap self-start">
          <Link to="/import">Import roster</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      {orgName && <h1 className="text-title font-semibold text-foreground">{orgName}</h1>}
      <ul className="flex flex-col gap-3">
        {members.map((m) => (
          <li
            key={m.membershipId}
            className="flex items-center justify-between gap-3 rounded-lg border border-[var(--color-border-light)] bg-surface px-4 py-3"
          >
            <div className="flex flex-col gap-1 min-w-0">
              <span className="text-body font-medium text-foreground truncate">{m.name}</span>
              {m.memberNumber && (
                <span className="text-caption text-muted-foreground">{m.memberNumber}</span>
              )}
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {KNOWN_STATUSES.has(m.status) ? (
                <StatusBadge status={m.status as KnownStatus} />
              ) : (
                <StatusBadge variant="muted">{m.status}</StatusBadge>
              )}
              <Button asChild className="min-h-tap">
                <a href={href(m)} aria-label={`Send pay-link to ${m.name}`}>
                  Send pay-link
                </a>
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ─── Container ───────────────────────────────────────────────────────────────

export default function Roster() {
  const { orgs } = useOrgs()
  const { orgId } = useSelectedOrg()
  const { status: rosterStatus, members } = useRoster(orgId)

  const selectedOrg = orgs.find((o) => o.id === orgId)
  const orgName = selectedOrg?.name ?? ''

  const isLoading = rosterStatus === 'loading'

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <div className="max-w-lg mx-auto pt-4">
        <div className="px-4 pb-2 flex justify-between">
          <Link to="/import" className={NAV_LINK}>
            Import roster
          </Link>
          <Link to="/dues" className={NAV_LINK}>
            Dues
          </Link>
        </div>
        <div className="px-4 pb-2 flex gap-6">
          <Link to="/events" className={NAV_LINK}>Create event</Link>
          <Link to="/announcements" className={NAV_LINK}>Post announcement</Link>
          <Link to="/payment-settings" className={NAV_LINK}>Payment settings</Link>
        </div>
        {orgs.length > 1 && (
          <div className="px-4 pb-2">
            <OrgPicker />
          </div>
        )}
        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <span className="text-body text-muted-foreground" role="status" aria-live="polite">
              Loading…
            </span>
          </div>
        ) : (
          <RosterView
            orgName={orgName}
            members={members}
            errored={rosterStatus === 'error'}
            linkFor={(m) =>
              `/members/${m.membershipId}/send?personId=${encodeURIComponent(m.personId)}&name=${encodeURIComponent(m.name)}`
            }
          />
        )}
      </div>
    </div>
  )
}
