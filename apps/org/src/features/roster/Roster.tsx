import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { Button, ConfirmDialog, EmptyState, ErrorState, Input, Skeleton, StatusBadge, ToggleGroup, ToggleGroupItem } from '@monobase/ui'
import { useOrgs, useSelectedOrg } from '../org/use-org'
import { OrgPicker } from '../org/OrgPicker'
import { useRoster, type RosterMember, type MemberFilter } from './use-roster'
import { useBulkSend, type BulkMember } from './use-bulk-send'
import { BulkResults } from './BulkResults'
import { AddMemberDialog } from './AddMemberDialog'

// Engine membership status → StatusBadge key (colour + label). Unmapped statuses
// (expired/removed/resigned/…) fall through to a muted badge with the raw text.
type KnownStatus = 'active' | 'grace' | 'lapsed' | 'pending' | 'suspended'
const STATUS_BADGE: Record<string, KnownStatus> = {
  active: 'active',
  gracePeriod: 'grace',
  lapsed: 'lapsed',
  pendingPayment: 'pending',
  suspended: 'suspended',
}

const FILTERS: { value: MemberFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'lapsed', label: 'Lapsed' },
  { value: 'due', label: 'Due soon' },
]

// "Member since {year} · {tier}" — present facts only; omit either piece when absent.
function metaLine(m: RosterMember): string {
  const parts: string[] = []
  if (m.joinedAt) {
    const y = new Date(m.joinedAt).getFullYear()
    if (!Number.isNaN(y)) parts.push(`Member since ${y}`)
  }
  if (m.tier) parts.push(m.tier)
  return parts.join(' · ')
}

// ─── Presentational ─────────────────────────────────────────────────────────

export interface RosterViewProps {
  orgName: string
  members: RosterMember[]
  /** True when the roster query errored (e.g. 403 — not an officer/admin). */
  errored?: boolean
  /** Retries the roster query (wired to the ErrorState "Try again"). */
  onRetry?: () => void
  /** When present, enables bulk select-and-send. */
  orgId?: string
  /** Active server-side status filter (chip). */
  filter?: MemberFilter
  /** When present, renders the filter chips and changes the server query. */
  onFilterChange?: (f: MemberFilter) => void
  /** Total member count (for the thin orientation strip). */
  totalCount?: number
  /** "+ Add member" control (container-owned: it uses query hooks). */
  addMemberSlot?: ReactNode
}

export function RosterView({
  orgName, members, errored, onRetry, orgId,
  filter = 'all', onFilterChange, totalCount, addMemberSlot,
}: RosterViewProps) {
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
        <ErrorState
          message="We couldn't load the roster. You may need officer or admin access."
          onRetry={onRetry}
        />
      </div>
    )
  }

  if (members.length === 0) {
    // A filter that returns nothing is NOT a fresh org — offer to clear, not to import.
    if (filter !== 'all') {
      return (
        <div className="flex flex-col gap-4 p-4">
          {orgName && <h1 className="text-title font-semibold text-foreground">{orgName}</h1>}
          <EmptyState headline="No members match this filter" description="Try a different filter to see more members." />
          <Button variant="outline" className="min-h-tap self-start" onClick={() => onFilterChange?.('all')}>
            Show all members
          </Button>
        </div>
      )
    }
    return (
      <div className="flex flex-col gap-4 p-4">
        {orgName && <h1 className="text-title font-semibold text-foreground">{orgName}</h1>}
        <EmptyState headline="No members yet" description="Import your roster or add your first member." />
        <div className="flex flex-wrap gap-3">
          <Button asChild className="min-h-tap">
            <Link to="/import">Import roster</Link>
          </Button>
          {addMemberSlot}
        </div>
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
        onBack={() => { bulk.reset(); setSendMembers(null); setSelecting(false); setSelected(new Set()) }}
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
    // Mint exactly the set the confirm count reflects — visibleSelected (filtered +
    // selected), NOT the raw `selected` set, which may retain rows hidden by search.
    const list: BulkMember[] = visibleSelected.map((m) => ({
      membershipId: m.membershipId,
      personId: m.personId,
      name: m.name,
    }))
    setSendMembers(list)
    setConfirmOpen(false)
  }

  return (
    <div className="flex flex-col gap-4 p-4 pb-28">
      <div className="flex items-center justify-between gap-3">
        {orgName && <h1 className="text-title font-semibold text-foreground">{orgName}</h1>}
        {orgId && (
          <div className="flex items-center gap-2 shrink-0">
            {addMemberSlot}
            <Button
              variant="outline"
              className="min-h-tap shrink-0"
              onClick={() => { setSelecting((s) => !s); setSelected(new Set()) }}
            >
              {selecting ? 'Cancel' : 'Select'}
            </Button>
          </div>
        )}
      </div>

      {totalCount != null && (
        <p className="text-caption text-muted-foreground">
          {/* Honest about the pageSize=100 cap: never imply more rows than are rendered. */}
          {members.length < totalCount
            ? `Showing ${members.length} of ${totalCount} members`
            : `${totalCount} member${totalCount === 1 ? '' : 's'}`}
        </p>
      )}

      <Input
        type="search"
        value={query}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
        placeholder="Search members by name, number, or status"
        aria-label="Search members"
        className="min-h-tap"
      />

      {onFilterChange && (
        <ToggleGroup
          type="single"
          value={filter}
          onValueChange={(v) => { if (v) onFilterChange(v as MemberFilter) }}
          className="flex-wrap justify-start gap-2"
          aria-label="Filter members"
        >
          {FILTERS.map((f) => (
            <ToggleGroupItem key={f.value} value={f.value} className="min-h-tap px-4">
              {f.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      )}

      {selecting && (
        <label className="flex min-h-tap items-center gap-3 text-body text-foreground">
          <input
            type="checkbox"
            className="size-5"
            aria-label="Select all"
            checked={allFilteredSelected}
            aria-checked={selectedCount > 0 && !allFilteredSelected ? 'mixed' : allFilteredSelected}
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
          const badge = STATUS_BADGE[m.status]
          return (
            <li
              key={m.membershipId}
              className="flex flex-col gap-1.5 rounded-lg border border-[var(--color-border-light)] bg-surface px-4 py-3"
              onClick={selecting ? () => toggle(m.membershipId) : undefined}
            >
              <div className="flex items-center justify-between gap-3">
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
                  <span className="text-body font-medium text-foreground truncate">{m.name}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {badge ? (
                    <StatusBadge status={badge} />
                  ) : (
                    <StatusBadge variant="muted">{m.status}</StatusBadge>
                  )}
                  {/* Per-row unpaid cue for the full derivation (open invoice on an otherwise
                      "Active" member) — the Pending badge already conveys pendingPayment. */}
                  {m.unpaid && m.status !== 'pendingPayment' && (
                    <StatusBadge variant="warning">Unpaid</StatusBadge>
                  )}
                  {!selecting && (
                    <Button asChild className="min-h-tap">
                      <Link
                        to="/members/$membershipId/send"
                        params={{ membershipId: m.membershipId }}
                        search={{ personId: m.personId, name: m.name }}
                        aria-label={`Send pay-link to ${m.name}`}
                      >
                        Send pay-link
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
              {/* Present-facts meta on its own full-width line so "Member since … · tier" is never crushed by the action. */}
              {(m.memberNumber || metaLine(m)) && (
                <span className={`text-caption text-muted-foreground truncate ${selecting ? 'pl-8' : ''}`}>
                  {[m.memberNumber, metaLine(m)].filter(Boolean).join(' · ')}
                </span>
              )}
            </li>
          )
        })}
      </ul>
      )}

      {selecting && selectedCount > 0 && (
        <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 border-t border-[var(--color-border-light)] bg-surface p-4">
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
  const [filter, setFilter] = useState<MemberFilter>('all')
  const { status: rosterStatus, members, totalCount, refetch } = useRoster(orgId, filter)

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
          <div className="flex flex-col gap-3 p-4" role="status" aria-label="Loading roster">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        ) : (
          <RosterView
            orgName={orgName}
            members={members}
            errored={rosterStatus === 'error'}
            onRetry={refetch}
            orgId={orgId ?? undefined}
            filter={filter}
            onFilterChange={setFilter}
            totalCount={rosterStatus === 'error' ? undefined : totalCount}
            addMemberSlot={orgId ? <AddMemberDialog orgId={orgId} /> : undefined}
          />
        )}
      </div>
    </div>
  )
}
