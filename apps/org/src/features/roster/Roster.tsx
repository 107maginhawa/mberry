import { useEffect, useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Button, ConfirmDialog, EmptyState, Input, StatusBadge } from '@monobase/ui'
import { useOrgs, useSelectedOrg } from '../org/use-org'
import { OrgPicker } from '../org/OrgPicker'
import { useRoster, type RosterMember } from './use-roster'
import { useBulkSend, type BulkMember } from './use-bulk-send'
import { BulkResults } from './BulkResults'

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
  /** When present, enables bulk select-and-send. */
  orgId?: string
}

export function RosterView({ orgName, members, errored, linkFor, orgId }: RosterViewProps) {
  const href = linkFor ?? ((m: RosterMember) => `/members/${m.membershipId}/send`)
  const [query, setQuery] = useState('')
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [sendMembers, setSendMembers] = useState<BulkMember[] | null>(null)

  const q = query.trim().toLowerCase()
  const filtered = useMemo(
    () =>
      q
        ? members.filter(
            (m) =>
              m.name.toLowerCase().includes(q) ||
              (m.memberNumber ?? '').toLowerCase().includes(q) ||
              m.status.toLowerCase().includes(q),
          )
        : members,
    [members, q],
  )

  // Drop filtered-out rows from the selection (select-all = currently-filtered only).
  const filteredIds = useMemo(() => new Set(filtered.map((m) => m.membershipId)), [filtered])
  const visibleSelected = filtered.filter((m) => selected.has(m.membershipId))
  const selectedCount = visibleSelected.length
  const allFilteredSelected = filtered.length > 0 && selectedCount === filtered.length

  const bulk = useBulkSend(orgId ?? '', sendMembers ?? [])

  // Kick off the sequential mint once a confirmed send-set is committed.
  // start() is ref-guarded against double-fire; depend only on the committed set.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (sendMembers) bulk.start() }, [sendMembers])

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

  // Once a send has started, take over the screen with the results panel.
  if (sendMembers) {
    return (
      <BulkResults
        members={sendMembers}
        results={bulk.results}
        progress={bulk.progress}
        onBack={() => { setSendMembers(null); setSelecting(false); setSelected(new Set()) }}
      />
    )
  }

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const toggleAll = () =>
    setSelected((prev) => {
      const next = new Set([...prev].filter((id) => !filteredIds.has(id)))
      if (!allFilteredSelected) filtered.forEach((m) => next.add(m.membershipId))
      return next
    })

  function startSend() {
    const list: BulkMember[] = members
      .filter((m) => selected.has(m.membershipId))
      .map((m) => ({ membershipId: m.membershipId, personId: m.personId, name: m.name }))
    setSendMembers(list)
    setConfirmOpen(false)
  }

  return (
    <div className="flex flex-col gap-4 p-4 pb-28">
      <div className="flex items-center justify-between gap-3">
        {orgName && <h1 className="text-title font-semibold text-foreground">{orgName}</h1>}
        {orgId && (
          <Button
            variant="outline"
            className="min-h-tap shrink-0"
            onClick={() => { setSelecting((s) => !s); setSelected(new Set()) }}
          >
            {selecting ? 'Cancel' : 'Select'}
          </Button>
        )}
      </div>

      <Input
        type="search"
        value={query}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
        placeholder="Search members by name, number, or status"
        aria-label="Search members"
        className="min-h-tap"
      />

      {selecting && (
        <label className="flex items-center gap-3 text-body text-foreground">
          <input
            type="checkbox"
            className="size-5"
            aria-label="Select all"
            checked={allFilteredSelected}
            ref={(el) => { if (el) el.indeterminate = selectedCount > 0 && !allFilteredSelected }}
            onChange={toggleAll}
          />
          Select all ({selectedCount} selected)
        </label>
      )}

      {filtered.length === 0 ? (
        <p className="text-body text-muted-foreground">No members match “{query}”.</p>
      ) : (
      <ul className="flex flex-col gap-3">
        {filtered.map((m) => {
          const checked = selected.has(m.membershipId)
          return (
            <li
              key={m.membershipId}
              className="flex items-center justify-between gap-3 rounded-lg border border-[var(--color-border-light)] bg-surface px-4 py-3"
              onClick={selecting ? () => toggle(m.membershipId) : undefined}
            >
              <div className="flex items-center gap-3 min-w-0">
                {selecting && (
                  <input
                    type="checkbox"
                    className="size-5 shrink-0"
                    aria-label={`Select ${m.name}`}
                    checked={checked}
                    onChange={() => toggle(m.membershipId)}
                    onClick={(e) => e.stopPropagation()}
                  />
                )}
                <div className="flex flex-col gap-1 min-w-0">
                  <span className="text-body font-medium text-foreground truncate">{m.name}</span>
                  {m.memberNumber && (
                    <span className="text-caption text-muted-foreground">{m.memberNumber}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {KNOWN_STATUSES.has(m.status) ? (
                  <StatusBadge status={m.status as KnownStatus} />
                ) : (
                  <StatusBadge variant="muted">{m.status}</StatusBadge>
                )}
                {!selecting && (
                  <Button asChild className="min-h-tap">
                    <a href={href(m)} aria-label={`Send pay-link to ${m.name}`}>
                      Send pay-link
                    </a>
                  </Button>
                )}
              </div>
            </li>
          )
        })}
      </ul>
      )}

      {selecting && selectedCount > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-10 border-t border-[var(--color-border-light)] bg-surface p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <div className="max-w-lg mx-auto">
            <Button className="min-h-tap w-full" onClick={() => setConfirmOpen(true)}>
              Send links to {selectedCount} selected
            </Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Send ${selectedCount} pay-link${selectedCount === 1 ? '' : 's'}?`}
        description="Each selected member gets a pay-link for their oldest outstanding dues. Members with no dues are skipped."
        confirmLabel="Send pay-links"
        onConfirm={startSend}
      />
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
            orgId={orgId ?? undefined}
            linkFor={(m) =>
              `/members/${m.membershipId}/send?personId=${encodeURIComponent(m.personId)}&name=${encodeURIComponent(m.name)}`
            }
          />
        )}
      </div>
    </div>
  )
}
