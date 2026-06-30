import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getEvent,
  listCustomEventRegistrations,
  searchCheckIns,
  checkInCustomEvent,
  updateEventRegistration,
  markEventRegistrationPaid,
  getEventRegistrationsSummary,
  listRosterMembers,
} from '@monobase/sdk-ts/generated'

export type OrgEventDetail = {
  id: string
  title: string
  startDate: string | Date
  endDate?: string | Date | null
  location?: string | null
  status: string
  registrationFee: number // centavos (0 = free)
  currency?: string | null
  capacity?: number | null
}

export function useEvent(orgId: string | null, eventId: string): {
  event?: OrgEventDetail
  isLoading: boolean
  isError: boolean
  refetch: () => void
} {
  const q = useQuery({
    queryKey: ['event', eventId],
    enabled: !!orgId && !!eventId,
    retry: false,
    queryFn: async () => {
      const { data, response } = await getEvent({ path: { eventId } })
      const res = response as Response | undefined
      if (res && res.status >= 400) throw new Error('event failed')
      if (!data) throw new Error('event failed')
      const e = data as any
      return {
        id: e.id,
        title: e.title,
        startDate: e.startDate,
        endDate: e.endDate ?? null,
        location: e.location ?? null,
        status: e.status,
        registrationFee: Number(e.registrationFee ?? 0),
        currency: e.currency ?? null,
        capacity: e.capacity ?? null,
      } satisfies OrgEventDetail
    },
  })
  return { event: q.data, isLoading: q.isLoading, isError: q.isError, refetch: () => void q.refetch() }
}

export type Attendee = {
  registrationId: string
  personId: string
  label: string
  memberNumber?: string | null
  status: string // DB enum: confirmed|waitlisted|cancelled|refunded|noShow (check-in is a separate table)
  paid: boolean
  checkedIn: boolean
}

export type AttendeeSummary = { total: number; paid: number; checkedIn: number; noShow: number }

// The engine caps these list endpoints at 100 (validator `.lte(100)` — a higher limit 400s).
const PAGE = 100

// Attendee list = registrations ⨝ check-ins ⨝ roster-name-map. The registration row carries no
// person name (only personId), so names come from the roster; non-roster guests fall back to a
// short id label.
export function useAttendees(orgId: string | null, eventId: string): {
  attendees: Attendee[]
  summary: AttendeeSummary
  total: number
  truncated: boolean
  isLoading: boolean
  isError: boolean
  refetch: () => void
} {
  const regs = useQuery({
    queryKey: ['event-registrations', eventId],
    enabled: !!eventId,
    retry: false,
    queryFn: async () => {
      const { data, response } = await listCustomEventRegistrations({ path: { eventId }, query: { limit: PAGE } })
      const res = response as Response | undefined
      if (res && res.status >= 400) throw new Error('registrations failed')
      if (!data) throw new Error('registrations failed')
      const rows = (data.data as any[]).map((r) => ({
        registrationId: r.id,
        personId: r.personId,
        status: r.status,
        // paidAt is the handler/table truth (set when a paid registration settles via the
        // PayMongo/Stripe webhook); amountPaid/paymentId are SDK-type fields not on the table —
        // kept as a defensive fallback.
        paid: r.paidAt != null || Number(r.amountPaid ?? 0) > 0 || r.paymentId != null,
      }))
      return { rows, total: Number((data as any).total ?? rows.length) }
    },
  })

  const checkins = useQuery({
    queryKey: ['event-checkins', eventId],
    enabled: !!eventId,
    retry: false,
    queryFn: async () => {
      const { data } = await searchCheckIns({ query: { eventId, limit: PAGE } })
      const set = new Set<string>()
      for (const c of (data?.data as any[]) ?? []) {
        if (c.personId) set.add(`p:${c.personId}`)
        if (c.registrationId) set.add(`r:${c.registrationId}`)
      }
      return set
    },
  })

  const roster = useQuery({
    queryKey: ['event-roster-names', orgId],
    enabled: !!orgId,
    retry: false,
    queryFn: async () => {
      const { data } = await listRosterMembers({ query: { organizationId: orgId!, pageSize: 100 } })
      const map = new Map<string, { name: string; memberNumber?: string | null }>()
      for (const m of ((data as any)?.data as any[]) ?? []) {
        const name = m.name || [m.firstName, m.lastName].filter(Boolean).join(' ')
        map.set(m.personId, { name: name || '(no name)', memberNumber: m.memberNumber ?? null })
      }
      return map
    },
  })

  const nameMap = roster.data ?? new Map()
  const checkinSet = checkins.data ?? new Set<string>()
  const attendees: Attendee[] = (regs.data?.rows ?? []).map((r) => {
    const m = nameMap.get(r.personId)
    return {
      registrationId: r.registrationId,
      personId: r.personId,
      label: m?.name ?? `Member ${r.personId.slice(0, 8)}`,
      memberNumber: m?.memberNumber ?? null,
      status: r.status,
      paid: r.paid,
      checkedIn: r.status === 'checked_in' || checkinSet.has(`p:${r.personId}`) || checkinSet.has(`r:${r.registrationId}`),
    }
  })

  // counts exclude cancelled/refunded from "total" (they're not attending)
  const active = attendees.filter((a) => a.status !== 'cancelled' && a.status !== 'refunded')
  const summary: AttendeeSummary = {
    total: active.length,
    paid: active.filter((a) => a.paid).length,
    checkedIn: active.filter((a) => a.checkedIn).length,
    noShow: attendees.filter((a) => a.status === 'noShow').length,
  }

  const total = regs.data?.total ?? attendees.length
  return {
    attendees,
    summary,
    total,
    truncated: total > attendees.length, // >100 attendees: rows 101+ aren't loaded — surface it
    isLoading: regs.isLoading || roster.isLoading,
    isError: regs.isError,
    refetch: () => { void regs.refetch(); void checkins.refetch() },
  }
}

// Server-side attendee counts (accurate beyond the 100-row registration page, and counts no-shows
// on the real DB status enum). The client-side tally in useAttendees is the load/error fallback.
export function useEventSummary(orgId: string | null, eventId: string): {
  summary?: AttendeeSummary
  isLoading: boolean
  isError: boolean
} {
  const q = useQuery({
    queryKey: ['event-summary', eventId],
    enabled: !!orgId && !!eventId,
    retry: false,
    queryFn: async () => {
      const { data, response } = await getEventRegistrationsSummary({ path: { eventId } })
      const res = response as Response | undefined
      if (res && res.status >= 400) throw new Error('summary failed')
      if (!data) throw new Error('summary failed')
      const d = data as any
      return {
        total: Number(d.totalAttending ?? 0),
        paid: Number(d.paid ?? 0),
        checkedIn: Number(d.checkedIn ?? 0),
        noShow: Number(d.noShow ?? 0),
      } satisfies AttendeeSummary
    },
  })
  return { summary: q.data, isLoading: q.isLoading, isError: q.isError }
}

function invalidate(qc: ReturnType<typeof useQueryClient>, eventId: string) {
  qc.invalidateQueries({ queryKey: ['event-registrations', eventId] })
  qc.invalidateQueries({ queryKey: ['event-checkins', eventId] })
  qc.invalidateQueries({ queryKey: ['event-summary', eventId] })
}

export function useCheckIn(eventId: string) {
  const qc = useQueryClient()
  return useMutation<unknown, Error, { personId: string; registrationId: string }>({
    mutationFn: async ({ personId, registrationId }) => {
      const { data, error, response } = await checkInCustomEvent({
        path: { eventId },
        body: { personId, registrationId, method: 'manual' },
      })
      if ((response as Response | undefined)?.status === 403) throw new Error('You are not allowed to check members in.')
      if (!data) throw new Error((error as any)?.error ?? 'Could not check in. Try again.')
      return data
    },
    onSuccess: () => invalidate(qc, eventId),
  })
}

// Walk-up cash collected at the door: officer marks a paid-event registration paid. The engine
// stamps paid_at idempotently (double-tap = one settlement); the cash trail is the audit event.
export function useMarkPaid(eventId: string) {
  const qc = useQueryClient()
  return useMutation<unknown, Error, { registrationId: string }>({
    mutationFn: async ({ registrationId }) => {
      const { data, error, response } = await markEventRegistrationPaid({ path: { registrationId } })
      if ((response as Response | undefined)?.status === 403) throw new Error('You are not allowed to record payments.')
      if (!data) throw new Error((error as any)?.error ?? 'Could not record the payment. Try again.')
      return data
    },
    onSuccess: () => invalidate(qc, eventId),
  })
}

export function useMarkNoShow(eventId: string) {
  const qc = useQueryClient()
  return useMutation<unknown, Error, { registrationId: string }>({
    mutationFn: async ({ registrationId }) => {
      const { data, error, response } = await updateEventRegistration({
        path: { registrationId },
        // The DB registration_status pgEnum value is 'noShow' (the SDK type's 'no_show' is drift —
        // sending it writes an invalid enum label → Postgres 500). updateEventRegistration's body
        // validator is open (z.record), so 'noShow' passes through correctly.
        body: { status: 'noShow' },
      })
      if ((response as Response | undefined)?.status === 403) throw new Error('You are not allowed to update registrations.')
      if (!data) throw new Error((error as any)?.error ?? 'Could not mark no-show. Try again.')
      return data
    },
    onSuccess: () => invalidate(qc, eventId),
  })
}
