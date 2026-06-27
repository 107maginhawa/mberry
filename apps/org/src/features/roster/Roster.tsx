import { Link } from '@tanstack/react-router'
import { EmptyState, StatusBadge } from '@monobase/ui'
import { useOrgs, useSelectedOrg } from '../org/use-org'
import { OrgPicker } from '../org/OrgPicker'
import { useRoster, type RosterMember } from './use-roster'

// Known membership statuses that StatusBadge renders with colour + label.
// Others fall through to variant="muted" with the raw status text.
const KNOWN_STATUSES = new Set(['active', 'grace', 'lapsed', 'pending', 'suspended'])
type KnownStatus = 'active' | 'grace' | 'lapsed' | 'pending' | 'suspended'

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
            className="flex items-center justify-between gap-3 rounded-lg border border-plum-100 bg-white px-4 py-3"
          >
            <div className="flex flex-col gap-1 min-w-0">
              <span className="text-body font-medium text-plum-900 truncate">{m.name}</span>
              {m.memberNumber && (
                <span className="text-caption text-plum-500">{m.memberNumber}</span>
              )}
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {KNOWN_STATUSES.has(m.status) ? (
                <StatusBadge status={m.status as KnownStatus} />
              ) : (
                <StatusBadge variant="muted">{m.status}</StatusBadge>
              )}
              <a
                href={href(m)}
                className="min-h-tap inline-flex items-center justify-center rounded-md bg-plum-600 px-4 text-sm font-semibold text-white hover:bg-plum-700 focus-visible:outline focus-visible:outline-2"
                aria-label={`Send pay-link to ${m.name}`}
              >
                Send pay-link
              </a>
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
        <div className="px-4 pb-2 flex justify-end">
          <Link
            to="/dues"
            className="text-sm font-medium text-plum-500 hover:text-plum-700"
          >
            Dues →
          </Link>
        </div>
        {orgs.length > 1 && (
          <div className="px-4 pb-2">
            <OrgPicker />
          </div>
        )}
        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <span className="text-body text-plum-400" role="status" aria-live="polite">
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
