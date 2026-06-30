import { useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { toast } from 'sonner'
import { Button, EmptyState, ErrorState, Input, Skeleton, StatusBadge, centavosToPhp } from '@monobase/ui'
import { useSelectedOrg } from '../org/use-org'
import { useAttendees, useCheckIn, useMarkNoShow, useEvent, type Attendee } from './use-event-detail'

const EVENT_STATUS: Record<string, { label: string; variant: 'muted' | 'success' | 'error' | 'info' }> = {
  draft: { label: 'Draft', variant: 'muted' },
  published: { label: 'Published', variant: 'success' },
  registration_open: { label: 'Registration open', variant: 'success' },
  registration_closed: { label: 'Registration closed', variant: 'muted' },
  in_progress: { label: 'In progress', variant: 'info' },
  completed: { label: 'Completed', variant: 'muted' },
  cancelled: { label: 'Cancelled', variant: 'error' },
}
const REG_STATUS: Record<string, { label: string; variant: 'info' | 'success' | 'muted' | 'error' }> = {
  registered: { label: 'Registered', variant: 'info' },
  confirmed: { label: 'Confirmed', variant: 'success' },
  waitlisted: { label: 'Waitlisted', variant: 'muted' },
  checked_in: { label: 'Confirmed', variant: 'success' },
  no_show: { label: 'No-show', variant: 'error' },
  cancelled: { label: 'Cancelled', variant: 'muted' },
  refunded: { label: 'Refunded', variant: 'muted' },
}

function fmtDateTime(d: unknown): string {
  const t = new Date(d as string)
  return Number.isNaN(t.getTime()) ? '' : t.toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })
}

function AttendeeRow({
  a, paidEvent, pending, failed, blocked, onCheckIn, onNoShow,
}: {
  a: Attendee
  paidEvent: boolean
  pending: boolean
  failed: boolean
  blocked: boolean
  onCheckIn: (a: Attendee) => void
  onNoShow: (a: Attendee) => void
}) {
  const reg = REG_STATUS[a.status] ?? { label: a.status, variant: 'muted' as const }
  const showActions = !a.checkedIn && a.status !== 'no_show' && a.status !== 'cancelled' && a.status !== 'refunded'
  return (
    <li className="flex flex-col gap-2 rounded-lg border border-[var(--color-border-light)] bg-surface px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-1 min-w-0">
          <span className="text-body font-medium text-foreground truncate">{a.label}</span>
          {a.memberNumber && <span className="text-caption text-muted-foreground">{a.memberNumber}</span>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {a.checkedIn ? <StatusBadge variant="success">Checked in</StatusBadge> : <StatusBadge variant={reg.variant}>{reg.label}</StatusBadge>}
          {paidEvent && (a.paid ? <StatusBadge variant="success">Paid</StatusBadge> : <StatusBadge variant="warning">Unpaid</StatusBadge>)}
        </div>
      </div>
      {showActions && (blocked ? (
        // A 403 (wrong role / no 2FA) is permanent — don't dangle a retry that always fails.
        <p role="alert" className="text-caption text-[var(--color-error)]">Only the Treasurer or President (with 2FA) can do this.</p>
      ) : (
        <div className="flex items-center gap-2">
          <Button className="min-h-tap" disabled={pending} onClick={() => onCheckIn(a)}>
            {pending ? 'Checking in…' : failed ? 'Retry check-in' : 'Check in'}
          </Button>
          <Button variant="outline" className="min-h-tap" disabled={pending} onClick={() => onNoShow(a)}>
            No-show
          </Button>
          {failed && <span role="alert" className="text-caption text-[var(--color-error)]">Failed — tap retry</span>}
        </div>
      ))}
    </li>
  )
}

export function EventDetail({ eventId }: { eventId: string }) {
  const { orgId } = useSelectedOrg()
  const { event, isLoading: evLoading, isError: evError, refetch: refetchEvent } = useEvent(orgId, eventId)
  const { attendees, summary, total, truncated, isLoading: atLoading, isError: atError, refetch } = useAttendees(orgId, eventId)
  const checkIn = useCheckIn(eventId)
  const noShow = useMarkNoShow(eventId)

  const [query, setQuery] = useState('')
  const [pending, setPending] = useState<Set<string>>(new Set())
  const [failed, setFailed] = useState<Set<string>>(new Set())
  const [blocked, setBlocked] = useState<Set<string>>(new Set())

  const paidEvent = (event?.registrationFee ?? 0) > 0
  const q = query.trim().toLowerCase()
  const filtered = useMemo(
    () => (q ? attendees.filter((a) => a.label.toLowerCase().includes(q) || (a.memberNumber ?? '').toLowerCase().includes(q)) : attendees),
    [attendees, q],
  )

  function mutateRow(id: string, run: () => Promise<unknown>, okMsg: string) {
    setPending((p) => new Set(p).add(id))
    setFailed((f) => { const n = new Set(f); n.delete(id); return n })
    run().then(
      () => { setPending((p) => { const n = new Set(p); n.delete(id); return n }); toast.success(okMsg) },
      (e: Error) => {
        setPending((p) => { const n = new Set(p); n.delete(id); return n })
        // Permission errors are permanent — block the row (no retry); transient → offer retry.
        if (/not allowed|Treasurer|President/i.test(e.message)) setBlocked((b) => new Set(b).add(id))
        else setFailed((f) => new Set(f).add(id))
        toast.error(e.message)
      },
    )
  }
  const onCheckIn = (a: Attendee) =>
    mutateRow(a.registrationId, () => checkIn.mutateAsync({ personId: a.personId, registrationId: a.registrationId }), `Checked in ${a.label}`)
  const onNoShow = (a: Attendee) =>
    mutateRow(a.registrationId, () => noShow.mutateAsync({ registrationId: a.registrationId }), `Marked ${a.label} no-show`)

  // While the selected org resolves, the event query is disabled (not loading) — treat as
  // loading so we never flash the access error on a deep link.
  if (evLoading || (!orgId && !event)) {
    return (
      <div className="flex flex-col gap-4 p-4" role="status" aria-label="Loading event">
        <Skeleton className="h-20 w-full rounded-lg" />
        <Skeleton className="h-40 w-full rounded-lg" />
      </div>
    )
  }
  if (evError || !event) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <BackLink />
        <ErrorState message="We couldn't load this event." onRetry={refetchEvent} />
      </div>
    )
  }

  const evStatus = EVENT_STATUS[event.status] ?? { label: event.status, variant: 'muted' as const }

  return (
    <div className="flex flex-col gap-5 p-4">
      <BackLink />

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-title font-semibold text-foreground">{event.title}</h1>
          <StatusBadge variant={evStatus.variant}>{evStatus.label}</StatusBadge>
        </div>
        <p className="text-caption text-muted-foreground">
          {[fmtDateTime(event.startDate), event.location, paidEvent ? centavosToPhp(event.registrationFee) : 'Free'].filter(Boolean).join(' · ')}
        </p>
      </div>

      {/* Live count summary (client-side tally) */}
      <p className="text-caption text-muted-foreground">
        {`${summary.total} attending${paidEvent ? ` · ${summary.paid} paid` : ''} · ${summary.checkedIn} checked in${summary.noShow > 0 ? ` · ${summary.noShow} no-show` : ''}`}
      </p>
      {truncated && (
        <p role="alert" className="text-caption text-warning">
          Showing the first {attendees.length} of {total} attendees — search to find a specific member.
        </p>
      )}

      <Input
        type="search"
        value={query}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
        placeholder="Search attendees"
        aria-label="Search attendees"
        className="min-h-tap"
      />

      <section className="flex flex-col gap-3">
        <h2 className="text-section font-semibold text-foreground">Attendees</h2>
        {atLoading ? (
          <Skeleton className="h-32 w-full rounded-lg" />
        ) : atError ? (
          <ErrorState message="We couldn't load attendees." onRetry={refetch} />
        ) : attendees.length === 0 ? (
          <EmptyState headline="No registrations yet" description="Members who register will appear here." />
        ) : filtered.length === 0 ? (
          <p className="text-body text-muted-foreground">No attendees match “{query}”.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {filtered.map((a) => (
              <AttendeeRow
                key={a.registrationId}
                a={a}
                paidEvent={paidEvent}
                pending={pending.has(a.registrationId)}
                failed={failed.has(a.registrationId)}
                blocked={blocked.has(a.registrationId)}
                onCheckIn={onCheckIn}
                onNoShow={onNoShow}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function BackLink() {
  return (
    <Link to="/events" className="inline-flex min-h-tap items-center text-body text-primary">
      ← Back to events
    </Link>
  )
}
